"""Unit tests for Voice / Audio petition transcription."""
import base64
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from app.security import validate_audio_upload_content


@pytest.fixture
def client():
    return TestClient(app)


def test_validate_audio_upload_content_wav():
    # Construct a minimal 44-byte WAV header
    wav_header = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    b64 = base64.b64encode(wav_header).decode("utf-8")
    data_bytes, mime = validate_audio_upload_content(b64)
    assert mime == "audio/wav"
    assert len(data_bytes) == len(wav_header)


def test_transcribe_audio_endpoint_and_rule5(client):
    wav_header = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    b64 = base64.b64encode(wav_header).decode("utf-8")
    token = create_token("u1")

    # 1. English transcription
    res_en = client.post(
        "/api/ai/transcribe",
        headers={"Authorization": f"Bearer {token}"},
        json={"audioBase64": b64, "languageHint": "en"},
    )
    assert res_en.status_code == 200
    data_en = res_en.json()
    assert "transcript" in data_en
    assert data_en["detectedLanguage"] == "en"
    # Rule 5 checks
    assert "confidence" in data_en
    assert "explanation" in data_en
    assert isinstance(data_en["confidence"], float)
    assert data_en["confidence"] >= 0.70
    assert len(data_en["explanation"]) > 10

    # 2. Tamil transcription
    res_ta = client.post(
        "/api/ai/transcribe",
        headers={"Authorization": f"Bearer {token}"},
        json={"audioBase64": b64, "languageHint": "ta"},
    )
    assert res_ta.status_code == 200
    data_ta = res_ta.json()
    assert data_ta["detectedLanguage"] == "ta"
    assert "குடிநீர்" in data_ta["transcript"]


def test_transcribe_unauthenticated_rejected(client):
    res = client.post("/api/ai/transcribe", json={"audioBase64": "dummy"})
    assert res.status_code == 401

