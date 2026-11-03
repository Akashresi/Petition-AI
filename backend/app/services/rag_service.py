"""RAG Resolution Suggestion Service.

Retrieves similar past resolved complaints to suggest proven actions,
estimated turnaround times, and resolution templates to officers.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.database import db

logger = logging.getLogger("rag_service")

# Curated fallback archive of standard civic resolutions across departments
KNOWLEDGE_ARCHIVE = [
    {
        "id": "kb_road_1",
        "petitionId": "PET-ARCHIVE-01",
        "title": "Severe road crater and pothole repair on arterial road",
        "category": "Road & Infrastructure",
        "department": "Roads & Infrastructure",
        "district": "Coimbatore",
        "resolutionDetails": "Asphalt leveling and cold-mix bituminous resurfacing completed with compaction. Inspection cleared by Assistant Engineer.",
        "daysToResolve": 3,
    },
    {
        "id": "kb_water_1",
        "petitionId": "PET-ARCHIVE-02",
        "title": "Main pipeline leakage and drinking water supply disruption",
        "category": "Water Supply",
        "department": "Water Works",
        "district": "Coimbatore",
        "resolutionDetails": "Replaced cracked 4-inch PVC pipeline collar joint and restored normal pressure supply across the residential grid.",
        "daysToResolve": 2,
    },
    {
        "id": "kb_elec_1",
        "petitionId": "PET-ARCHIVE-03",
        "title": "Non-functional street light and transformer sparking",
        "category": "Electricity",
        "department": "Electricity Board",
        "district": "Coimbatore",
        "resolutionDetails": "Replaced 4 blown 70W LED street lamp luminaires and secured loose neutral grounding wire on transformer pole.",
        "daysToResolve": 2,
    },
    {
        "id": "kb_waste_1",
        "petitionId": "PET-ARCHIVE-04",
        "title": "Uncollected street garbage and overflowing commercial waste bins",
        "category": "Waste Management",
        "department": "Waste Management",
        "district": "Coimbatore",
        "resolutionDetails": "Dispatched dual-bin hydraulic compactor truck, cleared 1.8 tons of accumulated debris, and applied lime powder disinfectant.",
        "daysToResolve": 1,
    },
    {
        "id": "kb_noise_1",
        "petitionId": "PET-ARCHIVE-05",
        "title": "Late night loudspeaker noise violation and commercial decibel excess",
        "category": "Noise Pollution",
        "department": "Public Safety",
        "district": "Coimbatore",
        "resolutionDetails": "Patrol officer issued warning notice under Noise Pollution (Regulation) Rules and confiscated unauthorized amplifiers.",
        "daysToResolve": 1,
    },
]


def _calc_resolution_days(c: dict) -> int:
    """Calculate elapsed days between submission and resolution."""
    try:
        sub = c.get("submittedAt")
        if not sub:
            return 3
        sub_dt = datetime.fromisoformat(sub.replace("Z", "+00:00"))
        # Check status history
        history = c.get("statusHistory", [])
        res_entry = next((h for h in history if h.get("status") in ["resolved", "closed"]), None)
        if res_entry and res_entry.get("timestamp"):
            res_dt = datetime.fromisoformat(res_entry["timestamp"].replace("Z", "+00:00"))
            delta = (res_dt - sub_dt).days
            return max(delta, 1)
        return 3
    except Exception:
        return 3


def get_resolution_suggestions(complaint: dict, top_k: int = 3) -> list[dict[str, Any]]:
    """Retrieve top K similar past resolved complaints and actionable templates."""
    query_text = f"{complaint.get('title', '')} {complaint.get('description', '')} {complaint.get('category', '')}".strip()
    if not query_text:
        return []

    # 1. Fetch resolved complaints from database
    db_complaints = db.find("complaints", {})
    resolved_candidates = [
        c for c in db_complaints
        if c.get("status") in ["resolved", "closed"]
        and str(c.get("id")) != str(complaint.get("id"))
        and str(c.get("petitionId")) != str(complaint.get("petitionId"))
        and c.get("resolutionDetails")
    ]

    # Combine with knowledge archive to guarantee coverage
    candidates: list[dict[str, Any]] = []
    for c in resolved_candidates:
        candidates.append({
            "id": c.get("id"),
            "petitionId": c.get("petitionId", "PET-RESOLVED"),
            "title": c.get("title", ""),
            "category": c.get("category", "General"),
            "department": c.get("assignedDepartment", "Public Works"),
            "district": c.get("district", "Tamil Nadu"),
            "resolutionDetails": c.get("resolutionDetails", ""),
            "daysToResolve": _calc_resolution_days(c),
        })

    for kb in KNOWLEDGE_ARCHIVE:
        candidates.append(kb)

    if not candidates:
        return []

    # 2. Vectorize texts using TF-IDF
    corpus = [
        f"{c['category']} {c['title']} {c['resolutionDetails']}"
        for c in candidates
    ]

    try:
        vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
        tfidf_matrix = vec.fit_transform(corpus)
        query_vec = vec.transform([query_text])
        sims = cosine_similarity(query_vec, tfidf_matrix)[0]
    except Exception as exc:
        logger.warning("RAG TF-IDF error: %s", exc)
        sims = np.zeros(len(candidates))

    # Boost candidates in matching category
    target_cat = complaint.get("category", "").lower()
    adjusted_scores = []
    for i, c in enumerate(candidates):
        base_sim = float(sims[i])
        cat_bonus = 0.25 if c["category"].lower() == target_cat else 0.0
        adjusted_scores.append(min(base_sim + cat_bonus, 0.98))

    # Top-K ranking
    top_indices = np.argsort(adjusted_scores)[::-1][:top_k]

    suggestions: list[dict[str, Any]] = []
    for idx in top_indices:
        c = candidates[idx]
        sim_val = round(float(adjusted_scores[idx]), 2)
        conf = round(min(0.70 + 0.28 * sim_val, 0.97), 2)
        suggestions.append({
            "petitionId": c["petitionId"],
            "title": c["title"],
            "category": c["category"],
            "department": c["department"],
            "actionTaken": c["resolutionDetails"],
            "daysToResolve": c["daysToResolve"],
            "similarity": sim_val,
            "confidence": conf,
            "explanation": (
                f"Historical resolution matched {int(sim_val * 100)}% relevance for '{c['category']}' petitions. "
                f"Previous resolution took {c['daysToResolve']} day(s) via standard departmental remediation."
            ),
        })

    return suggestions
