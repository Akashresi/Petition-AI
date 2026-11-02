"""Complaints router - submission, listing, tracking, status updates."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.ai.duplicates import detect_duplicates
from app.ai.ml_pipeline import generate_ai_analysis
from app.database import db
from app.routers.auth import get_current_user
from app.services.email_service import send_complaint_notification
from app.services.sms_service import send_complaint_sms

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


def _petition_id() -> str:
    """Allocate the next sequential petition id, e.g. PET-2026-001."""
    year = datetime.now().year
    prefix = f"PET-{year}-"
    existing = {c.get("petitionId", "") for c in db.find("complaints", {})}
    seq = 1
    while f"{prefix}{seq:03d}" in existing:
        seq += 1
    return f"{prefix}{seq:03d}"


def _public_complaint(c: dict) -> dict:
    c.pop("_id", None)
    return c


def _can_access(user: dict, complaint: dict) -> bool:
    """Owners, the assigned/same-department officer, and admins may access."""
    if user.get("role") == "admin":
        return True
    if complaint.get("submittedBy") == user.get("id"):
        return True
    if user.get("role") == "officer":
        if complaint.get("assignedOfficer") == user.get("id"):
            return True
        if user.get("department") and complaint.get("assignedDepartment") == user.get("department"):
            return True
    return False


class ComplaintIn(BaseModel):
    title: str
    description: str
    category: str = ""
    location: str
    district: str = "Coimbatore"
    images: list[str] = []


class StatusUpdateIn(BaseModel):
    status: str
    note: Optional[str] = None
    officerId: Optional[str] = None
    officerName: Optional[str] = None
    assignedDepartment: Optional[str] = None
    resolutionDetails: Optional[str] = None


@router.get("")
def list_complaints(
    department: Optional[str] = None,
    status: Optional[str] = None,
    submittedBy: Optional[str] = None,
    assignedOfficer: Optional[str] = None,
    user: dict = Depends(get_current_user),
) -> list[dict]:
    query: dict = {}
    if user.get("role") == "officer" and user.get("department"):
        query["assignedDepartment"] = user["department"]
    if department:
        query["assignedDepartment"] = department
    if status:
        query["status"] = status
    if submittedBy:
        query["submittedBy"] = submittedBy
    if assignedOfficer:
        query["assignedOfficer"] = assignedOfficer
    return [_public_complaint(c) for c in db.find("complaints", query, sort=[("submittedAt", -1)])]


@router.post("")
def create_complaint(req: ComplaintIn, user: dict = Depends(get_current_user)) -> dict:
    now = datetime.now().isoformat()

    existing = db.find("complaints", {})
    dup = detect_duplicates(
        f"{req.title} {req.description}", existing, threshold=0.5
    )

    analysis = generate_ai_analysis(req.title, req.description, req.category or None)
    analysis["isDuplicate"] = dup["isDuplicate"]
    analysis["duplicateCount"] = dup["duplicateCount"]
    analysis["similarComplaints"] = dup["similarComplaints"]

    complaint = {
        "id": f"c_{int(datetime.now().timestamp() * 1000)}",
        "petitionId": _petition_id(),
        "title": req.title,
        "description": req.description,
        "category": analysis["category"],
        "location": req.location,
        "district": req.district,
        "submittedBy": user["id"],
        "submittedByName": user["name"],
        "submittedAt": now,
        "status": "under_review",
        "priority": analysis["priority"],
        "assignedDepartment": analysis["department"],
        "human_review_required": analysis.get("human_review_required", False),
        "aiAnalysis": analysis,
        "statusHistory": [
            {"status": "submitted", "timestamp": now, "note": "Petition submitted by citizen", "updatedBy": "System"},
            {
                "status": "under_review",
                "timestamp": (datetime.fromisoformat(now) + timedelta(minutes=1)).isoformat(),
                "note": f"AI analysis complete. Classified as {analysis['category']} ({round(analysis['categoryConfidence'] * 100)}% confidence). Routed to {analysis['department']}.",
                "updatedBy": "AI System",
            },
        ],
        "reopenCount": 0,
        "isEscalated": False,
        "images": req.images,
    }
    db.insert("complaints", complaint)

    # Notify user via email + SMS (best-effort)
    send_complaint_notification(user.get("email", ""), complaint["petitionId"], complaint["title"], complaint["status"])
    send_complaint_sms(user.get("phone", ""), complaint["petitionId"], complaint["status"])

    db.insert("notifications", {
        "id": f"n_{int(datetime.now().timestamp() * 1000)}",
        "userId": user["id"],
        "title": "Petition Submitted Successfully",
        "message": f"Petition {complaint['petitionId']} submitted. AI classified as {analysis['category']}, Priority: {analysis['priority'].upper()}.",
        "type": "success",
        "isRead": False,
        "timestamp": now,
        "petitionId": complaint["petitionId"],
    })

    return _public_complaint(complaint)


@router.get("/{complaint_id}")
def get_complaint(complaint_id: str, user: dict = Depends(get_current_user)) -> dict:
    c = db.find_one("complaints", {"id": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if not _can_access(user, c):
        raise HTTPException(status_code=403, detail="Not allowed to view this complaint")
    return _public_complaint(c)


@router.patch("/{complaint_id}")
def update_complaint(
    complaint_id: str, req: StatusUpdateIn, user: dict = Depends(get_current_user)
) -> dict:
    c = db.find_one("complaints", {"id": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if not _can_access(user, c):
        raise HTTPException(status_code=403, detail="Not allowed to update this complaint")

    now = datetime.now().isoformat()
    updates: dict = {"status": req.status}
    if req.note:
        updates["officerRemarks"] = req.note
    if req.officerId:
        updates["assignedOfficer"] = req.officerId
    if req.officerName:
        updates["assignedOfficerName"] = req.officerName
    if req.assignedDepartment:
        updates["assignedDepartment"] = req.assignedDepartment
    if req.resolutionDetails:
        updates["resolutionDetails"] = req.resolutionDetails

    history = list(c.get("statusHistory", []))
    history.append({
        "status": req.status,
        "timestamp": now,
        "note": req.note or f"Status updated to {req.status}",
        "updatedBy": user.get("name", "System"),
    })
    updates["statusHistory"] = history

    db.update("complaints", {"id": complaint_id}, updates)
    updated = db.find_one("complaints", {"id": complaint_id})

    # Notify petitioner
    petitioner = db.find_one("users", {"id": updated.get("submittedBy")})
    if petitioner:
        send_complaint_notification(petitioner.get("email", ""), updated["petitionId"], updated["title"], req.status)
        send_complaint_sms(petitioner.get("phone", ""), updated["petitionId"], req.status)
        db.insert("notifications", {
            "id": f"n_{int(datetime.now().timestamp() * 1000)}",
            "userId": petitioner["id"],
            "title": f"Status Update: {updated['petitionId']}",
            "message": f"Your petition status is now '{req.status.replace('_', ' ').title()}'.",
            "type": "info",
            "isRead": False,
            "timestamp": now,
            "petitionId": updated["petitionId"],
        })

    return _public_complaint(updated)