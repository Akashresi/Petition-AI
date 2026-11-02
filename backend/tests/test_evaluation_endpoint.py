import json
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_evaluation_report_exists_and_valid():
    repo_root = Path(__file__).resolve().parents[2]
    report_file = repo_root / "reports" / "evaluation_report.json"
    assert report_file.exists(), "evaluation_report.json does not exist in /reports"
    
    data = json.loads(report_file.read_text(encoding="utf-8"))
    assert "summary" in data
    summary = data["summary"]
    assert "accuracy" in summary
    assert "f1_weighted" in summary
    assert "per_language_accuracy" in summary
    assert "en" in summary["per_language_accuracy"]
    assert "hi" in summary["per_language_accuracy"]
    assert "ta" in summary["per_language_accuracy"]


def test_analytics_evaluation_endpoint_authenticated(monkeypatch):
    # Register/login an admin user to test endpoint
    reg_res = client.post(
        "/api/auth/register",
        json={
            "name": "Admin Tester",
            "email": "admin_eval_test@example.com",
            "password": "Password123!",
            "phone": "9876543210",
            "role": "admin",
            "district": "Coimbatore",
        },
    )
    if reg_res.status_code == 200:
        token = reg_res.json()["token"]
    else:
        login_res = client.post(
            "/api/auth/login",
            json={"email": "admin_eval_test@example.com", "password": "Password123!"},
        )
        token = login_res.json()["token"]

    res = client.get("/api/analytics/evaluation", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert "summary" in body
    assert body["summary"]["accuracy"] > 0
