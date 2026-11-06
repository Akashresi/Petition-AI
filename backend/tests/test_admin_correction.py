import pytest
from fastapi import HTTPException
from app.database import db
from app.routers.complaints import (
    create_complaint,
    correct_complaint,
    approve_complaint,
    mark_complaint_as_spam,
    request_citizen_details,
    list_review_queue,
    list_complaints,
    ComplaintIn,
    ComplaintCorrectionIn,
    SpamMarkIn,
    RequestDetailsIn,
)

admin_user = {
    "id": "u_admin_corr",
    "name": "Super Admin",
    "email": "super_admin_corr@example.com",
    "role": "admin",
}

citizen_user = {
    "id": "u_cit_corr",
    "name": "Citizen Corr",
    "email": "citizen_corr@example.com",
    "role": "citizen",
    "phone": "9876543210",
}

officer_user = {
    "id": "u_off_corr",
    "name": "Officer Priya",
    "email": "officer_corr@example.com",
    "role": "officer",
    "department": "Roads & Infrastructure",
}


def test_admin_correction_flow():
    # 1. Citizen creates a complaint
    complaint = create_complaint(
        ComplaintIn(
            title="Random ambiguous text requiring review",
            description="Short note describing an unclear municipal issue.",
            category="Road & Infrastructure",
            location="RS Puram",
            district="Coimbatore",
        ),
        user=citizen_user,
    )
    complaint_id = complaint["id"]

    # Mark it as human_review_required in db
    db.update("complaints", {"id": complaint_id}, {"human_review_required": True})

    # 2. Admin retrieves review queue
    review_list = list_review_queue(user=admin_user)
    assert any(c["id"] == complaint_id for c in review_list)

    # 3. Citizen cannot correct
    with pytest.raises(HTTPException) as exc_info:
        correct_complaint(
            complaint_id=complaint_id,
            req=ComplaintCorrectionIn(
                category="Water Supply",
                department="Water Works",
                priority="high",
                note="Citizen trying to correct",
            ),
            user=citizen_user,
        )
    assert exc_info.value.status_code == 403

    # 4. Admin applies one-click correction
    res_data = correct_complaint(
        complaint_id=complaint_id,
        req=ComplaintCorrectionIn(
            category="Water Supply",
            department="Water Works",
            priority="high",
            note="Admin manual override to Water Works department",
        ),
        user=admin_user,
    )
    assert res_data["complaint"]["category"] == "Water Supply"
    assert res_data["complaint"]["assignedDepartment"] == "Water Works"
    assert res_data["complaint"]["priority"] == "high"
    assert res_data["complaint"]["status"] == "assigned"
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
    corr_audits = [a for a in audit_logs if a.get("action") == "admin_correction"]
    assert len(corr_audits) >= 1
    audit = corr_audits[-1]
    assert audit["details"]["before"]["category"] == "Road & Infrastructure"
    assert audit["details"]["after"]["category"] == "Water Supply"
    assert audit["details"]["note"] == "Admin manual override to Water Works department"


def test_admin_one_click_approve():
    c = create_complaint(
        ComplaintIn(
            title="Pothole needs review approval",
            description="Clear complaint flagged due to low baseline confidence.",
            category="Road & Infrastructure",
            location="Anna Salai",
            district="Coimbatore",
        ),
        user=citizen_user,
    )
    cid = c["id"]
    db.update("complaints", {"id": cid}, {"human_review_required": True})

    # Admin approves as is
    res = approve_complaint(cid, user=admin_user)
    assert res["complaint"]["status"] == "assigned"
    assert res["complaint"]["human_review_required"] is False

    # Stored in corrections collection
    corr = db.find_one("corrections", {"complaintId": cid, "approved_as_is": True})
    assert corr is not None
    assert corr["approved_as_is"] is True

    # Audit log recorded
    audit = db.find_one("audit_logs", {"entityId": cid, "action": "admin_approve"})
    assert audit is not None

    # Appears in officer queue
    officer_queue = list_complaints(user=officer_user)
    assert any(item["id"] == cid for item in officer_queue)


def test_admin_one_click_mark_spam():
    c = create_complaint(
        ComplaintIn(
            title="Spam test petition",
            description="Suspicious text that should be archived as spam.",
            category="Sanitation",
            location="Unknown",
            district="Coimbatore",
        ),
        user=citizen_user,
    )
    cid = c["id"]

    res = mark_complaint_as_spam(cid, req=SpamMarkIn(reason="Gibberish words"), user=admin_user)
    assert res["complaint"]["status"] == "closed"
    assert res["complaint"]["is_spam"] is True

    # Officer queue must NOT include spam
    officer_queue = list_complaints(user=officer_user)
    assert not any(item["id"] == cid for item in officer_queue)

    # Audit log recorded
    audit = db.find_one("audit_logs", {"entityId": cid, "action": "admin_mark_spam"})
    assert audit is not None
    assert audit["details"]["reason"] == "Gibberish words"


def test_admin_one_click_request_details():
    c = create_complaint(
        ComplaintIn(
            title="Vague location petition",
            description="Water is dirty in my area please help.",
            category="Water Supply",
            location="Near tree",
            district="Coimbatore",
        ),
        user=citizen_user,
    )
    cid = c["id"]

    res = request_citizen_details(cid, req=RequestDetailsIn(note="Please specify street name"), user=admin_user)
    assert res["complaint"]["id"] == cid

    # Verify status history has note
    doc = db.find_one("complaints", {"id": cid})
    history_notes = [h.get("note", "") for h in doc.get("statusHistory", [])]
    assert any("Please specify street name" in n for n in history_notes)

    # Audit log
    audit = db.find_one("audit_logs", {"entityId": cid, "action": "admin_request_details"})
    assert audit is not None
