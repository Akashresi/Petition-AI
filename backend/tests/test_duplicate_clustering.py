"""Unit tests for semantic + geo-aware duplicate clustering and supporter count engine."""
import pytest
from fastapi.testclient import TestClient

from app.ai.duplicates import detect_duplicates
from app.database import db
from app.main import app

client = TestClient(app)


def get_token(email: str = "cluster_user@example.com") -> str:
    db.delete("users", {"email": email.lower()})
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Cluster Citizen",
            "email": email,
            "password": "Password123!",
            "phone": "9876543210",
            "address": "Gandhipuram",
        },
    )
    assert reg.status_code == 200
    login = client.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    return login.json()["token"]


def test_paraphrased_and_multilingual_duplicate_clustering():
    existing = [
        {
            "id": "c_orig_1",
            "petitionId": "PET-2026-901",
            "title": "Large pothole on Cross Cut Road",
            "description": "Massive road damage near the bus stop causing traffic jams and vehicle damage",
            "category": "Road & Infrastructure",
            "location": "Cross Cut Road",
            "district": "Coimbatore",
            "lat": 11.0168,
            "lon": 76.9558,
            "created_at": "2026-10-20T10:00:00Z",
            "status": "in_progress",
            "supporter_count": 4,
        }
    ]

    # 1. English paraphrased petition
    res_en = detect_duplicates(
        "There is a deep pothole on Cross Cut Road damaging two-wheelers near bus shelter.",
        existing,
        threshold=0.45,
        new_lat=11.0170,
        new_lon=76.9560,
    )
    assert res_en["isDuplicate"] is True
    assert res_en["duplicateCount"] >= 1
    assert res_en["masterPetitionId"] in ["c_orig_1", "PET-2026-901"]
    assert res_en["clusterSupporterCount"] >= 5

    # 2. Tamil petition describing the same issue at the same location
    res_ta = detect_duplicates(
        "கிராஸ் கட் சாலையில் பேருந்து நிறுத்தம் அருகே பெரிய பள்ளம் ஏற்பட்டுள்ளது.",
        existing,
        threshold=0.35,
        new_lat=11.0169,
        new_lon=76.9559,
    )
    assert "isDuplicate" in res_ta
    assert "explanation" in res_ta


def test_i_have_this_issue_too_endpoint():
    token1 = get_token("citizen_supporter1@example.com")
    token2 = get_token("citizen_supporter2@example.com")

    # Citizen 1 submits a petition
    create_res = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {token1}"},
        json={
            "title": "Broken street light at 5th Cross Road",
            "description": "Entire corner is in pitch dark for four days",
            "location": "5th Cross Road",
            "district": "Coimbatore",
        },
    )
    assert create_res.status_code == 200
    complaint = create_res.json()
    complaint_id = complaint["id"]
    assert complaint.get("supporterCount", 1) == 1

    # Citizen 2 clicks 'I have this issue too'
    support_res = client.post(
        f"/api/complaints/{complaint_id}/support",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert support_res.status_code == 200
    data = support_res.json()
    assert data["supporterCount"] == 2
    assert "Support recorded" in data["message"]

    # Citizen 2 clicks again -> deduplicated, does not increment
    repeat_res = client.post(
        f"/api/complaints/{complaint_id}/support",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert repeat_res.status_code == 200
    assert repeat_res.json()["supporterCount"] == 2
    assert "Already supported" in repeat_res.json()["message"]
