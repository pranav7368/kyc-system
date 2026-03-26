"""
Face Service — face detection via OpenCV Haar cascade + embedding via DeepFace Facenet512.

Key design decisions:
- MTCNN abandoned: crashes with Keras 3 when no face batch exists (INVALID_ARGUMENT).
- DeepFace called with detector_backend='skip': Haar cascade handles all detection,
  so we skip DeepFace's redundant detection pass. This also avoids TF threading
  conflicts when face_service and liveness_service run in parallel asyncio threads.
- Numpy arrays passed directly (not file paths): eliminates path/IO issues in threads.
- Facenet512 chosen: 512-dim embedding, strong accuracy, no MSVC build tools needed.
"""
import logging
import numpy as np
import cv2
from typing import Optional, Tuple

logger = logging.getLogger("kyc.face")

_deepface_ready = False
_haar_cascade = None


def _get_cascade():
    global _haar_cascade
    if _haar_cascade is None:
        _haar_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _haar_cascade


def get_face_app():
    """Warm up DeepFace Facenet512 model. Called once at startup."""
    global _deepface_ready
    if not _deepface_ready:
        try:
            from deepface import DeepFace
            # 160x160 minimum for Facenet512 when using detector_backend='skip'
            dummy = np.ones((160, 160, 3), dtype=np.uint8) * 128
            try:
                DeepFace.represent(
                    img_path=dummy,
                    model_name="Facenet512",
                    enforce_detection=False,
                    detector_backend="skip",
                )
            except Exception:
                pass
            _deepface_ready = True
            logger.info("DeepFace (Facenet512) ready.")
        except ImportError as exc:
            logger.warning(f"DeepFace unavailable ({exc}); embeddings will be None.")
    return _deepface_ready


def _load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        from PIL import Image
        pil = Image.open(path).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def _blur_score(img: np.ndarray) -> float:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _brightness(img: np.ndarray) -> float:
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    return float(np.mean(hsv[:, :, 2])) / 255.0


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = a / (np.linalg.norm(a) + 1e-9)
    b = b / (np.linalg.norm(b) + 1e-9)
    return float(np.dot(a, b))


def _detect_face_box(img_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Detect the largest face using Haar cascade at multiple scales.
    Returns (x, y, w, h) or None.
    """
    cascade = _get_cascade()
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Try progressively more permissive settings
    for scale, neighbors, min_size in [
        (1.05, 5, (40, 40)),   # strict — clear selfies
        (1.05, 3, (25, 25)),   # relaxed — webcam shots
        (1.03, 2, (15, 15)),   # loose  — small ID card photos
    ]:
        faces = cascade.detectMultiScale(
            gray, scaleFactor=scale, minNeighbors=neighbors, minSize=min_size
        )
        if len(faces) > 0:
            best = max(faces, key=lambda f: f[2] * f[3])
            logger.debug(f"Face detected: box={tuple(best)}, scale={scale}")
            return tuple(best)

    logger.debug("No face detected by Haar cascade.")
    return None


def _get_embedding(img_bgr: np.ndarray) -> Optional[np.ndarray]:
    """
    Get Facenet512 embedding from a BGR numpy array.

    Uses detector_backend='skip' because:
    1. Face detection is already done by Haar cascade.
    2. Skipping DeepFace's internal detection avoids TF threading conflicts
       when running alongside liveness_service in parallel asyncio threads.
    3. Numpy arrays avoid all file-path / working-directory issues.

    Resizes to min 160x160 (Facenet512 requirement with skip backend).
    """
    try:
        from deepface import DeepFace

        h, w = img_bgr.shape[:2]
        if h < 160 or w < 160:
            scale = max(160.0 / h, 160.0 / w)
            new_w, new_h = int(w * scale), int(h * scale)
            img_bgr = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        result = DeepFace.represent(
            img_path=img_rgb,
            model_name="Facenet512",
            enforce_detection=False,
            detector_backend="skip",
        )
        if result:
            return np.array(result[0]["embedding"])
        return None
    except Exception as exc:
        logger.warning(f"DeepFace embedding error: {exc}")
        return None


def _process_image(image_path: str) -> Tuple[Optional[np.ndarray], dict]:
    """Load image, detect face, get embedding, assess quality."""
    img = _load_image(image_path)
    blur = _blur_score(img)
    brightness = _brightness(img)

    box = _detect_face_box(img)
    detected = box is not None

    quality = {
        "detected": detected,
        "blur": round(blur, 2),
        "brightness": round(brightness, 3),
        "frontal": detected,
        "face_count": 1 if detected else 0,
    }

    if detected:
        x, y, w, h = box
        pad_x = int(w * 0.25)
        pad_y = int(h * 0.25)
        h_img, w_img = img.shape[:2]
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w_img, x + w + pad_x)
        y2 = min(h_img, y + h + pad_y)
        crop = img[y1:y2, x1:x2]
        emb = _get_embedding(crop) if crop.size > 0 else None
        if emb is None:
            logger.warning(f"Crop embedding failed for {image_path}, trying full image.")
            emb = _get_embedding(img)
    else:
        # No face detected — embed the full image as fallback
        logger.warning(f"No face detected in {image_path}; embedding full image.")
        emb = _get_embedding(img)

    return emb, quality


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compare(doc_image_path: str, selfie_image_path: str) -> dict:
    get_face_app()

    doc_emb,    doc_quality    = _process_image(doc_image_path)
    selfie_emb, selfie_quality = _process_image(selfie_image_path)

    if doc_emb is None or selfie_emb is None:
        logger.warning(
            f"Embedding failed — doc={doc_emb is None}, selfie={selfie_emb is None}"
        )
        return {
            "similarity": 0.0,
            "match": False,
            "doc_face_quality": doc_quality,
            "selfie_face_quality": selfie_quality,
            "estimated_age": None,
            "estimated_gender": None,
        }

    similarity = _cosine_similarity(doc_emb, selfie_emb)
    similarity = max(0.0, min(1.0, similarity))

    from app.config import settings
    match = bool(similarity >= settings.FACE_MATCH_THRESHOLD)

    age = None
    gender = None
    try:
        from deepface import DeepFace
        img_selfie = _load_image(selfie_image_path)
        img_rgb = cv2.cvtColor(img_selfie, cv2.COLOR_BGR2RGB)
        analysis = DeepFace.analyze(
            img_path=img_rgb,
            actions=["age", "gender"],
            enforce_detection=False,
            detector_backend="skip",
            silent=True,
        )
        if analysis:
            age = int(analysis[0].get("age", 0)) or None
            g = analysis[0].get("dominant_gender", "")
            gender = "M" if "man" in g.lower() else "F" if "woman" in g.lower() else None
    except Exception:
        pass

    return {
        "similarity": round(similarity, 4),
        "match": match,
        "doc_face_quality": doc_quality,
        "selfie_face_quality": selfie_quality,
        "estimated_age": age,
        "estimated_gender": gender,
    }
