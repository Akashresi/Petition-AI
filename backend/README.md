# PetitionAI Backend (FastAPI)

AI-powered REST API backend for the PetitionAI grievance & petition management system.

## Technologies Used

| Technology | Purpose |
|------------|---------|
| **FastAPI** | High-performance REST API framework |
| **MongoDB** | Document database (with in-memory fallback) |
| **AI / NLP / ML** | TF-IDF text classification, sentiment analysis, priority prediction, duplicate detection |
| **REST APIs** | Full CRUD for auth, complaints, notifications, analytics |
| **Email (SMTP)** | Status notifications to petitioners |
| **SMS** | SMS notifications (console or Twilio provider) |
| **JWT** | Token-based authentication |
| **bcrypt** | Salted password hashing (legacy SHA-256 hashes auto-upgraded on login) |

## Quick Start

```bash
# 1. Create virtual environment & install deps (Python 3.14+)
npm run backend:install
# or manually:
#   python -m venv .venv
#   .venv\Scripts\python.exe -m pip install -r requirements.txt

# 2. Configure environment
Copy-Item .env.example .env   # then edit values

# 3. Start server
npm run backend
# or: .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Server runs at http://localhost:8000. Interactive docs at http://localhost:8000/docs.

## Running with MongoDB

Set `USE_MONGODB=true` and `MONGODB_URI=mongodb://localhost:27017/petition_ai` in `.env`.
If MongoDB is not running, the backend automatically falls back to an in-memory store so the
app always works.

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new citizen |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/complaints` | List complaints (filters: department, status, submittedBy, assignedOfficer) |
| POST | `/api/complaints` | Submit petition (runs AI analysis + duplicate detection, sends email/SMS) |
| GET | `/api/complaints/{id}` | Get single complaint (owner / officer of dept / admin only) |
| PATCH | `/api/complaints/{id}` | Update status / assign officer / add remarks (owner / officer of dept / admin only) |
| GET | `/api/notifications` | List user notifications |
| PATCH | `/api/notifications/{id}/read` | Mark notification read |
| PATCH | `/api/notifications/read-all` | Mark all read |
| GET | `/api/analytics` | Dashboard aggregate stats |
| GET | `/api/health` | Health check (reports mongo status) |

## AI / ML Pipeline (`app/ai/`)

- **`ml_pipeline.py`** — Pure-python TF-IDF + cosine-similarity classifier with a seed corpus
  of civic complaint examples; tokenization + stopword removal; rule-based sentiment and
  priority scoring; keyword extraction.
- **`duplicates.py`** — Duplicate grievance detection via TF-IDF similarity threshold.

## Notifications (`app/services/`)

- **`email_service.py`** — SMTP email sending (configure SMTP_USER/SMTP_PASSWORD in `.env`).
  If unconfigured, messages are logged instead.
- **`sms_service.py`** — Pluggable SMS provider (`console` default, `twilio` supported).