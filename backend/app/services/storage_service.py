"""
Storage Service — save and serve verification images.
Images are stored under STORAGE_DIR/{verification_id}/
"""
import shutil
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger("kyc.storage")


def get_storage_dir(verification_id: str) -> Path:
    path = Path(settings.STORAGE_DIR) / verification_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_document_image(verification_id: str, source_path: str, suffix: str = "") -> str:
    """Copy document image to permanent storage. Returns relative path."""
    src = Path(source_path)
    dest_dir = get_storage_dir(verification_id)
    filename = f"document{suffix}{src.suffix}"
    dest = dest_dir / filename
    shutil.copy2(src, dest)
    rel = f"{verification_id}/{filename}"
    logger.debug(f"Saved document image: {rel}")
    return rel


def save_selfie_image(verification_id: str, source_path: str) -> str:
    """Copy selfie image to permanent storage. Returns relative path."""
    src = Path(source_path)
    dest_dir = get_storage_dir(verification_id)
    filename = f"selfie{src.suffix}"
    dest = dest_dir / filename
    shutil.copy2(src, dest)
    rel = f"{verification_id}/{filename}"
    logger.debug(f"Saved selfie image: {rel}")
    return rel


def get_image_path(relative_path: str) -> Path:
    """Resolve a relative storage path to an absolute Path."""
    return Path(settings.STORAGE_DIR) / relative_path


def delete_verification_images(verification_id: str):
    """Remove all images for a verification (used for GDPR deletion etc)."""
    storage_dir = Path(settings.STORAGE_DIR) / verification_id
    if storage_dir.exists():
        shutil.rmtree(storage_dir)
        logger.info(f"Deleted images for verification {verification_id}")
