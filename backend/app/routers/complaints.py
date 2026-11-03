"""Complaints router - submission, listing, tracking, status updates."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.ai.duplicates import detect_duplicates
from app.ai.language import process_language
from app.ai.ml_pipeline import generate_ai_analysis
from app.database import db
from app.routers.auth import get_current_user
from app.security import mask_pii, submission_limiter, validate_upload_content
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


def _clean_doc(d: dict) -> dict:
    if isinstance(d, dict):
        d.pop("_id", None)
    return d


def _public_complaint(c: dict) -> dict:
    return _clean_doc(c)


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
    lat: Optional[float] = None
    lon: Optional[float] = None
    images: list[str] = []


class StatusUpdateIn(BaseModel):
    status: str
    note: Optional[str] = None
    officerId: Optional[str] = None
    officerName: Optional[str] = None
    assignedDepartment: Optional[str] = None
    resolutionDetails: Optional[str] = None


class ComplaintCorrectionIn(BaseModel):
    category: str
    department: str
    priority: str
    note: Optional[str] = "Corrected via Admin Review Panel"


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
    submission_limiter.check(user.get("id", "anonymous"))

    # Strict input validation
    if not req.title or len(req.title.strip()) < 3:
        raise HTTPException(status_code=400, detail="Title must be at least 3 characters long.")
    if len(req.title) > 200:
        raise HTTPException(status_code=400, detail="Title exceeds maximum length of 200 characters.")
    if not req.description or len(req.description.strip()) < 5:
        raise HTTPException(status_code=400, detail="Description must be at least 5 characters long.")
    if len(req.description) > 5000:
        raise HTTPException(status_code=400, detail="Description exceeds maximum length of 5000 characters.")

    # Validate uploaded images for type and 5MB size limit
    if req.images:
        for img in req.images:
            validate_upload_content(img)

    now = datetime.now().isoformat()
    raw_text = f"{req.title} {req.description}".strip()
    lang_info = process_language(raw_text)

    existing = db.find("complaints", {})
    dup = detect_duplicates(
        lang_info["normalized_text"],
        existing,
        threshold=0.60,
        radius_km=10.0,
        window_days=30,
        new_lat=req.lat,
        new_lon=req.lon,
    )

    # If this is a duplicate of a master petition, increment master supporter count
    if dup.get("isDuplicate") and dup.get("masterPetitionId"):
        master_pid = dup["masterPetitionId"]
        master = db.find_one("complaints", {"id": master_pid}) or db.find_one("complaints", {"petitionId": master_pid})
        if master:
            m_supporters = master.get("supporterCount", 1) + 1
            m_users = list(master.get("supportedBy", []))
            if user["id"] not in m_users:
                m_users.append(user["id"])
            db.update("complaints", {"id": master["id"]}, {"supporterCount": m_supporters, "supportedBy": m_users})

    analysis = generate_ai_analysis(req.title, req.description, req.category or None)
    analysis["detected_language"] = lang_info["detected_language"]
    analysis["language_name"] = lang_info["language_name"]
    analysis["isDuplicate"] = dup["isDuplicate"]
    analysis["duplicateCount"] = dup["duplicateCount"]
    analysis["masterPetitionId"] = dup.get("masterPetitionId")
    analysis["masterPetitionTitle"] = dup.get("masterPetitionTitle")
    analysis["similarComplaints"] = dup["similarComplaints"]

    from app.services.scheduler import calculate_sla_deadline, SLA_DEADLINES

    sla_hours = SLA_DEADLINES.get(analysis["priority"].lower(), 168)
    sla_deadline = calculate_sla_deadline(now, analysis["priority"])

    complaint = {
        "id": f"c_{int(datetime.now().timestamp() * 1000)}",
        "petitionId": _petition_id(),
        "title": req.title,
        "description": req.description,
        "original_text": lang_info["original_text"],
        "detected_language": lang_info["detected_language"],
        "language_name": lang_info["language_name"],
        "normalized_text": lang_info["normalized_text"],
        "category": analysis["category"],
        "location": req.location,
        "district": req.district,
        "lat": req.lat,
        "lon": req.lon,
        "submittedBy": user["id"],
        "submittedByName": user["name"],
        "submittedAt": now,
        "status": "under_review",
        "priority": analysis["priority"],
        "assignedDepartment": analysis["department"],
        "slaDeadline": sla_deadline,
        "slaHours": sla_hours,
        "reminderSent": False,
        "isEscalated": False,
        "isDuplicate": dup["isDuplicate"],
        "duplicateCount": dup["duplicateCount"],
        "masterPetitionId": dup.get("masterPetitionId"),
        "masterPetitionTitle": dup.get("masterPetitionTitle"),
        "supporterCount": 1,
        "supportedBy": [user["id"]],
        "human_review_required": analysis.get("human_review_required", False),
        "aiAnalysis": analysis,
        "statusHistory": [
            {"status": "submitted", "timestamp": now, "note": "Petition submitted by citizen", "updatedBy": "System"},
            {
                "status": "under_review",
                "timestamp": (datetime.fromisoformat(now) + timedelta(minutes=1)).isoformat(),
                "note": (
                    f"AI analysis flagged petition for human review: {'; '.join(analysis.get('review_reasons', []))}. Held from officer dispatch."
                    if analysis.get("human_review_required")
                    else f"AI analysis complete. Classified as {analysis['category']} ({round(analysis['categoryConfidence'] * 100)}% confidence). Routed to {analysis['department']}."
                ),
                "updatedBy": "AI System",
            },
        ],
        "reopenCount": 0,
        "isEscalated": False,
        "images": req.images,
    }
    db.insert("complaints", complaint)

    # Log AI decision to audit trail
    db.insert("audit_logs", {
        "id": f"audit_ai_{int(datetime.now().timestamp() * 1000)}",
        "action": "ai_decision",
        "entityType": "complaint",
        "entityId": complaint["id"],
        "petitionId": complaint["petitionId"],
        "performedBy": "ai_engine",
        "performedByName": "PetitionAI Hybrid Engine",
        "timestamp": now,
        "details": {
            "category": analysis["category"],
            "categoryConfidence": analysis.get("categoryConfidence"),
            "department": analysis["department"],
            "priority": analysis["priority"],
            "confidence": analysis.get("confidence", 0.9),
            "explanation": mask_pii(analysis.get("explanation", "")),
            "human_review_required": analysis.get("human_review_required", False),
        },
    })

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


@router.get("/reviews")
def list_review_queue(user: dict = Depends(get_current_user)) -> list[dict]:
    """List all petitions flagged human_review_required=True for administrative correction."""
    if user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=403, detail="Admin or officer permission required")
    complaints = db.find("complaints", {})
    results = [c for c in complaints if c.get("human_review_required") is True]
    return [_public_complaint(c) for c in results]


@router.get("/audit/all")
def list_all_audit_logs(
    petition_id: Optional[str] = None,
    action: Optional[str] = None,
    user: dict = Depends(get_current_user),
) -> list[dict]:
    """List recent audit logs across complaints, optionally filtered by petitionId or action."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin permission required")
    logs = db.find("audit_logs", {}, sort=[("timestamp", -1)])
    cleaned = [_clean_doc(d) for d in logs]
    if petition_id:
        pid = petition_id.strip().lower()
        cleaned = [
            d for d in cleaned
            if str(d.get("petitionId", "")).lower() == pid or str(d.get("entityId", "")).lower() == pid
        ]
    if action:
        act = action.strip().lower()
        cleaned = [d for d in cleaned if str(d.get("action", "")).lower() == act]
    return cleaned


@router.post("/check-sla")
def trigger_sla_check(user: dict = Depends(get_current_user)) -> dict:
    """Manually trigger background SLA inspection for reminders and auto-escalations."""
    from app.services.scheduler import check_sla_breaches_and_reminders
    return check_sla_breaches_and_reminders()


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

    # Log human override to audit trail
    db.insert("audit_logs", {
        "id": f"audit_override_{int(datetime.now().timestamp() * 1000)}",
        "action": "human_override",
        "entityType": "complaint",
        "entityId": updated["id"],
        "petitionId": updated.get("petitionId"),
        "performedBy": user.get("id"),
        "performedByName": user.get("name", "Officer"),
        "timestamp": now,
        "details": {
            "beforeStatus": c.get("status"),
            "newStatus": req.status,
            "assignedDepartment": req.assignedDepartment or c.get("assignedDepartment"),
            "officerRemarks": mask_pii(req.note or ""),
            "resolutionDetails": mask_pii(req.resolutionDetails or ""),
        },
    })

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


@router.post("/{complaint_id}/support")
def support_complaint(complaint_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Citizen clicks 'I have this issue too' to support a petition."""
    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    supporters = list(c.get("supporters", []))
    if user["id"] in supporters:
        return {
            "message": "Already supported",
            "supporterCount": c.get("supporterCount", len(supporters) or 1),
            "complaint": _public_complaint(c),
        }

    supporters.append(user["id"])
    new_count = c.get("supporterCount", 1) + 1
    db.update("complaints", {"id": c["id"]}, {
        "supporterCount": new_count,
        "supporters": supporters,
    })

    if c.get("masterPetitionId"):
        master = db.find_one("complaints", {"id": c["masterPetitionId"]}) or db.find_one("complaints", {"petitionId": c["masterPetitionId"]})
        if master and master["id"] != c["id"]:
            m_supporters = list(master.get("supporters", []))
            if user["id"] not in m_supporters:
                m_supporters.append(user["id"])
                db.update("complaints", {"id": master["id"]}, {
                    "supporterCount": master.get("supporterCount", 1) + 1,
                    "supporters": m_supporters,
                })

    updated = db.find_one("complaints", {"id": c["id"]})
    return {
        "message": "Support recorded successfully",
        "supporterCount": new_count,
        "complaint": _public_complaint(updated),
    }


@router.post("/{complaint_id}/correct")
def correct_complaint(
    complaint_id: str,
    req: ComplaintCorrectionIn,
    user: dict = Depends(get_current_user),
) -> dict:
    """One-click admin correction of category, department, and priority with audit logging."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin permission required to correct petitions")

    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    now = datetime.now().isoformat()
    before = {
        "category": c.get("category"),
        "department": c.get("assignedDepartment"),
        "priority": c.get("priority"),
    }
    after = {
        "category": req.category,
        "department": req.department,
        "priority": req.priority,
    }

    # 1. Save to corrections collection
    corr_id = f"corr_{int(datetime.now().timestamp() * 1000)}"
    correction_record = {
        "id": corr_id,
        "complaintId": c["id"],
        "petitionId": c.get("petitionId"),
        "correctedBy": user.get("id"),
        "correctedByName": user.get("name"),
        "correctedAt": now,
        "before": before,
        "after": after,
        "note": req.note,
    }
    db.insert("corrections", correction_record)

    # 2. Save to audit_logs collection
    audit_id = f"audit_{int(datetime.now().timestamp() * 1000)}"
    audit_record = {
        "id": audit_id,
        "action": "admin_correction",
        "entityType": "complaint",
        "entityId": c["id"],
        "petitionId": c.get("petitionId"),
        "performedBy": user.get("id"),
        "performedByName": user.get("name"),
        "timestamp": now,
        "details": {
            "before": before,
            "after": after,
            "note": mask_pii(req.note or ""),
        },
    }
    db.insert("audit_logs", audit_record)

    # 3. Update the complaint
    history = list(c.get("statusHistory", []))
    history.append({
        "status": c.get("status", "under_review"),
        "timestamp": now,
        "note": f"Admin correction applied: {before['category']} -> {req.category}, {before['department']} -> {req.department}, {before['priority']} -> {req.priority}",
        "updatedBy": f"Admin ({user.get('name')})",
    })

    updates = {
        "category": req.category,
        "assignedDepartment": req.department,
        "priority": req.priority,
        "human_review_required": False,
        "statusHistory": history,
    }
    if "aiAnalysis" in c and isinstance(c["aiAnalysis"], dict):
        ai_data = dict(c["aiAnalysis"])
        ai_data["category"] = req.category
        ai_data["department"] = req.department
        ai_data["priority"] = req.priority
        ai_data["human_review_required"] = False
        updates["aiAnalysis"] = ai_data

    db.update("complaints", {"id": c["id"]}, updates)
    updated = db.find_one("complaints", {"id": c["id"]})

    return {
        "message": "Petition successfully corrected and verified",
        "correction": _clean_doc(correction_record),
        "auditLog": _clean_doc(audit_record),
        "complaint": _public_complaint(updated),
    }


@router.get("/{complaint_id}/corrections")
def get_complaint_corrections(complaint_id: str, user: dict = Depends(get_current_user)) -> list[dict]:
    """Retrieve corrections history for a given complaint."""
    if user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=403, detail="Admin or officer permission required")
    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return [_clean_doc(d) for d in db.find("corrections", {"complaintId": c["id"]})]


@router.get("/{complaint_id}/audit")
def get_complaint_audit_trail(complaint_id: str, user: dict = Depends(get_current_user)) -> list[dict]:
    """Retrieve audit trail entries for a given complaint."""
    if user.get("role") not in ("admin", "officer"):
        raise HTTPException(status_code=403, detail="Admin or officer permission required")
    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return [_clean_doc(d) for d in db.find("audit_logs", {"entityId": c["id"]})]


@router.post("/{complaint_id}/support")
def support_complaint(complaint_id: str, user: dict = Depends(get_current_user)) -> dict:
    """'I have this issue too' - citizen endorsement increments supporter count."""
    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    supported_by = list(c.get("supportedBy", []))
    user_id = user["id"]

    if user_id in supported_by:
        return {
            "message": "You have already supported this petition.",
            "supporterCount": c.get("supporterCount", 1),
            "supported": True,
            "petitionId": c.get("petitionId"),
        }

    supported_by.append(user_id)
    new_count = c.get("supporterCount", 1) + 1
    now = datetime.now().isoformat()

    history = list(c.get("statusHistory", []))
    history.append({
        "status": c.get("status", "submitted"),
        "timestamp": now,
        "note": f"Supporter count increased to {new_count} ('I have this issue too' citizen endorsement)",
        "updatedBy": user.get("name", "Citizen"),
    })

    updates = {
        "supporterCount": new_count,
        "supportedBy": supported_by,
        "statusHistory": history,
    }
    db.update("complaints", {"id": c["id"]}, updates)

    return {
        "message": "Thank you! Your endorsement ('I have this issue too') has been recorded.",
        "supporterCount": new_count,
        "supported": True,
        "petitionId": c.get("petitionId"),
    }


@router.get("/{complaint_id}/resolution-suggestions")
def get_complaint_resolution_suggestions(complaint_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Retrieve RAG resolution suggestions and templates from past similar resolved petitions."""
    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    from app.services.rag_service import get_resolution_suggestions
    suggestions = get_resolution_suggestions(c, top_k=3)
    return {
        "complaintId": c["id"],
        "petitionId": c.get("petitionId"),
        "totalSuggestions": len(suggestions),
        "suggestions": suggestions,
    }


@router.get("/{complaint_id}/draft-response")
def get_draft_response(complaint_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Generate official administrative reply and RTI draft for officer review."""
    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    from app.services.draft_service import generate_official_draft
    return generate_official_draft(c)


@router.post("/{complaint_id}/send-official-response")
def send_official_response(
    complaint_id: str,
    payload: dict,
    user: dict = Depends(get_current_user),
) -> dict:
    """Manually dispatch approved official government response / RTI letter to citizen."""
    if user.get("role") not in ["officer", "admin"]:
        raise HTTPException(status_code=403, detail="Officer or Admin credentials required to dispatch official communication.")

    c = db.find_one("complaints", {"id": complaint_id}) or db.find_one("complaints", {"petitionId": complaint_id})
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    letter_text = payload.get("letterText", "")
    letter_type = payload.get("letterType", "citizen_letter")
    now = datetime.now().isoformat()

    # Append to status history
    history = list(c.get("statusHistory", []))
    history.append({
        "status": c.get("status", "in_progress"),
        "timestamp": now,
        "note": f"Official {letter_type.replace('_', ' ').title()} dispatched by {user.get('name', 'Officer')}.",
        "updatedBy": user.get("name", "Officer"),
    })

    db.update("complaints", {"id": c["id"]}, {"statusHistory": history, "lastOfficialLetter": letter_text})

    # Log to audit trail
    db.insert("audit_logs", {
        "id": f"audit_letter_{int(datetime.now().timestamp() * 1000)}",
        "action": "official_response_sent",
        "entityType": "complaint",
        "entityId": c["id"],
        "petitionId": c.get("petitionId"),
        "performedBy": user.get("id"),
        "performedByName": user.get("name", "Officer"),
        "timestamp": now,
        "details": {
            "letterType": letter_type,
            "recipient": c.get("submittedByName"),
            "letterLength": len(letter_text),
        },
    })

    # Notify petitioner
    petitioner = db.find_one("users", {"id": c.get("submittedBy")})
    if petitioner:
        db.insert("notifications", {
            "id": f"n_letter_{int(datetime.now().timestamp() * 1000)}",
            "userId": petitioner["id"],
            "title": f"Official Communication: {c.get('petitionId')}",
            "message": f"An official formal response has been dispatched regarding your petition {c.get('petitionId')}.",
            "type": "info",
            "isRead": False,
            "timestamp": now,
            "petitionId": c.get("petitionId"),
        })

    return {
        "status": "dispatched",
        "petitionId": c.get("petitionId"),
        "letterType": letter_type,
        "dispatchedAt": now,
        "dispatchedBy": user.get("name", "Officer"),
    }
