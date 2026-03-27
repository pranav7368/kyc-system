"""
Admin Router — /api/admin/* endpoints.
Review queue, approve/reject verifications, user management.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.database import get_db, KYCVerification, User
from app.auth import require_admin
from app.routers.kyc import _iso

logger = logging.getLogger("kyc.admin")
router = APIRouter(prefix="/api/admin", tags=["admin"])


class ReviewRequest(BaseModel):
    decision: str          # "APPROVED" | "REJECTED"
    notes: str = ""


# ---------------------------------------------------------------------------
# GET /api/admin/review-queue — all verifications needing manual review
# ---------------------------------------------------------------------------
@router.get("/review-queue")
async def review_queue(
    page:   int = Query(default=1, ge=1),
    limit:  int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),  # "pending" | "done"
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    offset = (page - 1) * limit

    q = select(KYCVerification).where(KYCVerification.decision == "REVIEW")

    if status == "pending":
        q = q.where(KYCVerification.reviewed_at.is_(None))
    elif status == "done":
        q = q.where(KYCVerification.reviewed_at.isnot(None))

    total_q = select(func.count()).select_from(KYCVerification).where(KYCVerification.decision == "REVIEW")
    total   = (await db.execute(total_q)).scalar() or 0

    q = q.order_by(desc(KYCVerification.created_at)).offset(offset).limit(limit)
    records = (await db.execute(q)).scalars().all()

    items = [_review_item(r) for r in records]

    return {
        "items": items,
        "total_count": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, -(-total // limit)),
        "pending_count": await _count_pending(db),
    }


# ---------------------------------------------------------------------------
# POST /api/admin/review/{id} — submit admin decision
# ---------------------------------------------------------------------------
@router.post("/review/{verification_id}")
async def submit_review(
    verification_id: str,
    body: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if body.decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(400, "Decision must be APPROVED or REJECTED")

    q = select(KYCVerification).where(KYCVerification.id == verification_id)
    record = (await db.execute(q)).scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Verification not found")

    record.admin_decision = body.decision
    record.review_notes   = body.notes.strip() or None
    record.reviewed_by    = admin.id
    record.reviewed_at    = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(record)

    logger.info(f"Admin {admin.username} reviewed {verification_id}: {body.decision}")
    return {
        "message": "Review submitted",
        "verification_id": verification_id,
        "admin_decision": record.admin_decision,
        "reviewed_at": _iso(record.reviewed_at),
    }


# ---------------------------------------------------------------------------
# GET /api/admin/stats
# ---------------------------------------------------------------------------
@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    total        = (await db.execute(select(func.count()).select_from(KYCVerification))).scalar() or 0
    pending_rev  = await _count_pending(db)
    done_rev     = (await db.execute(
        select(func.count()).select_from(KYCVerification).where(
            KYCVerification.decision == "REVIEW",
            KYCVerification.reviewed_at.isnot(None),
        )
    )).scalar() or 0

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0

    return {
        "total_verifications": total,
        "pending_review": pending_rev,
        "completed_review": done_rev,
        "total_users": total_users,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _count_pending(db: AsyncSession) -> int:
    q = select(func.count()).select_from(KYCVerification).where(
        KYCVerification.decision == "REVIEW",
        KYCVerification.reviewed_at.is_(None),
    )
    return (await db.execute(q)).scalar() or 0


def _review_item(r: KYCVerification) -> dict:
    # Extract pattern validation warnings from stored OCR data
    pattern_warnings = []
    pattern_valid = True
    extracted_fields = {}
    if r.extracted_data and isinstance(r.extracted_data, dict):
        pv = r.extracted_data.get("pattern_validation", {})
        pattern_warnings = pv.get("warnings", [])
        pattern_valid    = pv.get("valid", True)
        raw_fields = r.extracted_data.get("fields", {})
        # Flatten for easy display
        extracted_fields = {k: v.get("value") for k, v in raw_fields.items() if isinstance(v, dict) and v.get("value")}

    return {
        "id": r.id,
        "created_at": _iso(r.created_at),
        "document_type": r.document_type,
        "face_similarity": r.face_similarity,
        "liveness_score": r.liveness_score,
        "fraud_score": r.fraud_score,
        "risk_score": r.risk_score,
        "decision_reasons": r.decision_reasons,
        "reviewed": r.reviewed_at is not None,
        "admin_decision": r.admin_decision,
        "reviewed_at": _iso(r.reviewed_at),
        "review_notes": r.review_notes,
        "has_document_image": r.document_image_path is not None,
        "has_selfie_image": r.selfie_image_path is not None,
        "has_back_image": r.document_back_image_path is not None,
        "user_id": r.user_id,
        "pattern_valid": pattern_valid,
        "pattern_warnings": pattern_warnings,
        "extracted_fields": extracted_fields,
    }
