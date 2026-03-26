from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class Decision(str, Enum):
    APPROVED = "APPROVED"
    REVIEW = "REVIEW"
    REJECTED = "REJECTED"


class FieldValue(BaseModel):
    value: Optional[str] = None
    confidence: float = 0.0


class OCRResult(BaseModel):
    document_type: str = "unknown"
    fields: Dict[str, FieldValue] = {}
    overall_confidence: float = 0.0
    qr_data: Optional[Dict[str, Any]] = None
    qr_verified: bool = False
    raw_text: str = ""
    preprocessing_applied: List[str] = []


class FaceQuality(BaseModel):
    detected: bool = False
    blur: float = 0.0
    brightness: float = 0.0
    frontal: bool = False
    face_count: int = 0


class FaceResult(BaseModel):
    similarity: float = 0.0
    match: bool = False
    doc_face_quality: FaceQuality = FaceQuality()
    selfie_face_quality: FaceQuality = FaceQuality()
    estimated_age: Optional[int] = None
    estimated_gender: Optional[str] = None


class LivenessChecks(BaseModel):
    face_symmetry: float = 0.0
    texture_analysis: float = 0.0
    reflection_check: float = 0.0
    edge_analysis: float = 0.0
    skin_tone_analysis: float = 0.0


class LivenessResult(BaseModel):
    liveness_score: float = 0.0
    is_live: bool = False
    checks: LivenessChecks = LivenessChecks()
    anti_spoof_confidence: float = 0.0


class FraudChecks(BaseModel):
    ela_score: float = 0.0
    edge_consistency: float = 0.0
    noise_uniformity: float = 0.0
    copy_move_detected: bool = False
    jpeg_ghost_score: float = 0.0
    metadata_suspicious: bool = False
    resolution_adequate: bool = True


class FraudResult(BaseModel):
    fraud_score: float = 0.0
    is_suspicious: bool = False
    checks: FraudChecks = FraudChecks()
    flags: List[str] = []
    analysis_details: str = ""


class RiskBreakdown(BaseModel):
    face_match_score: float = 0.0
    document_quality: float = 0.0
    liveness_score: float = 0.0
    data_consistency: float = 0.0
    fraud_indicators: float = 0.0


class RiskResult(BaseModel):
    risk_score: float = 0.0
    decision: Decision = Decision.REVIEW
    decision_reasons: List[str] = []
    recommended_action: str = ""
    confidence_percentage: float = 0.0
    breakdown: RiskBreakdown = RiskBreakdown()


class VerificationResult(BaseModel):
    id: Optional[str] = None
    ocr: OCRResult
    face: FaceResult
    liveness: LivenessResult
    fraud: FraudResult
    risk: RiskResult
    processing_time_ms: int = 0
    created_at: Optional[datetime] = None


class VerificationSummary(BaseModel):
    id: str
    created_at: datetime
    document_type: Optional[str]
    face_similarity: Optional[float]
    risk_score: Optional[float]
    decision: Optional[str]
    processing_time_ms: Optional[int]


class PaginatedHistory(BaseModel):
    items: List[VerificationSummary]
    total_count: int
    page: int
    limit: int
    total_pages: int


class HourlyBucket(BaseModel):
    hour: str
    count: int


class StatsResponse(BaseModel):
    total_verifications: int
    approved_count: int
    review_count: int
    rejected_count: int
    avg_processing_time_ms: float
    avg_face_similarity: float
    avg_risk_score: float
    verifications_today: int
    verifications_this_hour: int
    hourly_distribution: List[HourlyBucket]
