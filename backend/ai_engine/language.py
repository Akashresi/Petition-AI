"""
Language Detection & Normalization Module
=========================================
Detects language (English / Tamil / Hindi / code-mixed) and normalizes
text to a clean, analysis-ready form while preserving the originals.

Outputs:
    original_text      – untouched input
    detected_language  – "en" | "ta" | "hi" | "mixed"
    language_name      – human label
    normalized_text    – lowercased, whitespace-cleaned, diacritics preserved
    script_segments    – list of (script, segment) for code-mixed text
"""
from __future__ import annotations

import re
import unicodedata
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Unicode block ranges for Tamil and Devanagari (Hindi)
_TAMIL_RANGE = (0x0B80, 0x0BFF)
_DEVANAGARI_RANGE = (0x0900, 0x097F)

# Minimum character fraction to call a text "predominantly" that language
_LANG_THRESHOLD = 0.15


def _char_counts(text: str) -> dict[str, int]:
    """Count characters by script family."""
    counts = {"latin": 0, "tamil": 0, "devanagari": 0, "other": 0}
    for ch in text:
        cp = ord(ch)
        if _TAMIL_RANGE[0] <= cp <= _TAMIL_RANGE[1]:
            counts["tamil"] += 1
        elif _DEVANAGARI_RANGE[0] <= cp <= _DEVANAGARI_RANGE[1]:
            counts["devanagari"] += 1
        elif ch.isalpha() and ch.isascii():
            counts["latin"] += 1
        elif ch.isalpha():
            counts["other"] += 1
    return counts


def detect_language(text: str) -> tuple[str, str]:
    """
    Returns (lang_code, lang_name).
    lang_code: "en" | "ta" | "hi" | "mixed"
    Uses script analysis first, then falls back to langdetect.
    """
    if not text or not text.strip():
        return "en", "English"

    total_alpha = max(sum(ch.isalpha() for ch in text), 1)
    counts = _char_counts(text)

    tamil_frac = counts["tamil"] / total_alpha
    deva_frac = counts["devanagari"] / total_alpha
    latin_frac = counts["latin"] / total_alpha

    has_tamil = tamil_frac >= _LANG_THRESHOLD
    has_deva = deva_frac >= _LANG_THRESHOLD
    has_latin = latin_frac >= _LANG_THRESHOLD

    # Code-mixed: more than one script present
    script_count = sum([has_tamil, has_deva, has_latin])
    if script_count >= 2:
        return "mixed", "Code-mixed"

    if has_tamil:
        return "ta", "Tamil"
    if has_deva:
        return "hi", "Hindi"

    # Latin script → try langdetect for en vs romanized Tamil/Hindi
    try:
        from langdetect import detect, LangDetectException  # type: ignore
        code = detect(text)
        if code == "ta":
            return "ta", "Tamil (romanized)"
        if code in {"hi", "mr", "ne"}:
            return "hi", "Hindi (romanized)"
        return "en", "English"
    except Exception:
        pass

    return "en", "English"


def normalize_text(text: str) -> str:
    """
    Clean text for NLP analysis:
    - Normalize unicode (NFC)
    - Collapse excessive whitespace / newlines
    - Remove invisible characters
    - Lowercase (preserves non-ASCII diacritics)
    Does NOT strip Tamil/Devanagari — multilingual content is kept intact.
    """
    if not text:
        return ""

    # NFC normalize (important for Tamil vowel combinations)
    text = unicodedata.normalize("NFC", text)

    # Remove zero-width and control characters except newline/tab
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Replace multiple whitespace/newlines with single space
    text = re.sub(r"\s+", " ", text)

    # Lowercase ASCII, keep non-ASCII as-is
    result = []
    for ch in text:
        result.append(ch.lower() if ch.isascii() and ch.isalpha() else ch)
    text = "".join(result)

    return text.strip()


def segment_by_script(text: str) -> list[dict[str, str]]:
    """
    Split code-mixed text into segments by script.
    Returns list of {"script": "latin"|"tamil"|"devanagari"|"other", "text": str}
    Useful for per-segment processing.
    """
    segments: list[dict[str, str]] = []
    current_script = None
    buf: list[str] = []

    def flush():
        if buf and current_script:
            segments.append({"script": current_script, "text": "".join(buf).strip()})

    for ch in text:
        cp = ord(ch)
        if not ch.isalpha():
            buf.append(ch)
            continue
        if _TAMIL_RANGE[0] <= cp <= _TAMIL_RANGE[1]:
            script = "tamil"
        elif _DEVANAGARI_RANGE[0] <= cp <= _DEVANAGARI_RANGE[1]:
            script = "devanagari"
        elif ch.isascii():
            script = "latin"
        else:
            script = "other"

        if script != current_script:
            flush()
            buf = [ch]
            current_script = script
        else:
            buf.append(ch)

    flush()
    return [s for s in segments if s["text"].strip()]


def process_language(raw_text: str) -> dict[str, Any]:
    """
    Master function. Returns full language metadata dict.
    """
    lang_code, lang_name = detect_language(raw_text)
    normalized = normalize_text(raw_text)
    segments = segment_by_script(raw_text) if lang_code == "mixed" else []

    return {
        "original_text": raw_text,
        "detected_language": lang_code,
        "language_name": lang_name,
        "normalized_text": normalized,
        "script_segments": segments,
    }
