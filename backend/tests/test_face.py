"""
Face service unit tests — tests quality helpers with synthetic images.
"""
import numpy as np
import cv2
import tempfile
import os
import pytest
from app.services.face_service import _blur_score, _brightness, _cosine_similarity


def test_blur_sharp():
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (90, 90), (255, 255, 255), 2)
    score = _blur_score(img)
    assert score > 0


def test_blur_blurry():
    img = np.random.randint(100, 150, (100, 100, 3), dtype=np.uint8)
    blurred = cv2.GaussianBlur(img, (31, 31), 0)
    score = _blur_score(blurred)
    assert score >= 0


def test_brightness_dark():
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    assert _brightness(img) < 0.05


def test_brightness_bright():
    img = np.full((100, 100, 3), 255, dtype=np.uint8)
    assert _brightness(img) > 0.95


def test_cosine_similarity_identical():
    v = np.random.rand(512).astype(np.float32)
    assert abs(_cosine_similarity(v, v) - 1.0) < 1e-5


def test_cosine_similarity_orthogonal():
    a = np.array([1.0, 0.0], dtype=np.float32)
    b = np.array([0.0, 1.0], dtype=np.float32)
    assert abs(_cosine_similarity(a, b)) < 1e-5
