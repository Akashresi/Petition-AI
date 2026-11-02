"""
Hybrid Classifier Module
========================
Combines three signals:
  1. TF-IDF + Logistic Regression (scikit-learn) – fast, interpretable baseline
  2. Multilingual Sentence-Transformer embeddings – cross-lingual similarity
  3. Gemini LLM judgment – rich contextual reasoning

If signals disagree or confidence is low → human_review_required = True.
"""
from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)

# ── Categories & Department mapping (canonical) ───────────────────────────────
CATEGORIES = [
    "Road & Infrastructure",
    "Water Supply",
    "Electricity",
    "Waste Management",
    "Noise Pollution",
    "Building & Construction",
    "Public Safety",
    "Healthcare",
    "Education",
    "Public Transport",
    "Sanitation",
    "Parks & Recreation",
    "Corruption & Malpractice",
    "Animal Control",
]

DEPARTMENT_MAP = {
    "Road & Infrastructure":    "Roads & Infrastructure (PWD)",
    "Building & Construction":  "Roads & Infrastructure (PWD)",
    "Water Supply":             "Water Works Department",
    "Sanitation":               "Waste Management Department",
    "Electricity":              "Electricity Board (TNEB)",
    "Waste Management":         "Waste Management Department",
    "Parks & Recreation":       "Parks & Horticulture Department",
    "Noise Pollution":          "Public Safety Department",
    "Public Safety":            "Public Safety Department",
    "Animal Control":           "Public Safety Department",
    "Healthcare":               "Health Department",
    "Education":                "Education Department",
    "Public Transport":         "Transport Authority",
    "Corruption & Malpractice": "Vigilance & Anti-Corruption",
}

# ── Seed corpus (EN + TA transliterated + HI transliterated) ─────────────────
SEED_CORPUS: list[tuple[str, str]] = [
    # Road & Infrastructure
    ("Road & Infrastructure", "large pothole on main road causing accidents vehicles damaged"),
    ("Road & Infrastructure", "sadak par bada gadha hai gadi kharab ho rahi hai"),  # HI
    ("Road & Infrastructure", "road damage near bus stand repair needed urgently"),
    ("Road & Infrastructure", "broken road surface pedestrians risk falling street"),
    ("Road & Infrastructure", "peru vazhi pothole accident padhikappadu"),  # TA romanized

    # Water Supply
    ("Water Supply", "no water supply for three days families severely affected"),
    ("Water Supply", "teen din se paani nahi aa raha colony mein pareshani"),  # HI
    ("Water Supply", "water leak main pipeline flooding street waste"),
    ("Water Supply", "thanneer varavillai moonu nalkal kodu suffering"),  # TA romanized
    ("Water Supply", "borewell broken no drinking water residents suffering"),

    # Electricity
    ("Electricity", "street lights not working area dark at night safety issue"),
    ("Electricity", "bijli nahi aa rahi transformer kharab hai"),  # HI
    ("Electricity", "power cut every evening electricity board fix transformer"),
    ("Electricity", "minu saram illai theru lamp damage"),  # TA romanized
    ("Electricity", "voltage fluctuation damages appliances dangerous wires hanging"),

    # Waste Management
    ("Waste Management", "garbage not collected week waste dumped roadside insects smell"),
    ("Waste Management", "kuda nahi uthaya corporation cleaning sanitation issue smell"),  # HI
    ("Waste Management", "sewage overflow blocked drain foul smell garbage everywhere"),
    ("Waste Management", "kurpam edukkavilla nasam nadaikkiradhu"),  # TA romanized
    ("Waste Management", "waste bins overflowing corporation not cleaning stray animals"),

    # Noise Pollution
    ("Noise Pollution", "loudspeakers playing high volume late night disturbing sleep"),
    ("Noise Pollution", "construction noise night hours unbearable wedding hall music"),
    ("Noise Pollution", "raat ko shor machate hain neend nahi aati"),  # HI

    # Building & Construction
    ("Building & Construction", "illegal construction blocking public road encroachment"),
    ("Building & Construction", "unauthorized structure government land encroachment action needed"),
    ("Building & Construction", "anadhikara kattida podum sandhu block"),  # TA romanized

    # Public Safety
    ("Public Safety", "stray dogs attacking children residents fear safety"),
    ("Public Safety", "abandoned building open broken glass danger children playing"),
    ("Public Safety", "awara kutte bachon par hamla kar rahe hain"),  # HI

    # Healthcare
    ("Healthcare", "government hospital hygiene poor patients no treatment on time"),
    ("Healthcare", "primary health center short medicines doctors not available"),
    ("Healthcare", "sarkari aspatal mein dawayi nahi milti"),  # HI

    # Education
    ("Education", "school building roof leaking classrooms unsafe students"),
    ("Education", "government school lacks toilets drinking water facility"),
    ("Education", "pallikkoodam korai kidaikkiradhu maanavargal padhikappadu"),  # TA romanized

    # Public Transport
    ("Public Transport", "bus not coming on time route cancelled commuters waiting hours"),
    ("Public Transport", "bus stop shelter damaged no transport service area"),
    ("Public Transport", "bas waqt par nahi aati commuters pareshaan"),  # HI

    # Sanitation
    ("Sanitation", "open defecation no public toilets unhygienic area disease risk"),
    ("Sanitation", "public toilet closed broken unhygienic smell health risk"),

    # Parks & Recreation
    ("Parks & Recreation", "playground abandoned maintenance children nowhere play"),
    ("Parks & Recreation", "park equipment broken garden not maintained plants dying"),

    # Corruption & Malpractice
    ("Corruption & Malpractice", "officer demanding bribe no work done corruption"),
    ("Corruption & Malpractice", "rishwat maang raha hai kaam nahi karta officer"),  # HI
    ("Corruption & Malpractice", "graft extortion government official misconduct fraud"),

    # Animal Control
    ("Animal Control", "wild animals entering residential area danger"),
    ("Animal Control", "cow bull roaming freely causing accidents road"),
    ("Animal Control", "janavar sadak par ghumte hain accident hota hai"),  # HI
]


# ── TF-IDF + Logistic Regression ─────────────────────────────────────────────

class TFIDFClassifier:
    """scikit-learn TF-IDF + LogisticRegression classifier."""

    def __init__(self) -> None:
        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(
                ngram_range=(1, 2),
                max_features=8000,
                sublinear_tf=True,
                min_df=1,
            )),
            ("clf", LogisticRegression(
                max_iter=2000,
                C=5.0,
                solver="lbfgs",
            )),
        ])
        self._fit()

    def _fit(self) -> None:
        texts = [t for _, t in SEED_CORPUS]
        labels = [c for c, _ in SEED_CORPUS]
        self.pipeline.fit(texts, labels)
        self.classes_ = self.pipeline.classes_.tolist()

    def predict_proba(self, text: str) -> dict[str, float]:
        probs = self.pipeline.predict_proba([text])[0]
        return {cat: float(p) for cat, p in zip(self.classes_, probs)}

    def classify(self, text: str) -> tuple[str, float]:
        proba = self.predict_proba(text)
        best = max(proba, key=proba.__getitem__)
        return best, proba[best]


_tfidf_clf: TFIDFClassifier | None = None

def get_tfidf_classifier() -> TFIDFClassifier:
    global _tfidf_clf
    if _tfidf_clf is None:
        _tfidf_clf = TFIDFClassifier()
    return _tfidf_clf


# ── Multilingual Embedding Classifier ────────────────────────────────────────

_embedding_model = None
_embedding_label_vecs: list[tuple[str, np.ndarray]] | None = None


def _get_embedding_model(model_name: str):
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer  # type: ignore
        logger.info("Loading embedding model %s (first run may download)…", model_name)
        _embedding_model = SentenceTransformer(model_name)
    return _embedding_model


def _get_label_vecs(model_name: str) -> list[tuple[str, np.ndarray]]:
    global _embedding_label_vecs
    if _embedding_label_vecs is None:
        model = _get_embedding_model(model_name)
        labels = list({c for c, _ in SEED_CORPUS})
        # Embed each category name as anchor
        vecs = model.encode(labels, normalize_embeddings=True)
        _embedding_label_vecs = list(zip(labels, vecs))
    return _embedding_label_vecs


def embedding_classify(text: str, model_name: str) -> tuple[str, float]:
    """Embed text and find nearest category centroid."""
    model = _get_embedding_model(model_name)
    text_vec = model.encode([text], normalize_embeddings=True)[0]
    label_vecs = _get_label_vecs(model_name)
    best_label, best_sim = "", 0.0
    for label, vec in label_vecs:
        sim = float(np.dot(text_vec, vec))
        if sim > best_sim:
            best_label, best_sim = label, sim
    return best_label, best_sim


# ── Gemini LLM Classifier ─────────────────────────────────────────────────────

_LLM_CLASSIFY_PROMPT = """\
You are an expert petition classification assistant for a government grievance system.

Classify the following petition into EXACTLY ONE of these categories:
{categories}

Text: "{text}"

Respond ONLY with valid JSON (no markdown):
{{
  "category": "<category from list>",
  "confidence": <0.0-1.0>,
  "explanation": "<one sentence why>",
  "urgency": "<low|medium|high|critical>",
  "severity": "<low|medium|high>",
  "safety_risk": "<none|low|medium|high>",
  "sentiment": "<positive|neutral|negative|angry>",
  "summary": "<one sentence petition summary>",
  "recommended_action": "<specific next step for the officer>",
  "is_spam": <true|false>,
  "spam_reason": "<reason if spam, else null>"
}}
"""

_LLM_RETRY_DELAY = 1.0  # seconds between retries


def llm_classify(text: str, api_key: str, model_name: str) -> dict[str, Any] | None:
    """Call Gemini to classify the petition. Returns parsed dict or None on failure."""
    if not api_key:
        return None
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        cats_str = "\n".join(f"- {c}" for c in CATEGORIES)
        prompt = _LLM_CLASSIFY_PROMPT.format(
            categories=cats_str,
            text=text[:3000],  # token safety cap
        )
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Strip markdown fences if present
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        return data
    except Exception as exc:
        logger.warning("LLM classification failed: %s", exc)
        return None


# ── Hybrid Fusion ─────────────────────────────────────────────────────────────

def hybrid_classify(
    normalized_text: str,
    *,
    api_key: str,
    gemini_model: str,
    embedding_model: str,
    confidence_threshold: float,
    agreement_tolerance: float,
) -> dict[str, Any]:
    """
    Fuse TF-IDF, embedding, and LLM signals.
    Returns classification dict including confidence and human_review_required.
    """
    # 1. TF-IDF baseline
    tfidf_clf = get_tfidf_classifier()
    tfidf_cat, tfidf_conf = tfidf_clf.classify(normalized_text)

    # 2. Multilingual embeddings
    try:
        emb_cat, emb_sim = embedding_classify(normalized_text, embedding_model)
    except Exception as exc:
        logger.warning("Embedding classify failed: %s", exc)
        emb_cat, emb_sim = tfidf_cat, tfidf_conf * 0.8

    # 3. LLM judgment
    llm_result = llm_classify(normalized_text, api_key=api_key, model_name=gemini_model)

    # ── Fusion logic ──────────────────────────────────────────────────────────
    # Primary: if LLM available and confident, trust it most
    if llm_result and llm_result.get("confidence", 0) >= confidence_threshold:
        final_cat = llm_result["category"]
        final_conf = llm_result["confidence"]
        explanation = llm_result.get("explanation", "LLM-classified with high confidence.")
        llm_fields = llm_result
    else:
        # Vote between TF-IDF and embedding
        if tfidf_cat == emb_cat:
            final_cat = tfidf_cat
            final_conf = (tfidf_conf + emb_sim) / 2
        elif tfidf_conf >= emb_sim:
            final_cat = tfidf_cat
            final_conf = tfidf_conf * 0.85
        else:
            final_cat = emb_cat
            final_conf = emb_sim * 0.85
        explanation = (
            f"TF-IDF→{tfidf_cat}({tfidf_conf:.2f}), "
            f"Embedding→{emb_cat}({emb_sim:.2f}). "
            f"LLM {'unavailable' if not api_key else 'low confidence'}."
        )
        llm_fields = {}

    # Ensure category is from canonical list
    if final_cat not in CATEGORIES:
        final_cat = tfidf_cat

    department = DEPARTMENT_MAP.get(final_cat, "General Administration")

    # Agreement check: require human review if signals diverge
    cats_disagree = len({tfidf_cat, emb_cat, llm_fields.get("category", final_cat)}) > 1
    low_confidence = final_conf < confidence_threshold
    human_review_required = cats_disagree or low_confidence or bool(
        llm_fields.get("is_spam")
    )

    return {
        "category": final_cat,
        "department": department,
        "confidence": round(final_conf, 3),
        "explanation": explanation,
        "human_review_required": human_review_required,
        # Per-signal details (for audit trail)
        "_tfidf": {"category": tfidf_cat, "confidence": round(tfidf_conf, 3)},
        "_embedding": {"category": emb_cat, "similarity": round(emb_sim, 3)},
        "_llm": llm_fields,
        # LLM-enriched fields (fall back to rule-based in classifier.py)
        "urgency": llm_fields.get("urgency"),
        "severity": llm_fields.get("severity"),
        "safety_risk": llm_fields.get("safety_risk"),
        "sentiment": llm_fields.get("sentiment"),
        "summary": llm_fields.get("summary"),
        "recommended_action": llm_fields.get("recommended_action"),
        "is_spam": llm_fields.get("is_spam", False),
        "spam_reason": llm_fields.get("spam_reason"),
    }
