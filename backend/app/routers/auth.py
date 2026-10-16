"""Authentication router (register / login) with JWT tokens."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr

from app.config import settings
from app.database import db
from app.security import hash_password, needs_rehash, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str
    address: str = ""


class AuthResponse(BaseModel):
    token: str
    user: dict


def _public_user(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "name": u.get("name"),
        "email": u.get("email"),
        "role": u.get("role"),
        "phone": u.get("phone"),
        "address": u.get("address"),
        "department": u.get("department"),
        "joinedAt": u.get("joinedAt"),
    }


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest) -> AuthResponse:
    user = db.find_one("users", {"email": req.email.lower()})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Transparently upgrade legacy hashes to bcrypt on successful login.
    if needs_rehash(user.get("password_hash", "")):
        db.update("users", {"id": user["id"]}, {"password_hash": hash_password(req.password)})
    return AuthResponse(token=create_token(user["id"]), user=_public_user(user))


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest) -> AuthResponse:
    existing = db.find_one("users", {"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = {
        "id": f"u{int(datetime.now().timestamp())}",
        "name": req.name,
        "email": req.email.lower(),
        "role": "citizen",
        "phone": req.phone,
        "address": req.address,
        "joinedAt": datetime.now().strftime("%Y-%m-%d"),
        "password_hash": hash_password(req.password),
    }
    db.insert("users", user)
    return AuthResponse(token=create_token(user["id"]), user=_public_user(user))


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(
            authorization.split(" ", 1)[1], settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user = db.find_one("users", {"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc