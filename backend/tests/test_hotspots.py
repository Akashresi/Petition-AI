"""Unit tests for Hotspot early warning detection."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.hotspot_service import detect_hotspots
from app.routers.auth import create_token


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_headers():
    token = create_token("u3")  # u3 is admin in seed
    return {"Authorization": f"Bearer {token}"}


def test_detect_hotspots_clustering():
    sample_complaints = [
        {"id": "1", "petitionId": "PET-01", "district": "Coimbatore", "category": "Road & Infrastructure", "priority": "medium", "submittedAt": "2024-08-01T10:00:00Z"},
        {"id": "2", "petitionId": "PET-02", "district": "Coimbatore", "category": "Road & Infrastructure", "priority": "high", "submittedAt": "2024-08-02T10:00:00Z"},
        {"id": "3", "petitionId": "PET-03", "district": "Coimbatore", "category": "Road & Infrastructure", "priority": "critical", "submittedAt": "2024-08-03T10:00:00Z"},
        {"id": "4", "petitionId": "PET-04", "district": "Chennai", "category": "Sanitation", "priority": "low", "submittedAt": "2024-08-01T10:00:00Z"},
    ]

    hotspots = detect_hotspots(sample_complaints, min_cluster_size=3, window_days=900)
    assert len(hotspots) == 1
    h = hotspots[0]
    assert h["district"] == "Coimbatore"
    assert h["category"] == "Road & Infrastructure"
    assert h["count"] == 3
    assert h["criticalCount"] == 1
    assert h["severity"] == "critical"
    assert "confidence" in h
    assert "explanation" in h
    assert h["confidence"] >= 0.7


def test_get_hotspots_api_endpoint(client, admin_headers):
    response = client.get("/api/analytics/hotspots", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "totalHotspots" in data
    assert "hotspots" in data
    assert isinstance(data["hotspots"], list)
