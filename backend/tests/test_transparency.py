"""Unit tests for Public Transparency Portal endpoint (Task 5.3)."""
import pytest
from fastapi.testclient import TestClient

from app.database import db
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def seed_transparency_data():
    # Insert a resolved petition with statusHistory
    complaint = {
        "id": "c_transparency_test_01",
        "petitionId": "PET-2026-T01",
        "title": "Cleaned open drain at Cross Cut Road",
        "description": "Drain cleaned and disinfected by sanitation squad",
        "category": "Sanitation",
        "assignedDepartment": "Waste Management",
        "priority": "medium",
        "status": "resolved",
        "district": "Coimbatore",
        "submittedAt": "2026-11-01T08:00:00Z",
        "resolvedAt": "2026-11-01T20:00:00Z",
        "slaHours": 72,
        "submittedByName": "Secret Citizen",
        "phone": "9998887776",
        "email": "secret@citizen.local",
    }
    db.insert("complaints", complaint)
    yield
    db.delete("complaints", {"id": "c_transparency_test_01"})


def test_public_transparency_no_auth_required():
    # Public endpoint must not require Authorization header
    response = client.get("/api/analytics/transparency")
    assert response.status_code == 200
    data = response.json()

    assert "summary" in data
    assert "departments" in data
    assert "recentResolutions" in data
    assert "confidence" in data
    assert "explanation" in data

    # Rule 5 compliance
    assert isinstance(data["confidence"], (int, float))
    assert isinstance(data["explanation"], str)
    assert len(data["explanation"]) > 0

    # Summary integrity
    summary = data["summary"]
    assert summary["totalPetitions"] >= 1
    assert summary["resolvedPetitions"] >= 1
    assert 0 <= summary["overallResolutionRatePct"] <= 100
    assert summary["overallSlaCompliancePct"] >= 0


def test_public_transparency_strictly_no_pii():
    response = client.get("/api/analytics/transparency")
    assert response.status_code == 200
    data = response.json()

    # Verify no PII fields in any resolved petition
    pii_keys = {"submittedByName", "submittedBy", "phone", "email", "userId", "address", "raw_phone"}
    for item in data["recentResolutions"]:
        for key in pii_keys:
            assert key not in item, f"PII key '{key}' found in public transparency item: {item}"

        # Must have anonymized public fields
        assert "petitionId" in item
        assert "category" in item
        assert "department" in item
        assert "resolutionHours" in item
        assert "status" in item


def test_public_transparency_departments_metrics():
    response = client.get("/api/analytics/transparency")
    assert response.status_code == 200
    data = response.json()

    for dept in data["departments"]:
        assert "department" in dept
        assert "totalPetitions" in dept
        assert "resolvedPetitions" in dept
        assert "resolutionRatePct" in dept
        assert "avgResolutionHours" in dept
        assert "slaCompliancePct" in dept
        assert 0.0 <= dept["resolutionRatePct"] <= 100.0
