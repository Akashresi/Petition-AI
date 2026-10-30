"""
Unit Tests – PetitionAI Phase 1 AI Engine
==========================================
Run: pytest backend/tests/test_ai_engine.py -v

Each module has its own test class. All tests run without API keys
(no live LLM calls) except where marked @pytest.mark.llm.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Ensure the backend/ directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


# ═══════════════════════════════════════════════════════════════════════════════
# Language detection tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestLanguageDetection:
    def test_english_detection(self):
        from ai_engine.language import detect_language
        code, name = detect_language("There is a pothole on the main road causing accidents.")
        assert code == "en"

    def test_tamil_script_detection(self):
        from ai_engine.language import detect_language
        code, name = detect_language("சாலையில் பெரிய குழி உள்ளது. உடனே சரி செய்யவும்.")
        assert code == "ta"

    def test_hindi_devanagari_detection(self):
        from ai_engine.language import detect_language
        code, name = detect_language("सड़क पर बड़ा गड्ढा है, वाहन खराब हो रहे हैं।")
        assert code == "hi"

    def test_code_mixed_detection(self):
        from ai_engine.language import detect_language
        # Tamil script + Latin
        code, name = detect_language("Road la குழி iruku, please fix it.")
        assert code == "mixed"

    def test_normalize_collapses_whitespace(self):
        from ai_engine.language import normalize_text
        result = normalize_text("Hello   \n\n   World  ")
        assert result == "hello world"

    def test_normalize_preserves_tamil(self):
        from ai_engine.language import normalize_text
        tamil = "சாலை குழி உள்ளது"
        result = normalize_text(tamil)
        assert "சாலை" in result

    def test_process_language_returns_all_keys(self):
        from ai_engine.language import process_language
        result = process_language("Pothole on the road")
        required = {"original_text", "detected_language", "language_name",
                    "normalized_text", "script_segments"}
        assert required.issubset(result.keys())

    def test_empty_text_returns_english(self):
        from ai_engine.language import detect_language
        code, _ = detect_language("")
        assert code == "en"


# ═══════════════════════════════════════════════════════════════════════════════
# Priority detection tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPriorityDetection:
    def test_fire_is_critical(self):
        from ai_engine.priority import detect_priority
        result = detect_priority("There is a fire in the building!")
        assert result["urgency"] == "critical"
        assert result["safety_risk"] == "high"

    def test_negated_fire_not_critical(self):
        from ai_engine.priority import detect_priority
        result = detect_priority("No fire, only smoke smell near the road.")
        # Negation should suppress "critical"; max "high" or "medium"
        assert result["urgency"] != "critical", (
            "Negation 'no fire' should prevent critical classification"
        )

    def test_no_water_is_high(self):
        from ai_engine.priority import detect_priority
        result = detect_priority("No water supply for three days in our area.")
        assert result["urgency"] in ("high", "critical")

    def test_garbage_is_medium(self):
        from ai_engine.priority import detect_priority
        result = detect_priority("Garbage has not been collected near the park.")
        assert result["urgency"] in ("medium", "low")

    def test_short_text_is_low(self):
        from ai_engine.priority import detect_priority
        result = detect_priority("Bad road.")
        assert result["urgency"] == "low"

    def test_flood_triggers_emergency(self):
        from ai_engine.priority import detect_priority, is_emergency
        result = detect_priority("Flooding is happening in the entire colony!")
        assert is_emergency(result) is True

    def test_returns_all_keys(self):
        from ai_engine.priority import detect_priority
        result = detect_priority("Test petition text.")
        required = {"urgency", "severity", "safety_risk",
                    "priority_confidence", "priority_explanation", "priority_keywords"}
        assert required.issubset(result.keys())


# ═══════════════════════════════════════════════════════════════════════════════
# Spam detection tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestSpamDetection:
    def test_valid_petition_not_spam(self):
        from ai_engine.spam import detect_spam
        text = "There is a massive pothole on MG Road causing accidents. Please repair urgently."
        result = detect_spam(text)
        assert result["is_spam"] is False

    def test_short_text_is_spam(self):
        from ai_engine.spam import detect_spam
        result = detect_spam("hi")
        assert result["is_spam"] is True

    def test_test_submission_is_spam(self):
        from ai_engine.spam import detect_spam
        # Short + test pattern: length penalty + test pattern penalty crosses 0.70
        result = detect_spam("testing 1234 foo bar")
        assert result["is_spam"] is True

    def test_repetitive_chars_score(self):
        from ai_engine.spam import detect_spam
        result = detect_spam("aaaaaaaaaaaaaaaa bbbbbbbbbbbbb road pothole")
        assert result["spam_score"] > 0.2

    def test_abusive_content_flagged(self):
        from ai_engine.spam import detect_spam
        result = detect_spam("I hate this system, it's complete shit and terrible.")
        assert result["is_abusive"] is True

    def test_returns_all_keys(self):
        from ai_engine.spam import detect_spam
        result = detect_spam("Test text.")
        required = {"is_spam", "is_abusive", "spam_score", "abuse_score", "spam_reason"}
        assert required.issubset(result.keys())


# ═══════════════════════════════════════════════════════════════════════════════
# TF-IDF Classifier tests (no LLM)
# ═══════════════════════════════════════════════════════════════════════════════

class TestTFIDFClassifier:
    def test_road_petition(self):
        from ai_engine.classifier import get_tfidf_classifier
        clf = get_tfidf_classifier()
        cat, conf = clf.classify("There is a large pothole on the main road causing accidents.")
        assert cat == "Road & Infrastructure"
        assert conf > 0.1

    def test_water_petition(self):
        from ai_engine.classifier import get_tfidf_classifier
        clf = get_tfidf_classifier()
        cat, conf = clf.classify("No water supply for three days, families are suffering.")
        assert cat == "Water Supply"

    def test_electricity_petition(self):
        from ai_engine.classifier import get_tfidf_classifier
        clf = get_tfidf_classifier()
        cat, conf = clf.classify("Street lights not working at night, area is dark.")
        assert cat == "Electricity"

    def test_healthcare_petition(self):
        from ai_engine.classifier import get_tfidf_classifier
        clf = get_tfidf_classifier()
        cat, conf = clf.classify("Hospital has no medicines and doctors are absent.")
        assert cat == "Healthcare"

    def test_returns_valid_category(self):
        from ai_engine.classifier import get_tfidf_classifier, CATEGORIES
        clf = get_tfidf_classifier()
        cat, conf = clf.classify("Random petition text about public issues.")
        assert cat in CATEGORIES
        assert 0.0 <= conf <= 1.0

    def test_proba_sums_to_one(self):
        from ai_engine.classifier import get_tfidf_classifier
        clf = get_tfidf_classifier()
        proba = clf.predict_proba("Water leak on the main road near the hospital.")
        total = sum(proba.values())
        assert abs(total - 1.0) < 1e-6


# ═══════════════════════════════════════════════════════════════════════════════
# Duplicate detection tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestDuplicateDetection:
    _existing = [
        {
            "id": "P001",
            "title": "Pothole on MG Road",
            "description": "Large pothole causing accidents near bus stop.",
            "lat": 13.0827,
            "lon": 80.2707,
            "created_at": "2026-10-01T10:00:00Z",
            "status": "open",
            "supporter_count": 5,
        },
        {
            "id": "P002",
            "title": "No water in colony",
            "description": "Water supply not available for two days.",
            "lat": 13.0900,
            "lon": 80.2800,
            "created_at": "2026-10-15T10:00:00Z",
            "status": "open",
            "supporter_count": 3,
        },
    ]

    def test_similar_petition_detected_as_duplicate(self):
        from ai_engine.dedup import detect_duplicates
        from ai_engine.config import ai_config
        result = detect_duplicates(
            "There is a massive pothole on MG Road causing vehicle damage.",
            self._existing,
            embedding_model=ai_config.EMBEDDING_MODEL,
            threshold=0.60,  # lower threshold for test stability
            radius_km=50.0,
            window_days=365,
            new_lat=13.0827,
            new_lon=80.2707,
        )
        assert result["is_duplicate"] is True
        assert result["duplicate_count"] >= 1

    def test_unrelated_petition_not_duplicate(self):
        from ai_engine.dedup import detect_duplicates
        from ai_engine.config import ai_config
        result = detect_duplicates(
            "The school building roof is leaking and students are unsafe.",
            self._existing,
            embedding_model=ai_config.EMBEDDING_MODEL,
            threshold=0.80,
            radius_km=5.0,
            window_days=30,
            new_lat=13.0827,
            new_lon=80.2707,
        )
        assert result["is_duplicate"] is False

    def test_empty_existing_returns_no_dup(self):
        from ai_engine.dedup import detect_duplicates
        from ai_engine.config import ai_config
        result = detect_duplicates(
            "Test petition text.",
            [],
            embedding_model=ai_config.EMBEDDING_MODEL,
        )
        assert result["is_duplicate"] is False
        assert result["duplicate_count"] == 0

    def test_returns_all_keys(self):
        from ai_engine.dedup import detect_duplicates
        from ai_engine.config import ai_config
        result = detect_duplicates("Any text.", [], embedding_model=ai_config.EMBEDDING_MODEL)
        required = {"is_duplicate", "duplicate_count", "master_petition_id",
                    "similar_petitions", "cluster_supporter_count"}
        assert required.issubset(result.keys())


# ═══════════════════════════════════════════════════════════════════════════════
# Full analyzer integration test (no LLM)
# ═══════════════════════════════════════════════════════════════════════════════

class TestAnalyzerIntegration:
    _required_output_keys = {
        "original_text", "detected_language", "language_name", "normalized_text",
        "source_type", "category", "department", "confidence", "explanation",
        "urgency", "severity", "safety_risk", "is_emergency",
        "sentiment", "summary", "recommended_action",
        "is_spam", "is_abusive", "spam_score", "spam_reason",
        "is_duplicate", "duplicate_count", "master_petition_id",
        "similar_petitions", "cluster_supporter_count",
        "human_review_required", "review_reasons",
        "_tfidf", "_embedding", "_llm",
    }

    def test_english_petition_produces_valid_output(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition(
            "There is a huge pothole on MG Road causing accidents.",
            gemini_api_key="",  # no LLM in unit test
        )
        assert self._required_output_keys.issubset(result.keys())
        assert result["category"] in [
            "Road & Infrastructure", "Public Safety"  # acceptable
        ]
        assert 0.0 <= result["confidence"] <= 1.0

    def test_spam_petition_flagged(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition("hi", gemini_api_key="")
        assert result["is_spam"] is True
        assert result["human_review_required"] is True

    def test_emergency_petition_flagged(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition(
            "The building is on fire! People are trapped inside!",
            gemini_api_key="",
        )
        assert result["is_emergency"] is True
        assert result["safety_risk"] == "high"

    def test_negation_no_fire_not_emergency(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition(
            "There is no fire, just a bit of smoke smell near the road.",
            gemini_api_key="",
        )
        assert result["is_emergency"] is False, (
            "Negated 'no fire' must not trigger emergency"
        )

    def test_hindi_petition_works(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition(
            "Sadak par bada gadha hai jo vehicles ko kharab kar raha hai.",
            gemini_api_key="",
        )
        assert result["detected_language"] in ("hi", "en")
        assert isinstance(result["category"], str)

    def test_output_serializable_to_json(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition(
            "Garbage piling up near school for a week.",
            gemini_api_key="",
        )
        # Must be JSON-serializable (all values are native Python types)
        serialized = json.dumps(result, ensure_ascii=False)
        reloaded = json.loads(serialized)
        assert reloaded["category"] == result["category"]

    def test_confidence_in_valid_range(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition(
            "Water supply is disrupted for three days in our colony.",
            gemini_api_key="",
        )
        assert 0.0 <= result["confidence"] <= 1.0

    def test_tamil_romanized_petition(self):
        from ai_engine.analyzer import analyze_petition
        result = analyze_petition(
            "Thanneer varavillai moonu nalkal, kudimakkal kodu padhikappadu.",
            gemini_api_key="",
        )
        assert isinstance(result["category"], str)
        assert result["summary"]


# ═══════════════════════════════════════════════════════════════════════════════
# Ingestion tests (file extraction)
# ═══════════════════════════════════════════════════════════════════════════════

class TestIngestion:
    def test_plain_text_file(self, tmp_path):
        from ai_engine.ingestion import extract_text_from_file
        f = tmp_path / "petition.txt"
        f.write_text("There is a pothole on the main road.", encoding="utf-8")
        result = extract_text_from_file(f)
        assert result["source_type"] == "text"
        assert "pothole" in result["raw_text"]

    def test_missing_file_raises(self):
        from ai_engine.ingestion import extract_text_from_file
        with pytest.raises(FileNotFoundError):
            extract_text_from_file("/nonexistent/path/file.txt")

    def test_unsupported_format_raises(self, tmp_path):
        from ai_engine.ingestion import extract_text_from_file
        f = tmp_path / "data.xyz"
        f.write_bytes(b"\x00\x01\x02binary garbage")
        with pytest.raises(Exception):
            extract_text_from_file(f)
