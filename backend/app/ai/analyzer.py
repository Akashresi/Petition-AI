"""
AI Engine Orchestrator
======================
Master function that orchestrates all Phase 1 modules and returns
the canonical PetitionAnalysis JSON output.

Output schema (all fields always present):
{
    // Input preservation
    "original_text":          str,
    "detected_language":      str,   // "en"|"ta"|"hi"|"mixed"
    "language_name":          str,
    "normalized_text":        str,
    "source_type":            str,   // "text"|"pdf"|"docx"|"image"|"video"

    // Classification
    "category":               str,
    "department":             str,
    "confidence":             float, // 0.0-1.0
    "explanation":            str,

    // Priority
    "urgency":                str,   // "low"|"medium"|"high"|"critical"
    "severity":               str,   // "low"|"medium"|"high"
    "safety_risk":            str,   // "none"|"low"|"medium"|"high"
    "is_emergency":           bool,

    // Sentiment & Summary
    "sentiment":              str,   // "positive"|"neutral"|"negative"|"angry"
    "summary":                str,
    "recommended_action":     str,

    // Spam / Quality
    "is_spam":                bool,
    "is_abusive":             bool,
    "spam_score":             float,
    "spam_reason":            str | null,

    // Duplicate clustering
    "is_duplicate":           bool,
    "duplicate_count":        int,
    "master_petition_id":     str | null,
    "similar_petitions":      list,
    "cluster_supporter_count":int,

    // Human review
    "human_review_required":  bool,
    "review_reasons":         list[str],

    // Audit signals
    "_tfidf":                 dict,
    "_embedding":             dict,
    "_llm":                   dict,
}
"""
from __future__ import annotations

import logging
from typing import Any

from .config import ai_config
from .language import process_language
from .priority import detect_priority, is_emergency
from .spam import detect_spam
from .classifier import hybrid_classify, CATEGORIES, DEPARTMENT_MAP

logger = logging.getLogger(__name__)


def analyze_petition(
    text: str,
    *,
    # Optional geo for duplicate detection
    lat: float | None = None,
    lon: float | None = None,
    # Existing petitions for duplicate detection (list of dicts)
    existing_petitions: list[dict] | None = None,
    # Override config per-call (useful for testing)
    gemini_api_key: str | None = None,
    gemini_model: str | None = None,
    embedding_model: str | None = None,
    # Source type for provenance
    source_type: str = "text",
) -> dict[str, Any]:
    """
    Full pipeline: language → spam → classify → priority → dedup → fuse.

    Parameters
    ----------
    text : str  (already extracted raw text from ingestion module)
    lat, lon : float | None  (GPS coordinates for geo-aware dedup)
    existing_petitions : list[dict]  (in-memory petition store for dedup)
    gemini_api_key : str | None  (override from .env)
    gemini_model : str | None
    embedding_model : str | None
    source_type : str  (provenance label)

    Returns
    -------
    Full analysis dict (see module docstring schema).
    """
    api_key = gemini_api_key or ai_config.GEMINI_API_KEY
    g_model = gemini_model or ai_config.GEMINI_MODEL
    emb_model = embedding_model or ai_config.EMBEDDING_MODEL

    # ── 1. Language processing ────────────────────────────────────────────────
    lang_result = process_language(text)
    normalized = lang_result["normalized_text"]

    # ── 2. Spam / abuse detection ─────────────────────────────────────────────
    spam_result = detect_spam(
        normalized,
        min_length=ai_config.MIN_TEXT_LENGTH,
        threshold=ai_config.SPAM_SCORE_THRESHOLD,
    )

    # If clearly spam/abusive, short-circuit with minimal analysis
    if spam_result["is_spam"] and spam_result["spam_score"] >= 0.85:
        return _spam_short_circuit(lang_result, spam_result, source_type)

    # ── 3. Hybrid classification ──────────────────────────────────────────────
    clf_result = hybrid_classify(
        normalized,
        api_key=api_key,
        gemini_model=g_model,
        embedding_model=emb_model,
        confidence_threshold=ai_config.CONFIDENCE_THRESHOLD,
        agreement_tolerance=ai_config.AGREEMENT_TOLERANCE,
    )

    # ── 4. Priority / urgency detection ───────────────────────────────────────
    # LLM fields take priority; rule-based fills gaps
    pri_result = detect_priority(normalized)

    urgency = clf_result.get("urgency") or pri_result["urgency"]
    severity = clf_result.get("severity") or pri_result["severity"]
    safety_risk = clf_result.get("safety_risk") or pri_result["safety_risk"]
    emergency = is_emergency({"safety_risk": safety_risk})

    # ── 5. Duplicate detection ────────────────────────────────────────────────
    dup_result: dict[str, Any] = {
        "is_duplicate": False,
        "duplicate_count": 0,
        "master_petition_id": None,
        "master_petition_title": None,
        "similar_petitions": [],
        "cluster_supporter_count": 1,
    }
    if existing_petitions:
        try:
            from .dedup import detect_duplicates
            dup_result = detect_duplicates(
                normalized,
                existing_petitions,
                embedding_model=emb_model,
                threshold=ai_config.DUPLICATE_THRESHOLD,
                window_days=ai_config.DUPLICATE_WINDOW_DAYS,
                new_lat=lat,
                new_lon=lon,
            )
        except Exception as exc:
            logger.warning("Duplicate detection failed: %s", exc)

    # ── 6. Build review reasons ───────────────────────────────────────────────
    review_reasons: list[str] = []
    if clf_result["human_review_required"]:
        review_reasons.append("Low confidence or signal disagreement in classification")
    if spam_result["is_spam"]:
        review_reasons.append(f"Spam indicators: {spam_result.get('spam_reason')}")
    if spam_result["is_abusive"]:
        review_reasons.append(f"Abusive content: {spam_result.get('abuse_reason')}")
    if dup_result["is_duplicate"]:
        review_reasons.append(
            f"Possible duplicate of petition {dup_result['master_petition_id']}"
        )
    if emergency:
        review_reasons.append("EMERGENCY: safety_risk=high — immediate escalation required")

    human_review_required = bool(review_reasons) or emergency

    # ── 7. Compose final output ───────────────────────────────────────────────
    sentiment = clf_result.get("sentiment") or _rule_sentiment(normalized)
    summary = clf_result.get("summary") or _rule_summary(
        normalized, clf_result["category"], urgency
    )
    recommended_action = clf_result.get("recommended_action") or _rule_action(
        clf_result["category"], urgency
    )

    return {
        # Input preservation
        "original_text": lang_result["original_text"],
        "detected_language": lang_result["detected_language"],
        "language_name": lang_result["language_name"],
        "normalized_text": normalized,
        "source_type": source_type,

        # Classification
        "category": clf_result["category"],
        "department": clf_result["department"],
        "confidence": clf_result["confidence"],
        "explanation": clf_result["explanation"],

        # Priority
        "urgency": urgency,
        "severity": severity,
        "safety_risk": safety_risk,
        "is_emergency": emergency,

        # Sentiment & Summary
        "sentiment": sentiment,
        "summary": summary,
        "recommended_action": recommended_action,

        # Spam / Quality
        "is_spam": spam_result["is_spam"],
        "is_abusive": spam_result["is_abusive"],
        "spam_score": spam_result["spam_score"],
        "spam_reason": spam_result["spam_reason"],

        # Duplicate clustering
        "is_duplicate": dup_result["is_duplicate"],
        "duplicate_count": dup_result["duplicate_count"],
        "master_petition_id": dup_result["master_petition_id"],
        "master_petition_title": dup_result.get("master_petition_title"),
        "similar_petitions": dup_result["similar_petitions"],
        "cluster_supporter_count": dup_result["cluster_supporter_count"],

        # Human review
        "human_review_required": human_review_required,
        "review_reasons": review_reasons,

        # Audit signals
        "_tfidf": clf_result.get("_tfidf", {}),
        "_embedding": clf_result.get("_embedding", {}),
        "_llm": clf_result.get("_llm", {}),
    }


# ── Rule-based fallbacks ──────────────────────────────────────────────────────

def _rule_sentiment(text: str) -> str:
    lower = text.lower()
    angry = ["furious", "unacceptable", "worst", "terrible", "outrageous", "fed up"]
    negative = ["bad", "poor", "broken", "failed", "issue", "complaint", "unsafe"]
    positive = ["thank", "appreciate", "good", "excellent", "resolved"]
    if any(w in lower for w in angry):
        return "angry"
    if any(w in lower for w in negative):
        return "negative"
    if any(w in lower for w in positive):
        return "positive"
    return "neutral"


def _rule_summary(text: str, category: str, urgency: str) -> str:
    words = text.split()[:20]
    snippet = " ".join(words) + ("…" if len(text.split()) > 20 else "")
    return f"{urgency.upper()} {category} petition: {snippet}"


def _rule_action(category: str, urgency: str) -> str:
    actions = {
        "Road & Infrastructure": "Dispatch PWD field team for inspection and repair.",
        "Water Supply": "Alert Water Works engineer; verify supply interruption.",
        "Electricity": "Notify TNEB lineman; inspect transformer/pole.",
        "Waste Management": "Schedule immediate waste clearance and drain inspection.",
        "Public Safety": "Alert local police/municipal safety officer.",
        "Healthcare": "Notify Health Department CMO for inspection.",
        "Education": "Inform DEO; arrange emergency structural assessment.",
        "Public Transport": "Alert transport authority; reroute or add service.",
    }
    base = actions.get(category, "Assign to relevant department officer for investigation.")
    if urgency in ("critical", "high"):
        base = "URGENT: " + base
    return base


def _spam_short_circuit(lang_result: dict, spam_result: dict, source_type: str) -> dict:
    """Return a minimal analysis for high-confidence spam."""
    return {
        "original_text": lang_result["original_text"],
        "detected_language": lang_result["detected_language"],
        "language_name": lang_result["language_name"],
        "normalized_text": lang_result["normalized_text"],
        "source_type": source_type,
        "category": "Unknown",
        "department": "Spam Filter",
        "confidence": 0.0,
        "explanation": "Petition rejected by spam filter.",
        "urgency": "low",
        "severity": "low",
        "safety_risk": "none",
        "is_emergency": False,
        "sentiment": "neutral",
        "summary": "Spam or abusive content detected.",
        "recommended_action": "Reject petition; no action required.",
        "is_spam": spam_result["is_spam"],
        "is_abusive": spam_result["is_abusive"],
        "spam_score": spam_result["spam_score"],
        "spam_reason": spam_result["spam_reason"],
        "is_duplicate": False,
        "duplicate_count": 0,
        "master_petition_id": None,
        "master_petition_title": None,
        "similar_petitions": [],
        "cluster_supporter_count": 0,
        "human_review_required": True,
        "review_reasons": [f"High-confidence spam: {spam_result['spam_reason']}"],
        "_tfidf": {},
        "_embedding": {},
        "_llm": {},
    }
