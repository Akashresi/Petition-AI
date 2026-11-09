"""Webhooks router for Fast2SMS and Gupshup WhatsApp grievance filing and tracking.

Handles inbound SMS and WhatsApp callbacks:
  1. Status inquiry: 'STATUS <petition_id>' -> responds with current status, priority, and SLA.
  2. Grievance filing: 'FILE <description>' or plain complaint text -> runs AI analysis, creates
     petition, assigns tracking ID, and responds with immediate confirmation.
All AI responses strictly adhere to Rule 5 with confidence score and explanation.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.ai.duplicates import detect_duplicates
from app.ai.language import process_language
from app.ai.ml_pipeline import generate_ai_analysis
from app.database import db
from app.security import mask_pii
from app.services.scheduler import calculate_sla_deadline, SLA_DEADLINES
from app.services.sms_service import send_sms
from app.services.whatsapp_service import send_whatsapp

logger = logging.getLogger("petitionai.webhooks")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _allocate_petition_id() -> str:
    year = datetime.now().year
    prefix = f"PET-{year}-"
    existing = {c.get("petitionId", "") for c in db.find("complaints", {})}
    seq = 1
    while f"{prefix}{seq:03d}" in existing:
        seq += 1
    return f"{prefix}{seq:03d}"


def _get_or_create_citizen(phone: str, channel: str) -> dict:
    clean = re.sub(r"\D", "", phone or "")
    user = db.find_one("users", {"phone": clean})
    if not user:
        clean_suffix = clean[-4:] if len(clean) >= 4 else "0000"
        user = {
            "id": f"u_{channel}_{int(datetime.now().timestamp() * 1000)}",
            "name": f"Citizen ({channel.upper()}-{clean_suffix})",
            "email": f"{clean}@{channel}.petitionai.local",
            "phone": clean,
            "role": "citizen",
            "createdAt": datetime.now().isoformat(),
        }
        db.insert("users", user)
    return user


def _process_inbound_message(raw_text: str, sender_phone: str, channel: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    clean_phone = re.sub(r"\D", "", sender_phone or "")

    # 1. Status inquiry pattern: "STATUS <petition_id>"
    status_match = re.match(r"^STATUS\s+([A-Za-z0-9\-_]+)", text, re.IGNORECASE)
    if status_match:
        target_id = status_match.group(1).strip()
        complaint = db.find_one("complaints", {"petitionId": target_id}) or db.find_one("complaints", {"id": target_id})
        if complaint:
            status_fmt = complaint.get("status", "unknown").replace("_", " ").title()
            reply_msg = (
                f"🏛️ PetitionAI Status for {complaint.get('petitionId', target_id)}:\n"
                f"• Title: {complaint.get('title')}\n"
                f"• Status: {status_fmt}\n"
                f"• Department: {complaint.get('assignedDepartment')}\n"
                f"• Priority: {complaint.get('priority', '').upper()}\n"
                f"• SLA Deadline: {complaint.get('slaDeadline', 'N/A')[:10]}"
            )
            confidence = 1.0
            explanation = f"Direct database match for petition {target_id}."
            return {
                "action": "status_inquiry",
                "success": True,
                "reply": reply_msg,
                "petition": complaint,
                "confidence": confidence,
                "explanation": explanation,
            }
        else:
            reply_msg = f"❌ No petition found matching '{target_id}'. Please check your petition ID."
            return {
                "action": "status_inquiry",
                "success": False,
                "reply": reply_msg,
                "petition": None,
                "confidence": 1.0,
                "explanation": f"Petition ID '{target_id}' does not exist in the database.",
            }

    # 2. Grievance filing: "FILE <text>" or general message text
    grievance_text = text
    if re.match(r"^FILE\s*[:\-]?\s*", grievance_text, re.IGNORECASE):
        grievance_text = re.sub(r"^FILE\s*[:\-]?\s*", "", grievance_text, flags=re.IGNORECASE).strip()

    if len(grievance_text) < 5:
        reply_msg = (
            "🏛️ Welcome to PetitionAI.\n"
            "• To file a petition: send 'FILE <your issue description>' (at least 5 characters).\n"
            "• To track a petition: send 'STATUS <PetitionID>'"
        )
        return {
            "action": "help",
            "success": False,
            "reply": reply_msg,
            "confidence": 1.0,
            "explanation": "Input text too short to form a valid grievance.",
        }

    # Process grievance text through language and AI pipeline
    user = _get_or_create_citizen(clean_phone, channel)
    lang_info = process_language(grievance_text)
    norm_text = lang_info["normalized_text"]

    # Extract title from first sentence or first 60 chars
    first_sentence = re.split(r"[.\n?!]", norm_text)[0].strip()
    title = first_sentence[:80] if len(first_sentence) >= 5 else norm_text[:80]

    existing = db.find("complaints", {})
    dup = detect_duplicates(
        norm_text,
        existing,
        threshold=0.65,
        radius_km=15.0,
        window_days=30,
    )

    analysis = generate_ai_analysis(title, norm_text, None)
    priority = analysis.get("priority", "medium")
    now_iso = datetime.now().isoformat()
    sla_deadline = calculate_sla_deadline(now_iso, priority)
    sla_hours = SLA_DEADLINES.get(priority.lower(), 168)
    petition_id = _allocate_petition_id()

    complaint = {
        "id": f"c_{channel}_{int(datetime.now().timestamp() * 1000)}",
        "petitionId": petition_id,
        "title": title,
        "description": grievance_text,
        "original_text": lang_info["original_text"],
        "detected_language": lang_info["detected_language"],
        "language_name": lang_info["language_name"],
        "normalized_text": norm_text,
        "category": analysis["category"],
        "location": "Submitted via " + channel.upper(),
        "district": "Coimbatore",
        "submittedBy": user["id"],
        "submittedByName": user["name"],
        "submittedAt": now_iso,
        "status": "under_review",
        "priority": priority,
        "assignedDepartment": analysis["department"],
        "slaDeadline": sla_deadline,
        "slaHours": sla_hours,
        "reminderSent": False,
        "isEscalated": False,
        "isDuplicate": dup.get("isDuplicate", False),
        "duplicateCount": dup.get("duplicateCount", 0),
        "masterPetitionId": dup.get("masterPetitionId"),
        "masterPetitionTitle": dup.get("masterPetitionTitle"),
        "supporterCount": 1,
        "supportedBy": [user["id"]],
        "human_review_required": analysis.get("human_review_required", False),
        "channel": channel,
    }
    db.insert("complaints", complaint)

    # Log audit entry
    db.insert("audit_logs", {
        "id": f"audit_{int(datetime.now().timestamp() * 1000)}",
        "action": f"{channel}_petition_submission",
        "entity": "complaint",
        "entityId": complaint["id"],
        "petitionId": petition_id,
        "performedBy": user["id"],
        "performedByName": user["name"],
        "details": {
            "channel": channel,
            "sender": mask_pii(clean_phone),
            "category": analysis["category"],
            "department": analysis["department"],
            "priority": priority,
        },
        "timestamp": now_iso,
    })

    reply_msg = (
        f"✅ Grievance registered successfully!\n"
        f"• Petition ID: *{petition_id}*\n"
        f"• Category: {analysis['category']}\n"
        f"• Department: {analysis['department']}\n"
        f"• Priority: {priority.upper()}\n"
        f"• SLA Target: {sla_hours} hours\n"
        f"Track progress anytime by sending 'STATUS {petition_id}'."
    )

    return {
        "action": "grievance_filed",
        "success": True,
        "reply": reply_msg,
        "petitionId": petition_id,
        "complaint": complaint,
        "confidence": analysis.get("confidence", 0.85),
        "explanation": analysis.get("explanation", f"Registered and classified via {channel} webhook."),
    }


# ── SMS Webhook (Fast2SMS & Generic) ──────────────────────────────────────────

class SMSWebhookPayload(BaseModel):
    sender: str = Field(..., description="Sender phone number")
    message: str = Field(..., description="SMS message text")


@router.post("/sms")
async def handle_sms_webhook(payload: SMSWebhookPayload) -> dict:
    """Handle inbound SMS from Fast2SMS or direct webhook integration."""
    result = _process_inbound_message(payload.message, payload.sender, channel="sms")
    # Dispatch reply back to citizen
    send_sms(payload.sender, result["reply"])
    return {
        "status": "ok",
        "action": result["action"],
        "success": result["success"],
        "reply": result["reply"],
        "petitionId": result.get("petitionId"),
        "confidence": result["confidence"],
        "explanation": result["explanation"],
    }


# ── WhatsApp Webhook (Gupshup & Generic) ──────────────────────────────────────

@router.get("/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
) -> Any:
    """Gupshup / WhatsApp webhook verification handshake endpoint."""
    if hub_challenge:
        return int(hub_challenge) if hub_challenge.isdigit() else hub_challenge
    return {"status": "active", "service": "PetitionAI Gupshup WhatsApp Gateway"}


@router.post("/whatsapp")
async def handle_whatsapp_webhook(request: Request) -> dict:
    """Handle inbound WhatsApp message from Gupshup webhook."""
    body_bytes = await request.body()
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    sender = ""
    message = ""

    # 1. Direct standard format: {"sender": "919876543210", "message": "STATUS PET-2024-001"}
    if "sender" in data and "message" in data:
        sender = str(data["sender"])
        message = str(data["message"])
    # 2. Gupshup enterprise payload format
    elif data.get("type") == "message":
        payload = data.get("payload", {})
        sender = payload.get("source", "") or payload.get("sender", {}).get("phone", "")
        if payload.get("type") == "text":
            message = payload.get("payload", {}).get("text", "") or payload.get("text", "")
    elif "mobile" in data and "text" in data:
        sender = str(data["mobile"])
        message = str(data["text"])

    if not sender or not message:
        return {
            "status": "ignored",
            "detail": "Non-message event or missing sender/message payload",
            "confidence": 1.0,
            "explanation": "Event did not contain text message payload.",
        }

    result = _process_inbound_message(message, sender, channel="whatsapp")
    # Dispatch reply back to citizen
    send_whatsapp(sender, result["reply"])

    return {
        "status": "ok",
        "action": result["action"],
        "success": result["success"],
        "reply": result["reply"],
        "petitionId": result.get("petitionId"),
        "confidence": result["confidence"],
        "explanation": result["explanation"],
    }


# ── Telegram Bot Webhook ──────────────────────────────────────────────────

@router.post("/telegram")
async def handle_telegram_webhook(request: Request) -> dict:
    """Handle inbound message from Telegram Bot webhook."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    msg = data.get("message") or data.get("edited_message") or {}
    sender = str(msg.get("from", {}).get("id", "")) or str(msg.get("chat", {}).get("id", ""))
    message = msg.get("text", "")

    if not sender or not message:
        return {
            "status": "ignored",
            "detail": "Non-message event or missing sender/text payload",
            "confidence": 1.0,
            "explanation": "Event did not contain text message payload.",
        }

    result = _process_inbound_message(message, sender, channel="telegram")

    return {
        "status": "ok",
        "action": result["action"],
        "success": result["success"],
        "reply": result["reply"],
        "petitionId": result.get("petitionId"),
        "confidence": result["confidence"],
        "explanation": result["explanation"],
    }


