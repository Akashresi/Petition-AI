"""
PetitionAI Model Evaluation Script
===================================
Evaluates the TF-IDF + Logistic Regression classification pipeline on
the labeled petitions dataset (backend/data/labeled_petitions.csv).

Computes:
  - Accuracy, Precision (weighted & macro), Recall (weighted & macro), F1 Score (weighted & macro)
  - Confusion Matrix (ASCII table and matrix array)
  - Per-language performance breakdown (English, Hindi, Tamil)
  - Per-category classification report

Outputs:
  - reports/evaluation_report.json
  - reports/evaluation_summary.md
  - reports/confusion_matrix.txt
"""
from __future__ import annotations

import csv
import json
import logging
import os
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("evaluate")

# Benchmark spam and abuse suite across English, Hindi, Tamil, and Tanglish
SPAM_BENCHMARK_SAMPLES = [
    # English Keyboard Mash & Gibberish
    "asdfghjkl zxcvbnm qwertyuiop lkjhgfds",
    "bcdfghjklmnpqrstvwxyz bcdfghjklmn",
    "poiuytrewq mnbvcxz lkjhgfdsa qazwsxedc",
    # English Repetitive Chars & Flooding
    "aaaaabbbbbcccccdddddeeeee testing repeated characters",
    "help help help help help help help help help help",
    "water water water water water water water water water",
    # Fake / Test / Placeholder Submissions
    "test 123 testing petition text sample data run",
    "sample petition issue complaint for testing",
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod",
    "foo bar hello world testing 123",
    "1234567890 1234567890 1234567890",
    # English Abuse & Threats
    "fuck this government bastard officer will pay",
    "kill all the corrupt officers bomb the government building",
    "useless corrupt asshole officer should be fired",
    # Hindi Abuse & Profanity (Devanagari & Transliterated)
    "ye madarchod bhenchod corrupt log kaam nahi karte",
    "चूतिया अधिकारी काम नहीं कर रहा है साला हरामी",
    "मादरचोद सरकारी कर्मचारी पैसे खा रहे हैं",
    "kutte ke bacche bhenchod sab chor hain yahan",
    "kamina afsar sunta nahi hai harami",
    # Tamil Abuse & Profanity (Tamil script & Tanglish)
    "indha kena mairu thevidya pasanga vela seiyala",
    "இந்த கூதி அதிகாரி வேலையே செய்ய மாட்டேங்குறான்",
    "நாயே பேயே மசுரு புண்ட அதிகாரி லஞ்சம் வாங்குறான்",
    "thevidya paiya kena madhiri pesuraan sunni",
    "mairu vela seiraangala government officers",
    "romba kevalamana punda officer lanjam kekraan",
    # Short / Nonsense
    "zzzzzzzzzzzzzzzzzzzzz",
    "qqqqqqqqqqqqqqqqqqqqq",
    "xxxx xxxxx xxxxx xxxxx",
]


def evaluate_spam_detection(clean_sample_texts: list[str]) -> dict[str, float | int]:
    """Evaluate spam and abuse detection recall (catch rate) and false positive rate."""
    backend_path = Path(__file__).resolve().parents[1]
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))

    try:
        from app.ai.spam import detect_spam
    except ImportError:
        logger.warning("Could not import detect_spam from app.ai.spam; using fallback heuristic.")
        def detect_spam(text: str) -> dict:
            return {"is_spam": False, "is_abusive": False}

    spam_results = [detect_spam(s) for s in SPAM_BENCHMARK_SAMPLES]
    spam_detected = sum(1 for r in spam_results if r.get("is_spam") or r.get("is_abusive"))
    spam_samples_count = len(SPAM_BENCHMARK_SAMPLES)
    spam_catch_rate = round(spam_detected / max(spam_samples_count, 1), 4)

    # Evaluate against legitimate clean petitions to check false positive rate
    eval_clean = clean_sample_texts[:max(30, min(len(clean_sample_texts), 50))]
    clean_results = [detect_spam(c) for c in eval_clean]
    false_positives = sum(1 for r in clean_results if r.get("is_spam") or r.get("is_abusive"))
    clean_samples_count = len(eval_clean)
    false_positive_rate = round(false_positives / max(clean_samples_count, 1), 4)

    total_eval = spam_samples_count + clean_samples_count
    correct = spam_detected + (clean_samples_count - false_positives)
    spam_accuracy = round(correct / max(total_eval, 1), 4)

    return {
        "spam_samples": spam_samples_count,
        "clean_samples": clean_samples_count,
        "spam_detected": spam_detected,
        "false_positives": false_positives,
        "spam_catch_rate": spam_catch_rate,
        "spam_false_positive_rate": false_positive_rate,
        "spam_accuracy": spam_accuracy,
    }


def run_evaluation(
    data_path: Path | None = None,
    output_dir: Path | None = None,
    test_size: float = 0.25,
    random_state: int = 42,
) -> dict:
    repo_root = Path(__file__).resolve().parents[2]
    if data_path is None:
        data_path = repo_root / "backend" / "data" / "labeled_petitions.csv"
    if output_dir is None:
        output_dir = repo_root / "reports"

    output_dir.mkdir(parents=True, exist_ok=True)
    # Also mirror into backend/reports for backend self-contained access
    backend_reports = repo_root / "backend" / "reports"
    backend_reports.mkdir(parents=True, exist_ok=True)

    if not data_path.exists():
        raise FileNotFoundError(f"Dataset not found at {data_path}. Run build_dataset.py first.")

    # 1. Load data
    rows = []
    with open(data_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get("text") and r.get("category"):
                rows.append(r)

    logger.info("Loaded %d labeled examples from %s", len(rows), data_path.name)

    texts = [r["text"] for r in rows]
    categories = [r["category"] for r in rows]
    languages = [r.get("language", "en") for r in rows]

    # Stratified split to ensure category balance
    try:
        (
            train_texts, test_texts,
            train_cats, test_cats,
            train_langs, test_langs,
        ) = train_test_split(
            texts, categories, languages,
            test_size=test_size,
            random_state=random_state,
            stratify=categories,
        )
    except Exception:
        # Fallback to unstratified if rare class has < 2 samples
        (
            train_texts, test_texts,
            train_cats, test_cats,
            train_langs, test_langs,
        ) = train_test_split(
            texts, categories, languages,
            test_size=test_size,
            random_state=random_state,
        )

    logger.info("Training set: %d samples, Test set: %d samples", len(train_texts), len(test_texts))

    # 2. Train model pipeline
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=10000,
            sublinear_tf=True,
            min_df=1,
        )),
        ("clf", LogisticRegression(
            max_iter=2000,
            C=5.0,
            solver="lbfgs",
        )),
    ])

    pipeline.fit(train_texts, train_cats)
    classes = sorted(list(set(categories)))

    # 3. Predict & evaluate
    test_preds = pipeline.predict(test_texts)

    acc = float(accuracy_score(test_cats, test_preds))
    prec_weighted = float(precision_score(test_cats, test_preds, average="weighted", zero_division=0))
    prec_macro = float(precision_score(test_cats, test_preds, average="macro", zero_division=0))
    rec_weighted = float(recall_score(test_cats, test_preds, average="weighted", zero_division=0))
    rec_macro = float(recall_score(test_cats, test_preds, average="macro", zero_division=0))
    f1_w = float(f1_score(test_cats, test_preds, average="weighted", zero_division=0))
    f1_m = float(f1_score(test_cats, test_preds, average="macro", zero_division=0))

    # Per-language accuracy
    per_lang_results: dict[str, dict[str, float]] = defaultdict(lambda: {"correct": 0, "total": 0})
    for true_cat, pred_cat, lang in zip(test_cats, test_preds, test_langs):
        per_lang_results[lang]["total"] += 1
        if true_cat == pred_cat:
            per_lang_results[lang]["correct"] += 1

    per_language_acc = {
        lang: round(stats["correct"] / max(stats["total"], 1), 4)
        for lang, stats in per_lang_results.items()
    }

    report_dict = classification_report(
        test_cats, test_preds,
        labels=classes,
        output_dict=True,
        zero_division=0,
    )

    cm = confusion_matrix(test_cats, test_preds, labels=classes)

    # 4. Generate confusion matrix text
    cm_lines = [
        "PetitionAI Classification Confusion Matrix",
        "=" * 80,
        f"{'True \\ Pred':<24} " + " ".join(f"{c[:7]:>8}" for c in classes),
        "-" * 80,
    ]
    for i, row_class in enumerate(classes):
        row_str = f"{row_class[:24]:<24} " + " ".join(f"{cm[i][j]:>8}" for j in range(len(classes)))
        cm_lines.append(row_str)
    cm_lines.append("=" * 80)
    cm_text = "\n".join(cm_lines)

    # 5. Evaluate spam and abuse detection
    spam_stats = evaluate_spam_detection(clean_sample_texts=train_texts + test_texts)

    # 6. Build summary payload
    report_data = {
        "summary": {
            "total_dataset_samples": len(rows),
            "train_samples": len(train_texts),
            "test_samples": len(test_texts),
            "accuracy": round(acc, 4),
            "precision_weighted": round(prec_weighted, 4),
            "precision_macro": round(prec_macro, 4),
            "recall_weighted": round(rec_weighted, 4),
            "recall_macro": round(rec_macro, 4),
            "f1_weighted": round(f1_w, 4),
            "f1_macro": round(f1_m, 4),
            "per_language_accuracy": per_language_acc,
            "spam_metrics": spam_stats,
        },
        "spam_metrics": spam_stats,
        "per_class_report": report_dict,
        "classes": classes,
        "confusion_matrix": cm.tolist(),
    }

    # 7. Save JSON report to both directories
    for target_dir in [output_dir, backend_reports]:
        (target_dir / "evaluation_report.json").write_text(
            json.dumps(report_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        (target_dir / "confusion_matrix.txt").write_text(cm_text, encoding="utf-8")

    # 8. Generate markdown summary
    md_lines = [
        "# PetitionAI Model Evaluation Report",
        "",
        "## Executive Summary",
        "",
        "| Metric | Score |",
        "|:-------|------:|",
        f"| **Overall Accuracy** | **{acc:.1%}** |",
        f"| **Weighted F1 Score** | **{f1_w:.1%}** |",
        f"| **Macro F1 Score** | {f1_m:.1%} |",
        f"| **Precision (Weighted)** | {prec_weighted:.1%} |",
        f"| **Recall (Weighted)** | {rec_weighted:.1%} |",
        f"| **Spam Catch Rate** | **{spam_stats['spam_catch_rate']:.1%}** |",
        f"| **Spam False Positive Rate** | {spam_stats['spam_false_positive_rate']:.1%} |",
        f"| **Total Labeled Petitions** | {len(rows)} |",
        f"| **Test Evaluation Split** | {len(test_texts)} ({test_size:.0%}) |",
        "",
        "## Per-Language Accuracy",
        "",
        "| Language | Accuracy | Test Samples | Status |",
        "|:---------|:--------:|:------------:|:-------|",
    ]
    lang_names = {
        "en": "English",
        "hi": "Hindi",
        "ta": "Tamil",
        "tanglish": "Tanglish",
    }
    for lang, lang_acc in sorted(per_language_acc.items()):
        samples = per_lang_results[lang]["total"]
        name = lang_names.get(lang, lang.upper())
        status = "PASSED" if lang_acc >= 0.70 else "NEEDS_TUNING"
        md_lines.append(f"| {name} (`{lang}`) | {lang_acc:.1%} | {samples} | {status} |")

    md_lines += [
        "",
        "## Spam & Abuse Detection Performance",
        "",
        "| Metric | Score | Details |",
        "|:-------|------:|:--------|",
        f"| **Spam Catch Rate (Recall)** | **{spam_stats['spam_catch_rate']:.1%}** | Flags keyboard mash, repetition, abuse (EN/HI/TA/Tanglish) |",
        f"| **False Positive Rate** | **{spam_stats['spam_false_positive_rate']:.1%}** | Legitimate citizen complaints incorrectly flagged |",
        f"| **Spam Filter Accuracy** | **{spam_stats['spam_accuracy']:.1%}** | Overall discrimination accuracy |",
        f"| **Spam Test Samples** | {spam_stats['spam_samples']} | Tested across English, Hindi, Tamil & Tanglish |",
        f"| **Clean Validation Samples** | {spam_stats['clean_samples']} | Sampled from verified citizen petitions |",
        "",
        "## Per-Category Performance Breakdown",
        "",
        "| Category | Precision | Recall | F1 Score | Support |",
        "|:---------|:---------:|:------:|:--------:|:-------:|",
    ]
    for c in classes:
        if c in report_dict:
            m = report_dict[c]
            md_lines.append(
                f"| {c} | {m['precision']:.1%} | {m['recall']:.1%} | {m['f1-score']:.1%} | {int(m['support'])} |"
            )

    md_lines += [
        "",
        "## Confusion Matrix",
        "",
        "```text",
        cm_text,
        "```",
        "",
        "---",
        "*Generated automatically by backend/scripts/evaluate.py*",
    ]
    md_text = "\n".join(md_lines)

    for target_dir in [output_dir, backend_reports]:
        (target_dir / "evaluation_summary.md").write_text(md_text, encoding="utf-8")

    logger.info("Evaluation complete! Reports saved to %s and %s", output_dir, backend_reports)
    print("\n" + "=" * 60)
    print("  PetitionAI Evaluation Results")
    print("=" * 60)
    print(f"  Accuracy            : {acc:.1%}")
    print(f"  F1 Score (Weighted) : {f1_w:.1%}")
    print(f"  F1 Score (Macro)    : {f1_m:.1%}")
    print(f"  Precision (Weighted): {prec_weighted:.1%}")
    print(f"  Recall (Weighted)   : {rec_weighted:.1%}")
    print("\n  Per-Language Accuracy:")
    for lang, lang_acc in per_language_acc.items():
        name = lang_names.get(lang, lang.upper())
        bar = "#" * int(lang_acc * 20)
        print(f"    {name:<10} ({lang}): {bar:<20} {lang_acc:.1%}")
    print("\n  Spam Detection Performance:")
    print(f"    Catch Rate (Recall): {spam_stats['spam_catch_rate']:.1%}")
    print(f"    False Positive Rate: {spam_stats['spam_false_positive_rate']:.1%}")
    print(f"    Overall Accuracy   : {spam_stats['spam_accuracy']:.1%}")
    print("=" * 60 + "\n")

    return report_data


if __name__ == "__main__":
    run_evaluation()
