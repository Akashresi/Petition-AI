"""Tests for Authentication endpoints (/api/auth/*)."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import create_token
from app.database import db
from app.security import hash_password

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_auth_db():
    """Seed test users into database with valid hashes."""
    if not db.find_one("users", {"id": "u1"}):
        db.insert("users", {
            "id": "u1",
            "name": "Citizen User",
            "email": "citizen@demo.com",
            "password_hash": hash_password("citizen123"),
            "role": "citizen",
            "phone": "+91 98765 43210",
            "address": "Coimbatore",
        })
    else:
        db.update("users", {"id": "u1"}, {"password_hash": hash_password("citizen123")})


def test_login_success():
    """Valid credentials return 200 with JWT token and user profile."""
    res = client.post("/api/auth/login", json={"email": "citizen@demo.com", "password": "citizen123"})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["user"]["email"] == "citizen@demo.com"
    assert data["user"]["role"] == "citizen"


def test_login_invalid_password():
    """Incorrect password returns 401."""
    res = client.post("/api/auth/login", json={"email": "citizen@demo.com", "password": "wrongpassword"})
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_login_nonexistent_user():
    """Non-existent email returns 401."""
    res = client.post("/api/auth/login", json={"email": "nobody@demo.com", "password": "any"})
    assert res.status_code == 401


def test_register_new_user():
    """Registering a new citizen succeeds and returns token."""
    email = f"new_citizen_{int(pytest.__version__.replace('.', ''))}@demo.com"
    db.delete("users", {"email": email})
    res = client.post(
        "/api/auth/register",
        json={
            "name": "New Citizen",
            "email": email,
            "password": "Password123!",
            "phone": "+91 99999 88888",
            "address": "RS Puram, Coimbatore",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "citizen"


def test_register_duplicate_email():
    """Registering with an already used email returns 409."""
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Duplicate",
            "email": "citizen@demo.com",
            "password": "password",
            "phone": "+91 12345 67890",
        },
    )
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]


def test_get_current_user_me():
    """GET /api/auth/me returns the logged-in user profile."""
    token = create_token("u1")
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "u1"
    assert data["email"] == "citizen@demo.com"


def test_get_me_unauthorized():
    """GET /api/auth/me without valid token returns 401."""
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_token"})
    assert res.status_code == 401
