import pytest
from app.ai.classifier import get_tfidf_classifier, CATEGORIES, DEPARTMENT_MAP
from app.ai.ml_pipeline import generate_ai_analysis


def test_tfidf_classifier_trained_on_dataset():
    clf = get_tfidf_classifier()
    assert len(clf.classes_) >= 8
    
    # English test
    cat_en, conf_en = clf.classify("major pothole and road collapse on the highway causing accidents")
    assert cat_en in ["Road & Infrastructure", "Building & Construction"]
    assert conf_en > 0.0

    # Hindi test
    cat_hi, conf_hi = clf.classify("चार दिनों से कॉलोनी में पीने का पानी नहीं आया लोग बहुत परेशान हैं")
    assert cat_hi == "Water Supply"
    assert conf_hi > 0.0

    # Tamil test
    cat_ta, conf_ta = clf.classify("டிரான்ஸ்பார்மரில் தீப்பொறி பறந்து வெடிக்கும் சத்தம் கேட்கிறது")
    assert cat_ta == "Electricity"
    assert conf_ta > 0.0


def test_generate_ai_analysis_returns_required_fields():
    result = generate_ai_analysis(
        title="Overflowing garbage on street corner",
        description="Waste collection truck has not visited in two weeks and smell is terrible."
    )
    assert "category" in result
    assert "department" in result
    assert "confidence" in result
    assert isinstance(result["confidence"], float)
    assert "explanation" in result
    assert len(result["explanation"]) > 0
    assert "human_review_required" in result
    assert isinstance(result["human_review_required"], bool)


def test_generate_ai_analysis_fallback_when_llm_fails(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy_invalid_key")
    
    # Should not raise any exception, gracefully falling back to baseline
    result = generate_ai_analysis(
        title="No electricity in the area",
        description="Transformer failed and street lamps are completely dark at night."
    )
    assert result["category"] == "Electricity"
    assert result["department"] == "Electricity Board"
    assert result["confidence"] > 0
    assert "explanation" in result


def test_low_confidence_flags_human_review():
    # Ambiguous or very short text
    result = generate_ai_analysis(title="something", description="random note")
    if result["confidence"] < 0.65:
        assert result["human_review_required"] is True
