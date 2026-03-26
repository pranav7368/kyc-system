"""
Fraud Detection Service — 7-layer document tamper detection.
Uses OpenCV + scikit-image techniques.
"""
import io
import logging
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("kyc.fraud")


def _load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        pil = Image.open(path).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


# ---------------------------------------------------------------------------
# 1. Error Level Analysis (ELA)
# ---------------------------------------------------------------------------

def _ela_score(image_path: str) -> float:
    """
    Re-compress at 95% JPEG quality, compute normalised difference.
    High difference in regions → potential tampering.
    """
    try:
        pil_orig = Image.open(image_path).convert("RGB")
        buf = io.BytesIO()
        pil_orig.save(buf, format="JPEG", quality=95)
        buf.seek(0)
        pil_recompressed = Image.open(buf).convert("RGB")

        orig_arr = np.array(pil_orig, dtype=np.float32)
        recomp_arr = np.array(pil_recompressed, dtype=np.float32)

        diff = np.abs(orig_arr - recomp_arr)
        ela = float(np.mean(diff)) / 255.0
        return round(min(ela * 10, 1.0), 4)  # scale to 0-1
    except Exception as exc:
        logger.debug(f"ELA failed: {exc}")
        return 0.1


# ---------------------------------------------------------------------------
# 2. Edge Consistency
# ---------------------------------------------------------------------------

def _edge_consistency(img: np.ndarray) -> float:
    """Uniform edge density ≈ clean document; abrupt changes → tampering."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    edges = cv2.Canny(gray, 50, 150)
    h, w = edges.shape

    # Divide into 4x4 blocks, measure std of edge density across blocks
    block_h, block_w = h // 4, w // 4
    densities = []
    for i in range(4):
        for j in range(4):
            block = edges[i*block_h:(i+1)*block_h, j*block_w:(j+1)*block_w]
            densities.append(np.mean(block > 0))

    inconsistency = float(np.std(densities))
    # Low std ≈ consistent; we normalise to a 0-1 risk score
    score = min(1.0, inconsistency * 10)
    return round(score, 4)


# ---------------------------------------------------------------------------
# 3. Noise Analysis
# ---------------------------------------------------------------------------

def _noise_uniformity(img: np.ndarray) -> float:
    """Inconsistent noise patterns suggest copy-paste or region editing."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    # Median filter to estimate noise
    median = cv2.medianBlur(gray, 5)
    noise = cv2.absdiff(gray, median).astype(np.float32)

    # Compare noise std across image quadrants
    h, w = noise.shape
    quads = [
        noise[:h//2, :w//2],
        noise[:h//2, w//2:],
        noise[h//2:, :w//2],
        noise[h//2:, w//2:],
    ]
    stds = [float(np.std(q)) for q in quads]
    inconsistency = float(np.std(stds)) / (np.mean(stds) + 1e-6)
    score = min(1.0, inconsistency / 2.0)
    return round(score, 4)


# ---------------------------------------------------------------------------
# 4. Copy-Move Detection (ORB)
# ---------------------------------------------------------------------------

def _copy_move_detected(img: np.ndarray) -> bool:
    """
    ORB feature matching within same image.
    Clustered internal matches → copy-move forgery.
    """
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        orb = cv2.ORB_create(nfeatures=500)
        kp, des = orb.detectAndCompute(gray, None)
        if des is None or len(des) < 50:
            return False

        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des, des)

        # Remove self-matches (same keypoint)
        valid = [m for m in matches if m.queryIdx != m.trainIdx]

        # If many keypoints match at different locations → copy-move
        if len(valid) > 50:
            pts1 = np.float32([kp[m.queryIdx].pt for m in valid])
            pts2 = np.float32([kp[m.trainIdx].pt for m in valid])
            dist = np.linalg.norm(pts1 - pts2, axis=1)
            close_pairs = np.sum(dist < 5)
            return bool(close_pairs > 20)
        return False
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 5. JPEG Ghost Detection
# ---------------------------------------------------------------------------

def _jpeg_ghost_score(image_path: str) -> float:
    """
    Re-compress at multiple quality levels; double-compressed regions
    show unusually low SSIM degradation at the original quality.
    """
    try:
        from skimage.metrics import structural_similarity as ssim

        pil_orig = Image.open(image_path).convert("L")
        orig_arr = np.array(pil_orig)

        ssim_scores = []
        for q in [30, 50, 70, 90]:
            buf = io.BytesIO()
            pil_orig.save(buf, format="JPEG", quality=q)
            buf.seek(0)
            recomp = np.array(Image.open(buf).convert("L"))
            s = ssim(orig_arr, recomp, data_range=255)
            ssim_scores.append(s)

        # Phone-shot JPEGs are already compressed; q30 SSIM is naturally high (~0.85-0.95).
        # Baseline raised to 0.85 to avoid false positives on legitimate documents.
        # Only flag images that score anomalously high (suggests heavy pre-compression/editing).
        ghost_indicator = max(0.0, ssim_scores[0] - 0.85)
        return round(min(ghost_indicator * 2, 1.0), 4)
    except Exception:
        return 0.05


# ---------------------------------------------------------------------------
# 6. Metadata Analysis
# ---------------------------------------------------------------------------

def _metadata_suspicious(image_path: str) -> bool:
    """Check EXIF for editing software signatures."""
    try:
        import piexif
        exif_data = piexif.load(image_path)
        software_tag = exif_data.get("0th", {}).get(piexif.ImageIFD.Software, b"")
        if isinstance(software_tag, bytes):
            software_tag = software_tag.decode("utf-8", errors="ignore").lower()
        suspicious_sw = ["photoshop", "gimp", "paint", "lightroom", "affinity"]
        return any(sw in software_tag for sw in suspicious_sw)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 7. Resolution & Quality Checks
# ---------------------------------------------------------------------------

def _resolution_adequate(img: np.ndarray) -> bool:
    h, w = img.shape[:2]
    return h >= 200 and w >= 200


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze(image_path: str) -> dict:
    """
    Run all 7 fraud detection layers.
    Returns FraudResult-compatible dict.
    """
    img = _load_image(image_path)

    ela = _ela_score(image_path)
    edge = _edge_consistency(img)
    noise = _noise_uniformity(img)
    copy_move = _copy_move_detected(img)
    jpeg_ghost = _jpeg_ghost_score(image_path)
    metadata_sus = _metadata_suspicious(image_path)
    res_ok = _resolution_adequate(img)

    # Aggregate fraud score (weighted)
    weights = {"ela": 0.30, "edge": 0.15, "noise": 0.20, "jpeg": 0.20, "copy": 0.15}
    fraud_score = (
        weights["ela"] * ela
        + weights["edge"] * edge
        + weights["noise"] * noise
        + weights["jpeg"] * jpeg_ghost
        + weights["copy"] * (1.0 if copy_move else 0.0)
    )
    if metadata_sus:
        fraud_score = min(1.0, fraud_score + 0.15)
    if not res_ok:
        fraud_score = min(1.0, fraud_score + 0.10)

    fraud_score = round(fraud_score, 4)

    flags = []
    if ela > 0.4:
        flags.append("High ELA variance — possible region editing")
    if edge > 0.5:
        flags.append("Edge inconsistency detected")
    if noise > 0.5:
        flags.append("Inconsistent noise pattern")
    if copy_move:
        flags.append("Copy-move artefacts detected")
    if jpeg_ghost > 0.5:
        flags.append("JPEG ghost — possible double compression")
    if metadata_sus:
        flags.append("Suspicious editing software in metadata")
    if not res_ok:
        flags.append("Low resolution — below minimum threshold")

    details = "Document appears authentic." if fraud_score < 0.35 else "Suspicious indicators found."

    return {
        "fraud_score": fraud_score,
        "is_suspicious": fraud_score >= 0.35,
        "checks": {
            "ela_score": ela,
            "edge_consistency": edge,
            "noise_uniformity": noise,
            "copy_move_detected": copy_move,
            "jpeg_ghost_score": jpeg_ghost,
            "metadata_suspicious": metadata_sus,
            "resolution_adequate": res_ok,
        },
        "flags": flags,
        "analysis_details": details,
    }
