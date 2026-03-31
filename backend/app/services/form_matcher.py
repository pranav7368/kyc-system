"""
Form Matcher — compare user-submitted form data against OCR-extracted fields.

Uses exact match for DOB and document number,
fuzzy (Levenshtein) match for name and address.
"""
import re
import logging
from typing import Optional

logger = logging.getLogger("kyc.form_matcher")


def _levenshtein(a: str, b: str) -> int:
    """Pure-Python Levenshtein distance (no external deps)."""
    a, b = a.lower().strip(), b.lower().strip()
    if a == b:
        return 0
    if not a: return len(b)
    if not b: return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j] + (0 if ca == cb else 1), prev[j+1] + 1, curr[j] + 1))
        prev = curr
    return prev[-1]


def _similarity(a: str, b: str) -> float:
    """Normalised similarity 0-1 (1 = identical)."""
    if not a or not b:
        return 0.0
    dist = _levenshtein(a, b)
    return 1.0 - dist / max(len(a), len(b))


def _normalise_dob(raw: str) -> Optional[str]:
    """Normalise date to DDMMYYYY for comparison."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 8:
        return digits   # either DDMMYYYY or YYYYMMDD — just compare digits
    return None


def _normalise_docnum(raw: str) -> str:
    return re.sub(r"[\s\-/]", "", raw).upper()


def match(user_form: dict, ocr_fields: dict) -> dict:
    """
    Compare user-submitted form against OCR-extracted data.

    user_form keys: name, dob, document_number, address
    ocr_fields: dict of {field_name: {value, confidence}}

    Returns:
        {
          matches: { field: { user, ocr, match, similarity, status } },
          overall_match: bool,
          match_score: float 0-1,
          discrepancies: [str]
        }
    """
    matches      = {}
    discrepancies = []
    scores       = []

    def _ocr_val(key):
        return (ocr_fields.get(key) or {}).get("value") or ""

    # -----------------------------------------------------------------------
    # Name — fuzzy match (allows minor OCR errors and name ordering)
    # -----------------------------------------------------------------------
    user_name = (user_form.get("name") or "").strip()
    ocr_name  = _ocr_val("name").strip()
    if user_name and ocr_name:
        sim = _similarity(user_name, ocr_name)
        status = "match" if sim >= 0.80 else "partial" if sim >= 0.60 else "mismatch"
        matches["name"] = {"user": user_name, "ocr": ocr_name, "similarity": round(sim, 3), "status": status}
        scores.append(sim)
        if status == "mismatch":
            discrepancies.append(f"Name mismatch: user entered '{user_name}' but ID shows '{ocr_name}'")
    elif user_name:
        matches["name"] = {"user": user_name, "ocr": None, "similarity": 0.0, "status": "ocr_missing"}

    # -----------------------------------------------------------------------
    # DOB — normalised digit comparison
    # -----------------------------------------------------------------------
    user_dob = _normalise_dob(user_form.get("dob") or "")
    ocr_dob  = _normalise_dob(_ocr_val("dob"))
    if user_dob and ocr_dob:
        exact = user_dob == ocr_dob
        sim   = 1.0 if exact else 0.0
        status = "match" if exact else "mismatch"
        matches["dob"] = {"user": user_form.get("dob"), "ocr": _ocr_val("dob"), "similarity": sim, "status": status}
        scores.append(sim)
        if not exact:
            discrepancies.append(f"Date of birth mismatch: user entered '{user_form.get('dob')}' but ID shows '{_ocr_val('dob')}'")
    elif user_dob:
        matches["dob"] = {"user": user_form.get("dob"), "ocr": None, "similarity": 0.0, "status": "ocr_missing"}

    # -----------------------------------------------------------------------
    # Document number — exact (normalised, case-insensitive)
    # -----------------------------------------------------------------------
    user_num = _normalise_docnum(user_form.get("document_number") or "")
    ocr_num  = _normalise_docnum(_ocr_val("document_number"))
    if user_num and ocr_num:
        exact  = user_num == ocr_num
        sim    = 1.0 if exact else _similarity(user_num, ocr_num)
        status = "match" if exact else ("partial" if sim >= 0.85 else "mismatch")
        matches["document_number"] = {"user": user_form.get("document_number"), "ocr": _ocr_val("document_number"), "similarity": round(sim, 3), "status": status}
        scores.append(sim)
        if status == "mismatch":
            discrepancies.append(f"ID number mismatch: user entered '{user_form.get('document_number')}' but extracted '{_ocr_val('document_number')}'")

    # -----------------------------------------------------------------------
    # Address — fuzzy (very lenient: addresses differ a lot due to OCR)
    # -----------------------------------------------------------------------
    user_addr = (user_form.get("address") or "").strip()
    ocr_addr  = _ocr_val("address").strip()
    if user_addr and ocr_addr:
        sim = _similarity(user_addr, ocr_addr)
        # Also check if pincode matches inside address strings
        user_pin = re.search(r"\b\d{6}\b", user_addr)
        ocr_pin  = re.search(r"\b\d{6}\b", ocr_addr)
        if user_pin and ocr_pin and user_pin.group() == ocr_pin.group():
            sim = max(sim, 0.75)   # pincode match = significant address match
        status = "match" if sim >= 0.65 else "partial" if sim >= 0.40 else "mismatch"
        matches["address"] = {"user": user_addr, "ocr": ocr_addr, "similarity": round(sim, 3), "status": status}
        scores.append(sim * 0.5)   # address weighted less
        if status == "mismatch":
            discrepancies.append("Address has significant differences from extracted text")

    # -----------------------------------------------------------------------
    # Overall score
    # -----------------------------------------------------------------------
    match_score   = round(sum(scores) / len(scores), 3) if scores else 0.0
    overall_match = match_score >= 0.70 and len(discrepancies) == 0

    logger.info(f"Form match: score={match_score} overall_match={overall_match} discrepancies={len(discrepancies)}")

    return {
        "matches":       matches,
        "overall_match": overall_match,
        "match_score":   match_score,
        "discrepancies": discrepancies,
    }
