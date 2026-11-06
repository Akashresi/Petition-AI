import json
from pathlib import Path
from app.routers.analytics import get_evaluation_metrics, get_department_sla_performance


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
    assert "tanglish" in summary["per_language_accuracy"]
    assert "spam_metrics" in summary
    assert summary["spam_metrics"]["spam_catch_rate"] >= 0.90


def test_analytics_evaluation_endpoint_direct():
    admin_user = {"id": "admin_1", "email": "admin@demo.com", "role": "admin"}
    body = get_evaluation_metrics(user=admin_user)
    assert "summary" in body
    summary = body["summary"]
    assert summary["accuracy"] > 0
    assert "tanglish" in summary["per_language_accuracy"]
    assert summary["spam_metrics"]["spam_catch_rate"] >= 0.90


def test_analytics_department_sla_performance_direct():
    admin_user = {"id": "admin_1", "email": "admin@demo.com", "role": "admin"}
    body = get_department_sla_performance(user=admin_user)
    assert "departments" in body
    assert len(body["departments"]) > 0
    dept = body["departments"][0]
    assert "department" in dept
    assert "slaCompliancePct" in dept
    assert 0 <= dept["slaCompliancePct"] <= 100
