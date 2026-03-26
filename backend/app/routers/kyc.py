"""
KYC Router — all /api/kyc/* endpoints.
"""
import os
import uuid
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta


def _iso(dt: datetime) -> str:
    """Return ISO-8601 string always with UTC offset so browsers parse correctly."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case

from app.config import settings
from app.database import get_db, KYCVerification
from app.services import pipeline

logger = logging.getLogger("kyc.router")

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXTS  = {".jpg", ".jpeg", ".png", ".webp"}

router = APIRouter(prefix="/api/kyc", tags=["kyc"])


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
    id_document: UploadFile = File(..., description="Government-issued ID image"),
    selfie:      UploadFile = File(..., description="Live selfie of the applicant"),
    db: AsyncSession = Depends(get_db),
):
    _validate_file(id_document, "id_document")
    _validate_file(selfie, "selfie")

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    doc_path    = upload_dir / f"{uuid.uuid4()}{Path(id_document.filename or '.jpg').suffix}"
    selfie_path = upload_dir / f"{uuid.uuid4()}{Path(selfie.filename or '.jpg').suffix}"

    try:
        doc_hash    = await _save_upload(id_document, doc_path)
        selfie_hash = await _save_upload(selfie, selfie_path)

        result = await pipeline.run_verification(str(doc_path), str(selfie_path))

        ocr     = result["ocr"]
        face    = result["face"]
        live    = result["liveness"]
        fraud   = result["fraud"]
        risk    = result["risk"]

        record = KYCVerification(
            id=str(uuid.uuid4()),
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
        )

        db.add(record)
        await db.commit()
        await db.refresh(record)

        return {
            "id": record.id,
            "created_at": _iso(record.created_at),
            **result,
        }

    finally:
        # Clean up temp files
        for p in [doc_path, selfie_path]:
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# GET /api/kyc/history
# ---------------------------------------------------------------------------

@router.get("/history")
async def history(
    page:  int = Query(default=1,  ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit

    count_q  = select(func.count()).select_from(KYCVerification)
    count_r  = await db.execute(count_q)
    total    = count_r.scalar() or 0

    items_q  = (
        select(KYCVerification)
        .order_by(desc(KYCVerification.created_at))
        .offset(offset)
        .limit(limit)
    )
    items_r  = await db.execute(items_q)
    records  = items_r.scalars().all()

    items = [
        {
            "id": r.id,
            "created_at": _iso(r.created_at),
            "document_type": r.document_type,
            "face_similarity": r.face_similarity,
            "risk_score": r.risk_score,
            "decision": r.decision,
            "processing_time_ms": r.processing_time_ms,
        }
        for r in records
    ]

    return {
        "items": items,
        "total_count": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, -(-total // limit)),  # ceiling division
    }


# ---------------------------------------------------------------------------
# GET /api/kyc/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    now   = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    hour_start = now.replace(minute=0, second=0, microsecond=0)

    # Aggregates
    agg_q = select(
        func.count().label("total"),
        func.sum(case((KYCVerification.decision == "APPROVED", 1), else_=0)).label("approved"),
        func.sum(case((KYCVerification.decision == "REVIEW",   1), else_=0)).label("review"),
        func.sum(case((KYCVerification.decision == "REJECTED", 1), else_=0)).label("rejected"),
        func.avg(KYCVerification.processing_time_ms).label("avg_time"),
        func.avg(KYCVerification.face_similarity).label("avg_face"),
        func.avg(KYCVerification.risk_score).label("avg_risk"),
    )
    agg_r = await db.execute(agg_q)
    row   = agg_r.fetchone()

    # Today & this hour
    today_q = select(func.count()).where(KYCVerification.created_at >= today)
    hour_q  = select(func.count()).where(KYCVerification.created_at >= hour_start)
    today_count = (await db.execute(today_q)).scalar() or 0
    hour_count  = (await db.execute(hour_q)).scalar()  or 0

    # Hourly distribution last 24h
    hourly = []
    for i in range(24):
        h_start = now - timedelta(hours=24 - i)
        h_end   = now - timedelta(hours=23 - i)
        hq = select(func.count()).where(
            KYCVerification.created_at >= h_start,
            KYCVerification.created_at < h_end,
        )
        cnt = (await db.execute(hq)).scalar() or 0
        hourly.append({"hour": h_start.strftime("%H:00"), "count": cnt})

    def _safe(v, default=0):
        return default if v is None else v

    return {
        "total_verifications":    int(_safe(row.total)),
        "approved_count":         int(_safe(row.approved)),
        "review_count":           int(_safe(row.review)),
        "rejected_count":         int(_safe(row.rejected)),
        "avg_processing_time_ms": round(float(_safe(row.avg_time, 0.0)), 1),
        "avg_face_similarity":    round(float(_safe(row.avg_face, 0.0)), 3),
        "avg_risk_score":         round(float(_safe(row.avg_risk, 0.0)), 1),
        "verifications_today":    today_count,
        "verifications_this_hour": hour_count,
        "hourly_distribution":    hourly,
    }


# ---------------------------------------------------------------------------
# GET /api/kyc/{id}
# ---------------------------------------------------------------------------

@router.get("/{verification_id}")
async def get_verification(
    verification_id: str,
    db: AsyncSession = Depends(get_db),
):
    q = select(KYCVerification).where(KYCVerification.id == verification_id)
    r = await db.execute(q)
    record = r.scalar_one_or_none()

    if not record:
        raise HTTPException(404, "Verification not found")

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
        "decision": record.decision,
        "decision_reasons": record.decision_reasons,
        "processing_time_ms": record.processing_time_ms,
    }
