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
from app.services.llm_ocr_service import extract_with_gemini, merge_gemini_with_easyocr, merge_back_side
from app.services.pattern_validator import validate as validate_patterns


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


async def run_verification(doc_image_path: str, selfie_image_path: str, doc_back_image_path: str = None, liveness_challenge_passed: bool = False) -> dict:
    """
    Execute all 4 ML services concurrently using asyncio.gather + to_thread,
    then compute the risk score synchronously (it's fast).

    Returns a complete result dict matching VerificationResult schema.
    """
    start = time.perf_counter()
    logger.info(f"Starting verification pipeline | doc={doc_image_path} | selfie={selfie_image_path} | back={doc_back_image_path}")

    # -----------------------------------------------------------------------
    # Parallel execution — OCR (EasyOCR + Gemini), face, liveness, fraud
    # -----------------------------------------------------------------------
    async def _ocr_combined():
        # Run EasyOCR in thread + Gemini async simultaneously
        easyocr_task = asyncio.to_thread(ocr_service.extract, doc_image_path)
        gemini_task  = extract_with_gemini(doc_image_path)

        async def _noop():
            return None

        gemini_back_task = (
            extract_with_gemini(doc_back_image_path, is_back=True)
            if doc_back_image_path else _noop()
        )

        easyocr_result, gemini_result, gemini_back = await asyncio.gather(
            easyocr_task, gemini_task, gemini_back_task,
            return_exceptions=True,
        )

        if isinstance(easyocr_result, Exception):
            logger.error(f"EasyOCR failed: {easyocr_result}")
            easyocr_result = {"document_type": "unknown", "fields": {}, "overall_confidence": 0.0,
                              "raw_text": "", "preprocessing_applied": [], "qr_data": None, "qr_verified": False}
        if isinstance(gemini_result, Exception):
            gemini_result = None
        if isinstance(gemini_back, Exception):
            gemini_back = None

        merged = merge_gemini_with_easyocr(gemini_result, easyocr_result)
        if gemini_back:
            merged = merge_back_side(merged, gemini_back)
        return merged

    ocr_task      = _ocr_combined()
    face_task     = asyncio.to_thread(face_service.compare,     doc_image_path, selfie_image_path)
    liveness_task = asyncio.to_thread(liveness_service.check,   selfie_image_path, liveness_challenge_passed)
    fraud_task    = asyncio.to_thread(fraud_service.analyze,    doc_image_path)

    # return_exceptions=True: wait for ALL tasks before raising, so temp files
    # are not deleted by the finally block while other threads are still running.
    results = await asyncio.gather(
        ocr_task, face_task, liveness_task, fraud_task,
        return_exceptions=True,
    )
    for r in results:
        if isinstance(r, Exception):
            logger.error(f"Pipeline service error: {r}", exc_info=r)
            raise r
    ocr_result, face_result, liveness_result, fraud_result = results

    # -----------------------------------------------------------------------
    # Pattern validation (sync, fast)
    # -----------------------------------------------------------------------
    pattern_result = validate_patterns(
        ocr_result.get("document_type", "unknown"),
        ocr_result.get("fields", {}),
    )
    # Attach to OCR result so it flows through to DB/response
    ocr_result["pattern_validation"] = pattern_result

    # Add pattern warnings to fraud flags if patterns invalid
    if not pattern_result["valid"]:
        existing_flags = fraud_result.get("flags", [])
        for w in pattern_result["warnings"]:
            existing_flags.append(f"Pattern: {w}")
        fraud_result["flags"] = existing_flags
        # Slight fraud score bump for invalid patterns
        fraud_result["fraud_score"] = min(1.0, fraud_result.get("fraud_score", 0.0) + 0.10)

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
