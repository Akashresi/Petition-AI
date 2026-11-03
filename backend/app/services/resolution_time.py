"""Resolution Time Prediction Service.

Predicts estimated days to resolve a petition with confidence intervals
based on department, category, priority, and real-time department backlog queue.
Flags departments whose current backlog risk exceeds SLA velocity.
"""
from __future__ import annotations

from typing import Any
from app.database import db

# Priority SLA baselines in days (matches src/lib/sla.ts)
SLA_DAYS_MAP = {
    "critical": 2,
    "high": 5,
    "medium": 7,
    "low": 15,
}

# Category complexity adjustment in days
CATEGORY_OFFSET_DAYS = {
    "Building & Construction": 2,
    "Road & Infrastructure": 1,
    "Corruption & Malpractice": 2,
    "Public Transport": 1,
    "Water Supply": 0,
    "Electricity": -1,
    "Waste Management": -1,
    "Noise Pollution": -1,
    "Parks & Recreation": 0,
    "Sanitation": -1,
    "Animal Control": 0,
}


def predict_resolution_time(
    complaint: dict,
    all_complaints: list[dict] | None = None,
) -> dict[str, Any]:
    """Predict resolution duration interval, confidence, and department backlog risk."""
    priority = (complaint.get("priority") or "medium").lower()
    cat = complaint.get("category", "General")
    dept = complaint.get("assignedDepartment", "Public Works")

    sla_days = SLA_DAYS_MAP.get(priority, 7)

    # 1. Base estimates from priority
    if priority == "critical":
        min_days, max_days = 1, 2
    elif priority == "high":
        min_days, max_days = 3, 5
    elif priority == "medium":
        min_days, max_days = 4, 7
    else:  # low
        min_days, max_days = 7, 12

    # 2. Category complexity adjustment
    cat_offset = CATEGORY_OFFSET_DAYS.get(cat, 0)
    min_days = max(1, min_days + cat_offset)
    max_days = max(min_days + 1, max_days + cat_offset)

    # 3. Department workload backlog analysis
    if all_complaints is None:
        try:
            all_complaints = db.find("complaints", {})
        except Exception:
            all_complaints = []

    dept_pending = [
        c for c in all_complaints
        if c.get("assignedDepartment") == dept
        and c.get("status") not in ["resolved", "closed"]
    ]
    pending_count = len(dept_pending)

    backlog_risk = False
    if pending_count >= 5:
        min_days += 1
        max_days += 2
        backlog_risk = True

    interval_str = f"{min_days}–{max_days} days"
    confidence = round(0.88 - (0.04 * (pending_count // 3)), 2)
    confidence = max(0.72, min(0.95, confidence))

    explanation = (
        f"Estimated {interval_str} turnaround based on {priority.upper()} priority '{cat}' "
        f"assigned to {dept} with {pending_count} pending petitions in queue."
    )
    if backlog_risk:
        explanation += f" Warning: High departmental queue backlog ({pending_count} pending) may impact SLA."

    return {
        "predictedDaysMin": min_days,
        "predictedDaysMax": max_days,
        "confidenceInterval": interval_str,
        "confidence": confidence,
        "slaDays": sla_days,
        "backlogRisk": backlog_risk,
        "departmentPendingCount": pending_count,
        "department": dept,
        "explanation": explanation,
    }
