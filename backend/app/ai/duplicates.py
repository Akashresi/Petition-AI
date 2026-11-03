"""Semantic + Geo-aware Duplicate Detection Module.

Wraps multilingual sentence embeddings (with offline fallback), geographic proximity,
and time-window clustering to group duplicates under a master petition.
"""
from typing import Any
from app.ai.dedup import detect_duplicates as semantic_detect_duplicates


def detect_duplicates(
    new_text: str,
    existing_complaints: list[dict],
    threshold: float = 0.50,
    radius_km: float = 15.0,
    window_days: int = 60,
    new_lat: float | None = None,
    new_lon: float | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Detect semantic and geo-aware duplicate petitions across languages.

    Returns:
        dict: isDuplicate, duplicateCount, masterPetitionId, masterPetitionTitle,
              similarComplaints, supporterCount, clusterSupporterCount, confidence, explanation.
    """
    res = semantic_detect_duplicates(
        new_text=new_text,
        existing_petitions=existing_complaints,
        embedding_model="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        threshold=threshold,
        radius_km=radius_km,
        window_days=window_days,
        new_lat=new_lat,
        new_lon=new_lon,
    )

    is_dup = res["is_duplicate"]
    count = res["duplicate_count"]
    master_id = res.get("master_petition_id")
    master_title = res.get("master_petition_title")
    similar = res.get("similar_petitions", [])
    supporters = res.get("cluster_supporter_count", 1)

    top_sim = similar[0]["similarity"] if similar else 0.0

    return {
        "isDuplicate": is_dup,
        "is_duplicate": is_dup,
        "duplicateCount": count,
        "duplicate_count": count,
        "masterPetitionId": master_id,
        "master_petition_id": master_id,
        "masterPetitionTitle": master_title,
        "master_petition_title": master_title,
        "similarComplaints": similar,
        "similar_petitions": similar,
        "supporterCount": supporters,
        "supporter_count": supporters,
        "clusterSupporterCount": supporters,
        "cluster_supporter_count": supporters,
        "confidence": round(max(0.75, float(top_sim) if is_dup else 0.85), 2),
        "explanation": (
            f"Multilingual semantic embeddings and geo-temporal proximity matched {count} similar petition(s) under master petition {master_id}."
            if is_dup
            else "No duplicate petition detected within geographic proximity and 60-day window."
        ),
    }
