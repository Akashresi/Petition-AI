"""Unit tests for Fairness & Demographic Equity Audit."""
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from scripts.fairness_audit import run_fairness_audit
from app.database import db


@pytest.fixture
def client():
    return TestClient(app)


def test_fairness_audit_computation_and_rule5():
    res = run_fairness_audit()
    assert res["status"] == "success"
    assert "fourFifthsRuleCompliance" in res
    assert "perLanguage" in res
    assert "perDistrict" in res
    # Rule 5 strict checks
    assert "confidence" in res
    assert "explanation" in res
    assert isinstance(res["confidence"], float)
    assert res["confidence"] >= 0.85
    assert len(res["explanation"]) > 10

    # Verify all 3 languages evaluated
    langs = {item["code"] for item in res["perLanguage"]}
    assert {"en", "hi", "ta"}.issubset(langs)

    # Verify report file exists
    repo_root = Path(__file__).resolve().parents[2]
    report_file = repo_root / "reports" / "fairness_audit.json"
    assert report_file.exists()


def test_fairness_endpoint_authenticated(client):
    if not db.find_one("users", {"id": "u3"}):
        db.insert("users", {"id": "u3", "name": "Admin Rajesh", "email": "admin@demo.com", "role": "admin"})

    admin_token = create_token("u3")
    res = client.get("/api/analytics/fairness", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "perLanguage" in data
    assert "perDistrict" in data
