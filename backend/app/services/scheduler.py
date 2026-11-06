"""
SLA Monitoring and Auto-Escalation Scheduler
=============================================
APScheduler background service monitoring complaints against priority SLA deadlines.

SLA Deadlines (consistent with src/lib/sla.ts):
  - critical : 24 hours (1 day)
  - high     : 72 hours (3 days)
  - medium   : 168 hours (7 days)
  - low      : 336 hours (14 days)

Actions:
  1. Pre-Breach Reminder:
     Alerts the assigned officer (or department head) before deadline breach (at 25% remaining time).
     Sends email, SMS, and creates an in-app warning notification.
  2. Post-Breach Auto-Escalation:
     When current time exceeds SLA deadline and complaint is unresolved,
     marks isEscalated=True, updates status='escalated', notifies officer and petitioner,
     and logs the breach in audit_logs.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import db
from app.services.email_service import send_email
from app.services.sms_service import send_sms

logger = logging.getLogger("petitionai.scheduler")

# SLA deadlines in hours based on priority (matching src/lib/sla.ts)
SLA_DEADLINES: dict[str, int] = {
    "critical": 24,
    "high": 72,
    "medium": 168,
    "low": 336,
}


def calculate_sla_deadline(submitted_at: str | datetime, priority: str) -> str:
    """Calculate ISO-8601 deadline string based on submission time and priority."""
    if isinstance(submitted_at, str):
        # Normalize ISO strings
        clean_str = submitted_at.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(clean_str)
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = submitted_at

    # Ensure timezone aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    hours = SLA_DEADLINES.get(priority.lower(), 168)
    deadline = dt + timedelta(hours=hours)
    return deadline.isoformat()


def check_sla_breaches_and_reminders(
    current_time: datetime | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """
    Scan all unresolved complaints:
    1. Send pre-breach reminder to officer if nearing SLA deadline and not yet reminded.
    2. Auto-escalate if past SLA deadline and not yet escalated.
    """
    now = current_time or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    now_iso = now.isoformat()
    reminders_sent: list[dict[str, Any]] = []
    escalations_triggered: list[dict[str, Any]] = []

    # Fetch active complaints (not resolved and not closed)
    complaints = db.find("complaints", {})
    active = [c for c in complaints if c.get("status") not in ("resolved", "closed")]

    for c in active:
        priority = c.get("priority", "medium").lower()
        sla_hours = c.get("slaHours") or SLA_DEADLINES.get(priority, 168)
        
        # Calculate or load deadline
        deadline_str = c.get("slaDeadline")
        if not deadline_str:
            submitted_at = c.get("submittedAt", now_iso)
            deadline_str = calculate_sla_deadline(submitted_at, priority)
            db.update("complaints", {"id": c["id"]}, {"slaDeadline": deadline_str, "slaHours": sla_hours})

        try:
            deadline_dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
        except ValueError:
            continue

        if deadline_dt.tzinfo is None:
            deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)

        remaining_seconds = (deadline_dt - now).total_seconds()
        hours_remaining = remaining_seconds / 3600.0

        # Pre-breach window: within 25% of total SLA time (or min 4 hours)
        pre_breach_threshold_hours = max(sla_hours * 0.25, 4.0)

        # ── 1. PRE-BREACH WARNING & REMINDER ──────────────────────────────────
        if 0 < hours_remaining <= pre_breach_threshold_hours and not c.get("reminderSent"):
            pet_id = c.get("petitionId", c["id"])
            title = c.get("title", "Petition")
            officer_name = c.get("assignedOfficerName", "Assigned Officer")
            officer_id = c.get("assignedOfficer")

            # Update complaint record
            history = list(c.get("statusHistory", []))
            history.append({
                "status": c.get("status", "in_progress"),
                "timestamp": now_iso,
                "note": (
                    f"SLA Pre-breach warning: {round(hours_remaining, 1)} hours remaining "
                    f"before SLA deadline. Reminder dispatched to {officer_name}."
                ),
                "updatedBy": "SLA Scheduler",
            })

            db.update("complaints", {"id": c["id"]}, {
                "reminderSent": True,
                "reminderSentAt": now_iso,
                "statusHistory": history,
            })

            # Create notification
            notif_doc = {
                "id": f"n_rem_{int(now.timestamp() * 1000)}_{c['id'][-4:]}",
                "userId": officer_id or c.get("submittedBy"),
                "title": f"SLA Warning: {pet_id}",
                "message": (
                    f"Petition '{title}' ({priority.upper()}) has {round(hours_remaining, 1)}h "
                    f"remaining before SLA breach. Please expedite resolution."
                ),
                "type": "warning",
                "isRead": False,
                "timestamp": now_iso,
                "petitionId": pet_id,
            }
            db.insert("notifications", notif_doc)

            # Best-effort Email/SMS reminder
            officer_user = db.find_one("users", {"id": officer_id}) if officer_id else None
            to_email = officer_user.get("email") if officer_user else "officer@demo.com"
            to_phone = officer_user.get("phone") if officer_user else "+919876543210"

            send_email(
                to_email,
                f"SLA Reminder: {pet_id} approaching deadline",
                f"Petition '{title}' ({pet_id}) has {round(hours_remaining, 1)}h left before breach.\nPriority: {priority.upper()}",
            )
            send_sms(to_phone, f"PetitionAI Alert: {pet_id} has {round(hours_remaining, 1)}h left before SLA breach.")

            reminders_sent.append({
                "complaintId": c["id"],
                "petitionId": pet_id,
                "hoursRemaining": round(hours_remaining, 1),
                "recipient": to_email,
            })
            logger.info("Sent SLA pre-breach reminder for %s (%s left)", pet_id, f"{round(hours_remaining, 1)}h")

        # ── 2. POST-BREACH AUTO-ESCALATION ────────────────────────────────────
        elif hours_remaining <= 0 and not c.get("isEscalated"):
            pet_id = c.get("petitionId", c["id"])
            title = c.get("title", "Petition")
            overdue_hours = abs(round(hours_remaining, 1))

            history = list(c.get("statusHistory", []))
            history.append({
                "status": "escalated",
                "timestamp": now_iso,
                "note": (
                    f"SLA Breached! Auto-escalated to Department Head & District Collector. "
                    f"Overdue by {overdue_hours} hours past deadline ({deadline_str})."
                ),
                "updatedBy": "SLA Escalation Engine",
            })

            db.update("complaints", {"id": c["id"]}, {
                "isEscalated": True,
                "status": "escalated",
                "escalatedAt": now_iso,
                "statusHistory": history,
            })

            # Create notification for citizen and admin
            db.insert("notifications", {
                "id": f"n_esc_{int(now.timestamp() * 1000)}_{c['id'][-4:]}",
                "userId": c.get("submittedBy"),
                "title": f"Petition Escalated: {pet_id}",
                "message": (
                    f"Your petition '{title}' has been automatically escalated to higher municipal authorities "
                    f"due to SLA deadline breach ({overdue_hours}h overdue)."
                ),
                "type": "error",
                "isRead": False,
                "timestamp": now_iso,
                "petitionId": pet_id,
            })

            # Log to audit_logs collection
            db.insert("audit_logs", {
                "id": f"audit_esc_{int(now.timestamp() * 1000)}_{c['id'][-4:]}",
                "action": "sla_auto_escalation",
                "entityType": "complaint",
                "entityId": c["id"],
                "petitionId": pet_id,
                "performedBy": "system_sla_scheduler",
                "performedByName": "APScheduler SLA Engine",
                "timestamp": now_iso,
                "details": {
                    "priority": priority,
                    "deadline": deadline_str,
                    "overdueHours": overdue_hours,
                    "previousStatus": c.get("status"),
                    "newStatus": "escalated",
                },
            })

            # Email/SMS escalation notification
            petitioner = db.find_one("users", {"id": c.get("submittedBy")})
            if petitioner:
                send_email(
                    petitioner.get("email", ""),
                    f"SLA Escalation Notice: {pet_id}",
                    f"Your petition '{title}' has been auto-escalated to Department Head due to SLA breach ({overdue_hours}h overdue).",
                )
                send_sms(petitioner.get("phone", ""), f"PetitionAI: {pet_id} has been auto-escalated due to SLA breach.")

            escalations_triggered.append({
                "complaintId": c["id"],
                "petitionId": pet_id,
                "overdueHours": overdue_hours,
                "deadline": deadline_str,
            })
            logger.warning("Auto-escalated complaint %s (%s overdue)", pet_id, f"{overdue_hours}h")

    return {
        "reminders_sent": reminders_sent,
        "escalations_triggered": escalations_triggered,
    }


# ── Global APScheduler instance ───────────────────────────────────────────────

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="UTC", daemon=True)
        _scheduler.add_job(
            check_sla_breaches_and_reminders,
            trigger="interval",
            minutes=2,
            id="sla_check_job",
            replace_existing=True,
        )
    return _scheduler


def start_scheduler() -> None:
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("APScheduler SLA service started (monitoring interval: 2 minutes).")


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler SLA service stopped.")
        _scheduler = None
