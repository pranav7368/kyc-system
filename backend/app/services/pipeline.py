"""
Pipeline Orchestrator — runs OCR, face, liveness, fraud IN PARALLEL,
then feeds results into the risk engine.
"""
import asyncio
import time
import logging
from typing import Any

import numpy as np

from app.services import ocr_service, face_service, liveness_service, fraud_service, risk_engine


def _to_python(obj: Any) -> Any:
    """Recursively convert numpy scalars to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _to_python(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_python(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

logger = logging.getLogger("kyc.pipeline")


async def run_verification(doc_image_path: str, selfie_image_path: str) -> dict:
    """
    Execute all 4 ML services concurrently using asyncio.gather + to_thread,
    then compute the risk score synchronously (it's fast).

    Returns a complete result dict matching VerificationResult schema.
    """
    start = time.perf_counter()
    logger.info(f"Starting verification pipeline | doc={doc_image_path} | selfie={selfie_image_path}")

    # -----------------------------------------------------------------------
    # Parallel execution of the 4 heavy services
    # -----------------------------------------------------------------------
    ocr_task      = asyncio.to_thread(ocr_service.extract,      doc_image_path)
    face_task     = asyncio.to_thread(face_service.compare,     doc_image_path, selfie_image_path)
    liveness_task = asyncio.to_thread(liveness_service.check,   selfie_image_path)
    fraud_task    = asyncio.to_thread(fraud_service.analyze,    doc_image_path)

    try:
        ocr_result, face_result, liveness_result, fraud_result = await asyncio.gather(
            ocr_task, face_task, liveness_task, fraud_task,
            return_exceptions=False,
        )
    except Exception as exc:
        logger.error(f"Pipeline service error: {exc}", exc_info=True)
        raise

    # -----------------------------------------------------------------------
    # Risk scoring (synchronous — microseconds)
    # -----------------------------------------------------------------------
    risk_result = risk_engine.calculate(
        ocr=ocr_result,
        face=face_result,
        liveness=liveness_result,
        fraud=fraud_result,
    )

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    logger.info(
        f"Pipeline complete in {elapsed_ms}ms | "
        f"decision={risk_result['decision']} | "
        f"risk={risk_result['risk_score']}"
    )

    return _to_python({
        "ocr":              ocr_result,
        "face":             face_result,
        "liveness":         liveness_result,
        "fraud":            fraud_result,
        "risk":             risk_result,
        "processing_time_ms": elapsed_ms,
    })
