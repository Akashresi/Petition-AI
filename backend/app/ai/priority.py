"""
Priority Engine
===============
Rule-based and context-aware priority detection with robust negation handling.
Classifies: urgency (low/medium/high/critical), severity, safety_risk.

Key design:
- Dual-window negation & resolution check (looks 6 tokens before AND 5 tokens after).
- Contextual idiom matching ("no fire, only smoke", "there is no flood", "fire extinguished").
- Multilingual negation tokens (English, Hindi, Tamil).
- Optional LLM verification for critical edge cases.
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ── Priority keyword sets ─────────────────────────────────────────────────────

CRITICAL_PATTERNS: list[str] = [
    r"\bfire\b",
    r"\bflood(ing)?\b",
    r"\bbuilding collapse\b",
    r"\broad collapse\b",
    r"\bbridge collapse\b",
    r"\belectro?cut(ion|ed)?\b",
    r"\bdeath\b",
    r"\bdead bod(y|ies)\b",
    r"\bfatalit(y|ies)\b",
    r"\bserious accident\b",
    r"\bfatal accident\b",
    r"\bsewage overflow\b",
    r"\bgas leak\b",
    r"\bexplosion\b",
    r"\blandslide\b",
    r"\bstructural failure\b",
    r"\blive wire\b",
    r"\bpeople trapped\b",
]

HIGH_PATTERNS: list[str] = [
    r"\bno water\b",
    r"\bno electricity\b",
    r"\bpower (cut|outage|failure)\b",
    r"\bpothole\b",
    r"\bstray dogs? attack(ing)?\b",
    r"\bblocked (drain|sewage|pipe)\b",
    r"\bbroken (road|pipe|wire|pole|lamp)\b",
    r"\bfoul smell\b",
    r"\bopen (manhole|drain|sewer)\b",
    r"\bhanging (wire|cable)\b",
    r"\bunsafe (building|structure|road|bridge)\b",
    r"\bno (medicine|doctor)\b",
    r"\bchild(ren)? danger\b",
    r"\bsparking transformer\b",
]

MEDIUM_PATTERNS: list[str] = [
    r"\bgarbage\b",
    r"\bwaste\b",
    r"\bnoise\b",
    r"\bstreet light\b",
    r"\broad repair\b",
    r"\bmaintenance\b",
    r"\bdelay\b",
    r"\bcomplaint\b",
    r"\bpark\b",
    r"\bfootpath\b",
    r"\bbus stop\b",
    r"\bwater leak\b",
    r"\bwater pressure\b",
]

# Words appearing before the keyword that negate urgency
NEGATION_BEFORE_WORDS = {
    "no", "not", "never", "none", "nothing", "without", "neither", "nor",
    "zero", "hardly", "barely", "scarcely", "false", "prevented", "averted",
    "stopped", "avoided", "untrue", "fake", "mock", "drill", "exercise",
    "minor", "slight", "small", "merely", "only", "just", "low",
    # Hindi
    "nahi", "nahin", "na", "bina", "koi",
    # Tamil
    "illai", "illamal", "kedaiyadhu", "mattum",
}

# Words appearing after the keyword that indicate resolution or safety
RESOLUTION_AFTER_WORDS = {
    "extinguished", "resolved", "repaired", "fixed", "averted", "prevented",
    "controlled", "subsided", "receded", "cleared", "avoided", "stopped",
    "contained", "over", "safe", "false", "ended", "checked", "intact",
    # Hindi
    "bujha", "bujh", "theek", "khatam",
    # Tamil
    "anaikkappattadhu", "theerkappattadhu", "mudinthathu",
}

# Explicit phrase patterns that indicate non-critical context
NEGATION_PHRASE_PATTERNS = [
    r"\bno\s+fire\b",
    r"\bno\s+flood\b",
    r"\bnot\s+a\s+fire\b",
    r"\bnot\s+a\s+flood\b",
    r"\bnot\s+(an?\s+)?emergency\b",
    r"\bthere\s+is\s+no\s+(fire|flood|danger|risk|emergency|death|casualty|collapse)\b",
    r"\b(fire|flood|leak|overflow)\s+(has been|was|is|already)\s+(extinguished|resolved|under control|cleared|fixed|subsided|receded|put out)\b",
    r"\b(accident|collapse|explosion|landslide)\s+(was\s+)?(averted|prevented|avoided)\b",
    r"\b(drill|exercise|test run|mock drill|false alarm)\b",
    r"\bno\s+(casualties|casualty|death|deaths|injuries|injury)\b",
    r"\bzero\s+(risk|danger|chance|damage|casualties|deaths)\b",
    r"\b(safe|stable|secure)\b.*?\bno\s+(collapse|risk)\b",
    # Multilingual
    r"\baag\s+nahi\b",
    r"\bbaadh\s+nahi\b",
    r"\bthee\s+illai\b",
    r"\bvellam\s+illai\b",
]

LOOKBACK_WINDOW = 6
LOOKAHEAD_WINDOW = 5


def _is_token_negated(tokens: list[str], token_idx: int) -> bool:
    """Check both lookback and lookahead windows for negation/resolution words."""
    # Lookback window (before the token)
    start_back = max(0, token_idx - LOOKBACK_WINDOW)
    prior_tokens = tokens[start_back:token_idx]
    if any(t in NEGATION_BEFORE_WORDS for t in prior_tokens):
        return True

    # Lookahead window (after the token)
    end_forward = min(len(tokens), token_idx + 1 + LOOKAHEAD_WINDOW)
    subsequent_tokens = tokens[token_idx + 1:end_forward]
    if any(t in RESOLUTION_AFTER_WORDS for t in subsequent_tokens):
        return True

    return False


def _has_phrase_negation(text: str) -> bool:
    """Check if any explicit negation phrase pattern matches."""
    for pattern in NEGATION_PHRASE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def _match_patterns(patterns: list[str], text: str, tokens: list[str]) -> list[tuple[str, int]]:
    """Return list of (matched_pattern, token_index) that are NOT negated or resolved."""
    hits = []
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            matched_str = m.group()
            prefix = text[: m.start()]
            token_idx = len(prefix.split())
            
            # Check window-based negation
            if _is_token_negated(tokens, token_idx):
                continue
                
            hits.append((matched_str, token_idx))
    return hits


def detect_priority(
    text: str,
    *,
    llm_judgment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Classify petition urgency:
        urgency: "low" | "medium" | "high" | "critical"
        severity: "low" | "medium" | "high"
        safety_risk: "none" | "low" | "medium" | "high"
        priority_confidence: float
        priority_explanation: str
        priority_keywords: list[str]
    """
    tokens = re.findall(r"\w+", text.lower())
    lower_text = text.lower()

    # Match patterns with negation awareness
    critical_hits = _match_patterns(CRITICAL_PATTERNS, lower_text, tokens)
    high_hits = _match_patterns(HIGH_PATTERNS, lower_text, tokens)
    medium_hits = _match_patterns(MEDIUM_PATTERNS, lower_text, tokens)

    # Check for general negation phrases that might suppress critical status
    phrase_negated = _has_phrase_negation(lower_text)
    if phrase_negated and critical_hits:
        # Re-verify critical hits under phrase negation
        critical_hits = [
            h for h in critical_hits 
            if not any(re.search(rf"\b(no|not|zero|without|false|drill|prevented|averted)\s+.*?{re.escape(h[0])}", lower_text) for _ in [1])
        ]

    # Combine with LLM judgment if provided
    if llm_judgment and "urgency" in llm_judgment:
        llm_urgency = llm_judgment["urgency"].lower()
        if llm_urgency in ["low", "medium", "high", "critical"]:
            # If rules say critical but LLM says not critical and phrase negation exists
            if critical_hits and phrase_negated and llm_urgency != "critical":
                critical_hits = []

    if critical_hits:
        urgency = "critical"
        safety_risk = "high"
        severity = "high"
        confidence = min(0.92 + 0.01 * len(critical_hits), 0.99)
        keywords = [h[0] for h in critical_hits[:4]]
        explanation = f"Critical active safety keywords detected: {', '.join(keywords)}"

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
        # Non-critical context or routine maintenance
        word_count = len(tokens)
        urgency = "low" if word_count < 12 else "medium"
        safety_risk = "none"
        severity = "low"
        confidence = 0.50
        keywords = []
        explanation = "No active critical keywords detected; assigned standard priority."

    return {
        "urgency": urgency,
        "severity": severity,
        "safety_risk": safety_risk,
        "priority_confidence": round(confidence, 3),
        "priority_explanation": explanation,
        "priority_keywords": keywords,
    }


def is_emergency(priority_result: dict[str, Any]) -> bool:
    """True when safety_risk == 'high' (bypasses queue for immediate escalation)."""
    return priority_result.get("safety_risk") == "high"
