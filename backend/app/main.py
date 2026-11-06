"""PetitionAI - FastAPI backend entry point.

Run:  uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ai, analytics, auth, complaints, notifications, webhooks
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
app.include_router(webhooks.router)


@app.on_event("startup")
def on_startup() -> None:
    import os
    import sys
    is_testing = "pytest" in sys.modules or bool(os.getenv("PYTEST_CURRENT_TEST"))
    # Demo credentials and seed complaints are only populated in local development
    if (settings.ENV == "development" or settings.DEBUG) and not is_testing:
        seed_all()
    if not is_testing:
        try:
            from app.services.scheduler import start_scheduler
            start_scheduler()
        except Exception:
            pass


@app.on_event("shutdown")
def on_shutdown() -> None:
    try:
        from app.services.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass


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
