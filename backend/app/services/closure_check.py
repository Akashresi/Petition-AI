"""
Resolution Quality Check Module
================================
AI check scoring whether officer closing remarks actually address the citizen's complaint.
Flags weak, evasive, or boilerplate closures.
"""
from __future__ import annotations

import re
from typing import Any, Dict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Generic evasion or weak closure indicators
EVASIVE_PHRASES = [
    r"\bwill look into\b",
    r"\bforwarded to\b",
    r"\bnoted\b",
    r"\bunder process\b",
    r"\bclosed without action\b",
    r"\bnot applicable\b",
    r"\bok\b",
    r"\bdone\b",
    r"\bfixed\b",
    r"\baction taken\b",
    r"\bwill be done later\b",
    r"\bno issue found\b",
]

# Action verbs and evidence markers indicating genuine civic resolution
ACTION_MARKERS = [
    r"\brepair(ed)?\b",
    r"\bpatch(ed)?\b",
    r"\bclean(ed)?\b",
    r"\breplace(d)?\b",
    r"\bclear(ed)?\b",
    r"\binspect(ed)?\b",
    r"\bseal(ed)?\b",
    r"\brestor(ed)?\b",
    r"\bdisconnect(ed)?\b",
    r"\binstall(ed)?\b",
    r"\bdispatch(ed)?\b",
    r"\bfill(ed)?\b",
    r"\basphalt\b",
    r"\bpipeline\b",
    r"\bcontractor\b",
    r"\bphoto attached\b",
    r"\bvoucher\b",
    r"\bwork order\b",
    r"\bfield team\b",
]


def score_resolution_remarks(
    complaint_text: str,
    resolution_remarks: str,
) -> Dict[str, Any]:
    """
    Score officer closing remarks against the original complaint description.
    Returns:
        quality_score: 0.0 to 1.0
        is_weak_closure: bool
        reasons: list of flags
        recommendation: guidance message
        confidence: float
        explanation: Rule 5 summary
    """
    remarks = (resolution_remarks or "").strip()
    complaint = (complaint_text or "").strip()

    if not remarks:
        return {
            "quality_score": 0.0,
            "is_weak_closure": True,
            "reasons": ["No resolution remarks provided."],
            "recommendation": "Provide detailed remarks explaining the physical action taken to resolve the grievance.",
            "confidence": 0.99,
            "explanation": "Flagged as weak closure: closing remarks are completely blank.",
        }

    word_count = len(remarks.split())
    reasons: list[str] = []

    # 1. Brevity check
    if word_count < 5:
        reasons.append("Remarks are too brief (fewer than 5 words).")

    # 2. Evasion / boilerplate check
    lower_remarks = remarks.lower()
    for pattern in EVASIVE_PHRASES:
        if re.search(pattern, lower_remarks) and word_count <= 8:
            clean_pat = pattern.replace(r"\b", "")
            reasons.append(f"Boilerplate or evasive remark detected ('{clean_pat}').")
            break

    # 3. Action marker check
    action_hits = sum(1 for p in ACTION_MARKERS if re.search(p, lower_remarks))

    # 4. Semantic alignment check
    semantic_sim = 0.0
    if complaint and len(complaint) > 10 and word_count >= 4:
        try:
            vec = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b")
            tfidf = vec.fit_transform([complaint, remarks])
            sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
            semantic_sim = float(sim)
        except Exception:
            semantic_sim = 0.2

    # Quality scoring algorithm
    score = 0.35  # base score
    if word_count >= 10:
        score += 0.20
    elif word_count >= 5:
        score += 0.10

    if action_hits >= 2:
        score += 0.30
    elif action_hits == 1:
        score += 0.15

    score += min(semantic_sim * 0.25, 0.25)

    if reasons:
        score = max(score - 0.35, 0.10)

    score = round(min(max(score, 0.0), 1.0), 2)
    is_weak = score < 0.50 or len(reasons) > 0

    if is_weak:
        recommendation = "Officer closing remarks lack specific action details or direct relevance to the grievance. Please specify work done or reference work-order details."
        explanation = f"Flagged as weak closure (Quality score {int(score * 100)}%): {'; '.join(reasons or ['insufficient verifiable action taken'])}"
    else:
        recommendation = "Resolution remarks adequately describe corrective action taken."
        explanation = f"Verified closure (Quality score {int(score * 100)}%): Remarks detail specific actions taken matching the reported grievance."

    return {
        "quality_score": score,
        "is_weak_closure": is_weak,
        "reasons": reasons,
        "recommendation": recommendation,
        "action_markers_found": action_hits,
        "semantic_similarity": round(semantic_sim, 2),
        "confidence": 0.88,
        "explanation": explanation,
    }
