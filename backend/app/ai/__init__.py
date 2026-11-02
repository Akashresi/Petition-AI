"""AI / NLP / ML analysis package - Single source of truth for PetitionAI AI logic."""

from .analyzer import analyze_petition
from .classifier import CATEGORIES, DEPARTMENT_MAP, hybrid_classify
from .config import ai_config
from .dedup import detect_duplicates as semantic_detect_duplicates
from .duplicates import detect_duplicates
from .evaluator import run_evaluation
from .ingestion import extract_text_from_bytes, extract_text_from_file
from .language import detect_language, normalize_text, process_language
from .ml_pipeline import (
    TfidfClassifier,
    analyze_sentiment,
    extract_keywords,
    generate_ai_analysis,
    predict_priority,
)
from .priority import detect_priority, is_emergency
from .spam import detect_spam

__all__ = [
    "ai_config",
    "analyze_petition",
    "analyze_sentiment",
    "CATEGORIES",
    "DEPARTMENT_MAP",
    "detect_duplicates",
    "detect_language",
    "detect_priority",
    "detect_spam",
    "extract_keywords",
    "extract_text_from_bytes",
    "extract_text_from_file",
    "generate_ai_analysis",
    "hybrid_classify",
    "is_emergency",
    "normalize_text",
    "predict_priority",
    "process_language",
    "run_evaluation",
    "semantic_detect_duplicates",
    "TfidfClassifier",
]
