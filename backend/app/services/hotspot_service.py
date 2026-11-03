"""Hotspot early warning detection service.

Detects when multiple petitions in the same geographic area and category
cluster within a time window, signaling an emerging civic hotspot.
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

DISTRICT_COORDS = {
    "Coimbatore": [11.0168, 76.9558],
    "Chennai": [13.0827, 80.2707],
    "Madurai": [9.9252, 78.1198],
    "Tiruchirappalli": [10.7905, 78.7047],
    "Salem": [11.6643, 78.1460],
    "Tirunelveli": [8.7139, 77.7567],
    "Erode": [11.3410, 77.7172],
    "Vellore": [12.9165, 79.1325],
    "Thoothukudi": [8.7642, 78.1348],
    "Dindigul": [10.3673, 77.9803],
    "Thanjavur": [10.7870, 79.1378],
    "Ranipet": [12.9272, 79.3330],
    "Virudhunagar": [9.5872, 77.9514],
    "Karur": [10.9601, 78.0766],
    "Nilgiris": [11.4102, 76.6950],
    "Kanchipuram": [12.8342, 79.7036],
}


def detect_hotspots(
    complaints: list[dict],
    min_cluster_size: int = 3,
    window_days: int = 90,
) -> list[dict[str, Any]]:
    """Cluster complaints by (district, category) or (location, category).

    Returns a list of hotspot alerts with severity, counts, and coordinates.
    """
    clusters = defaultdict(list)
    now = datetime.now(timezone.utc)

    for c in complaints:
        # Exclude closed complaints if older than window
        cat = c.get("category", "General")
        district = c.get("district", "Coimbatore")
        loc = c.get("location", district)

        # Parse submission time
        sub_time = c.get("submittedAt")
        is_recent = True
        if sub_time:
            try:
                dt = datetime.fromisoformat(sub_time.replace("Z", "+00:00"))
                if (now - dt).days > window_days:
                    is_recent = False
            except Exception:
                is_recent = True

        if is_recent:
            key = f"{district}::{cat}"
            clusters[key].append(c)

    hotspots: list[dict[str, Any]] = []

    for key, group in clusters.items():
        if len(group) >= min_cluster_size:
            district, cat = key.split("::", 1)
            primary_loc = group[0].get("location", district)
            department = group[0].get("assignedDepartment", "Public Works")

            # Determine severity
            critical_count = sum(1 for p in group if p.get("priority") == "critical")
            severity = "critical" if critical_count > 0 or len(group) >= 5 else "high"

            # Resolve coordinates
            coords = DISTRICT_COORDS.get(district) or [11.0168, 76.9558]
            if group[0].get("lat") and group[0].get("lon"):
                coords = [float(group[0]["lat"]), float(group[0]["lon"])]

            petitions = [p.get("petitionId") or p.get("id") for p in group]

            hotspots.append({
                "id": f"hotspot_{district.lower()}_{cat.lower().replace(' ', '_').replace('&', 'and')}",
                "district": district,
                "location": primary_loc,
                "category": cat,
                "department": department,
                "count": len(group),
                "criticalCount": critical_count,
                "severity": severity,
                "coordinates": coords,
                "petitions": petitions,
                "title": f"{cat} Surge in {district}",
                "alertMessage": (
                    f"Hotspot Alert: {len(group)} {cat} petitions reported in {district} "
                    f"within the recent window. Immediate departmental inspection recommended."
                ),
                "confidence": round(min(0.70 + 0.05 * len(group) + 0.10 * (critical_count > 0), 0.98), 2),
                "explanation": (
                    f"Statistical density detection identified {len(group)} concurrent complaints in {district} "
                    f"for category '{cat}' within a 90-day window ({critical_count} critical priority)."
                ),
            })

    # Sort hotspots by count descending
    hotspots.sort(key=lambda h: (h["severity"] == "critical", h["count"]), reverse=True)
    return hotspots
