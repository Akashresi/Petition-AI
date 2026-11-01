"""PetitionAI - FastAPI backend entry point.

Run:  uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ai, analytics, auth, complaints, notifications
from app.seed import seed_all

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered grievance & petition management system API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(complaints.router)
app.include_router(notifications.router)
app.include_router(analytics.router)


@app.on_event("startup")
def on_startup() -> None:
    seed_all()


@app.get("/")
def root() -> dict:
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/api/health")
def health() -> dict:
    from app.database import db

    return {
        "status": "ok",
        "mongo": db.using_mongodb,
        "storage": "mongodb" if db.using_mongodb else "in-memory",
    }