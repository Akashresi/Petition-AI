"""Tests for POST /api/ai/analyze-image endpoint."""
import base64
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from app.routers import ai
from app.database import db

client = TestClient(app)

# 1x1 transparent PNG in base64
VALID_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
VALID_JPEG_BASE64 = base64.b64encode(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb").decode("utf-8")
VALID_PDF_BASE64 = base64.b64encode(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF").decode("utf-8")


@pytest.fixture(autouse=True)
def setup_test_users():
    """Ensure test users and clean rate limits."""
    ai._rate_limit_records.clear()
    if not db.find_one("users", {"id": "u1"}):
        db.insert("users", {"id": "u1", "name": "Test Citizen", "email": "citizen@demo.com", "role": "citizen"})
    if not db.find_one("users", {"id": "u_rate_limit"}):
        db.insert("users", {"id": "u_rate_limit", "name": "Rate Limited", "email": "rl@demo.com", "role": "citizen"})


def test_analyze_image_unauthorized():
    """Missing or invalid JWT token should return 401."""
    res = client.post("/api/ai/analyze-image", json={"image": VALID_PNG_BASE64})
    assert res.status_code == 401


def test_analyze_image_valid_png():
    """Authenticated request with valid PNG returns 200 with analysis, confidence, explanation."""
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/ai/analyze-image",
        headers=headers,
        json={"image": f"data:image/png;base64,{VALID_PNG_BASE64}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "analysis" in data
    assert "confidence" in data
    assert "explanation" in data
    assert 0.0 <= data["confidence"] <= 1.0


def test_analyze_image_valid_pdf():
    """Authenticated request with PDF magic bytes returns 200."""
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/ai/analyze-image",
        headers=headers,
        json={"image": VALID_PDF_BASE64},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["confidence"] >= 0.70


def test_analyze_image_invalid_base64():
    """Garbage base64 should return 400."""
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/ai/analyze-image",
        headers=headers,
        json={"image": "not_valid_base64!@#$%^"},
    )
    assert res.status_code == 400


def test_analyze_image_unsupported_file_type():
    """Text file magic bytes disguised as image should return 400."""
    fake_data = base64.b64encode(b"This is just a plain text file, not an image.").decode("utf-8")
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/ai/analyze-image",
        headers=headers,
        json={"image": fake_data},
    )
    assert res.status_code == 400
    assert "Unsupported file type" in res.json()["detail"]


def test_analyze_image_oversized():
    """Payload exceeding 5 MB limit should return 400."""
    # 5.1 MB of dummy bytes
    oversized_data = base64.b64encode(b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024 + 100)).decode("utf-8")
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/ai/analyze-image",
        headers=headers,
        json={"image": oversized_data},
    )
    assert res.status_code == 400
    assert "exceeds maximum allowed size" in res.json()["detail"]


def test_analyze_image_rate_limiting():
    """More than 10 requests in 60s window should trigger 429."""
    token = create_token("u_rate_limit")
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(10):
        res = client.post(
            "/api/ai/analyze-image",
            headers=headers,
            json={"image": VALID_PNG_BASE64},
        )
        assert res.status_code == 200

    # 11th request triggers 429
    res = client.post(
        "/api/ai/analyze-image",
        headers=headers,
        json={"image": VALID_PNG_BASE64},
    )
    assert res.status_code == 429
    assert "Rate limit exceeded" in res.json()["detail"]
