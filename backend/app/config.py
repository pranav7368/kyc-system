"""
Application settings — loaded from .env file.

CORS_ORIGINS and OCR_LANGUAGES are stored as plain strings so pydantic-settings
never tries to JSON-decode them (that would fail for bare values like "*").
They are parsed on first access via properties.
"""
from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./kyc.db"
    UPLOAD_DIR: str = "./uploads"
    STORAGE_DIR: str = "./storage"
    MAX_FILE_SIZE: int = 10_485_760         # 10 MB
    FACE_MATCH_THRESHOLD: float = 0.55
    FRAUD_SCORE_THRESHOLD: float = 0.7
    LOG_LEVEL: str = "INFO"

    # Stored as str — any format works: *, ["*"], http://a,http://b
    _CORS_ORIGINS: str = "*"
    _OCR_LANGUAGES: str = "en,hi"

    # Auth
    SECRET_KEY: str = "change-this-to-a-long-random-secret-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # LLM APIs
    GEMINI_API_KEY: str = ""
    CLAUDE_API_KEY: str = ""

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
        # Tell pydantic-settings the real env var names for our private fields
        "populate_by_name": True,
    }

    def __init__(self, **data):
        # Pull raw string values from env/data before pydantic processes them
        cors_raw = data.pop("CORS_ORIGINS", None)
        ocr_raw  = data.pop("OCR_LANGUAGES", None)
        super().__init__(**data)
        if cors_raw is not None:
            object.__setattr__(self, "_CORS_ORIGINS", cors_raw)
        if ocr_raw is not None:
            object.__setattr__(self, "_OCR_LANGUAGES", ocr_raw)

    @staticmethod
    def _parse_str_list(raw: str) -> List[str]:
        """Parse *, ["*"], http://a,http://b  →  list of strings."""
        s = (raw or "").strip()
        if s.startswith("["):
            try:
                result = json.loads(s)
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass
        if "," in s:
            return [v.strip() for v in s.split(",") if v.strip()]
        return [s] if s else ["*"]

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return self._parse_str_list(self._CORS_ORIGINS)

    @property
    def OCR_LANGUAGES(self) -> List[str]:
        return self._parse_str_list(self._OCR_LANGUAGES)


# Read raw env vars ourselves to avoid pydantic-settings JSON-decoding them
import os
from dotenv import dotenv_values

_env = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))

settings = Settings()
# Inject the raw string values
_cors = _env.get("CORS_ORIGINS") or os.environ.get("CORS_ORIGINS")
_ocr  = _env.get("OCR_LANGUAGES") or os.environ.get("OCR_LANGUAGES")
if _cors:
    object.__setattr__(settings, "_CORS_ORIGINS", _cors)
if _ocr:
    object.__setattr__(settings, "_OCR_LANGUAGES", _ocr)
