"""Unit tests for Active Learning retraining pipeline."""
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from scripts.retrain import retrain_model


@pytest.fixture
def client():
    return TestClient(app)


def test_retrain_model_function():
    mock_corrections = [
        {
            "text": "Frequent severe flooding on canal bank street whenever heavy rain occurs",
            "category": "Water Supply",
            "correctedCategory": "Water Supply",
            "language": "en",
        },
        {
            "text": "Loud horn and modified silencer sound disturbing hospital quiet zone",
            "category": "Noise Pollution",
            "correctedCategory": "Noise Pollution",
            "language": "en",
        },
    ]

    result = retrain_model(corrections=mock_corrections)
    assert result["status"] == "success"
    assert result["retrained"] is True
    assert result["correctionsApplied"] >= 2
    assert "beforeMetrics" in result
    assert "afterMetrics" in result
    assert "confidence" in result
    assert "explanation" in result
    assert result["confidence"] > 0.8
    assert Path(result["modelPath"]).exists()


def test_retrain_endpoint_admin_authorized(client):
    admin_token = create_token("u3")  # u3 is admin in seed
    res = client.post("/api/analytics/retrain", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "beforeMetrics" in data
    assert "afterMetrics" in data


def test_retrain_endpoint_citizen_forbidden(client):
    citizen_token = create_token("u1")  # u1 is citizen
    res = client.post("/api/analytics/retrain", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res.status_code == 403
