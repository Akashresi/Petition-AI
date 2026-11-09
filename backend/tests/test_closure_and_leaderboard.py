"""
Unit & integration tests for resolution closure quality checks, citizen ratings,
and officer accountability leaderboard.
"""
import pytest
from fastapi.testclient import TestClient

from app.database import db
from app.main import app
from app.routers.auth import create_token
from app.services.closure_check import score_resolution_remarks

client = TestClient(app)


def test_closure_check_standalone():
    complaint = "Large water pipeline rupture on Anna Salai flooding the street"

    # Weak / evasive closure
    weak_res = score_resolution_remarks(complaint, "Ok done")
    assert weak_res["is_weak_closure"] is True
    assert weak_res["quality_score"] < 0.50

    # Blank remarks
    blank_res = score_resolution_remarks(complaint, "")
    assert blank_res["is_weak_closure"] is True
    assert blank_res["quality_score"] == 0.0

    # Genuine detailed resolution
    strong_res = score_resolution_remarks(
        complaint,
        "Water Works field team dispatched to Anna Salai. Pipeline repaired and leaking joint replaced with new collar. Road drained and supply restored."
    )
    assert strong_res["is_weak_closure"] is False
    assert strong_res["quality_score"] >= 0.70


def test_rate_complaint_and_officer_leaderboard():
    if not db.find_one("users", {"id": "u2"}):
        db.insert("users", {"id": "u2", "name": "Priya Suresh", "email": "officer@demo.com", "role": "officer", "department": "Water Works"})
    if not db.find_one("users", {"id": "u1"}):
        db.insert("users", {"id": "u1", "name": "Akash Rajan", "email": "citizen@demo.com", "role": "citizen"})

    officer_token = create_token("u2")
    citizen_token = create_token("u1")

    comp_id = "test_rate_comp_001"
    db.delete("complaints", {"id": comp_id})
    db.insert("complaints", {
        "id": comp_id,
        "petitionId": "PET-TEST-RATE",
        "title": "Broken water valve near market",
        "description": "Continuous water loss from municipal tap",
        "category": "Water Supply",
        "assignedDepartment": "Water Works",
        "assignedOfficer": "u2",
        "assignedOfficerName": "Priya Suresh",
        "status": "in_progress",
        "priority": "medium",
        "submittedBy": "u1",
    })

    res = client.patch(
        f"/api/complaints/{comp_id}",
        headers={"Authorization": f"Bearer {officer_token}"},
        json={
            "status": "resolved",
            "note": "Field team inspected the tap, replaced the broken brass valve, and confirmed zero water leakage.",
            "resolutionDetails": "Replaced valve assembly with certified ISI component.",
        },
    )
    assert res.status_code == 200
    assert res.status_code == 200
    resolved_comp = db.find_one("complaints", {"id": comp_id})
    assert resolved_comp["isWeakClosure"] is False
    assert resolved_comp["resolutionQualityScore"] >= 0.60

    # Citizen rates the resolved complaint (5 stars)
    rate_res = client.post(
        f"/api/complaints/{comp_id}/rate",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={"rating": 5, "comment": "Excellent fast repair by the team!"},
    )
    assert rate_res.status_code == 200
    assert rate_res.json()["status"] == "success"

    # Verify officer leaderboard reflects resolution and rating
    lb_res = client.get(
        "/api/analytics/officer-leaderboard",
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert lb_res.status_code == 200
    data = lb_res.json()
    assert "leaderboard" in data
    assert data["totalOfficers"] >= 1
    # Check that our officer has a score
    matched = [o for o in data["leaderboard"] if o["id"] == "u2"]
    assert len(matched) == 1
    assert matched[0]["resolvedCount"] >= 1
    assert matched[0]["citizenRating"] >= 4.0
    assert matched[0]["accountabilityScore"] > 0
