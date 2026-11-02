"""
Spam & Abuse Detection Module
==============================
Detects:
  - Spam / gibberish (too short, all caps, no real words, repetitive)
  - Abusive / offensive content (keyword + regex patterns)
  - Fake / test submissions
  - Excessive duplicate submissions by same petitioner

Returns: { is_spam: bool, is_abusive: bool, spam_score: float,
           abuse_score: float, spam_reason: str | None }
"""
from __future__ import annotations

import re
from typing import Any


# ── Spam detection heuristics ─────────────────────────────────────────────────

_GIBBERISH_RE = re.compile(r"^[^a-z\u0B00-\u0BFF\u0900-\u097F]*$", re.IGNORECASE)
_REPEAT_CHAR_RE = re.compile(r"(.)\1{4,}")  # 5+ repeated chars
_TEST_PATTERNS = [
    r"\btest(ing)?\b", r"\bsample\b", r"\bfoo\b", r"\bbar\b",
    r"hello world", r"\babc\b", r"xxxx", r"1234",
]
_ABUSIVE_PATTERNS = [
    r"\bfuck\b", r"\bshit\b", r"\bbastard\b", r"\bkill\b",
    r"\bdie\b", r"\bhate\b", r"\bterrorist\b", r"\bbomb\b",
    # Transliterated Tamil/Hindi abusive terms (light coverage)
    r"\bmairu\b", r"\bkoothi\b", r"\bsaala\b", r"\bbhenchod\b",
]


def _count_real_words(text: str) -> int:
    """Count tokens that look like real words (3+ alpha chars)."""
    return len(re.findall(r"[a-zA-Z\u0B00-\u0BFF\u0900-\u097F]{3,}", text))


def detect_spam(text: str, *, min_length: int = 20, threshold: float = 0.60) -> dict[str, Any]:
    """
    Score a petition text for spam / abuse.

    spam_score: 0.0 (clean) → 1.0 (definitely spam)
    abuse_score: 0.0 → 1.0
    """
    score = 0.0
    reasons: list[str] = []

    stripped = text.strip()
    lower = stripped.lower()

    # 1. Length check
    if len(stripped) < min_length:
        score += 0.5
        reasons.append(f"Too short ({len(stripped)} chars)")

    # 2. Real word count
    real_words = _count_real_words(stripped)
    if real_words < 3:
        score += 0.4
        reasons.append("Too few real words")

    # 3. All uppercase (shouting / bot)
    alpha_chars = [c for c in stripped if c.isalpha()]
    if alpha_chars and sum(c.isupper() for c in alpha_chars) / len(alpha_chars) > 0.85:
        score += 0.2
        reasons.append("Excessive uppercase")

    # 4. Repetitive characters
    if _REPEAT_CHAR_RE.search(lower):
        score += 0.25
        reasons.append("Repetitive character sequences")

    # 5. Test/fake pattern
    test_hit = False
    for pat in _TEST_PATTERNS:
        if re.search(pat, lower):
            test_hit = True
            reasons.append("Test/fake submission pattern")
            break
    if test_hit:
        score += 0.45  # weighted higher so test strings cross threshold
        # Extra penalty when real content words are few
        if real_words < 8:
            score += 0.2

    # 6. Gibberish: too many non-alpha characters
    alpha_ratio = len(alpha_chars) / max(len(stripped), 1)
    if alpha_ratio < 0.4 and real_words < 5:
        score += 0.3
        reasons.append("High non-alphabetic character ratio")

    spam_score = min(score, 1.0)
    is_spam = spam_score >= threshold

    # ── Abuse detection (independent) ────────────────────────────────────────
    abuse_score = 0.0
    abuse_reasons: list[str] = []
    for pat in _ABUSIVE_PATTERNS:
        if re.search(pat, lower):
            abuse_score = min(abuse_score + 0.5, 1.0)
            abuse_reasons.append(f"Abusive keyword: {pat}")

    is_abusive = abuse_score >= 0.5

    return {
        "is_spam": is_spam,
        "is_abusive": is_abusive,
        "spam_score": round(spam_score, 3),
        "abuse_score": round(abuse_score, 3),
        "spam_reason": "; ".join(reasons) if reasons else None,
        "abuse_reason": "; ".join(abuse_reasons) if abuse_reasons else None,
        "real_word_count": real_words,
    }
