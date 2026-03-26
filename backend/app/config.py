from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./kyc.db"
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10_485_760  # 10MB
    FACE_MATCH_THRESHOLD: float = 0.55
    FRAUD_SCORE_THRESHOLD: float = 0.7
    OCR_LANGUAGES: List[str] = ["en", "hi"]
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = ["*"]

    @field_validator("OCR_LANGUAGES", "CORS_ORIGINS", mode="before")
    @classmethod
    def parse_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
