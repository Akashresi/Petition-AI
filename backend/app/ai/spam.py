"""
Spam & Abuse Detection Module
==============================
Detects:
  - Spam / gibberish (keyboard mash, consonant clusters, repetitive chars/words)
  - Abusive / offensive content (English, Hindi, Tamil)
  - Fake / placeholder / test submissions
  - Repeated identical word flooding

Returns: {
    is_spam: bool,
    is_abusive: bool,
    spam_score: float,
    abuse_score: float,
    spam_reason: str | None,
    abuse_reason: str | None,
    real_word_count: int,
}
"""
from __future__ import annotations

import re
from typing import Any

# ── Regex patterns ────────────────────────────────────────────────────────────

_REPEAT_CHAR_RE = re.compile(r"(.)\1{4,}")  # 5+ repeated chars (e.g. aaaaa, zzzzzz)
_KEYBOARD_MASH_RE = re.compile(
    r"\b(asdfgh|qwerty|zxcvbn|dfghjk|hjkl|poiuyt|mnbvc|lkjhgf|qazwsx|edcrfv)\w*\b",
    re.IGNORECASE,
)
_CONSONANT_CLUSTER_RE = re.compile(r"\b[bcdfghjklmnpqrstvwxyz]{6,}\b", re.IGNORECASE)

_TEST_PATTERNS = [
    r"\btest(ing)?\s*(123|petition|text|data|run)?\b",
    r"\bsample\s*(petition|text|issue|complaint)?\b",
    r"\bfoo\s*bar\b",
    r"\bhello\s+world\b",
    r"\blorem\s+ipsum\b",
    r"\bxxxx+\b",
    r"\b1234+\b",
    r"\basdf\b",
]

_ABUSIVE_PATTERNS = [
    # English profanity & threats
    r"\bfuck\w*\b",
    r"\bshit\w*\b",
    r"\bbastard\w*\b",
    r"\basshole\w*\b",
    r"\bbitch\w*\b",
    r"\bcunt\w*\b",
    r"\bkill\s+(you|them|all|officer)\b",
    r"\bbomb\s+(the|government|office|building)\b",
    r"\bterrorist\b",
    # Hindi profanity (transliterated & Devanagari)
    r"\bmadarchod\b",
    r"\bbhenchod\b",
    r"\bchutiya\w*\b",
    r"\bsaala\b",
    r"\bharami\b",
    r"\bkutte\s+ke\s+bacche\b",
    r"\bkamina\b",
    r"मादरचोद",
    r"भोसड़ी",
    r"चूतिया",
    r"हरामी",
    r"कुत्ते\s+के\s+बच्चे",
    # Tamil profanity (transliterated & Tamil script)
    r"\bmairu\b",
    r"\bkoothi\b",
    r"\bpunda\w*\b",
    r"\bsunni\b",
    r"\bthevidya\w*\b",
    r"\bkena\b",
    r"மயிரு",
    r"கூதி",
    r"புண்ட",
    r"தேவிடியா",
    r"சுன்னி",
]


def _count_real_words(text: str) -> int:
    """Count tokens that look like real words (3+ alpha chars)."""
    return len(re.findall(r"[a-zA-Z\u0B00-\u0BFF\u0900-\u097F]{3,}", text))


def detect_spam(text: str, *, min_length: int = 15, threshold: float = 0.50) -> dict[str, Any]:
    """
    Score a petition text for spam / abuse.
    If check errors, returns safe clean result so petition proceeds normally.

    Output fields conform to Task 4.2 & Rule 5:
      - spam_score: float (0.0 to 1.0)
      - reason: short plain language reason
      - confidence: float confidence score (0.0 to 1.0)
    """
    try:
        score = 0.0
        reasons: list[str] = []

        stripped = text.strip()
        lower = stripped.lower()
        words = re.findall(r"\w+", lower)

        # 1. Length check
        if len(stripped) < min_length:
            score += 0.5
            reasons.append(f"Too short ({len(stripped)} chars < {min_length})")

        # 2. Real word count
        real_words = _count_real_words(stripped)
        if real_words < 3:
            score += 0.45
            reasons.append("Too few real words")

        # 3. Repeated word spam (e.g. "help help help help help" or "தண்ணீர் தண்ணீர் தண்ணீர்")
        if len(words) >= 5:
            unique_words = set(words)
            unique_ratio = len(unique_words) / len(words)
            if unique_ratio < 0.30:
                score += 0.55
                most_repeated = max(unique_words, key=words.count)
                reasons.append(f"Repetitive word flooding ('{most_repeated}' repeated {words.count(most_repeated)} times)")

        # 4. Keyboard mash & consonant clusters (e.g. asdfghjkl, bcdfghjkl)
        if _KEYBOARD_MASH_RE.search(lower):
            score += 0.60
            reasons.append("Keyboard mash sequence detected")
        elif _CONSONANT_CLUSTER_RE.search(lower):
            score += 0.50
            reasons.append("Gibberish consonant clusters detected")

        # 5. Repetitive character sequences (e.g. aaaaaa, !!!!!)
        if _REPEAT_CHAR_RE.search(lower):
            score += 0.40
            reasons.append("Repetitive character sequence detected")

        # 6. Test / fake / placeholder patterns
        for pat in _TEST_PATTERNS:
            if re.search(pat, lower):
                score += 0.65
                reasons.append("Test or placeholder submission pattern")
                break

        # 7. Non-alphabetic ratio (e.g. only punctuation / symbols)
        alpha_chars = [c for c in stripped if c.isalpha()]
        alpha_ratio = len(alpha_chars) / max(len(stripped), 1)
        if alpha_ratio < 0.35 and len(stripped) > 5:
            score += 0.50
            reasons.append("High non-alphabetic character ratio (mostly punctuation/symbols)")

        # 8. Excessive uppercase (SHOUTING / automated bot)
        if alpha_chars and len(alpha_chars) > 15 and sum(c.isupper() for c in stripped if c.isalpha()) / len(alpha_chars) > 0.90:
            score += 0.25
            reasons.append("Excessive uppercase shouting")

        spam_score = min(score, 1.0)
        is_spam = spam_score >= threshold

        # ── Abuse detection (independent) ────────────────────────────────────────
        abuse_score = 0.0
        abuse_reasons: list[str] = []
        for pat in _ABUSIVE_PATTERNS:
            match = re.search(pat, lower)
            if match:
                abuse_score = min(abuse_score + 0.6, 1.0)
                abuse_reasons.append(f"Abusive content detected: '{match.group()}'")

        is_abusive = abuse_score >= 0.5

        if is_spam or is_abusive:
            combined_reasons = reasons + abuse_reasons
            plain_reason = combined_reasons[0] if combined_reasons else "Potential spam or repetitive content"
            confidence = round(max(spam_score, abuse_score, 0.85), 2)
        else:
            plain_reason = "Valid citizen complaint content"
            confidence = round(max(1.0 - spam_score, 0.90), 2)

        return {
            "is_spam": is_spam,
            "is_abusive": is_abusive,
            "spam_score": round(spam_score, 3),
            "abuse_score": round(abuse_score, 3),
            "reason": plain_reason,
            "confidence": confidence,
            "spam_reason": "; ".join(reasons) if reasons else None,
            "abuse_reason": "; ".join(abuse_reasons) if abuse_reasons else None,
            "real_word_count": real_words,
        }
    except Exception as exc:
        # Task 4.4: If check fails or errors, proceed normally
        return {
            "is_spam": False,
            "is_abusive": False,
            "spam_score": 0.0,
            "abuse_score": 0.0,
            "reason": "Spam check bypassed safely",
            "confidence": 0.50,
            "spam_reason": None,
            "abuse_reason": None,
            "real_word_count": len(text.split()),
        }
