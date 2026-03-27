import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Integer, DateTime, JSON, Boolean, Text, ForeignKey
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped, relationship
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
import enum


class DecisionEnum(str, enum.Enum):
    APPROVED = "APPROVED"
    REVIEW = "REVIEW"
    REJECTED = "REJECTED"


class RoleEnum(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(10), default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=True)

    verifications: Mapped[list["KYCVerification"]] = relationship(
        "KYCVerification", back_populates="user", foreign_keys="KYCVerification.user_id"
    )


class KYCVerification(Base):
    __tablename__ = "kyc_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Linked user (nullable — guest submissions allowed)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    user: Mapped["User"] = relationship("User", back_populates="verifications", foreign_keys=[user_id])

    # Document info
    document_type: Mapped[str] = mapped_column(String(50), nullable=True)
    extracted_data: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Scores
    face_similarity: Mapped[float] = mapped_column(Float, nullable=True)
    face_quality_score: Mapped[float] = mapped_column(Float, nullable=True)
    liveness_score: Mapped[float] = mapped_column(Float, nullable=True)
    fraud_score: Mapped[float] = mapped_column(Float, nullable=True)
    fraud_flags: Mapped[list] = mapped_column(JSON, nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=True)
    risk_breakdown: Mapped[dict] = mapped_column(JSON, nullable=True)
    decision: Mapped[str] = mapped_column(String(20), nullable=True)
    decision_reasons: Mapped[list] = mapped_column(JSON, nullable=True)
    processing_time_ms: Mapped[int] = mapped_column(Integer, nullable=True)

    # Image hashes (integrity)
    document_image_hash: Mapped[str] = mapped_column(String(64), nullable=True)
    selfie_image_hash: Mapped[str] = mapped_column(String(64), nullable=True)

    # Permanent image storage paths (relative to STORAGE_DIR)
    document_image_path: Mapped[str] = mapped_column(String(256), nullable=True)
    document_back_image_path: Mapped[str] = mapped_column(String(256), nullable=True)
    selfie_image_path: Mapped[str] = mapped_column(String(256), nullable=True)

    # User-submitted form data (for matching against OCR)
    user_form_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    form_match_result: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Manual review fields
    reviewed_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str] = mapped_column(Text, nullable=True)
    admin_decision: Mapped[str] = mapped_column(String(20), nullable=True)  # override by admin


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
