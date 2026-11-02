from datetime import datetime, timedelta, timezone
import pytest
from app.database import db
from app.services.scheduler import (
    SLA_DEADLINES,
    calculate_sla_deadline,
    check_sla_breaches_and_reminders,
)


def test_sla_deadlines_match_spec():
    assert SLA_DEADLINES["critical"] == 24
    assert SLA_DEADLINES["high"] == 72
    assert SLA_DEADLINES["medium"] == 168
    assert SLA_DEADLINES["low"] == 336


def test_calculate_sla_deadline_values():
    now = datetime(2026, 11, 2, 10, 0, 0, tzinfo=timezone.utc)
    critical_deadline = calculate_sla_deadline(now, "critical")
    assert "2026-11-03T10:00:00" in critical_deadline

    high_deadline = calculate_sla_deadline(now, "high")
    assert "2026-11-05T10:00:00" in high_deadline


def test_pre_breach_reminder_triggered():
    now = datetime.now(timezone.utc)
    # Create complaint with deadline in 3 hours (inside 25% window of 24h SLA)
    complaint_id = f"test_rem_{int(now.timestamp() * 1000)}"
    pet_id = "PET-TEST-REM"
    deadline = (now + timedelta(hours=3)).isoformat()

    c_doc = {
        "id": complaint_id,
        "petitionId": pet_id,
        "title": "Severe pothole nearing deadline",
        "description": "Danger of accident",
        "priority": "critical",
        "category": "Road & Infrastructure",
        "assignedDepartment": "Roads & Infrastructure",
        "assignedOfficer": "o1",
        "assignedOfficerName": "Priya Suresh",
        "status": "in_progress",
        "submittedAt": (now - timedelta(hours=21)).isoformat(),
        "slaDeadline": deadline,
        "slaHours": 24,
        "reminderSent": False,
        "isEscalated": False,
        "statusHistory": [],
    }
    db.insert("complaints", c_doc)

    res = check_sla_breaches_and_reminders(current_time=now)
    assert any(r["complaintId"] == complaint_id for r in res["reminders_sent"])

    # Verify complaint updated with reminderSent=True
    updated = db.find_one("complaints", {"id": complaint_id})
    assert updated["reminderSent"] is True
    assert any("SLA Pre-breach warning" in h.get("note", "") for h in updated.get("statusHistory", []))


def test_post_breach_auto_escalation_triggered():
    now = datetime.now(timezone.utc)
    # Create complaint with deadline 5 hours in the past (overdue)
    complaint_id = f"test_esc_{int(now.timestamp() * 1000)}"
    pet_id = "PET-TEST-ESC"
    past_deadline = (now - timedelta(hours=5)).isoformat()

    c_doc = {
        "id": complaint_id,
        "petitionId": pet_id,
        "title": "Unattended sewage leak breach",
        "description": "Flooding road for days",
        "priority": "high",
        "category": "Waste Management",
        "assignedDepartment": "Waste Management",
        "assignedOfficer": "o4",
        "assignedOfficerName": "Arun Prasad",
        "status": "in_progress",
        "submittedAt": (now - timedelta(hours=77)).isoformat(),
        "slaDeadline": past_deadline,
        "slaHours": 72,
        "reminderSent": True,
        "isEscalated": False,
        "statusHistory": [],
    }
    db.insert("complaints", c_doc)

    res = check_sla_breaches_and_reminders(current_time=now)
    assert any(e["complaintId"] == complaint_id for e in res["escalations_triggered"])

    # Verify complaint updated with isEscalated=True and status='escalated'
    updated = db.find_one("complaints", {"id": complaint_id})
    assert updated["isEscalated"] is True
    assert updated["status"] == "escalated"
    assert any("SLA Breached! Auto-escalated" in h.get("note", "") for h in updated.get("statusHistory", []))

    # Verify audit log entry was created
    audit_entries = db.find("audit_logs", {"entityId": complaint_id})
    assert len(audit_entries) >= 1
    assert audit_entries[0]["action"] == "sla_auto_escalation"
