import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Integer, DateTime, JSON, Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
import enum


class DecisionEnum(str, enum.Enum):
    APPROVED = "APPROVED"
    REVIEW = "REVIEW"
    REJECTED = "REJECTED"


class Base(DeclarativeBase):
    pass


class KYCVerification(Base):
    __tablename__ = "kyc_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    document_type: Mapped[str] = mapped_column(String(50), nullable=True)
    extracted_data: Mapped[dict] = mapped_column(JSON, nullable=True)
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
    document_image_hash: Mapped[str] = mapped_column(String(64), nullable=True)
    selfie_image_hash: Mapped[str] = mapped_column(String(64), nullable=True)


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
