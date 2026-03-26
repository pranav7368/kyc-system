"""
OCR service unit tests — tests regex patterns without needing EasyOCR.
"""
import re
import pytest

AADHAAR_PATTERN = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
PAN_PATTERN     = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
DOB_PATTERN     = re.compile(r"\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\b")
GENDER_PATTERN  = re.compile(r"\b(MALE|FEMALE|TRANSGENDER)\b", re.IGNORECASE)


def test_aadhaar_regex():
    assert AADHAAR_PATTERN.search("1234 5678 9012")
    assert AADHAAR_PATTERN.search("123456789012")
    assert not AADHAAR_PATTERN.search("12345")


def test_pan_regex():
    assert PAN_PATTERN.search("ABCDE1234F")
    assert not PAN_PATTERN.search("abcde1234f")  # lowercase
    assert not PAN_PATTERN.search("ABCDE12345")


def test_dob_regex():
    assert DOB_PATTERN.search("15/03/1995")
    assert DOB_PATTERN.search("15-03-1995")
    assert not DOB_PATTERN.search("1995-03-15")  # ISO format not matched


def test_gender_regex():
    assert GENDER_PATTERN.search("MALE")
    assert GENDER_PATTERN.search("female")
    assert GENDER_PATTERN.search("TRANSGENDER")
    assert not GENDER_PATTERN.search("other")
