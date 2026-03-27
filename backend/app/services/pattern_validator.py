"""
Pattern Validator — government-defined format checks per document type.

Indian government ID rules (official):
  Aadhaar  : 12 digits, first digit 2-9, Verhoeff checksum
  PAN      : AAAAA9999A — position 4 = entity type, position 5 = surname initial
  Passport : A9999999   — first char P/D/S/V, MRZ checksum if available
  DL       : StateCode + district + year + serial (state code must be valid)
  Voter ID : 3 letters + 7 digits (EPIC format)

Returns: { valid, warnings, pattern_score, details }
"""
import re
import logging
from datetime import datetime, date

logger = logging.getLogger("kyc.pattern")

# ---------------------------------------------------------------------------
# Compiled patterns
# ---------------------------------------------------------------------------
AADHAAR_RE  = re.compile(r"^\d{12}$")
PAN_RE      = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
PASSPORT_RE = re.compile(r"^[A-Z]\d{7}$")
DL_RE       = re.compile(r"^[A-Z]{2}\d{2}")         # at least state + 2 district digits
VOTER_RE    = re.compile(r"^[A-Z]{2,3}\d{7}$")

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

# Valid Indian state/UT codes used in Driving Licence
DL_STATE_CODES = {
    "AN","AP","AR","AS","BR","CG","CH","DD","DL","DN","GA","GJ","HP","HR",
    "JH","JK","KA","KL","LA","LD","MH","ML","MN","MP","MZ","NL","OD","PB",
    "PY","RJ","SK","TG","TN","TR","UK","UP","WB",
}

# PAN card 4th-character entity codes (official Income Tax definition)
PAN_ENTITY_CODES = {
    "P": "Individual (Person)",
    "C": "Company",
    "H": "Hindu Undivided Family (HUF)",
    "F": "Firm / LLP",
    "A": "Association of Persons / BOI",
    "T": "Trust / AOP Trust",
    "B": "Body of Individuals",
    "L": "Local Authority",
    "J": "Artificial Juridical Person",
    "G": "Government",
}

# Valid first characters for Indian passports
PASSPORT_TYPE_CODES = {
    "P": "Ordinary",
    "D": "Diplomatic",
    "S": "Service / Official",
    "V": "Visa (legacy)",
    "J": "Jumbo (old)",
}

# EPIC (Voter ID) state prefix codes — first 2–3 letters
EPIC_STATE_PREFIXES = {
    "S2","GJ","MH","KA","TN","UP","MP","RJ","AP","TG","WB","OR","KL","HR",
    "PB","JH","UK","HP","GA","MN","MZ","NL","ML","TR","AR","SK","AS","BR",
    "CH","DL","PY","AN","DN","DD","LD","LA",
    # 3-letter prefixes used by some states
    "ODP","BIH",
}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def validate(document_type: str, fields: dict) -> dict:
    """
    Validate extracted document fields against official government patterns.
    Returns dict with valid flag, warnings list, details, and pattern_score (0-1).
    """
    doc_num_field = fields.get("document_number", {})
    doc_num = (doc_num_field.get("value") or "").strip().upper().replace(" ", "").replace("-", "")
    warnings = []
    details  = {}

    if not doc_num:
        return {
            "valid": False,
            "warnings": ["Document number could not be extracted — image may be unclear or document not supported"],
            "pattern_score": 0.0,
            "details": {},
        }

    if document_type == "aadhaar":
        valid, warns, details = _validate_aadhaar(doc_num, fields)
    elif document_type == "pan":
        valid, warns, details = _validate_pan(doc_num, fields)
    elif document_type == "passport":
        valid, warns, details = _validate_passport(doc_num, fields)
    elif document_type == "driving_license":
        valid, warns, details = _validate_dl(doc_num, fields)
    elif document_type == "voter_id":
        valid, warns, details = _validate_voter(doc_num, fields)
    else:
        valid  = len(doc_num) >= 6
        warns  = [] if valid else ["Document number too short — expected at least 6 characters"]
        details = {"doc_num_length": len(doc_num)}

    warnings.extend(warns)

    if valid and not warnings:
        pattern_score = 1.0
    elif valid:
        pattern_score = max(0.65, 1.0 - len(warnings) * 0.1)
    else:
        pattern_score = max(0.1, 0.5 - len(warnings) * 0.1)

    logger.info(
        f"Pattern | type={document_type} | num={doc_num[:4]}*** | "
        f"valid={valid} | warns={len(warnings)} | score={pattern_score:.2f}"
    )

    return {
        "valid": valid,
        "warnings": warnings,
        "pattern_score": round(pattern_score, 3),
        "details": details,
    }


# ---------------------------------------------------------------------------
# Per-document validators
# ---------------------------------------------------------------------------

def _validate_aadhaar(num: str, fields: dict):
    """
    Aadhaar rules (UIDAI spec):
    - Exactly 12 digits
    - First digit must be 2–9 (0 and 1 are permanently reserved by UIDAI)
    - Passes Verhoeff checksum algorithm
    - Must have Name, DOB, Gender on front
    - Address is on the back of the physical card
    """
    warnings = []
    details  = {}

    if not num.isdigit():
        return False, [f"Aadhaar must contain only digits — got '{num}'"], {}

    if len(num) != 12:
        return False, [f"Aadhaar must be exactly 12 digits — got {len(num)} digits"], {}

    # UIDAI rule: first digit 2–9
    if num[0] in ("0", "1"):
        warnings.append(
            f"Aadhaar first digit '{num[0]}' is invalid — UIDAI reserves 0 and 1; "
            "number may have been misread"
        )

    # Verhoeff checksum
    checksum_ok = _verhoeff_check(num)
    details["checksum_ok"] = checksum_ok
    if not checksum_ok:
        warnings.append(
            "Aadhaar checksum (Verhoeff) failed — one or more digits may have been misread by OCR"
        )

    # Required fields
    if not fields.get("name", {}).get("value"):
        warnings.append("Name not extracted from Aadhaar — required field")
    if not fields.get("dob", {}).get("value"):
        warnings.append("Date of Birth not extracted from Aadhaar — required field")
    if not fields.get("gender", {}).get("value"):
        warnings.append("Gender not extracted from Aadhaar — required field")
    if not fields.get("address", {}).get("value"):
        warnings.append(
            "Address not found — on physical Aadhaar cards the address is printed on the back side"
        )

    details.update({"length": 12, "first_digit_valid": num[0] not in ("0", "1")})
    return True, warnings, details


def _validate_pan(num: str, fields: dict):
    """
    PAN rules (Income Tax Department):
    - Exactly 10 characters: 5 uppercase letters + 4 digits + 1 uppercase letter
    - Position 1–3: Jurisdiction/office code (letters)
    - Position 4: Entity type code (P/C/H/F/A/T/B/L/J/G)
    - Position 5: First letter of surname (for individuals — entity P)
    - Position 6–9: Sequential issue number (0001–9999)
    - Position 10: Alphabetic check character
    """
    warnings = []
    details  = {}

    if not PAN_RE.match(num):
        # Detailed failure message
        if len(num) != 10:
            msg = f"PAN must be exactly 10 characters — got {len(num)}"
        elif not num[:5].isalpha():
            msg = f"PAN positions 1–5 must be letters — got '{num[:5]}'"
        elif not num[5:9].isdigit():
            msg = f"PAN positions 6–9 must be digits — got '{num[5:9]}'"
        elif not num[9].isalpha():
            msg = f"PAN position 10 must be a letter — got '{num[9]}'"
        else:
            msg = f"PAN format invalid — expected AAAAA9999A, got '{num}'"
        return False, [msg], {}

    # Position 4 — entity type code
    entity_char = num[3]
    pan_type = PAN_ENTITY_CODES.get(entity_char)
    if not pan_type:
        warnings.append(
            f"PAN 4th character '{entity_char}' is not a valid entity code "
            f"(valid: {', '.join(PAN_ENTITY_CODES.keys())})"
        )
    else:
        details["entity_type"] = pan_type

    # Position 5 — surname initial (only meaningful for individuals: entity P)
    surname_initial_on_pan = num[4]
    details["surname_initial_on_pan"] = surname_initial_on_pan

    if entity_char == "P":
        name_val = fields.get("name", {}).get("value", "")
        if name_val:
            name_parts = name_val.strip().upper().split()
            # In India, PAN surname initial = first letter of the LAST name word
            actual_surname_initial = name_parts[-1][0] if name_parts else ""
            details["extracted_surname_initial"] = actual_surname_initial
            if actual_surname_initial and actual_surname_initial != surname_initial_on_pan:
                warnings.append(
                    f"PAN 5th character '{surname_initial_on_pan}' should match first letter of surname — "
                    f"extracted name '{name_val}' suggests '{actual_surname_initial}'. "
                    "OCR may have misread either the PAN number or the name."
                )
        else:
            warnings.append("Name not extracted from PAN card — required for individual PANs")

    details["jurisdiction_code"] = num[0:3]
    details["entity_code"] = entity_char
    details["serial_number"] = num[5:9]

    return True, warnings, details


def _validate_passport(num: str, fields: dict):
    """
    Indian Passport rules (MEA):
    - Exactly 8 characters: 1 letter + 7 digits
    - First character: P (ordinary), D (diplomatic), S (service/official), V (visa, legacy)
    - MRZ line 1 checksum if MRZ is available
    - Expiry date should be in the future
    """
    warnings = []
    details  = {}

    if not PASSPORT_RE.match(num):
        if len(num) != 8:
            msg = f"Passport number must be 8 characters — got {len(num)}"
        elif not num[0].isalpha():
            msg = f"Passport number must start with a letter — got '{num[0]}'"
        elif not num[1:].isdigit():
            msg = f"Passport positions 2–8 must be digits — got '{num[1:]}'"
        else:
            msg = f"Passport number format invalid — expected A9999999, got '{num}'"
        return False, [msg], {}

    # First character = passport type
    type_char = num[0]
    passport_type = PASSPORT_TYPE_CODES.get(type_char)
    if passport_type:
        details["passport_type"] = passport_type
    else:
        warnings.append(
            f"Passport type code '{type_char}' is unusual for Indian passports "
            f"(expected P/D/S/V)"
        )

    # Expiry date check
    expiry_val = fields.get("expiry_date", {}).get("value", "")
    if not expiry_val:
        warnings.append("Passport expiry date not found — required field; document may be expired")
    else:
        details["expiry_date"] = expiry_val
        expired = _is_date_expired(expiry_val)
        if expired is True:
            warnings.append(f"Passport appears to be EXPIRED (expiry: {expiry_val})")
            details["expired"] = True
        elif expired is False:
            details["expired"] = False

    # MRZ checksum validation
    mrz1 = fields.get("mrz_line1", {}).get("value", "")
    mrz2 = fields.get("mrz_line2", {}).get("value", "")
    if mrz1 and mrz2:
        mrz_ok, mrz_warn = _validate_mrz(mrz1, mrz2)
        details["mrz_checksum_ok"] = mrz_ok
        if not mrz_ok and mrz_warn:
            warnings.append(mrz_warn)
    else:
        details["mrz_available"] = False

    if not fields.get("name", {}).get("value"):
        warnings.append("Name not extracted from Passport")
    if not fields.get("dob", {}).get("value"):
        warnings.append("Date of Birth not extracted from Passport")

    return True, warnings, details


def _validate_dl(num: str, fields: dict):
    """
    Driving Licence rules (MoRTH):
    - Format: StateCode(2) + District(2 digits) + Year(4 digits) + Serial(7 digits)
    - Smart card DL (post-2012): 16 characters total
    - Old format: XX-YY-YYYYNNNNNNN or similar
    - First 2 characters must be a valid Indian state/UT code
    - Validity/expiry should be present (often on back)
    """
    warnings = []
    details  = {}

    state_code = num[:2].upper()
    details["state_code"] = state_code

    if state_code not in DL_STATE_CODES:
        warnings.append(
            f"DL state code '{state_code}' is not a recognised Indian state/UT code — "
            "may have been misread by OCR"
        )
        valid = False
    else:
        valid = True
        details["state"] = _STATE_NAME.get(state_code, state_code)

    # Length check (DL numbers are 13–16 chars typically)
    if len(num) < 10:
        warnings.append(f"DL number seems too short ({len(num)} chars) — may be incomplete")
        valid = False
    elif len(num) > 18:
        warnings.append(f"DL number seems too long ({len(num)} chars) — may have noise")

    # Year embedded in DL number (chars 5–8 for smart card format)
    if len(num) >= 8 and num[4:8].isdigit():
        year = int(num[4:8])
        current_year = date.today().year
        if 1990 <= year <= current_year:
            details["issue_year"] = year
        else:
            warnings.append(f"DL embedded year '{year}' looks unusual")

    # Expiry check
    expiry_val = (
        fields.get("expiry_date", {}).get("value") or
        fields.get("validity", {}).get("value")
    )
    if not expiry_val:
        warnings.append(
            "DL validity/expiry not found — this is usually printed on the back of the card"
        )
    else:
        details["validity"] = expiry_val
        expired = _is_date_expired(expiry_val)
        if expired is True:
            warnings.append(f"Driving Licence appears to be EXPIRED (validity: {expiry_val})")
            details["expired"] = True

    if not fields.get("name", {}).get("value"):
        warnings.append("Name not extracted from Driving Licence")

    return valid, warnings, details


def _validate_voter(num: str, fields: dict):
    """
    Voter ID (EPIC) rules (Election Commission of India):
    - Format: 3 uppercase letters + 7 digits = 10 characters
    - First 2 letters are state-level prefix assigned by ECI
    - Each state gets a specific prefix (e.g. GJ=Gujarat, MH=Maharashtra)
    """
    warnings = []
    details  = {}

    if not VOTER_RE.match(num):
        if len(num) != 10:
            msg = f"Voter ID must be 10 characters — got {len(num)}"
        elif not num[:3].isalpha():
            msg = f"Voter ID first 3 characters must be letters — got '{num[:3]}'"
        elif not num[3:].isdigit():
            msg = f"Voter ID last 7 characters must be digits — got '{num[3:]}'"
        else:
            msg = f"Voter ID format invalid — expected 3 letters + 7 digits, got '{num}'"
        return False, [msg], {}

    # State prefix check (first 2 chars)
    state_prefix = num[:2]
    details["state_prefix"] = state_prefix
    if state_prefix not in EPIC_STATE_PREFIXES:
        warnings.append(
            f"Voter ID prefix '{state_prefix}' not in known ECI state codes — "
            "may be a new allocation or misread"
        )

    details["epic_format"] = f"{num[:3]}-{num[3:]}"

    if not fields.get("name", {}).get("value"):
        warnings.append("Name not extracted from Voter ID — required field")
    if not fields.get("address", {}).get("value"):
        warnings.append(
            "Address not found — Voter ID address details are on the back of the card"
        )

    return True, warnings, details


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_STATE_NAME = {
    "AN": "Andaman & Nicobar", "AP": "Andhra Pradesh", "AR": "Arunachal Pradesh",
    "AS": "Assam", "BR": "Bihar", "CG": "Chhattisgarh", "CH": "Chandigarh",
    "DD": "Daman & Diu", "DL": "Delhi", "DN": "Dadra & Nagar Haveli",
    "GA": "Goa", "GJ": "Gujarat", "HP": "Himachal Pradesh", "HR": "Haryana",
    "JH": "Jharkhand", "JK": "Jammu & Kashmir", "KA": "Karnataka",
    "KL": "Kerala", "LA": "Ladakh", "LD": "Lakshadweep", "MH": "Maharashtra",
    "ML": "Meghalaya", "MN": "Manipur", "MP": "Madhya Pradesh",
    "MZ": "Mizoram", "NL": "Nagaland", "OD": "Odisha", "PB": "Punjab",
    "PY": "Puducherry", "RJ": "Rajasthan", "SK": "Sikkim", "TG": "Telangana",
    "TN": "Tamil Nadu", "TR": "Tripura", "UK": "Uttarakhand",
    "UP": "Uttar Pradesh", "WB": "West Bengal",
}


def _is_date_expired(date_str: str):
    """
    Parse common Indian date formats and return True if expired, False if valid, None if unparseable.
    Handles: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD/MM/YY, YYYY/MM/DD
    """
    if not date_str:
        return None
    s = date_str.strip().replace(".", "/").replace("-", "/")
    formats = [
        "%d/%m/%Y", "%Y/%m/%d", "%m/%d/%Y",
        "%d/%m/%y", "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(s.replace("-", "/"), fmt).date()
            return parsed < date.today()
        except ValueError:
            continue
    return None  # Cannot parse


def _validate_mrz(line1: str, line2: str):
    """
    Validate MRZ checksum digits per ICAO 9303 standard.
    Weights cycle: 7, 3, 1. Char values: 0-9 → 0-9, A-Z → 10-35, < → 0.
    Returns (ok: bool, warning_message: str | None)
    """
    try:
        def _char_val(c):
            if c.isdigit(): return int(c)
            if c.isalpha(): return ord(c.upper()) - 55
            return 0  # '<'

        def _check(field_str: str, check_digit: str) -> bool:
            weights = [7, 3, 1]
            total = sum(_char_val(c) * weights[i % 3] for i, c in enumerate(field_str))
            return (total % 10) == int(check_digit)

        if len(line2) < 44:
            return True, None  # MRZ too short to validate, skip

        # Line 2 layout: PassportNo(9) + Check(1) + Nationality(3) + DOB(6) + Check(1) +
        #                Sex(1) + Expiry(6) + Check(1) + PersonalNo(14) + Check(1) + CompositeCheck(1)
        passport_num = line2[0:9]
        passport_check = line2[9]
        dob = line2[13:19]
        dob_check = line2[19]
        expiry = line2[21:27]
        expiry_check = line2[27]

        checks = [
            _check(passport_num, passport_check),
            _check(dob, dob_check),
            _check(expiry, expiry_check),
        ]
        if all(checks):
            return True, None
        failed = [i + 1 for i, ok in enumerate(checks) if not ok]
        return False, f"MRZ checksum failed at field(s) {failed} — passport may have been tampered or misread"
    except Exception:
        return True, None  # Don't penalise if MRZ parse fails


# ---------------------------------------------------------------------------
# Verhoeff algorithm (UIDAI-mandated Aadhaar checksum)
# ---------------------------------------------------------------------------
_VERHOEFF_D = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
]
_VERHOEFF_P = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8],
]

def _verhoeff_check(num_str: str) -> bool:
    """Return True if Aadhaar number passes the UIDAI-mandated Verhoeff checksum."""
    try:
        c = 0
        for i, n in enumerate(reversed(num_str)):
            c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(n)]]
        return c == 0
    except Exception:
        return True  # don't penalise on parse error
