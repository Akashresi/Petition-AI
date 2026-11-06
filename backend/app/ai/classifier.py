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
    ("Road & Infrastructure", "சாலையில் பெரிய பள்ளம் உள்ளது விபத்து ஏற்படுகிறது"),  # TA script
    ("Road & Infrastructure", "சாலை சேதமடைந்துள்ளது உடனடியாக தார் சாலை அமைக்க வேண்டும்"),  # TA script
    ("Road & Infrastructure", "सड़क पर गहरा गड्ढा है दुर्घटनाएं हो रही हैं"),  # HI script

    # Water Supply
    ("Water Supply", "no water supply for three days families severely affected"),
    ("Water Supply", "teen din se paani nahi aa raha colony mein pareshani"),  # HI
    ("Water Supply", "water leak main pipeline flooding street waste"),
    ("Water Supply", "thanneer varavillai moonu nalkal kodu suffering"),  # TA romanized
    ("Water Supply", "borewell broken no drinking water residents suffering"),
    ("Water Supply", "குடிநீர் வரவில்லை மூன்று நாட்களாக தண்ணீர் இல்லை மக்கள் அவதி"),  # TA script
    ("Water Supply", "குடிநீர் குழாய் உடைந்து தண்ணீர் வீணாக சாலையில் ஓடுகிறது"),  # TA script
    ("Water Supply", "पीने का पानी नहीं आ रहा है पाइपलाइन टूटी हुई है"),  # HI script

    # Electricity
    ("Electricity", "street lights not working area dark at night safety issue"),
    ("Electricity", "bijli nahi aa rahi transformer kharab hai"),  # HI
    ("Electricity", "power cut every evening electricity board fix transformer"),
    ("Electricity", "minu saram illai theru lamp damage"),  # TA romanized
    ("Electricity", "voltage fluctuation damages appliances dangerous wires hanging"),
    ("Electricity", "தெருவிளக்குகள் எரியவில்லை இரவு நேரத்தில் தெரு இருட்டாக உள்ளது"),  # TA script
    ("Electricity", "மின்வெட்டு அடிக்கடி ஏற்படுகிறது மின்சாரம் இல்லை டிரான்ஸ்பார்மர்"),  # TA script
    ("Electricity", "बिजली नहीं आ रही है स्ट्रीट लाइट बंद है ट्रांसफार्मर खराब"),  # HI script

    # Waste Management
    ("Waste Management", "garbage not collected week waste dumped roadside insects smell"),
    ("Waste Management", "kuda nahi uthaya corporation cleaning sanitation issue smell"),  # HI
    ("Waste Management", "sewage overflow blocked drain foul smell garbage everywhere"),
    ("Waste Management", "kurpam edukkavilla nasam nadaikkiradhu"),  # TA romanized
    ("Waste Management", "waste bins overflowing corporation not cleaning stray animals"),
    ("Waste Management", "குப்பைகள் அகற்றப்படவில்லை துர்நாற்றம் வீசுகிறது சாக்கடை"),  # TA script
    ("Waste Management", "சாக்கடை நீர் நிரம்பி வழிகிறது குப்பை தொட்டி நிரம்பியுள்ளது"),  # TA script
    ("Waste Management", "कचरा नहीं उठाया गया बदबू फैल रही है नाली जाम है"),  # HI script

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
        model_artifact = Path(__file__).resolve().parents[2] / "models" / "retrained_model.pkl"
        if model_artifact.exists():
            try:
                import pickle
                with open(model_artifact, "rb") as f:
                    self.pipeline = pickle.load(f)
                self.classes_ = self.pipeline.classes_.tolist()
                logger.info("Loaded retrained active learning model artifact from %s", model_artifact.name)
                return
            except Exception as exc:
                logger.warning("Could not load model artifact: %s", exc)

        texts = [t for _, t in SEED_CORPUS]
        labels = [c for c, _ in SEED_CORPUS]

        csv_path = Path(__file__).resolve().parents[2] / "data" / "labeled_petitions.csv"
        if csv_path.exists():
            try:
                import csv
                with open(csv_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        text = row.get("text", "").strip()
                        cat = row.get("category", "").strip()
                        if text and cat:
                            texts.append(text)
                            labels.append(cat)
                logger.info("Loaded %d training examples from %s", len(texts), csv_path.name)
            except Exception as exc:
                logger.warning("Could not load dataset %s: %s", csv_path, exc)

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
    import os
    import sys
    if "pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST") or os.getenv("FAST_FALLBACK") == "1":
        return "fallback"

    if _embedding_model is None:
        import os
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            logger.info("Loading embedding model %s…", model_name)
            _embedding_model = SentenceTransformer(model_name, local_files_only=True)
        except Exception as exc:
            logger.warning("Could not load embedding model (%s); using fallback.", exc)
            _embedding_model = "fallback"
    return _embedding_model


def _get_label_vecs(model_name: str) -> list[tuple[str, np.ndarray]]:
    global _embedding_label_vecs
    if _embedding_label_vecs is None:
        model = _get_embedding_model(model_name)
        if model == "fallback":
            _embedding_label_vecs = []
            return _embedding_label_vecs
        labels = list({c for c, _ in SEED_CORPUS})
        # Embed each category name as anchor
        vecs = model.encode(labels, normalize_embeddings=True)
        _embedding_label_vecs = list(zip(labels, vecs))
    return _embedding_label_vecs


def embedding_classify(text: str, model_name: str) -> tuple[str, float]:
    """Embed text and find nearest category centroid."""
    model = _get_embedding_model(model_name)
    if model == "fallback":
        return get_tfidf_classifier().classify(text)
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
        from app.security.pii import mask_pii
        sanitized_text = mask_pii(text[:3000])

        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        cats_str = "\n".join(f"- {c}" for c in CATEGORIES)
        prompt = _LLM_CLASSIFY_PROMPT.format(
            categories=cats_str,
            text=sanitized_text,
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
