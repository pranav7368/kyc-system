"""
Risk Engine — weighted scoring system producing APPROVED / REVIEW / REJECTED.
"""
from typing import Any


def calculate(
    ocr: dict,
    face: dict,
    liveness: dict,
    fraud: dict,
) -> dict:
    """
    Inputs: raw dicts from each service.
    Returns RiskResult-compatible dict.
    Risk score 0-100; LOWER is better.
    """

    # -----------------------------------------------------------------------
    # 1. Face Match  (max 30 pts)
    # -----------------------------------------------------------------------
    similarity = face.get("similarity", 0.0)
    if similarity >= 0.70:
        face_penalty = 0
        face_status = "Excellent"
    elif similarity >= 0.55:
        face_penalty = 15
        face_status = "Good"
    else:
        face_penalty = 30
        face_status = "Poor"

    # -----------------------------------------------------------------------
    # 2. Document Quality  (max 25 pts)
    # -----------------------------------------------------------------------
    ocr_confidence = ocr.get("overall_confidence", 0.0)
    if ocr_confidence >= 0.80:
        doc_penalty = 0
        doc_status = "Excellent"
    elif ocr_confidence >= 0.40:
        doc_penalty = 12
        doc_status = "Acceptable"
    else:
        doc_penalty = 25
        doc_status = "Poor"

    # -----------------------------------------------------------------------
    # 3. Liveness  (max 20 pts)
    # -----------------------------------------------------------------------
    live_score = liveness.get("liveness_score", 0.0)
    if live_score >= 0.80:
        live_penalty = 0
        live_status = "Passed"
    elif live_score >= 0.50:
        live_penalty = 10
        live_status = "Partial"
    else:
        live_penalty = 20
        live_status = "Failed"

    # -----------------------------------------------------------------------
    # 4. Data Consistency  (max 15 pts)
    # -----------------------------------------------------------------------
    fields = ocr.get("fields", {})
    critical = ["document_number", "name", "dob"]
    present = sum(1 for f in critical if fields.get(f, {}).get("value"))
    qr_verified = ocr.get("qr_verified", False)

    if present == len(critical) and qr_verified:
        data_penalty = 0
        data_status = "All fields verified"
    elif present >= 2:
        data_penalty = 7
        data_status = "Most fields extracted"
    else:
        data_penalty = 15
        data_status = "Critical fields missing"

    # -----------------------------------------------------------------------
    # 5. Fraud Indicators  (max 10 pts)
    # -----------------------------------------------------------------------
    fraud_score = fraud.get("fraud_score", 0.0)
    if fraud_score < 0.30:
        fraud_penalty = 0
        fraud_status = "Clean"
    elif fraud_score < 0.60:
        fraud_penalty = 5
        fraud_status = "Suspicious"
    else:
        fraud_penalty = 10
        fraud_status = "High Risk"

    # -----------------------------------------------------------------------
    # Aggregate
    # -----------------------------------------------------------------------
    risk_score = face_penalty + doc_penalty + live_penalty + data_penalty + fraud_penalty
    risk_score = max(0, min(100, risk_score))

    # Decision
    if risk_score <= 25:
        decision = "APPROVED"
        color = "#10B981"
        recommended_action = "Proceed with customer onboarding."
        confidence = round((1 - risk_score / 100) * 100, 1)
    elif risk_score <= 55:
        decision = "REVIEW"
        color = "#F59E0B"
        recommended_action = "Route to manual review agent."
        confidence = round((1 - (risk_score - 25) / 80) * 100, 1)
    else:
        decision = "REJECTED"
        color = "#EF4444"
        recommended_action = "Request resubmission with better-quality images."
        confidence = round((risk_score / 100) * 85, 1)

    # Human-readable reasons
    reasons = []
    if face_penalty > 15:
        reasons.append(f"Face similarity too low ({similarity:.0%})")
    elif face_penalty > 0:
        reasons.append(f"Face similarity borderline ({similarity:.0%})")
    if doc_penalty > 12:
        reasons.append(f"Document OCR confidence low ({ocr_confidence:.0%})")
    if live_penalty > 10:
        reasons.append("Liveness check failed — possible spoof")
    elif live_penalty > 0:
        reasons.append("Liveness score borderline")
    if data_penalty > 7:
        reasons.append("Critical document fields could not be extracted")
    elif data_penalty > 0:
        reasons.append("Some document fields missing or unverified")
    if fraud_penalty > 5:
        reasons.append("Document shows signs of tampering")
    elif fraud_penalty > 0:
        reasons.append("Minor document anomalies detected")
    if not reasons:
        reasons.append("All checks passed successfully")

    return {
        "risk_score": float(risk_score),
        "decision": decision,
        "decision_reasons": reasons,
        "recommended_action": recommended_action,
        "confidence_percentage": confidence,
        "color": color,
        "breakdown": {
            "face_match": {
                "penalty": face_penalty,
                "max": 30,
                "status": face_status,
                "value": round(similarity * 100, 1),
            },
            "document_quality": {
                "penalty": doc_penalty,
                "max": 25,
                "status": doc_status,
                "value": round(ocr_confidence * 100, 1),
            },
            "liveness": {
                "penalty": live_penalty,
                "max": 20,
                "status": live_status,
                "value": round(live_score * 100, 1),
            },
            "data_consistency": {
                "penalty": data_penalty,
                "max": 15,
                "status": data_status,
                "value": present,
            },
            "fraud_indicators": {
                "penalty": fraud_penalty,
                "max": 10,
                "status": fraud_status,
                "value": round(fraud_score * 100, 1),
            },
        },
    }
