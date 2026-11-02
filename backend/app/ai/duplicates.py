from app.ai.ml_pipeline import classifier


def detect_duplicates(new_text: str, existing_complaints: list[dict], threshold: float = 0.45) -> dict:
    """Return duplicate info comparing new text against existing complaints."""
    similar: list[dict] = []
    for c in existing_complaints:
        comp_text = f"{c.get('title', '')} {c.get('description', '')}"
        sim = classifier.similarity(new_text, comp_text)
        if sim >= threshold:
            similar.append({
                "id": c.get("petitionId") or c.get("id"),
                "title": c.get("title", ""),
                "similarity": round(sim, 2),
                "status": c.get("status", "submitted"),
            })

    similar.sort(key=lambda s: s["similarity"], reverse=True)
    top_sim = similar[0]["similarity"] if similar else 0.0
    return {
        "isDuplicate": len(similar) > 0,
        "duplicateCount": len(similar),
        "similarComplaints": similar[:3],
        "confidence": round(max(0.70, top_sim if similar else 0.85), 2),
        "explanation": (
            f"Detected {len(similar)} similar complaint(s) with semantic cosine similarity >= {threshold}."
            if similar else "No similar complaints exceeding the similarity threshold were found."
        ),
    }
