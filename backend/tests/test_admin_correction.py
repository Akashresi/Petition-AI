import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import db

client = TestClient(app)


def get_auth_token(role: str = "admin", email: str = "admin_corr@example.com") -> str:
    db.delete("users", {"email": email.lower()})
    reg_res = client.post(
        "/api/auth/register",
        json={
            "name": f"Test {role.title()}",
            "email": email,
            "password": "Password123!",
            "phone": "9876543210",
            "address": "Coimbatore",
        },
    )
    assert reg_res.status_code == 200
    user = db.find_one("users", {"email": email.lower()})
    if role != "citizen":
        db.update("users", {"id": user["id"]}, {"role": role})

    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    return login_res.json()["token"]


def test_admin_correction_flow():
    admin_token = get_auth_token(role="admin", email="super_admin_corr@example.com")
    citizen_token = get_auth_token(role="citizen", email="citizen_corr@example.com")

    # 1. Citizen creates a complaint that requires review
    create_res = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={
            "title": "Random ambiguous text requiring review",
            "description": "Short note",
            "category": "Road & Infrastructure",
            "location": "RS Puram",
            "district": "Coimbatore",
        },
    )
    assert create_res.status_code == 200
    complaint = create_res.json()
    complaint_id = complaint["id"]

    # Mark it as human_review_required in db
    db.update("complaints", {"id": complaint_id}, {"human_review_required": True})

    # 2. Admin retrieves review queue
    reviews_res = client.get("/api/complaints/reviews", headers={"Authorization": f"Bearer {admin_token}"})
    assert reviews_res.status_code == 200
    review_list = reviews_res.json()
    assert any(c["id"] == complaint_id for c in review_list)

    # 3. Citizen cannot correct
    unauth_res = client.post(
        f"/api/complaints/{complaint_id}/correct",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={
            "category": "Water Supply",
            "department": "Water Works",
            "priority": "high",
            "note": "Citizen trying to correct",
        },
    )
    assert unauth_res.status_code == 403

    # 4. Admin applies one-click correction
    correct_res = client.post(
        f"/api/complaints/{complaint_id}/correct",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "category": "Water Supply",
            "department": "Water Works",
            "priority": "high",
            "note": "Admin manual override to Water Works department",
        },
    )
    assert correct_res.status_code == 200
    res_data = correct_res.json()
    assert res_data["complaint"]["category"] == "Water Supply"
    assert res_data["complaint"]["assignedDepartment"] == "Water Works"
    assert res_data["complaint"]["priority"] == "high"
    assert res_data["complaint"]["human_review_required"] is False

    # 5. Verify correction record exists in corrections collection
    corrections = db.find("corrections", {"complaintId": complaint_id})
    assert len(corrections) >= 1
    corr = corrections[-1]
    assert corr["before"]["category"] == "Road & Infrastructure"
    assert corr["after"]["category"] == "Water Supply"
    assert corr["after"]["department"] == "Water Works"
    assert corr["after"]["priority"] == "high"
    assert "correctedBy" in corr
    assert "correctedAt" in corr

    # 6. Verify audit log entry exists in audit_logs collection
    audit_logs = db.find("audit_logs", {"entityId": complaint_id})
    assert len(audit_logs) >= 1
    audit = audit_logs[-1]
    assert audit["action"] == "admin_correction"
    assert audit["details"]["before"]["category"] == "Road & Infrastructure"
    assert audit["details"]["after"]["category"] == "Water Supply"
    assert audit["details"]["note"] == "Admin manual override to Water Works department"
    assert "performedBy" in audit
    assert "timestamp" in audit
