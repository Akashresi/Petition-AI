"""Tests for Complaints router (/api/complaints/*)."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from app.database import db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_complaints_data():
    """Ensure officer, admin, and citizen users exist in db."""
    if not db.find_one("users", {"id": "u1"}):
        db.insert("users", {"id": "u1", "name": "Akash Rajan", "email": "citizen@demo.com", "role": "citizen"})
    if not db.find_one("users", {"id": "u2"}):
        db.insert("users", {"id": "u2", "name": "Priya Suresh", "email": "officer@demo.com", "role": "officer", "department": "Roads & Infrastructure"})
    if not db.find_one("users", {"id": "u3"}):
        db.insert("users", {"id": "u3", "name": "Admin Rajesh", "email": "admin@demo.com", "role": "admin"})


def test_create_complaint_authenticated():
    """Citizen creates complaint; AI analysis is automatically attached."""
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "title": "Severe water contamination in pipeline",
        "description": "Tap water is brown and smelling bad for past 3 days. Multiple families falling sick.",
        "category": "Water Supply",
        "location": "Sector 4, Gandhipuram",
        "district": "Coimbatore",
        "images": [],
    }
    res = client.post("/api/complaints", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == payload["title"]
    assert data["submittedBy"] == "u1"
    assert "petitionId" in data
    assert "aiAnalysis" in data
    ai = data["aiAnalysis"]
    assert "confidence" in ai and 0.0 <= ai["confidence"] <= 1.0
    assert "explanation" in ai and len(ai["explanation"]) > 0
    assert data["assignedDepartment"] == "Water Works"


def test_list_complaints_citizen():
    """Citizen retrieves list of complaints."""
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/complaints", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_get_complaint_by_id():
    """Fetch complaint by id."""
    token = create_token("u1")
    headers = {"Authorization": f"Bearer {token}"}
    # Create one first
    res = client.post(
        "/api/complaints",
        headers=headers,
        json={
            "title": "Streetlight failure on 5th cross road",
            "description": "Entire street is pitch black for a week causing safety issues.",
            "category": "Electricity",
            "location": "5th Cross Road",
            "district": "Coimbatore",
            "images": [],
        },
    )
    cid = res.json()["id"]

    get_res = client.get(f"/api/complaints/{cid}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == cid


def test_update_complaint_status_admin():
    """Admin or assigned officer can update status."""
    c_token = create_token("u1")
    c_res = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {c_token}"},
        json={
            "title": "Garbage dump near public school",
            "description": "Stray animals and bad odor near gate.",
            "category": "Waste Management",
            "location": "North Town",
            "district": "Coimbatore",
            "images": [],
        },
    )
    cid = c_res.json()["id"]

    admin_token = create_token("u3")
    patch_res = client.patch(
        f"/api/complaints/{cid}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "in_progress", "note": "Inspection team deployed."},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "in_progress"
    assert len(updated["statusHistory"]) >= 3
