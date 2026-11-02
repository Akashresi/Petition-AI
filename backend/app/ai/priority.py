"""
Priority Engine
===============
Rule-based priority detection with negation awareness and context handling.
Classifies: urgency (low/medium/high/critical), severity, safety_risk.

Key design: negation window (5 words before keyword) suppresses false positives.
Example: "no fire, only smoke" → NOT critical.
"""
from __future__ import annotations

import re
from typing import Any

# ── Priority keyword sets ─────────────────────────────────────────────────────

CRITICAL_PATTERNS: list[str] = [
    r"fire",
    r"flood(ing)?",
    r"building collapse",
    r"road collapse",
    r"bridge collapse",
    r"electro?cut(ion|ed)?",
    r"death|dead body|fatality",
    r"serious accident",
    r"sewage overflow",
    r"gas leak",
    r"explosion",
    r"landslide",
    r"structural failure",
]

HIGH_PATTERNS: list[str] = [
    r"no water (supply|connection)?",
    r"no electricity",
    r"power (cut|outage|failure)",
    r"pothole",
    r"stray dogs? attack(ing)?",
    r"blocked (drain|sewage|pipe)",
    r"broken (road|pipe|wire|pole|lamp)",
    r"foul smell",
    r"open (manhole|drain|sewer)",
    r"hanging (wire|cable)",
    r"unsafe (building|structure|road|bridge)",
    r"no (medicine|doctor)",
    r"child(ren)? danger",
]

MEDIUM_PATTERNS: list[str] = [
    r"garbage",
    r"waste",
    r"noise",
    r"street light",
    r"road repair",
    r"maintenance",
    r"delay",
    r"complaint",
    r"park",
    r"footpath",
    r"bus stop",
    r"water leak",
    r"water pressure",
]

# Negation words that suppress the following keyword
NEGATION_WORDS = {
    "no", "not", "never", "none", "nothing", "without", "stopped",
    "fixed", "resolved", "repaired", "absent", "missing", "only",
    "just", "merely", "slight", "minor", "small",
}

# Negation window: words to look back from keyword
NEGATION_WINDOW = 6


def _has_negation(text_tokens: list[str], match_start: int) -> bool:
    """Check if a negation word appears in the window before the match."""
    start_idx = max(0, match_start - NEGATION_WINDOW)
    window = text_tokens[start_idx:match_start]
    return any(t in NEGATION_WORDS for t in window)


def _match_patterns(patterns: list[str], text: str, tokens: list[str]) -> list[tuple[str, int]]:
    """Return list of (matched_pattern, token_index) that are NOT negated."""
    hits = []
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            # Approximate token position
            prefix = text[: m.start()]
            token_idx = len(prefix.split())
            if not _has_negation(tokens, token_idx):
                hits.append((m.group(), token_idx))
    return hits


def detect_priority(text: str) -> dict[str, Any]:
    """
    Returns:
        urgency: "low" | "medium" | "high" | "critical"
        severity: "low" | "medium" | "high"
        safety_risk: "none" | "low" | "medium" | "high"
        priority_confidence: float
        priority_explanation: str
        priority_keywords: list[str]
    """
    tokens = re.findall(r"\w+", text.lower())
    lower_text = text.lower()

    critical_hits = _match_patterns(CRITICAL_PATTERNS, lower_text, tokens)
    high_hits = _match_patterns(HIGH_PATTERNS, lower_text, tokens)
    medium_hits = _match_patterns(MEDIUM_PATTERNS, lower_text, tokens)

    if critical_hits:
        urgency = "critical"
        safety_risk = "high"
        severity = "high"
        confidence = min(0.92 + 0.01 * len(critical_hits), 0.99)
        keywords = [h[0] for h in critical_hits[:4]]
        explanation = f"Critical safety keywords detected: {', '.join(keywords)}"

    elif high_hits:
        urgency = "high"
        safety_risk = "medium"
        severity = "high"
        confidence = min(0.78 + 0.02 * len(high_hits), 0.94)
        keywords = [h[0] for h in high_hits[:4]]
        explanation = f"High-priority issue keywords: {', '.join(keywords)}"

    elif medium_hits:
        urgency = "medium"
        safety_risk = "low"
        severity = "medium"
        confidence = 0.65
        keywords = [h[0] for h in medium_hits[:3]]
        explanation = f"Standard complaint keywords: {', '.join(keywords)}"

    else:
        # Length heuristic: very short texts are likely low-quality
        word_count = len(tokens)
        urgency = "low" if word_count < 12 else "medium"
        safety_risk = "none"
        severity = "low"
        confidence = 0.50
        keywords = []
        explanation = "No specific priority keywords detected; using heuristic."

    return {
        "urgency": urgency,
        "severity": severity,
        "safety_risk": safety_risk,
        "priority_confidence": round(confidence, 3),
        "priority_explanation": explanation,
        "priority_keywords": keywords,
    }


# ── Emergency Fast-Lane check ─────────────────────────────────────────────────

def is_emergency(priority_result: dict[str, Any]) -> bool:
    """True when safety_risk == 'high' (bypasses queue for immediate escalation)."""
    return priority_result.get("safety_risk") == "high"
