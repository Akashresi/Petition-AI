"""Unit tests for official auto-drafting and RTI response system."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from app.services.draft_service import generate_official_draft
from app.database import db


@pytest.fixture
def client():
    return TestClient(app)


def test_generate_official_draft_english():
    sample_complaint = {
        "id": "c_draft_en",
        "petitionId": "PET-EN-101",
        "title": "Severe road crater and pothole repair",
        "category": "Road & Infrastructure",
        "assignedDepartment": "Roads & Infrastructure",
        "district": "Coimbatore",
        "submittedByName": "Akash Rajan",
        "status": "in_progress",
        "detected_language": "en",
        "resolutionDetails": "Asphalt leveling completed.",
    }
    draft = generate_official_draft(sample_complaint)
    assert draft["petitionId"] == "PET-EN-101"
    assert "PET-EN-101" in draft["citizenLetter"]
    assert "Section 19(1)" in draft["citizenLetter"]
    assert "RTI" in draft["rtiLetter"]
    # Rule 5 strict checks
    assert "confidence" in draft
    assert "explanation" in draft
    assert draft["confidence"] >= 0.85
    assert len(draft["explanation"]) > 10


def test_generate_official_draft_multilingual_tamil_hindi():
    ta_complaint = {
        "id": "c_draft_ta",
        "petitionId": "PET-TA-102",
        "title": "குடிநீர் குழாய் உடைந்து தண்ணீர் வீணாகிறது",
        "category": "Water Supply",
        "assignedDepartment": "Water Works",
        "district": "Coimbatore",
        "submittedByName": "சுரேஷ்",
        "status": "resolved",
        "detected_language": "ta",
        "resolutionDetails": "குழாய் சரிசெய்யப்பட்டது.",
    }
    ta_draft = generate_official_draft(ta_complaint)
    assert ta_draft["language"] == "ta"
    assert "தகவல் அறியும் உரிமைச் சட்டம்" in ta_draft["citizenLetter"]
    assert "PET-TA-102" in ta_draft["citizenLetter"]

    hi_complaint = {
        "id": "c_draft_hi",
        "petitionId": "PET-HI-103",
        "title": "सड़क पर गहरा गड्ढा है",
        "category": "Road & Infrastructure",
        "assignedDepartment": "Roads & Infrastructure",
        "district": "Coimbatore",
        "submittedByName": "राहुल",
        "status": "in_progress",
        "detected_language": "hi",
    }
    hi_draft = generate_official_draft(hi_complaint)
    assert hi_draft["language"] == "hi"
    assert "सूचना का अधिकार" in hi_draft["citizenLetter"]


def test_draft_endpoints_workflow(client):
    if not db.find_one("users", {"id": "u2"}):
        db.insert("users", {"id": "u2", "name": "Priya Suresh", "email": "officer@demo.com", "role": "officer"})

    test_c = {
        "id": "c_draft_api_test",
        "petitionId": "PET-DRAFT-99",
        "title": "Street light dark at junction",
        "category": "Electricity",
        "assignedDepartment": "Electricity Board",
        "district": "Coimbatore",
        "submittedByName": "Ravi",
        "status": "in_progress",
    }
    db.insert("complaints", test_c)

    officer_token = create_token("u2")
    headers = {"Authorization": f"Bearer {officer_token}"}

    # 1. Fetch draft
    get_res = client.get("/api/complaints/c_draft_api_test/draft-response", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert "citizenLetter" in data
    assert "rtiLetter" in data

    # 2. Dispatch draft
    post_res = client.post(
        "/api/complaints/c_draft_api_test/send-official-response",
        headers=headers,
        json={
            "letterText": data["citizenLetter"],
            "letterType": "citizen_letter",
        },
    )
    assert post_res.status_code == 200
    dispatch_data = post_res.json()
    assert dispatch_data["status"] == "dispatched"

    # 3. Citizen cannot dispatch
    citizen_token = create_token("u1")
    cit_res = client.post(
        "/api/complaints/c_draft_api_test/send-official-response",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"letterText": "test"},
    )
    assert cit_res.status_code == 403
