"""Unit tests for multilingual support: English, Hindi, Tamil, and code-mixed detection & storage."""
import pytest
from fastapi.testclient import TestClient

from app.ai.language import detect_language, normalize_text, process_language
from app.ai.ml_pipeline import generate_ai_analysis
from app.database import db
from app.main import app

client = TestClient(app)


def get_token(email: str = "multi_citizen@example.com") -> str:
    db.delete("users", {"email": email.lower()})
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Multilingual Citizen",
            "email": email,
            "password": "Password123!",
            "phone": "9876543210",
            "address": "Tamil Nadu",
        },
    )
    assert reg.status_code == 200
    login = client.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    return login.json()["token"]


def test_language_detection_tamil_hindi_english():
    # Tamil script
    ta_text = "சாலையில் பெரிய பள்ளம் உள்ளது, உடனடியாக சீரமைக்க வேண்டும்."
    lang_code, lang_name = detect_language(ta_text)
    assert lang_code == "ta"
    assert "Tamil" in lang_name

    # Hindi script (Devanagari)
    hi_text = "सड़क पर बड़ा गड्ढा है गाड़ियां दुर्घटनाग्रस्त हो रही हैं।"
    lang_code, lang_name = detect_language(hi_text)
    assert lang_code == "hi"
    assert "Hindi" in lang_name

    # English
    en_text = "Huge pothole on the cross cut road causing traffic jams."
    lang_code, lang_name = detect_language(en_text)
    assert lang_code == "en"
    assert "English" in lang_name


def test_multilingual_text_normalization():
    raw_ta = "  சாலையில்   பெரிய   பள்ளம்   உள்ளது  \n\n  "
    norm = normalize_text(raw_ta)
    assert "\n" not in norm
    assert "  " not in norm
    assert "சாலையில் பெரிய பள்ளம் உள்ளது" in norm


def test_multilingual_classification():
    # Tamil Road grievance
    ta_analysis = generate_ai_analysis("சாலை பழுது", "சாலையில் பெரிய பள்ளம் உள்ளது உடனடியாக சீரமைக்க வேண்டும்")
    assert "category" in ta_analysis
    assert "confidence" in ta_analysis
    assert "explanation" in ta_analysis

    # Hindi Water grievance
    hi_analysis = generate_ai_analysis("पानी की समस्या", "चार दिनों से कॉलोनी में पीने का पानी नहीं आया कृपया टैंकर भेजें")
    assert "category" in hi_analysis
    assert "confidence" in hi_analysis
    assert "explanation" in hi_analysis


def test_complaint_stores_multilingual_fields():
    from app.routers.complaints import create_complaint, ComplaintIn

    user = {
        "id": "u_ta_test",
        "name": "Multilingual Citizen",
        "email": "ta@demo.com",
        "role": "citizen",
        "phone": "9876543210",
    }
    ta_title = "சாலையில் பெரிய பள்ளம்"
    ta_desc = "சாலையில் பெரிய பள்ளம் உள்ளது, உடனடியாக சீரமைக்க வேண்டும்."

    complaint = create_complaint(
        ComplaintIn(
            title=ta_title,
            description=ta_desc,
            location="RS Puram",
            district="Coimbatore",
        ),
        user=user,
    )

    assert "original_text" in complaint
    assert ta_title in complaint["original_text"]
    assert complaint["detected_language"] == "ta"
    assert complaint["language_name"] == "Tamil"
    assert "normalized_text" in complaint
    assert "aiAnalysis" in complaint
    assert complaint["aiAnalysis"]["detected_language"] == "ta"
