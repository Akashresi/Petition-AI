"""Email notification service via SMTP."""
import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger("petitionai.email")


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email via SMTP. Returns True on success (or if SMTP unconfigured/dummy)."""
    if (
        not settings.SMTP_USER
        or not settings.SMTP_PASSWORD
        or "your_email" in settings.SMTP_USER
        or "example.com" in settings.SMTP_USER
    ):
        logger.info(
            "[Email] SMTP not configured (simulated) - would send to=%s subject=%s\n%s",
            to_email, subject, body,
        )
        return True

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("[Email] Sent to %s", to_email)
        return True
    except Exception as exc:  # pragma: no cover
        logger.error("[Email] Failed to send to %s: %s", to_email, exc)
        return False


def send_complaint_notification(to_email: str, petition_id: str, title: str, status: str, lang: str = "en") -> bool:
    normalized_lang = (lang or "en").lower()[:2]
    status_clean = status.replace('_', ' ').title()

    if normalized_lang == "ta":
        subject = f"மனு {petition_id} - நிலை: {status_clean}"
        body = (
            f"அன்புள்ள குடிமகனே,\n\n"
            f"உங்கள் மனு '{title}' ({petition_id}) தற்போதைய நிலை: {status_clean}.\n\n"
            f"மனு எண் மூலம் வலைத்தளத்தில் நிலையை அறியலாம்.\n\n"
            f"நன்றி,\nPetitionAI குழு"
        )
    elif normalized_lang == "hi":
        subject = f"शिकायत {petition_id} - स्थिति: {status_clean}"
        body = (
            f"प्रिय नागरिक,\n\n"
            f"आपकी शिकायत '{title}' ({petition_id}) की वर्तमान स्थिति: {status_clean} है।\n\n"
            f"शिकायत संख्या का उपयोग करके स्थिति ट्रैक कर सकते हैं।\n\n"
            f"धन्यवाद,\nPetitionAI टीम"
        )
    else:
        subject = f"Petition {petition_id} - Status Update: {status_clean}"
        body = (
            f"Dear Citizen,\n\n"
            f"Your petition '{title}' ({petition_id}) has been updated.\n\n"
            f"Current Status: {status_clean}\n\n"
            f"You can track progress using your Petition ID: {petition_id}\n\n"
            f"Thank you,\nPetitionAI Team"
        )
    return send_email(to_email, subject, body)