"""Unit tests for Fast2SMS and Gupshup WhatsApp webhooks (Task 5.2)."""
import pytest
from fastapi.testclient import TestClient

from app.database import db
from app.main import app
from app.services.sms_service import send_sms, send_complaint_sms
from app.services.whatsapp_service import send_whatsapp, send_complaint_whatsapp

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_webhook_test_data():
    # Insert a known test complaint for status tracking
    test_complaint = {
        "id": "c_webhook_test_100",
        "petitionId": "PET-2026-999",
        "title": "Severe water pipe rupture at Cross Cut Road",
        "description": "Continuous leak flooding street for two days",
        "category": "Water Supply",
        "assignedDepartment": "Water Works",
        "priority": "high",
        "status": "in_progress",
        "slaDeadline": "2026-11-10T12:00:00Z",
    }
    db.insert("complaints", test_complaint)
    yield
    db.delete("complaints", {"id": "c_webhook_test_100"})
    db.delete("complaints", {"petitionId": "PET-2026-999"})


def test_sms_webhook_status_inquiry_found():
    response = client.post(
        "/api/webhooks/sms",
        json={"sender": "9876543210", "message": "STATUS PET-2026-999"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["action"] == "status_inquiry"
    assert data["success"] is True
    assert "PET-2026-999" in data["reply"]
    assert "In Progress" in data["reply"]
    assert "confidence" in data
    assert "explanation" in data
    assert data["confidence"] == 1.0


def test_sms_webhook_status_inquiry_not_found():
    response = client.post(
        "/api/webhooks/sms",
        json={"sender": "9876543210", "message": "STATUS PET-9999-000"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "status_inquiry"
    assert data["success"] is False
    assert "No petition found" in data["reply"]
    assert data["confidence"] == 1.0
    assert "explanation" in data


def test_sms_webhook_new_petition_filing():
    response = client.post(
        "/api/webhooks/sms",
        json={
            "sender": "919443212345",
            "message": "FILE Massive garbage heap burning near residential park emitting toxic smoke",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["action"] == "grievance_filed"
    assert data["success"] is True
    assert data["petitionId"].startswith("PET-")
    assert "Waste Management" in data["reply"] or "Public Safety" in data["reply"]
    assert "confidence" in data
    assert "explanation" in data

    # Verify petition was stored in DB
    created = db.find_one("complaints", {"petitionId": data["petitionId"]})
    assert created is not None
    assert created["channel"] == "sms"
    assert created["status"] == "under_review"

    # Verify audit log entry
    audit = db.find("audit_logs", {"petitionId": data["petitionId"]})
    assert len(audit) >= 1
    assert audit[0]["action"] == "sms_petition_submission"


def test_whatsapp_webhook_verification():
    response = client.get("/api/webhooks/whatsapp?hub.challenge=98765&hub.verify_token=xyz")
    assert response.status_code == 200
    assert response.text == "98765" or response.json() == 98765


def test_whatsapp_gupshup_payload_handling():
    # Simulate Gupshup inbound WhatsApp message format
    gupshup_payload = {
        "app": "PetitionAI",
        "timestamp": 1730628000000,
        "type": "message",
        "payload": {
            "id": "gup_msg_12345",
            "source": "919876543210",
            "type": "text",
            "payload": {
                "text": "STATUS PET-2026-999"
            },
            "sender": {
                "phone": "919876543210",
                "name": "Citizen Ramesh",
            },
        },
    }
    response = client.post("/api/webhooks/whatsapp", json=gupshup_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["action"] == "status_inquiry"
    assert data["success"] is True
    assert "PET-2026-999" in data["reply"]
    assert "confidence" in data
    assert "explanation" in data


def test_whatsapp_direct_filing():
    response = client.post(
        "/api/webhooks/whatsapp",
        json={
            "sender": "919988776655",
            "message": "Streetlights non-functional for 5 consecutive nights on DB Road",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "grievance_filed"
    assert data["success"] is True
    assert "Electricity" in data["reply"] or "Road" in data["reply"]
    assert data["petitionId"] is not None

    stored = db.find_one("complaints", {"petitionId": data["petitionId"]})
    assert stored is not None
    assert stored["channel"] == "whatsapp"


def test_sms_service_fallback_and_helpers():
    assert send_sms("9876543210", "Test fallback message") is True
    assert send_complaint_sms("9876543210", "PET-2026-001", "in_progress") is True


def test_whatsapp_service_fallback_and_helpers():
    assert send_whatsapp("9876543210", "Test WhatsApp fallback message") is True
    assert send_complaint_whatsapp("9876543210", "PET-2026-001", "resolved") is True

