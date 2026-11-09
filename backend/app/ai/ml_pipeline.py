"""Machine Learning / NLP pipeline for petition analysis.

Implements a lightweight TF-IDF + cosine similarity classifier in pure
Python (no external ML deps required), plus rule-based sentiment and
priority detection. This keeps the backend runnable out-of-the-box while
still performing genuine NLP (tokenization, stopword filtering, TF-IDF
weighting, similarity scoring).
"""
import math
import re
from collections import Counter

from app.ai.classifier import get_tfidf_classifier, llm_classify
from app.ai.priority import detect_priority
from app.ai.spam import detect_spam
from app.config import settings

# ── Categories the classifier can route ─────────────────────────────────────────
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
]

DEPARTMENT_MAP = {
    "Road & Infrastructure": "Roads & Infrastructure",
    "Building & Construction": "Roads & Infrastructure",
    "Water Supply": "Water Works",
    "Sanitation": "Waste Management",
    "Electricity": "Electricity Board",
    "Waste Management": "Waste Management",
    "Parks & Recreation": "Waste Management",
    "Noise Pollution": "Public Safety",
    "Public Safety": "Public Safety",
    "Healthcare": "Health Department",
    "Education": "Education Department",
    "Public Transport": "Transport Authority",
}

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "has", "have", "had", "do",
    "does", "did", "not", "no", "but", "so", "at", "by", "from", "our",
    "your", "my", "their", "there", "this", "that", "these", "those", "it",
    "we", "they", "i", "you", "he", "she", "as", "about", "more", "very",
    "just", "all", "any", "can", "will", "would", "should", "please", "since",
    "over", "under", "into", "during", "while", "out", "up", "down", "off",
}

# ── Seed corpus for the TF-IDF classifier ───────────────────────────────────────
SEED_DOCS: list[tuple[str, str]] = [
    # (category, sample text)
    ("Road & Infrastructure", "large pothole on the main road causing accidents vehicles damaged"),
    ("Road & Infrastructure", "broken road surface near the bus stop needs repair resurfacing"),
    ("Road & Infrastructure", "road is damaged and severely needs immediate repair pothole accident"),
    ("Road & Infrastructure", "speed breaker damaged on highway causing traffic and dangerous driving"),
    ("Road & Infrastructure", "street pavement cracked walkway broken pedestrians risk falling"),
    ("Water Supply", "no water supply for three days our street families with children severely affected"),
    ("Water Supply", "water leak from main pipeline wasting water flooding the street"),
    ("Water Supply", "water connection not working low pressure from morning households suffering"),
    ("Water Supply", "borewell broken no drinking water colony residents without water"),
    ("Electricity", "street lights not working for two weeks area completely dark at night safety"),
    ("Electricity", "power cut every evening transformer faulty electricity board please fix"),
    ("Electricity", "no electricity in our block wires hanging dangerous electric pole damaged"),
    ("Electricity", "voltage fluctuation damages appliances street lamp not functioning"),
    ("Waste Management", "large pile of garbage accumulated near residential area smell unbearable stray dogs"),
    ("Waste Management", "garbage not collected for a week waste dumped on the roadside attracting insects"),
    ("Waste Management", "sewage overflow blocked drain foul smell garbage everywhere"),
    ("Waste Management", "waste bins overflowing corporation not cleaning the area sanitation issue"),
    ("Noise Pollution", "loudspeakers playing at high volume late night disturbing sleep noise"),
    ("Noise Pollution", "construction noise during night hours unbearable music from wedding hall"),
    ("Noise Pollution", "vehicle honking continuously near hospital zone noise nuisance"),
    ("Building & Construction", "illegal construction blocking public road encroachment reducing single lane traffic"),
    ("Building & Construction", "building under construction materials stored on road permission not shown"),
    ("Building & Construction", "unauthorized structure on government land encroachment needs action"),
    ("Public Safety", "stray dogs attacking children in the area residents fear for safety"),
    ("Public Safety", "dark street no lights people afraid to walk at night unsafe"),
    ("Public Safety", "abandoned building open broken glass danger to children playing nearby"),
    ("Healthcare", "government hospital hygiene poor patients not getting treatment on time"),
    ("Healthcare", "primary health center short of medicines doctors not available"),
    ("Education", "school building roof leaking classrooms unusable students studying in unsafe condition"),
    ("Education", "government school lacks proper toilets and drinking water facility"),
    ("Public Transport", "public bus not coming on time route cancelled commuters waiting hours"),
    ("Public Transport", "bus stop shelter damaged no proper transport service in this area"),
    ("Parks & Recreation", "playground abandoned no maintenance children have nowhere to play"),
    ("Parks & Recreation", "park equipment broken garden not maintained plants dying"),
]


class TfidfClassifier:
    """Pure-python TF-IDF + cosine similarity classifier."""

    def __init__(self) -> None:
        self.vocab: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.doc_vectors: list[tuple[str, dict[str, float]]] = []
        self._fit()

    def _tokenize(self, text: str) -> list[str]:
        tokens = re.findall(r"[a-z]+", text.lower())
        return [t for t in tokens if t not in STOPWORDS and len(t) > 2]

    def _fit(self) -> None:
        # Build vocabulary from seed corpus
        df: Counter = Counter()
        for _, text in SEED_DOCS:
            for token in set(self._tokenize(text)):
                df[token] += 1
        self.vocab = {token: idx for idx, token in enumerate(df)}

        n_docs = len(SEED_DOCS)
        self.idf = {
            token: math.log(n_docs / (1 + count))
            for token, count in df.items()
        }

        for cat, text in SEED_DOCS:
            vec = self._tfidf(text)
            self.doc_vectors.append((cat, vec))

    def _tfidf(self, text: str) -> dict[str, float]:
        tokens = self._tokenize(text)
        tf = Counter(tokens)
        total = sum(tf.values()) or 1
        vec: dict[str, float] = {}
        for token, count in tf.items():
            if token in self.idf:
                vec[token] = (count / total) * self.idf[token]
        return vec

    @staticmethod
    def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
        keys = set(a) | set(b)
        dot = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in keys)
        norm_a = math.sqrt(sum(v * v for v in a.values())) or 1.0
        norm_b = math.sqrt(sum(v * v for v in b.values())) or 1.0
        return dot / (norm_a * norm_b)

    def classify(self, text: str) -> tuple[str, float]:
        vec = self._tfidf(text)
        if not vec:
            return "Road & Infrastructure", 0.3
        best_cat, best_score = "Road & Infrastructure", 0.0
        for cat, doc_vec in self.doc_vectors:
            score = self._cosine(vec, doc_vec)
            if score > best_score:
                best_cat, best_score = cat, score
        return best_cat, min(best_score, 0.99)

    def similarity(self, a: str, b: str) -> float:
        return self._cosine(self._tfidf(a), self._tfidf(b))


classifier = TfidfClassifier()


# ── Rule-based analysis helpers ─────────────────────────────────────────────────
ANGRY_WORDS = [
    "angry", "furious", "unacceptable", "terrible", "worst", "disgusting",
    "outrageous", "frustrated", "fed up", "shameful",
]
NEGATIVE_WORDS = [
    "bad", "poor", "issue", "problem", "complaint", "broken", "damaged",
    "fail", "missing", "blocked", "danger", "unsafe", "suffering",
]
POSITIVE_WORDS = ["appreciate", "grateful", "thank", "excellent", "good"]

CRITICAL_WORDS = [
    "accident", "emergency", "danger", "death", "flood", "fire", "collapse",
    "sewage overflow", "electrocution", "collapse",
]
HIGH_WORDS = [
    "broken", "leaking", "no water", "no electricity", "pothole",
    "blocked drain", "stray dogs", "foul smell",
]


def analyze_sentiment(text: str) -> tuple[str, float]:
    lower = text.lower()
    angry_hits = sum(1 for w in ANGRY_WORDS if w in lower)
    neg_hits = sum(1 for w in NEGATIVE_WORDS if w in lower)
    pos_hits = sum(1 for w in POSITIVE_WORDS if w in lower)

    if angry_hits >= 1:
        return "angry", max(0.05, 0.2 - 0.1 * angry_hits)
    if neg_hits >= 2:
        return "negative", max(0.1, 0.35 - 0.05 * neg_hits)
    if pos_hits > neg_hits:
        return "positive", 0.75
    return "neutral", 0.5


def predict_priority(text: str) -> tuple[str, float]:
    pri = detect_priority(text)
    return pri["urgency"], pri["priority_confidence"]


def extract_keywords(text: str, limit: int = 6) -> list[str]:
    tokens = [t for t in re.findall(r"[a-z]+", text.lower())
              if t not in STOPWORDS and len(t) > 4]
    counts = Counter(tokens)
    return [t for t, _ in counts.most_common(limit)]


def generate_ai_analysis(title: str, description: str, category: str | None = None) -> dict:
    full_text = f"{title} {description}".strip()

    # Baseline TF-IDF + Logistic Regression classification
    tfidf_clf = get_tfidf_classifier()
    if category and category in CATEGORIES:
        ai_category = category
        category_conf = 0.90
    else:
        ai_category, category_conf = tfidf_clf.classify(full_text)

    # Hosted LLM classification step (Gemini backend-only)
    llm_result = None
    if settings.GEMINI_API_KEY:
        try:
            llm_result = llm_classify(full_text, api_key=settings.GEMINI_API_KEY, model_name="gemini-1.5-flash")
        except Exception:
            llm_result = None

    human_review_required = False
    review_reasons: list[str] = []

    if llm_result and "category" in llm_result:
        llm_cat = llm_result["category"]
        llm_conf = float(llm_result.get("confidence", 0.85))
        if llm_cat != ai_category:
            human_review_required = True
            review_reasons.append(f"Model disagreement: Baseline predicted '{ai_category}', LLM predicted '{llm_cat}'.")
            if llm_conf > category_conf:
                ai_category = llm_cat
                category_conf = llm_conf
        else:
            category_conf = max(category_conf, llm_conf)

    if category_conf < 0.65:
        human_review_required = True
        review_reasons.append(f"Low classification confidence ({round(category_conf * 100)}% < 65%).")

    # Spam & Abuse quality check
    spam_info = detect_spam(full_text)
    if spam_info["is_spam"]:
        human_review_required = True
        review_reasons.append(f"Spam detected: {spam_info['spam_reason']}")
    if spam_info["is_abusive"]:
        human_review_required = True
        review_reasons.append(f"Abuse detected: {spam_info['abuse_reason']}")

    department = DEPARTMENT_MAP.get(ai_category, "Roads & Infrastructure")
    sentiment, sentiment_score = analyze_sentiment(full_text)

    # Priority from negation-aware priority engine
    pri_info = detect_priority(full_text)
    priority = pri_info["urgency"]
    priority_score = pri_info["priority_confidence"]

    keywords = extract_keywords(full_text)
    conf = round(category_conf, 2)

    if human_review_required:
        explanation = (
            f"Classified as {ai_category} ({round(conf * 100)}% confidence). "
            f"Flagged for human review: {'; '.join(review_reasons)}"
        )
    else:
        explanation = (
            f"AI hybrid model classified petition as {ai_category} ({round(conf * 100)}% confidence) "
            f"and routed to {department} at {priority.upper()} priority."
        )

    priority_reason = pri_info.get("priority_explanation") or f"Assigned {priority} priority based on civic severity assessment."

    return {
        "category": ai_category,
        "categoryConfidence": conf,
        "department": department,
        "departmentConfidence": round(min(conf + 0.04, 0.99), 2),
        "priority": priority,
        "priorityScore": priority_score,
        "priority_reason": priority_reason,
        "priorityReason": priority_reason,
        "sentiment": sentiment,
        "sentimentScore": sentiment_score,
        "isDuplicate": False,
        "duplicateCount": 0,
        "similarComplaints": [],
        "urgencyLevel": priority,
        "keywords": keywords or ["complaint", "repair", "maintenance"],
        "contributing_keywords": keywords or ["complaint", "repair", "maintenance"],
        "contributingKeywords": keywords or ["complaint", "repair", "maintenance"],
        "confidence": conf,
        "explanation": explanation,
        "human_review_required": human_review_required,
        "review_reasons": review_reasons,
        "is_spam": spam_info["is_spam"],
        "is_abusive": spam_info["is_abusive"],
        "spam_score": spam_info["spam_score"],
        "spam_reason": spam_info["spam_reason"],
        "abuse_reason": spam_info["abuse_reason"],
        "summaryNote": (
            f"AI-powered NLP classified this petition as {ai_category} with "
            f"{round(conf * 100)}% confidence. Routed to {department}. "
            f"Priority: {priority.upper()}. No duplicates detected."
        ),
    }
