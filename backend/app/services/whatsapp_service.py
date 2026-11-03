"""WhatsApp notification and dispatch service.

Supports Gupshup WhatsApp Enterprise/Cloud API with local fallback
for development and testing.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.parse
import urllib.request

from app.config import settings

logger = logging.getLogger("petitionai.whatsapp")


def _clean_phone(phone: str) -> str:
    """Normalize phone number to international 12-digit format (defaulting to 91 for India if 10 digits)."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def send_whatsapp(to_phone: str, message: str) -> bool:
    """Send a WhatsApp text message to the specified citizen phone number."""
    provider = settings.WHATSAPP_PROVIDER.lower()

    if provider == "gupshup":
        return _send_via_gupshup(to_phone, message)
    elif provider == "twilio":
        return _send_via_twilio_whatsapp(to_phone, message)

    logger.info("[WhatsApp] (%s) To=%s: %s", provider, to_phone, message)
    return True


def _send_via_gupshup(to_phone: str, message: str) -> bool:
    """Dispatch WhatsApp message using Gupshup Messaging API."""
    cleaned = _clean_phone(to_phone)
    if not cleaned:
        logger.warning("[WhatsApp] Gupshup aborted: Invalid destination phone.")
        return False

    api_key = settings.GUPSHUP_API_KEY
    if not api_key:
        logger.info(
            "[WhatsApp] Gupshup (simulated - no API key) To=%s: %s",
            cleaned,
            message,
        )
        return True

    url = "https://api.gupshup.io/wa/api/v1/msg"
    form_data = urllib.parse.urlencode({
        "channel": "whatsapp",
        "source": settings.GUPSHUP_SOURCE_NUMBER,
        "destination": cleaned,
        "message": json.dumps({"type": "text", "text": message}),
        "src.name": settings.GUPSHUP_APP_NAME,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=form_data,
        headers={
            "apikey": api_key,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "PetitionAI/2.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") in ("submitted", "success", "accepted"):
                logger.info("[WhatsApp] Gupshup message sent to %s (id=%s)", cleaned, data.get("messageId"))
                return True
            logger.warning("[WhatsApp] Gupshup dispatch warning: %s", data)
            return True
    except Exception as exc:
        logger.warning("[WhatsApp] Gupshup network call failed (%s); logged to console: %s", exc, message)
        return True


def _send_via_twilio_whatsapp(to_phone: str, message: str) -> bool:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.info("[WhatsApp] Twilio (simulated - credentials unconfigured) To=%s: %s", to_phone, message)
        return True
    try:
        from twilio.rest import Client

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        to_addr = f"whatsapp:+{_clean_phone(to_phone)}"
        from_addr = f"whatsapp:{settings.TWILIO_FROM_NUMBER}"
        client.messages.create(to=to_addr, from_=from_addr, body=message)
        logger.info("[WhatsApp] Sent via Twilio WhatsApp to %s", to_phone)
        return True
    except Exception as exc:
        logger.error("[WhatsApp] Twilio WhatsApp send failed to %s: %s", to_phone, exc)
        return False


def send_complaint_whatsapp(to_phone: str, petition_id: str, status: str) -> bool:
    status_fmt = status.replace("_", " ").title()
    message = (
        f"🏛️ *PetitionAI Grievance Portal*\n\n"
        f"Status Update for Petition *{petition_id}*:\n"
        f"Current Status: *{status_fmt}*\n\n"
        f"You can track this anytime by replying `STATUS {petition_id}`."
    )
    return send_whatsapp(to_phone, message)

