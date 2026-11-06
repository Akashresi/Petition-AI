"""SMS notification service with pluggable provider.

Currently supports 'console', 'fast2sms', and 'twilio' providers.
Falls back safely to local logging in development and offline mode.
"""
from __future__ import annotations

import logging
import re
import urllib.parse
import urllib.request
import json

from app.config import settings

logger = logging.getLogger("petitionai.sms")


def _clean_phone(phone: str) -> str:
    """Normalize phone number to digits only."""
    return re.sub(r"\D", "", phone or "")


def send_sms(to_phone: str, message: str) -> bool:
    provider = settings.SMS_PROVIDER.lower()

    if provider == "fast2sms":
        return _send_via_fast2sms(to_phone, message)
    elif provider == "twilio":
        return _send_via_twilio(to_phone, message)

    logger.info("[SMS] (%s) To=%s: %s", provider, to_phone, message)
    return True


def _send_via_fast2sms(to_phone: str, message: str) -> bool:
    """Send SMS via Fast2SMS Bulk V2 API."""
    cleaned = _clean_phone(to_phone)
    if not cleaned:
        logger.warning("[SMS] Fast2SMS aborted: Empty destination phone.")
        return False

    api_key = settings.FAST2SMS_API_KEY
    if not api_key:
        logger.info(
            "[SMS] Fast2SMS (simulated - no API key) To=%s: %s",
            cleaned,
            message,
        )
        return True

    payload = json.dumps({
        "route": "q",
        "message": message,
        "language": "english",
        "flash": 0,
        "numbers": cleaned,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://www.fast2sms.com/dev/bulkV2",
        data=payload,
        headers={
            "authorization": api_key,
            "Content-Type": "application/json",
            "User-Agent": "PetitionAI/2.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("return"):
                logger.info("[SMS] Fast2SMS sent successfully to %s", cleaned)
                return True
            logger.warning("[SMS] Fast2SMS returned error: %s", data.get("message"))
            return False
    except Exception as exc:
        logger.warning("[SMS] Fast2SMS network call failed (%s); logged to console: %s", exc, message)
        return True


def _send_via_twilio(to_phone: str, message: str) -> bool:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.info("[SMS] Twilio (simulated - credentials unconfigured) To=%s: %s", to_phone, message)
        return True
    try:
        from twilio.rest import Client

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            to=to_phone,
            from_=settings.TWILIO_FROM_NUMBER,
            body=message,
        )
        logger.info("[SMS] Sent via Twilio to %s", to_phone)
        return True
    except Exception as exc:
        logger.error("[SMS] Twilio send failed to %s: %s", to_phone, exc)
        return False


def send_complaint_sms(to_phone: str, petition_id: str, status: str, lang: str = "en") -> bool:
    """Send SMS notification to citizen in their language (Tamil, Hindi, English)."""
    normalized_lang = (lang or "en").lower()[:2]
    status_clean = status.replace('_', ' ').title()

    if normalized_lang == "ta":
        message = f"PetitionAI: உங்கள் மனு {petition_id} தற்போதைய நிலை: {status_clean}. மனு எண் மூலம் நிலையை அறியலாம்."
    elif normalized_lang == "hi":
        message = f"PetitionAI: आपकी शिकायत {petition_id} की स्थिति: {status_clean}। शिकायत संख्या से स्थिति ट्रैक करें।"
    else:
        message = (
            f"PetitionAI: Your petition {petition_id} status is now "
            f"'{status_clean}'. Track with your Petition ID. "
            f"- PetitionAI"
        )
    return send_sms(to_phone, message)
