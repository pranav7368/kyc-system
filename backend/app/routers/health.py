from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "CIPHER KYC Backend",
        "version": "1.0.0",
    }
