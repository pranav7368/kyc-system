"""
KYC Router — all /api/kyc/* endpoints.
"""
import os
import uuid
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case

import json
from app.config import settings
from app.database import get_db, KYCVerification, User
from app.auth import get_current_user, get_current_user_optional, require_admin, decode_token
from app.services import pipeline
from app.services.storage_service import save_document_image, save_selfie_image, get_image_path
from app.services.form_matcher import match as match_form

logger = logging.getLogger("kyc.router")

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXTS  = {".jpg", ".jpeg", ".png", ".webp"}

router = APIRouter(prefix="/api/kyc", tags=["kyc"])

# Document types that require both sides for complete data extraction
# Aadhaar (physical card): address is on the back
# Driving Licence (smart card): address is on the back
# Voter ID (EPIC): residential details on the back
NEEDS_BACK_SIDE = {"aadhaar", "driving_license", "voter_id"}


@router.get("/doc-requirements")
async def doc_requirements():
    """Return which document types need both sides captured."""
    return {
        "needs_back_side": list(NEEDS_BACK_SIDE),
        "supported_types": ["aadhaar", "pan", "passport", "driving_license", "voter_id"],
        "back_side_message": {
            "aadhaar":         "Aadhaar physical card has the full address printed on the back. Upload the back for complete address extraction.",
            "driving_license": "Driving Licence (smart card) has address and vehicle classes on the back. Upload both sides.",
            "voter_id":        "Voter ID (EPIC card) has residential address details on the back. Upload both sides.",
        },
        "front_only_ok": {
            "aadhaar":         "If you have an e-Aadhaar printout or mAadhaar, the front side has all details.",
            "driving_license": "Upload back side to include address and vehicle class information.",
            "voter_id":        "Upload back side to include residential address.",
        },
    }


def _iso(dt: datetime) -> str:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _validate_file(file: UploadFile, label: str):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTS and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"{label}: unsupported file type (use JPG/PNG/WebP)")


async def _save_upload(file: UploadFile, dest: Path) -> str:
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(413, f"File too large (max {settings.MAX_FILE_SIZE // 1_048_576}MB)")
    dest.write_bytes(content)
    return hashlib.sha256(content).hexdigest()


# ---------------------------------------------------------------------------
# POST /api/kyc/verify
# ---------------------------------------------------------------------------
@router.post("/verify")
async def verify(
    id_document: UploadFile = File(..., description="Government-issued ID (front)"),
    selfie:      UploadFile = File(..., description="Live selfie of the applicant"),
    id_document_back: Optional[UploadFile] = File(default=None, description="ID back side (optional)"),
    challenge_completed: Optional[str] = Form(default=None),   # "true" if active liveness passed
    user_form_data: Optional[str] = Form(default=None),         # JSON of user-submitted form fields
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    _validate_file(id_document, "id_document")
    _validate_file(selfie, "selfie")
    if id_document_back:
        _validate_file(id_document_back, "id_document_back")

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    doc_path    = upload_dir / f"{uuid.uuid4()}{Path(id_document.filename or '.jpg').suffix}"
    selfie_path = upload_dir / f"{uuid.uuid4()}{Path(selfie.filename or '.jpg').suffix}"
    back_path   = None
    if id_document_back:
        back_path = upload_dir / f"{uuid.uuid4()}{Path(id_document_back.filename or '.jpg').suffix}"

    verification_id = str(uuid.uuid4())

    try:
        doc_hash    = await _save_upload(id_document, doc_path)
        selfie_hash = await _save_upload(selfie, selfie_path)
        back_hash   = None
        if back_path and id_document_back:
            back_hash = await _save_upload(id_document_back, back_path)

        liveness_challenge_passed = (challenge_completed or "").lower() == "true"
        result = await pipeline.run_verification(
            str(doc_path),
            str(selfie_path),
            str(back_path) if back_path else None,
            liveness_challenge_passed=liveness_challenge_passed,
        )

        ocr   = result["ocr"]
        face  = result["face"]
        live  = result["liveness"]
        fraud = result["fraud"]
        risk  = result["risk"]

        # Run form matching if user submitted form data
        form_data_parsed = None
        form_match_result = None
        if user_form_data:
            try:
                form_data_parsed = json.loads(user_form_data)
                ocr_fields = result.get("ocr", {}).get("fields", {})
                form_match_result = match_form(form_data_parsed, ocr_fields)
                # If significant mismatch, increase risk
                if form_match_result and not form_match_result.get("overall_match"):
                    result["risk"]["risk_score"] = min(100, result["risk"]["risk_score"] + 8)
                    result["risk"]["decision_reasons"].append(
                        f"User form data does not match extracted ID fields (score: {form_match_result.get('match_score', 0):.0%})"
                    )
            except (json.JSONDecodeError, Exception) as e:
                logger.warning(f"Form matching failed: {e}")

        # Save images to permanent storage
        doc_storage_path     = save_document_image(verification_id, str(doc_path))
        selfie_storage_path  = save_selfie_image(verification_id, str(selfie_path))
        back_storage_path    = None
        if back_path and back_path.exists():
            back_storage_path = save_document_image(verification_id, str(back_path), suffix="_back")

        record = KYCVerification(
            id=verification_id,
            user_id=current_user.id if current_user else None,
            document_type=ocr.get("document_type"),
            extracted_data=ocr,
            face_similarity=face.get("similarity"),
            face_quality_score=face.get("selfie_face_quality", {}).get("blur"),
            liveness_score=live.get("liveness_score"),
            fraud_score=fraud.get("fraud_score"),
            fraud_flags=fraud.get("flags", []),
            risk_score=risk.get("risk_score"),
            risk_breakdown=risk.get("breakdown"),
            decision=risk.get("decision"),
            decision_reasons=risk.get("decision_reasons", []),
            processing_time_ms=result["processing_time_ms"],
            document_image_hash=doc_hash,
            selfie_image_hash=selfie_hash,
            document_image_path=doc_storage_path,
            document_back_image_path=back_storage_path,
            selfie_image_path=selfie_storage_path,
            user_form_data=form_data_parsed,
            form_match_result=form_match_result,
        )

        db.add(record)
        await db.commit()
        await db.refresh(record)

        return {
            "id": record.id,
            "created_at": _iso(record.created_at),
            "has_back_image": back_storage_path is not None,
            "form_match": form_match_result,
            **result,
        }

    finally:
        for p in [doc_path, selfie_path, back_path]:
            if p:
                try:
                    p.unlink(missing_ok=True)
                except Exception:
                    pass


# ---------------------------------------------------------------------------
# GET /api/kyc/{id}/images/{image_type}  — serve stored images
# ---------------------------------------------------------------------------
@router.get("/{verification_id}/images/{image_type}")
async def get_image(
    verification_id: str,
    image_type: str,   # "document" | "document_back" | "selfie"
    token: Optional[str] = Query(default=None),  # fallback for <img> tags (can't send headers)
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    # <img> tags cannot set Authorization headers — accept ?token= as fallback
    if current_user is None and token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                r = await db.execute(select(User).where(User.id == user_id))
                u = r.scalar_one_or_none()
                if u and u.is_active:
                    current_user = u
        except Exception:
            pass

    if current_user is None:
        raise HTTPException(401, "Authentication required to view images")

    q = select(KYCVerification).where(KYCVerification.id == verification_id)
    r = await db.execute(q)
    record = r.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Verification not found")

    # Users can only view their own; admins can view all
    if current_user.role != "admin" and record.user_id != current_user.id:
        raise HTTPException(403, "Not authorized to view this verification")

    path_map = {
        "document":      record.document_image_path,
        "document_back": record.document_back_image_path,
        "selfie":        record.selfie_image_path,
    }
    rel_path = path_map.get(image_type)
    if not rel_path:
        raise HTTPException(404, f"Image '{image_type}' not available")

    abs_path = get_image_path(rel_path)
    if not abs_path.exists():
        raise HTTPException(404, "Image file not found on disk")

    return FileResponse(str(abs_path), media_type="image/jpeg")


# ---------------------------------------------------------------------------
# GET /api/kyc/history
# ---------------------------------------------------------------------------
@router.get("/history")
async def history(
    page:  int = Query(default=1,  ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offset = (page - 1) * limit

    # Admins see all; regular users see only their own
    base_filter = [] if current_user.role == "admin" else [KYCVerification.user_id == current_user.id]

    count_q = select(func.count()).select_from(KYCVerification)
    if base_filter:
        count_q = count_q.where(*base_filter)
    total = (await db.execute(count_q)).scalar() or 0

    items_q = select(KYCVerification).order_by(desc(KYCVerification.created_at)).offset(offset).limit(limit)
    if base_filter:
        items_q = items_q.where(*base_filter)
    records = (await db.execute(items_q)).scalars().all()

    items = [
        {
            "id": r.id,
            "created_at": _iso(r.created_at),
            "document_type": r.document_type,
            "face_similarity": r.face_similarity,
            "risk_score": r.risk_score,
            "decision": r.admin_decision or r.decision,
            "processing_time_ms": r.processing_time_ms,
            "reviewed": r.reviewed_at is not None,
        }
        for r in records
    ]

    return {
        "items": items,
        "total_count": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, -(-total // limit)),
    }


# ---------------------------------------------------------------------------
# GET /api/kyc/stats
# ---------------------------------------------------------------------------
@router.get("/stats")
async def stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now        = datetime.now(timezone.utc)
    today      = now.replace(hour=0, minute=0, second=0, microsecond=0)
    hour_start = now.replace(minute=0, second=0, microsecond=0)

    agg_q = select(
        func.count().label("total"),
        func.sum(case((KYCVerification.decision == "APPROVED", 1), else_=0)).label("approved"),
        func.sum(case((KYCVerification.decision == "REVIEW",   1), else_=0)).label("review"),
        func.sum(case((KYCVerification.decision == "REJECTED", 1), else_=0)).label("rejected"),
        func.avg(KYCVerification.processing_time_ms).label("avg_time"),
        func.avg(KYCVerification.face_similarity).label("avg_face"),
        func.avg(KYCVerification.risk_score).label("avg_risk"),
    )
    row = (await db.execute(agg_q)).fetchone()

    today_count = (await db.execute(select(func.count()).where(KYCVerification.created_at >= today))).scalar() or 0
    hour_count  = (await db.execute(select(func.count()).where(KYCVerification.created_at >= hour_start))).scalar() or 0

    hourly = []
    for i in range(24):
        h_start = now - timedelta(hours=24 - i)
        h_end   = now - timedelta(hours=23 - i)
        cnt = (await db.execute(
            select(func.count()).where(
                KYCVerification.created_at >= h_start,
                KYCVerification.created_at < h_end,
            )
        )).scalar() or 0
        hourly.append({"hour": h_start.strftime("%H:00"), "count": cnt})

    def _s(v, d=0):
        return d if v is None else v

    return {
        "total_verifications":     int(_s(row.total)),
        "approved_count":          int(_s(row.approved)),
        "review_count":            int(_s(row.review)),
        "rejected_count":          int(_s(row.rejected)),
        "avg_processing_time_ms":  round(float(_s(row.avg_time, 0.0)), 1),
        "avg_face_similarity":     round(float(_s(row.avg_face, 0.0)), 3),
        "avg_risk_score":          round(float(_s(row.avg_risk, 0.0)), 1),
        "verifications_today":     today_count,
        "verifications_this_hour": hour_count,
        "hourly_distribution":     hourly,
    }


# ---------------------------------------------------------------------------
# GET /api/kyc/{id}
# ---------------------------------------------------------------------------
@router.get("/{verification_id}")
async def get_verification(
    verification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(KYCVerification).where(KYCVerification.id == verification_id)
    record = (await db.execute(q)).scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Verification not found")

    if current_user.role != "admin" and record.user_id != current_user.id:
        raise HTTPException(403, "Not authorized")

    return {
        "id": record.id,
        "created_at": _iso(record.created_at),
        "document_type": record.document_type,
        "extracted_data": record.extracted_data,
        "face_similarity": record.face_similarity,
        "face_quality_score": record.face_quality_score,
        "liveness_score": record.liveness_score,
        "fraud_score": record.fraud_score,
        "fraud_flags": record.fraud_flags,
        "risk_score": record.risk_score,
        "risk_breakdown": record.risk_breakdown,
        "decision": record.admin_decision or record.decision,
        "original_decision": record.decision,
        "decision_reasons": record.decision_reasons,
        "processing_time_ms": record.processing_time_ms,
        "reviewed_at": _iso(record.reviewed_at),
        "review_notes": record.review_notes,
        "admin_decision": record.admin_decision,
        "has_document_image": record.document_image_path is not None,
        "has_selfie_image": record.selfie_image_path is not None,
        "has_back_image": record.document_back_image_path is not None,
        "user_form_data": record.user_form_data,
        "form_match_result": record.form_match_result,
    }
