"""
LLM OCR Service — document text extraction via Google Gemini Flash.

Uses the new google-genai SDK (v1.x) — same package the team's JS @google/generative-ai
maps to in Python. Model: gemini-2.0-flash (production alias: gemini-flash-latest).

Falls back to EasyOCR if Gemini is unavailable or fails.
"""
import io
import json
import base64
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger("kyc.llm_ocr")

EXTRACTION_PROMPT = """You are an expert OCR system for Indian government identity documents.

Analyse this ID document image and extract ALL visible text fields.

Return a JSON object with EXACTLY this structure (use null for fields not found):
{
  "document_type": "<aadhaar|pan|passport|driving_license|voter_id|unknown>",
  "document_number": "<the main ID number>",
  "name": "<full name on document>",
  "dob": "<date of birth in DD/MM/YYYY format>",
  "gender": "<Male|Female|Other|null>",
  "address": "<full address if present>",
  "pincode": "<6-digit PIN code if present>",
  "father_name": "<father or guardian name if present>",
  "issue_date": "<date of issue if present>",
  "expiry_date": "<expiry date if present>",
  "nationality": "<nationality if present>",
  "mrz_line1": "<first MRZ line for passport>",
  "mrz_line2": "<second MRZ line for passport>",
  "state": "<state if present>",
  "district": "<district if present>",
  "confidence": <overall confidence 0.0 to 1.0>,
  "raw_text": "<all visible text concatenated>",
  "is_back_side": <true if this is the back of a document>
}

Rules:
- For Aadhaar: number is 12 digits in format XXXX XXXX XXXX
- For PAN: number is 10 chars AAAAA9999A format
- For Passport: number is letter + 7 digits
- For DL: include state code + number
- Extract exactly what is written, do not guess missing fields
- If document is blurry or unreadable, set confidence below 0.4
- Return ONLY valid JSON, no markdown, no explanation
"""

BACK_SIDE_PROMPT = """You are an expert OCR system for Indian government identity documents.

This is the BACK SIDE of an identity document. Extract all visible fields.

Return JSON with this structure (use null for missing fields):
{
  "document_type": "<aadhaar|pan|passport|driving_license|voter_id|unknown>",
  "address": "<full address if present>",
  "pincode": "<6-digit PIN code if present>",
  "vehicle_classes": "<for driving licence — vehicle categories>",
  "validity": "<validity period if present>",
  "blood_group": "<blood group if present>",
  "emergency_contact": "<emergency contact if present>",
  "additional_fields": {},
  "raw_text": "<all visible text>"
}

Return ONLY valid JSON.
"""


def _clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _image_to_jpeg_bytes(image_path: str, max_dim: int = 1600) -> bytes:
    """Load image with EXIF correction, downscale if needed, return JPEG bytes.

    Gemini OCR doesn't benefit from images wider than ~1600 px, and oversized
    images (4K+ from phone cameras) cause 'Server disconnected' errors on slow
    WiFi because the upload takes too long before the connection is reset.
    """
    from PIL import Image, ImageOps
    img = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
    w, h = img.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        logger.debug(f"Resized {w}×{h} → {img.size[0]}×{img.size[1]} for Gemini upload")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _call_gemini_sync(api_key: str, image_path: str, prompt: str) -> str:
    """
    Synchronous Gemini call using the new google-genai SDK (v1.x).
    Run via asyncio.to_thread to avoid blocking the event loop.
    Retries once on transient network disconnects before giving up.
    """
    import time
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    img_bytes = _image_to_jpeg_bytes(image_path)
    logger.debug(f"Gemini upload size: {len(img_bytes) / 1024:.0f} KB")
    image_part = types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")

    _NETWORK_ERRS = ("disconnected", "connection", "reset", "timeout", "eof", "broken pipe")

    # Try models in priority order — same as team's gemini-flash-latest alias
    for model_name in ("gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"):
        for attempt in range(2):  # retry once on transient network errors
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt, image_part],
                )
                logger.info(f"Gemini model used: {model_name}")
                return response.text
            except Exception as e:
                err = str(e).lower()
                if "429" in err or "resource_exhausted" in err:
                    logger.warning(f"Gemini quota exhausted for {model_name}, trying next model")
                    break  # try next model, no retry
                if attempt == 0 and any(k in err for k in _NETWORK_ERRS):
                    logger.warning(f"Gemini network error ({model_name}), retrying in 2s: {e}")
                    time.sleep(2)
                    continue  # retry same model once
                raise  # non-retryable error bubbles up
    raise RuntimeError("All Gemini models quota exhausted — enable billing at aistudio.google.com or wait for daily reset")


async def extract_with_gemini(
    image_path: str,
    is_back: bool = False,
    api_key: Optional[str] = None,
) -> Optional[dict]:
    """
    Send document image to Gemini Flash and return structured fields dict.
    Returns None on failure — pipeline falls back to EasyOCR only.
    """
    if not api_key:
        from app.config import settings
        api_key = settings.GEMINI_API_KEY

    if not api_key or api_key in ("", "your-gemini-api-key-here"):
        logger.debug("Gemini API key not set — skipping LLM OCR")
        return None

    logger.info(f"Gemini OCR → {Path(image_path).name} | back={is_back}")

    import asyncio
    prompt = BACK_SIDE_PROMPT if is_back else EXTRACTION_PROMPT

    try:
        raw_text = await asyncio.to_thread(_call_gemini_sync, api_key, image_path, prompt)
        raw = _clean_json_response(raw_text)
        data = json.loads(raw)
        extracted = [k for k, v in data.items() if v and k not in ("raw_text", "is_back_side", "confidence")]
        logger.info(
            f"Gemini OCR success | doc_type={data.get('document_type')} "
            f"| confidence={data.get('confidence')} | extracted={extracted}"
        )
        return data

    except json.JSONDecodeError as e:
        logger.warning(f"Gemini returned non-JSON: {e}")
        return None
    except Exception as e:
        logger.warning(f"Gemini OCR failed: {e}")
        return None


def merge_gemini_with_easyocr(gemini_result: dict, easyocr_result: dict) -> dict:
    if not gemini_result:
        return easyocr_result

    fields = dict(easyocr_result.get("fields", {}))
    field_map = {
        "document_number": "document_number",
        "name":            "name",
        "dob":             "dob",
        "gender":          "gender",
        "address":         "address",
        "pincode":         "pincode",
        "father_name":     "father_name",
        "issue_date":      "issue_date",
        "expiry_date":     "expiry_date",
        "nationality":     "nationality",
        "mrz_line1":       "mrz_line1",
        "mrz_line2":       "mrz_line2",
        "state":           "state",
        "district":        "district",
        "vehicle_classes": "vehicle_classes",
        "blood_group":     "blood_group",
    }

    gemini_confidence = float(gemini_result.get("confidence", 0.85))
    for gk, fk in field_map.items():
        val = gemini_result.get(gk)
        if val and str(val).strip() and str(val).lower() != "null":
            fields[fk] = {"value": str(val).strip(), "confidence": gemini_confidence}

    doc_type     = gemini_result.get("document_type") or easyocr_result.get("document_type", "unknown")
    gemini_raw   = gemini_result.get("raw_text", "")
    easyocr_raw  = easyocr_result.get("raw_text", "")
    combined_raw = (gemini_raw + "\n" + easyocr_raw).strip()[:3000]

    return {
        **easyocr_result,
        "document_type":         doc_type,
        "fields":                fields,
        "overall_confidence":    gemini_confidence,
        "raw_text":              combined_raw,
        "llm_extracted":         True,
        "preprocessing_applied": easyocr_result.get("preprocessing_applied", []) + ["gemini_flash"],
    }


def merge_back_side(front_result: dict, back_result: dict) -> dict:
    if not back_result:
        return front_result
    fields = dict(front_result.get("fields", {}))
    for key in ("address", "pincode", "vehicle_classes", "blood_group", "validity"):
        val = back_result.get(key)
        if val and str(val).strip() and str(val).lower() != "null":
            if key not in fields or not fields[key].get("value"):
                fields[key] = {"value": str(val).strip(), "confidence": 0.85}
    return {**front_result, "fields": fields, "has_back_side": True}
