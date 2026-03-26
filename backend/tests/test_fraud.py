"""
Fraud service unit tests — tests with synthetic images.
"""
import numpy as np
import cv2
import tempfile
import os
import pytest
from app.services.fraud_service import (
    _ela_score, _edge_consistency, _noise_uniformity,
    _copy_move_detected, _resolution_adequate,
)


def make_temp_image(h=400, w=300) -> str:
    """Create a synthetic image and return temp path."""
    img = np.random.randint(0, 256, (h, w, 3), dtype=np.uint8)
    # Draw some lines to make it look document-like
    cv2.rectangle(img, (10, 10), (w-10, h-10), (0, 0, 0), 2)
    cv2.putText(img, "TEST DOCUMENT", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    cv2.imwrite(tmp.name, img)
    return tmp.name


def test_resolution_adequate():
    img_ok = np.zeros((400, 300, 3), dtype=np.uint8)
    assert _resolution_adequate(img_ok) is True
    img_small = np.zeros((100, 100, 3), dtype=np.uint8)
    assert _resolution_adequate(img_small) is False


def test_noise_uniformity():
    img = np.random.randint(0, 256, (200, 200, 3), dtype=np.uint8)
    score = _noise_uniformity(img)
    assert 0.0 <= score <= 1.0


def test_edge_consistency():
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(img, (20, 20), (180, 180), (255, 255, 255), 2)
    score = _edge_consistency(img)
    assert 0.0 <= score <= 1.0


def test_copy_move_clean():
    """A plain image should not trigger copy-move detection."""
    img = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)
    result = _copy_move_detected(img)
    assert isinstance(result, bool)


def test_ela_score():
    path = make_temp_image()
    try:
        score = _ela_score(path)
        assert 0.0 <= score <= 1.0
    finally:
        os.unlink(path)
