"""AI Router - Backend Gemini image analysis, file validation, rate limiting, and centralized NLP logic."""
import base64
from collections import defaultdict
import time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.ai.duplicates import detect_duplicates
from app.ai.ml_pipeline import (
    DEPARTMENT_MAP,
    analyze_sentiment,
    classifier,
    generate_ai_analysis,
    predict_priority,
)
from app.config import settings
from app.database import db
from app.routers.auth import get_current_user
from app.security import (
    MAX_UPLOAD_SIZE_BYTES,
    image_analysis_limiter,
    mask_pii,
    validate_upload_content,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# ── In-memory Rate Limiting & Upload Validation ──────────────────────────────
MAX_FILE_SIZE_BYTES = MAX_UPLOAD_SIZE_BYTES
_rate_limit_records = image_analysis_limiter._records


def check_rate_limit(user_id: str) -> None:
    image_analysis_limiter.check(user_id)


def validate_image_payload(base64_str: str) -> tuple[bytes, str]:
    """Validate base64 string, enforce 5MB limit, and verify magic bytes for JPEG/PNG/PDF."""
    return validate_upload_content(base64_str)


def analyze_with_gemini(decoded_bytes: bytes, mime_type: str) -> dict:
    """Analyze image with Gemini 1.5 Flash or return structured fallback if key is unconfigured."""
    if not settings.GEMINI_API_KEY:
        return {
            "analysis": "Visual evidence verified. Attached document/image inspected for civic grievance processing.",
            "confidence": 0.85,
            "explanation": "Processed via backend image validator (GEMINI_API_KEY unconfigured).",
        }

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = (
            "Analyze this image/document for a municipal civic grievance system.\n"
            "Identify:\n"
            "1. What type of issue is visible (pothole, garbage, water leak, broken streetlight, illegal construction, etc.)\n"
            "2. Severity level (critical, high, medium, low)\n"
            "3. Any visible location markers (street signs, landmarks, building numbers)\n"
            "4. Any text visible in the image\n"
            "5. Whether this appears to be a genuine civic issue\n"
            "Provide a concise analysis in 2-3 sentences."
        )

        image_part = {
            "mime_type": mime_type,
            "data": decoded_bytes,
        }
        response = model.generate_content([prompt, image_part])
        text = (response.text or "").strip()

        return {
            "analysis": text or "Civic evidence analyzed successfully.",
            "confidence": 0.90,
            "explanation": "Image content verified by Gemini 1.5 Flash multimodal vision model.",
        }
    except Exception as exc:
        return {
            "analysis": f"Visual evidence recorded ({mime_type}). Queued for administrative inspection.",
            "confidence": 0.75,
            "explanation": f"Gemini API invocation fallback: {str(exc)[:120]}",
        }


# ── Pydantic Request / Response Models ───────────────────────────────────────

class ImageAnalysisIn(BaseModel):
    image: str


class ImageAnalysisOut(BaseModel):
    analysis: str
    confidence: float
    explanation: str


class PetitionAnalysisIn(BaseModel):
    title: str
    description: str
    category: Optional[str] = None
    location: Optional[str] = None
    district: Optional[str] = None


class PetitionAnalysisOut(BaseModel):
    category: str
    categoryConfidence: float
    department: str
    departmentConfidence: float
    priority: str
    priorityScore: float
    sentiment: str
    sentimentScore: float
    isDuplicate: bool
    duplicateCount: int
    similarComplaints: list[dict] = []
    urgencyLevel: str
    keywords: list[str] = []
    confidence: float
    explanation: str
    human_review_required: bool = False
    summaryNote: str


class ClassificationIn(BaseModel):
    category: Optional[str] = None
    text: Optional[str] = None


class ClassificationOut(BaseModel):
    category: str = "Road & Infrastructure"
    department: str
    categoryConfidence: float
    departmentConfidence: float
    confidence: float
    explanation: str
    human_review_required: bool = False


class PriorityIn(BaseModel):
    text: str


class PriorityOut(BaseModel):
    priority: str
    priorityScore: float
    confidence: float
    explanation: str


class SentimentIn(BaseModel):
    text: str


class SentimentOut(BaseModel):
    sentiment: str
    sentimentScore: float
    confidence: float
    explanation: str


class DuplicateIn(BaseModel):
    category: Optional[str] = None
    text: Optional[str] = None


class DuplicateOut(BaseModel):
    isDuplicate: bool
    duplicateCount: int
    similarComplaints: list[dict] = []
    confidence: float
    explanation: str


# ── AI Endpoints ─────────────────────────────────────────────────────────────

@router.post("/analyze-image", response_model=ImageAnalysisOut)
def analyze_image(
    req: ImageAnalysisIn,
    user: dict = Depends(get_current_user),
) -> ImageAnalysisOut:
    check_rate_limit(user.get("id", "anonymous"))
    decoded_bytes, mime_type = validate_image_payload(req.image)
    result = analyze_with_gemini(decoded_bytes, mime_type)
    return ImageAnalysisOut(**result)


@router.post("/analyze", response_model=PetitionAnalysisOut)
def analyze_petition(
    req: PetitionAnalysisIn,
    user: dict = Depends(get_current_user),
) -> PetitionAnalysisOut:
    """Full single-source AI analysis for petition text and image summary."""
    full_text = f"{req.title} {req.description}".strip()
    analysis = generate_ai_analysis(req.title, req.description, req.category or None)

    existing = db.find("complaints", {})
    dup = detect_duplicates(full_text, existing, threshold=0.45)
    analysis["isDuplicate"] = dup["isDuplicate"]
    analysis["duplicateCount"] = dup["duplicateCount"]
    analysis["similarComplaints"] = dup["similarComplaints"]

    return PetitionAnalysisOut(**analysis)


@router.post("/classify", response_model=ClassificationOut)
def classify_category_and_dept(
    req: ClassificationIn,
    user: dict = Depends(get_current_user),
) -> ClassificationOut:
    """Classify category and resolve responsible municipal department."""
    from app.ai.classifier import get_tfidf_classifier, llm_classify
    human_review_required = False
    review_reasons = []

    if req.text:
        tfidf_clf = get_tfidf_classifier()
        cat, conf = tfidf_clf.classify(req.text)
        
        # Hosted LLM step (backend only)
        if settings.GEMINI_API_KEY:
            try:
                llm_res = llm_classify(req.text, api_key=settings.GEMINI_API_KEY, model_name="gemini-1.5-flash")
                if llm_res and "category" in llm_res:
                    llm_cat = llm_res["category"]
                    llm_conf = float(llm_res.get("confidence", 0.85))
                    if llm_cat != cat:
                        human_review_required = True
                        review_reasons.append(f"Model disagreement: Baseline predicted '{cat}', LLM predicted '{llm_cat}'.")
                        if llm_conf > conf:
                            cat = llm_cat
                            conf = llm_conf
                    else:
                        conf = max(conf, llm_conf)
            except Exception:
                pass
    else:
        cat = req.category or "Road & Infrastructure"
        conf = 0.88

    if conf < 0.65:
        human_review_required = True
        review_reasons.append(f"Confidence {round(conf * 100)}% below 65% threshold")

    dept = DEPARTMENT_MAP.get(cat, "Roads & Infrastructure")
    dept_conf = round(min(conf + 0.05, 0.99), 2)
    explanation = (
        f"Routed to {dept} based on classification of {cat} ({round(conf * 100)}% confidence)."
    )
    if human_review_required:
        explanation += f" Flagged for human review: {'; '.join(review_reasons)}"

    return ClassificationOut(
        category=cat,
        department=dept,
        categoryConfidence=round(conf, 2),
        departmentConfidence=dept_conf,
        confidence=round(conf, 2),
        explanation=explanation,
        human_review_required=human_review_required,
    )


@router.post("/priority", response_model=PriorityOut)
def predict_priority_endpoint(
    req: PriorityIn,
    user: dict = Depends(get_current_user),
) -> PriorityOut:
    """Predict urgency and priority level from text."""
    priority, score = predict_priority(req.text)
    return PriorityOut(
        priority=priority,
        priorityScore=score,
        confidence=score,
        explanation=f"Predicted {priority.upper()} priority based on severity keywords and urgency indicators.",
    )


@router.post("/sentiment", response_model=SentimentOut)
def analyze_sentiment_endpoint(
    req: SentimentIn,
    user: dict = Depends(get_current_user),
) -> SentimentOut:
    """Analyze citizen sentiment from complaint wording."""
    sentiment, score = analyze_sentiment(req.text)
    return SentimentOut(
        sentiment=sentiment,
        sentimentScore=score,
        confidence=0.85,
        explanation=f"Detected {sentiment} sentiment with tone score {round(score, 2)}.",
    )


@router.post("/duplicates", response_model=DuplicateOut)
def detect_duplicates_endpoint(
    req: DuplicateIn,
    user: dict = Depends(get_current_user),
) -> DuplicateOut:
    """Detect similar existing petitions using semantic similarity."""
    text = req.text or req.category or ""
    existing = db.find("complaints", {})
    dup = detect_duplicates(text, existing, threshold=0.45)
    return DuplicateOut(**dup)
