import pytest
from app.ai.spam import detect_spam
from app.ai.ml_pipeline import generate_ai_analysis


# ── Spam Test Cases ───────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "spam_text, expected_keyword",
    [
        ("asdfghjkl qwertyuiop zxcvbnm", "Keyboard mash"),
        ("test 123 sample test run hello world", "Test"),
        ("lorem ipsum dolor sit amet consectetur", "Test"),
        ("water water water water water water water water", "flooding"),
        ("help help help help help help help help", "flooding"),
        ("zzzzzzzzzzzzzzzzzzzzzzzzzz", "Repetitive character"),
        ("????????????????????????????", "character ratio"),
        ("hi", "Too short"),
    ],
)
def test_detects_spam_submissions(spam_text, expected_keyword):
    result = detect_spam(spam_text)
    assert result["is_spam"] is True, f"Failed to detect spam in: {spam_text}"
    assert result["spam_score"] >= 0.50
    assert result["spam_reason"] is not None
    assert expected_keyword.lower() in result["spam_reason"].lower()


# ── Abuse Test Cases ──────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "abusive_text",
    [
        "This officer is a bastard and I will kill you all if not fixed",
        "Fuck this government department and everyone in it",
        "Tu chutiya hai aur tera pura department harami hai",  # Hindi
        "Indha mairu velaiku aagathu kena officer",  # Tamil
        "We are going to bomb the office building if power is not restored",
    ],
)
def test_detects_abusive_submissions(abusive_text):
    result = detect_spam(abusive_text)
    assert result["is_abusive"] is True, f"Failed to detect abuse in: {abusive_text}"
    assert result["abuse_score"] >= 0.50
    assert result["abuse_reason"] is not None


# ── Normal Petitions (Clean Controls) ─────────────────────────────────────────

@pytest.mark.parametrize(
    "legitimate_text",
    [
        "There is a deep pothole on MG Road causing dangerous accidents for daily two-wheeler commuters.",
        "Municipal water supply pipeline has burst near the cross junction and clean water is flooding the street.",
        "Street lights along Ward 12 have been non-functional for three consecutive weeks leaving the area dark.",
        "Garbage collection truck has not visited our residential area for ten days leading to bad smell.",
        "चार दिनों से कॉलोनी में पीने का पानी नहीं आया लोग बहुत परेशान हैं कृपया टैंकर भेजें।",
        "பிரதான சாலையில் குடிநீர் குழாய் உடைந்து சாலையில் லட்சக்கணக்கான லிட்டர் குடிநீர் வீணாகிறது.",
    ],
)
def test_clean_petitions_are_not_flagged_as_spam_or_abuse(legitimate_text):
    result = detect_spam(legitimate_text)
    assert result["is_spam"] is False, f"False positive spam for: {legitimate_text} (reason: {result['spam_reason']})"
    assert result["is_abusive"] is False, f"False positive abuse for: {legitimate_text} (reason: {result['abuse_reason']})"


def test_pipeline_routes_spam_to_human_review():
    analysis = generate_ai_analysis(
        title="test testing 123",
        description="qwertyuiop asdfghjkl zxcvbnm test test"
    )
    assert analysis["human_review_required"] is True
    assert analysis["is_spam"] is True
    assert any("Spam detected" in r for r in analysis["review_reasons"])
