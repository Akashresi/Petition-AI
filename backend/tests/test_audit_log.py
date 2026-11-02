import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import db

client = TestClient(app)


def get_token(role: str, email: str) -> str:
    db.delete("users", {"email": email.lower()})
    reg_res = client.post(
        "/api/auth/register",
        json={
            "name": f"Audit {role.title()}",
            "email": email,
            "password": "Password123!",
            "phone": "9876543210",
            "address": "Audit City",
        },
    )
    assert reg_res.status_code == 200
    user = db.find_one("users", {"email": email.lower()})
    if role != "citizen":
        db.update("users", {"id": user["id"]}, {"role": role, "department": "Public Works"})

    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    return login_res.json()["token"]


def test_ai_decision_and_human_override_audit_logging():
    admin_token = get_token("admin", "admin_audit_test@example.com")
    officer_token = get_token("officer", "officer_audit_test@example.com")
    citizen_token = get_token("citizen", "citizen_audit_test@example.com")

    # 1. Citizen creates complaint -> triggers AI decision audit log
    create_res = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={
            "title": "Severe water leakage on Gandhi Road",
            "description": "Continuous underground pipe burst leaking thousands of liters",
            "category": "Water Supply",
            "location": "Gandhi Road",
            "district": "Coimbatore",
        },
    )
    assert create_res.status_code == 200
    complaint = create_res.json()
    complaint_id = complaint["id"]
    petition_id = complaint["petitionId"]

    # Verify AI decision log in database
    ai_logs = [
        l for l in db.find("audit_logs", {})
        if l.get("entityId") == complaint_id and l.get("action") == "ai_decision"
    ]
    assert len(ai_logs) >= 1
    ai_log = ai_logs[0]
    assert ai_log["action"] == "ai_decision"
    assert ai_log["petitionId"] == petition_id
    assert "category" in ai_log["details"]
    assert "priority" in ai_log["details"]
    assert "confidence" in ai_log["details"]

    # 2. Officer/Admin updates complaint status -> triggers human override audit log
    update_res = client.patch(
        f"/api/complaints/{complaint_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "status": "in_progress",
            "note": "Assigned emergency pipeline repair team",
            "assignedDepartment": "Water Works",
        },
    )
    assert update_res.status_code == 200

    # Verify human override log in database
    override_logs = [
        l for l in db.find("audit_logs", {})
        if l.get("entityId") == complaint_id and l.get("action") == "human_override"
    ]
    assert len(override_logs) >= 1
    override_log = override_logs[0]
    assert override_log["action"] == "human_override"
    assert override_log["petitionId"] == petition_id
    assert override_log["details"]["newStatus"] == "in_progress"
    assert override_log["details"]["officerRemarks"] == "Assigned emergency pipeline repair team"

    # 3. Admin performs one-click correction -> triggers admin_correction audit log
    corr_res = client.post(
        f"/api/complaints/{complaint_id}/correct",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "category": "Water Supply",
            "department": "Water Works",
            "priority": "critical",
            "note": "Elevated to critical due to resource loss",
        },
    )
    assert corr_res.status_code == 200

    # 4. Admin queries GET /api/complaints/audit/all filtered by petition_id
    filter_res = client.get(
        f"/api/complaints/audit/all?petition_id={petition_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert filter_res.status_code == 200
    filtered_logs = filter_res.json()
    assert len(filtered_logs) >= 3  # ai_decision, human_override, admin_correction
    assert all(l["petitionId"] == petition_id for l in filtered_logs)

    # 5. Admin queries GET /api/complaints/audit/all filtered by action
    action_filter_res = client.get(
        "/api/complaints/audit/all?action=human_override",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert action_filter_res.status_code == 200
    action_logs = action_filter_res.json()
    assert len(action_logs) >= 1
    assert all(l["action"] == "human_override" for l in action_logs)

    # 6. Citizen access to audit logs is forbidden
    citizen_forbidden_res = client.get(
        "/api/complaints/audit/all",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert citizen_forbidden_res.status_code == 403
