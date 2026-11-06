"""Unit tests for resolution time prediction and backlog risk flagging."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from app.services.resolution_time import predict_resolution_time
from app.database import db


@pytest.fixture
def client():
    return TestClient(app)


def test_predict_resolution_time_priorities_and_rule5():
    crit_c = {
        "priority": "critical",
        "category": "Road & Infrastructure",
        "assignedDepartment": "Roads & Infrastructure",
    }
    low_c = {
        "priority": "low",
        "category": "Road & Infrastructure",
        "assignedDepartment": "Roads & Infrastructure",
    }

    pred_crit = predict_resolution_time(crit_c, all_complaints=[])
    pred_low = predict_resolution_time(low_c, all_complaints=[])

    assert pred_crit["predictedDaysMax"] < pred_low["predictedDaysMin"]
    assert "confidenceInterval" in pred_crit
    assert "confidence" in pred_crit
    assert "explanation" in pred_crit
    assert isinstance(pred_crit["confidence"], float)
    assert 0.70 <= pred_crit["confidence"] <= 0.99
    assert len(pred_crit["explanation"]) > 10


def test_department_backlog_risk_flagging():
    # Simulate high backlog (6 pending complaints in Roads & Infrastructure)
    mock_backlog = [
        {"assignedDepartment": "Roads & Infrastructure", "status": "submitted"}
        for _ in range(6)
    ]

    c = {
        "priority": "high",
        "category": "Road & Infrastructure",
        "assignedDepartment": "Roads & Infrastructure",
    }

    pred = predict_resolution_time(c, all_complaints=mock_backlog)
    assert pred["backlogRisk"] is True
    assert pred["departmentPendingCount"] == 6
    assert "Warning" in pred["explanation"]


def test_resolution_prediction_endpoint():
    from app.routers.complaints import get_resolution_prediction
    if not db.find_one("users", {"id": "u1"}):
        db.insert("users", {"id": "u1", "name": "Akash Rajan", "email": "citizen@demo.com", "role": "citizen"})

    test_c = {
        "id": "c_pred_test",
        "petitionId": "PET-PRED-01",
        "title": "Low water pressure",
        "category": "Water Supply",
        "assignedDepartment": "Water Works",
        "priority": "high",
        "status": "in_progress",
    }
    db.insert("complaints", test_c)

    data = get_resolution_prediction("c_pred_test", user={"id": "u1"})
    assert "confidenceInterval" in data
    assert "confidence" in data
    assert "explanation" in data
    assert "slaDays" in data
