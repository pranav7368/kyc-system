"""
OCR Service — Document text extraction using EasyOCR + OpenCV preprocessing.
EasyOCR reader is a module-level singleton to avoid re-init penalty.
"""
import re
import hashlib
import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("kyc.ocr")

# ---------------------------------------------------------------------------
# Module-level singleton — initialised once, reused across all requests
# ---------------------------------------------------------------------------
_reader = None


class _OCRStub:
    """Fallback stub when EasyOCR is not installed."""
    def readtext(self, image, **kwargs):
        return []


def get_reader():
    global _reader
    if _reader is None:
        try:
            import easyocr
            logger.info("Initialising EasyOCR reader (first call)…")
            _reader = easyocr.Reader(["en", "hi"], gpu=False, verbose=False)
            logger.info("EasyOCR ready.")
        except ImportError:
            logger.warning("EasyOCR not installed — using stub (install easyocr for full OCR)")
            _reader = _OCRStub()
    return _reader


# ---------------------------------------------------------------------------
# Image pre-processing
# ---------------------------------------------------------------------------

def _deskew(image: np.ndarray) -> np.ndarray:
    """Deskew image using Hough transform angle estimation."""
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi / 180, 100)
        if lines is None:
            return image
        angles = []
        for line in lines[:20]:
            rho, theta = line[0]
            angle = (theta - np.pi / 2) * 180 / np.pi
            if abs(angle) < 45:
                angles.append(angle)
        if not angles:
            return image
        median_angle = np.median(angles)
        if abs(median_angle) < 0.5:
            return image
        h, w = image.shape[:2]
        M = cv2.getRotationMatrix2D((w / 2, h / 2), median_angle, 1.0)
        return cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    except Exception:
        return image


def preprocess_image(image_path: str) -> tuple[np.ndarray, list[str]]:
    """
    Apply CLAHE → bilateral filter → Otsu threshold → deskew.
    Returns (processed_image, list_of_applied_steps).
    """
    applied = []
    img = cv2.imread(image_path)
    if img is None:
        img_pil = Image.open(image_path).convert("RGB")
        img = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    applied.append("clahe")

    # Bilateral filter — denoise while preserving edges
    gray = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)
    applied.append("bilateral")

    # Deskew
    img_deskewed = _deskew(img)
    gray_deskewed = cv2.cvtColor(img_deskewed, cv2.COLOR_BGR2GRAY)
    applied.append("deskew")

    # Otsu threshold for binarisation
    _, binary = cv2.threshold(gray_deskewed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    applied.append("otsu")

    # Convert to 3-channel so EasyOCR is happy
    result = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    return result, applied


# ---------------------------------------------------------------------------
# QR code extraction
# ---------------------------------------------------------------------------

def _extract_qr(image_path: str) -> Optional[dict]:
    """Decode QR codes with pyzbar; parse Aadhaar XML if present."""
    try:
        try:
            from pyzbar.pyzbar import decode as pyzbar_decode
        except ImportError:
            return None
        import xml.etree.ElementTree as ET

        img = cv2.imread(image_path)
        if img is None:
            return None
        decoded = pyzbar_decode(img)
        if not decoded:
            return None

        raw = decoded[0].data.decode("utf-8", errors="ignore")

        # Try parsing as Aadhaar XML
        try:
            root = ET.fromstring(raw)
            return {k: v for k, v in root.attrib.items()}
        except ET.ParseError:
            return {"raw": raw}
    except Exception as exc:
        logger.debug(f"QR extraction skipped: {exc}")
        return None


# ---------------------------------------------------------------------------
# Document-type detection & field parsing
# ---------------------------------------------------------------------------

def _correct_pan_ocr(text: str) -> str:
    """
    Fix common OCR digit-letter confusions in PAN number positions 6-9.
    PAN format: AAAAA9999A — positions 6-9 must be digits.
    OCR commonly reads: 0→O, 6→G, 1→I, 8→B, 5→S, 2→Z.
    Finds a loose PAN candidate and corrects the numeric section.
    """
    loose = re.compile(r"\b([A-Z]{5})([A-Z0-9]{4})([A-Z0-9=])")
    _ocr_to_digit = str.maketrans("OGIBS Z", "0618520")

    def _fix(m):
        letters, nums, last = m.group(1), m.group(2), m.group(3)
        corrected_nums = nums.translate(_ocr_to_digit)
        if re.match(r"\d{4}", corrected_nums):
            return letters + corrected_nums + last
        return m.group(0)

    return loose.sub(_fix, text)


PATTERNS = {
    "aadhaar_number": re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),
    "pan_number":     re.compile(r"\b[A-Z]{5}\d{4}[A-Z0-9=]"),  # no trailing \b — = breaks word boundary
    "passport_number":re.compile(r"\b[A-Z][0-9]{7}\b"),
    "dl_number":      re.compile(r"\b[A-Z]{2}\d{2}\s?\d{11}\b"),
    "dob":            re.compile(
        r"\b(\d{2}[\/\-\.\{\']\d{2}[\/\-\.\{\']\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})\b"
    ),
    "gender":         re.compile(r"\b(MALE|FEMALE|TRANSGENDER|पुरुष|महिला|OTHER)\b", re.IGNORECASE),
    "pincode":        re.compile(r"\b[1-9]\d{5}\b"),
}

DOC_KEYWORDS = {
    "aadhaar":         ["aadhaar", "आधार", "unique identification", "uidai"],
    "pan":             ["income tax", "permanent account", "income", "pan card", "आयकर", "स्थायी लेखा"],
    "passport":        ["passport", "republic of india", "राज्य"],
    "driving_license": ["driving licence", "driving license", "transport"],
}


def _detect_document_type(text: str) -> str:
    lower = text.lower()
    for doc_type, keywords in DOC_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return doc_type
    if PATTERNS["aadhaar_number"].search(text):
        return "aadhaar"
    if PATTERNS["pan_number"].search(text):
        return "pan"
    if PATTERNS["passport_number"].search(text):
        return "passport"
    return "unknown"


# Individual words that appear in document headers/templates (not names).
# Word-level check catches OCR-mangled versions like "INCONE TAX DEPARIIENT".
_TEMPLATE_WORDS = {
    "tax", "govt", "gov", "government", "department", "dept", "ministry",
    "board", "authority", "limited", "ltd", "inc", "corp", "union",
    "national", "central", "federal", "republic", "permanent", "account",
    "income", "uidai", "india", "bharat", "passport", "transport",
    "licence", "license", "signature", "valid", "bearer", "holder",
    "depari", "depariment", "depart",  # common OCR noise for "department"
}

_TEMPLATE_PHRASES = [
    "permanent account", "income tax", "mera aadhaar", "मेरा आधार",
    "date of birth", "card no", "account number", "driving lic",
    "s/o", "w/o", "d/o", "mother", "father",
]


def _parse_name(lines: list[str], doc_type: str) -> tuple[str, float]:
    """
    Heuristic name extraction.
    1. Exclude lines containing known template/header words (word-level, catches OCR noise).
    2. Among remaining 2-5 word capitalised lines, prefer closest to 3 words.
    For PAN cards the name appears after the PAN number — handled by word exclusion
    filtering out 'INCOME TAX DEPARTMENT' even when OCR-mangled.
    """
    candidates = []
    for line in lines:
        line = line.strip()
        if len(line) < 4 or len(line) > 50:
            continue
        if re.search(r"\d", line):
            continue
        line_lower = line.lower()

        # Skip address-like lines (substring check)
        if any(kw in line_lower for kw in [
            "address", "village", "district", "state", "pin", *_TEMPLATE_PHRASES,
        ]):
            continue

        # Skip lines where ANY word is a known template/institutional word
        line_words = {w.strip(".,/|()[]") for w in line_lower.split()}
        if line_words & _TEMPLATE_WORDS:
            continue

        upper_ratio = sum(1 for c in line if c.isupper()) / max(len(line), 1)
        if upper_ratio > 0.4 or line.istitle():
            word_count = len(line.split())
            if 2 <= word_count <= 5:
                candidates.append((line, word_count))

    if candidates:
        # Prefer exactly 3 words (most common full name: First Middle Last)
        candidates.sort(key=lambda x: abs(x[1] - 3))
        return candidates[0][0], 0.85
    return "", 0.0


def _parse_address(lines: list[str]) -> tuple[str, float]:
    """Grab lines after address markers."""
    addr_lines = []
    capturing = False
    for line in lines:
        l_lower = line.lower().strip()
        if any(kw in l_lower for kw in ["address", "s/o", "w/o", "d/o", "village", "house no", "flat no"]):
            capturing = True
        if capturing:
            addr_lines.append(line.strip())
            if len(addr_lines) >= 4:
                break
    if addr_lines:
        return ", ".join(addr_lines), 0.70
    return "", 0.0


# ---------------------------------------------------------------------------
# Main extraction function
# ---------------------------------------------------------------------------

def extract(image_path: str) -> dict:
    """
    Full OCR pipeline.
    Returns dict matching OCRResult schema.
    """
    reader = get_reader()

    # Pre-process
    processed, applied = preprocess_image(image_path)

    # Run OCR on both processed AND original; use whichever gives higher confidence
    ocr_results_processed = []
    ocr_results_original  = []

    try:
        ocr_results_processed = reader.readtext(processed, detail=1, paragraph=False)
    except Exception as exc:
        logger.warning(f"OCR on processed image failed: {exc}")

    try:
        ocr_results_original = reader.readtext(image_path, detail=1, paragraph=False)
    except Exception as exc:
        logger.warning(f"OCR on original image failed: {exc}")

    def _avg_conf(results):
        confs = [r[2] for r in results]
        return float(np.mean(confs)) if confs else 0.0

    # Pick the result set with higher average confidence
    if _avg_conf(ocr_results_original) > _avg_conf(ocr_results_processed):
        ocr_results = ocr_results_original
        applied.append("original_preferred")
    else:
        ocr_results = ocr_results_processed if ocr_results_processed else ocr_results_original

    # Build raw text and confidence list
    texts = [r[1] for r in ocr_results]
    confidences = [r[2] for r in ocr_results]
    raw_text = "\n".join(texts)
    avg_confidence = float(np.mean(confidences)) if confidences else 0.0

    # Document type
    doc_type = _detect_document_type(raw_text)

    # For PAN number matching, apply OCR digit correction first
    # (OCR commonly misreads 0→O, 6→G, 1→I in the numeric section of PAN)
    raw_text_pan_corrected = _correct_pan_ocr(raw_text)

    # Field extraction
    fields: dict = {}

    # Document number — try OCR-corrected text for PAN, raw for others
    for field, pattern, search_text in [
        ("document_number", "aadhaar_number", raw_text),
        ("document_number", "pan_number",     raw_text_pan_corrected),
        ("document_number", "passport_number", raw_text),
        ("document_number", "dl_number",       raw_text),
    ]:
        m = PATTERNS[pattern].search(search_text)
        if m:
            conf = next((c for t, c in zip(texts, confidences) if any(ch in t for ch in m.group()[:5])), avg_confidence)
            fields[field] = {"value": m.group().strip(), "confidence": round(float(conf), 3)}
            break

    # DOB
    m = PATTERNS["dob"].search(raw_text)
    if m:
        conf = next((c for t, c in zip(texts, confidences) if m.group() in t), avg_confidence)
        fields["dob"] = {"value": m.group().strip(), "confidence": round(float(conf), 3)}

    # Gender
    m = PATTERNS["gender"].search(raw_text)
    if m:
        conf = next((c for t, c in zip(texts, confidences) if m.group() in t), avg_confidence)
        fields["gender"] = {"value": m.group().strip().upper(), "confidence": round(float(conf), 3)}

    # Name
    name, name_conf = _parse_name(texts, doc_type)
    if name:
        fields["name"] = {"value": name, "confidence": round(name_conf, 3)}

    # Address
    address, addr_conf = _parse_address(texts)
    if address:
        fields["address"] = {"value": address, "confidence": round(addr_conf, 3)}

    # Pincode
    m = PATTERNS["pincode"].search(raw_text)
    if m:
        fields["pincode"] = {"value": m.group().strip(), "confidence": round(avg_confidence, 3)}

    # QR
    qr_data = _extract_qr(image_path)
    qr_verified = False
    if qr_data and fields.get("document_number"):
        doc_num_clean = re.sub(r"\s", "", fields["document_number"]["value"])
        qr_str = str(qr_data)
        if doc_num_clean in qr_str:
            qr_verified = True

    # Image hash
    with open(image_path, "rb") as f:
        image_hash = hashlib.sha256(f.read()).hexdigest()

    return {
        "document_type": doc_type,
        "fields": fields,
        "overall_confidence": round(avg_confidence, 3),
        "qr_data": qr_data,
        "qr_verified": qr_verified,
        "raw_text": raw_text[:2000],  # truncate for storage
        "preprocessing_applied": applied,
        "image_hash": image_hash,
    }
