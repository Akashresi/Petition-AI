"""
AI Engine Configuration.
All secrets are read from environment variables (never hardcoded).
Copy backend/.env.example -> backend/.env and fill in the values.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ directory (two levels up from this file)
_env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_env_path, override=False)


class AIConfig:
    # ── LLM ──────────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # ── Multilingual Embeddings ───────────────────────────────────────────────
    EMBEDDING_MODEL: str = os.getenv(
        "EMBEDDING_MODEL",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    )

    # ── Confidence / Thresholds ───────────────────────────────────────────────
    # Below this threshold the hybrid engine disagrees -> human_review_required
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.55"))
    # TF-IDF vs LLM agreement gap tolerance
    AGREEMENT_TOLERANCE: float = float(os.getenv("AGREEMENT_TOLERANCE", "0.20"))
    # Duplicate cosine similarity threshold (embedding-space)
    DUPLICATE_THRESHOLD: float = float(os.getenv("DUPLICATE_THRESHOLD", "0.75"))
    # Recent window for duplicate geo+time clustering (days)
    DUPLICATE_WINDOW_DAYS: int = int(os.getenv("DUPLICATE_WINDOW_DAYS", "30"))

    # ── Spam / Abuse ──────────────────────────────────────────────────────────
    MIN_TEXT_LENGTH: int = int(os.getenv("MIN_TEXT_LENGTH", "20"))
    SPAM_SCORE_THRESHOLD: float = float(os.getenv("SPAM_SCORE_THRESHOLD", "0.60"))

    # ── Reports ──────────────────────────────────────────────────────────────
    REPORTS_DIR: Path = Path(os.getenv("REPORTS_DIR", "reports"))


ai_config = AIConfig()
