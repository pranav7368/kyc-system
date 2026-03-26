"""
Liveness Service — passive anti-spoofing checks using OpenCV + scikit-image.

MTCNN removed: running MTCNN (TensorFlow) in a parallel asyncio thread alongside
DeepFace (also TensorFlow) causes TF internal graph conflicts and embedding failures.
OpenCV Haar cascade is used instead for face ROI detection — no TF dependency.

Checks: face symmetry, LBP texture, specular reflection, edge density, skin tone.
"""
import logging
import numpy as np
import cv2

logger = logging.getLogger("kyc.liveness")

_haar_cascade = None


def _get_detector():
    global _haar_cascade
    if _haar_cascade is None:
        _haar_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        logger.info("OpenCV Haar face detector ready (liveness).")
    return _haar_cascade


def _load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        from PIL import Image
        pil = Image.open(path).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def _get_face_roi(img_bgr: np.ndarray):
    """Detect largest face and return cropped ROI, or None if not found."""
    cascade = _get_detector()
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    for scale, neighbors, min_size in [
        (1.05, 5, (60, 60)),
        (1.05, 3, (40, 40)),
        (1.03, 2, (20, 20)),
    ]:
        faces = cascade.detectMultiScale(
            gray, scaleFactor=scale, minNeighbors=neighbors, minSize=min_size
        )
        if len(faces) > 0:
            best = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = best
            roi = img_bgr[y:y + h, x:x + w]
            return roi if roi.size > 0 else None

    return None


# ---------------------------------------------------------------------------
# Individual liveness checks
# ---------------------------------------------------------------------------

def _face_symmetry_score(img_bgr: np.ndarray) -> float:
    """Real faces have natural bilateral symmetry."""
    try:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        left  = gray[:, :w // 2]
        right = cv2.flip(gray[:, w // 2:], 1)
        min_w = min(left.shape[1], right.shape[1])
        left, right = left[:, :min_w], right[:, :min_w]
        diff = np.abs(left.astype(float) - right.astype(float))
        symmetry = 1.0 - (np.mean(diff) / 128.0)
        return round(float(max(0.0, min(1.0, symmetry))), 4)
    except Exception:
        return 0.6


def _lbp_texture(gray: np.ndarray) -> float:
    """LBP histogram entropy — real faces have richer texture patterns."""
    try:
        from skimage.feature import local_binary_pattern
        lbp = local_binary_pattern(gray, P=24, R=3, method="uniform")
        hist, _ = np.histogram(lbp.ravel(), bins=26, range=(0, 26), density=True)
        entropy = -np.sum(hist * np.log2(hist + 1e-9))
        return round(float(min(1.0, entropy / 4.5)), 4)
    except Exception:
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        var = float(np.var(np.sqrt(sobelx ** 2 + sobely ** 2)))
        return round(min(1.0, var / 2000.0), 4)


def _reflection_check(img_bgr: np.ndarray) -> float:
    """
    Specular highlights check. Real faces in good lighting show small bright spots.
    Dark selfies (low overall brightness) genuinely lack highlights — don't penalise them.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    avg_brightness = float(np.mean(gray)) / 255.0
    _, bright = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    ratio = np.sum(bright > 0) / bright.size
    if 0.001 < ratio < 0.08:
        return 0.85
    elif ratio == 0:
        # Dark image legitimately has no highlights — give neutral score
        return 0.65 if avg_brightness < 0.45 else 0.40
    return 0.60


def _edge_analysis(img_bgr: np.ndarray) -> float:
    """Printed/screen photos have unnaturally sharp pixel-level edges."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    density = np.sum(edges > 0) / edges.size
    if 0.02 < density < 0.15:
        return 0.85
    elif density >= 0.15:
        return 0.40
    return 0.65


def _skin_tone_analysis(img_bgr: np.ndarray) -> float:
    """Check whether colour distribution matches human skin tones."""
    ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
    _, Cr, Cb = cv2.split(ycrcb)
    mask = (Cr > 133) & (Cr < 173) & (Cb > 77) & (Cb < 127)
    ratio = np.sum(mask) / mask.size
    return round(float(min(1.0, ratio / 0.15)), 4)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check(image_path: str) -> dict:
    """Passive liveness check on a selfie image."""
    img = _load_image(image_path)

    face_roi = _get_face_roi(img)
    target = face_roi if face_roi is not None else img
    target_gray = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)

    checks = {
        "face_symmetry":      _face_symmetry_score(target),
        "texture_analysis":   _lbp_texture(target_gray),
        "reflection_check":   _reflection_check(target),
        "edge_analysis":      _edge_analysis(target),
        "skin_tone_analysis": _skin_tone_analysis(target),
    }

    weights = [0.30, 0.25, 0.20, 0.15, 0.10]
    liveness_score = sum(v * w for v, w in zip(checks.values(), weights))
    liveness_score = round(min(1.0, max(0.0, liveness_score)), 4)

    return {
        "liveness_score": liveness_score,
        "is_live": bool(liveness_score >= 0.55),
        "checks": checks,
        "anti_spoof_confidence": round(liveness_score * 0.95, 4),
    }
