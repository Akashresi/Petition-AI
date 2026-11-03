"""Unit tests for RAG resolution suggestion service and endpoint."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from app.services.rag_service import get_resolution_suggestions


@pytest.fixture
def client():
    return TestClient(app)


def test_get_resolution_suggestions_structure_and_rule5():
    sample_complaint = {
        "id": "test_c1",
        "petitionId": "PET-TEST-001",
        "title": "Severe road craters and pothole hazards on highway",
        "description": "Massive pothole cluster near signal damaging two wheelers and causing gridlock.",
        "category": "Road & Infrastructure",
    }

    suggestions = get_resolution_suggestions(sample_complaint, top_k=3)
    assert len(suggestions) > 0
    top = suggestions[0]
    assert "petitionId" in top
    assert "actionTaken" in top
    assert "daysToResolve" in top
    assert "similarity" in top
    # Strict Rule 5 check: confidence + explanation
    assert "confidence" in top
    assert "explanation" in top
    assert isinstance(top["confidence"], float)
    assert top["confidence"] >= 0.70
    assert len(top["explanation"]) > 10


def test_resolution_suggestions_category_relevance():
    road_complaint = {
        "id": "test_c2",
        "petitionId": "PET-TEST-002",
        "title": "Asphalt broken road surface and potholes",
        "description": "Road surface completely degraded needs resurfacing",
        "category": "Road & Infrastructure",
    }

    suggestions = get_resolution_suggestions(road_complaint, top_k=3)
    assert len(suggestions) > 0
    # Top suggestion should be relevant to Road & Infrastructure
    assert suggestions[0]["category"] == "Road & Infrastructure"


def test_resolution_suggestions_endpoint(client):
    from app.database import db
    if not db.find_one("users", {"id": "u2"}):
        db.insert("users", {"id": "u2", "name": "Priya Suresh", "email": "officer@demo.com", "role": "officer"})

    test_c = {
        "id": "c_rag_test",
        "petitionId": "PET-RAG-TEST",
        "title": "Severe road craters and pothole hazards on highway",
        "description": "Massive pothole cluster near signal damaging two wheelers.",
        "category": "Road & Infrastructure",
        "district": "Coimbatore",
        "status": "in_progress",
    }
    db.insert("complaints", test_c)

    officer_token = create_token("u2")
    res = client.get("/api/complaints/c_rag_test/resolution-suggestions", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["complaintId"] == "c_rag_test"
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)
    assert len(data["suggestions"]) > 0
