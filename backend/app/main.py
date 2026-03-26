"""
CIPHER KYC — FastAPI application entry point.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import create_tables
from app.middleware import RequestIDMiddleware, TimingMiddleware, LoggingMiddleware
from app.routers import health, kyc

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("kyc.main")


# ---------------------------------------------------------------------------
# Lifespan — startup & shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    logger.info("CIPHER KYC starting up…")

    # Create DB tables
    await create_tables()
    logger.info("Database tables ready.")

    # Create upload directory
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info(f"Upload directory: {settings.UPLOAD_DIR}")

    # Pre-warm ML models (so first request is fast)
    try:
        logger.info("Pre-warming OCR model…")
        from app.services.ocr_service import get_reader
        get_reader()
        logger.info("OCR model ready.")
    except Exception as exc:
        logger.warning(f"OCR pre-warm skipped: {exc}")

    try:
        logger.info("Pre-warming Face model…")
        from app.services.face_service import get_face_app
        get_face_app()
        logger.info("Face model ready.")
    except Exception as exc:
        logger.warning(f"Face pre-warm skipped: {exc}")

    try:
        logger.info("Pre-warming liveness detector…")
        from app.services.liveness_service import _get_detector
        _get_detector()
        logger.info("Liveness detector ready.")
    except Exception as exc:
        logger.warning(f"Liveness pre-warm skipped: {exc}")

    logger.info("All models loaded. CIPHER KYC is ready!")
    yield

    # --- SHUTDOWN ---
    logger.info("CIPHER KYC shutting down.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CIPHER KYC",
    description=(
        "Autonomous Identity Verification System — AI-powered KYC in under 3 seconds. "
        "Supports Aadhaar, PAN, Passport, and Driving Licence."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware (order matters — outermost = first to run on request)
app.add_middleware(LoggingMiddleware)
app.add_middleware(TimingMiddleware)
app.add_middleware(RequestIDMiddleware)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "An unexpected error occurred. Please try again.",
        },
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(kyc.router)


@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": "CIPHER KYC",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
