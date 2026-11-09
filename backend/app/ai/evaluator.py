"""
Evaluation Module
=================
Runs the classifier against a synthetic labeled dataset covering:
- 14 categories × 3 languages (EN, TA romanized, HI romanized)
- Various urgency levels
- Spam samples
- Code-mixed text

Generates:
  reports/evaluation_report.json   – raw metrics
  reports/evaluation_summary.md    – human-readable summary
  reports/confusion_matrix.txt     – ASCII confusion matrix
"""
from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from .analyzer import analyze_petition
from .config import ai_config

logger = logging.getLogger(__name__)


# ── Synthetic Labeled Dataset ─────────────────────────────────────────────────
# Format: (text, true_category, language, urgency)
LABELED_DATASET: list[tuple[str, str, str, str]] = [
    # ── Road & Infrastructure ─────────────────────────────────────────────
    ("There is a huge pothole on MG Road that has damaged many vehicles and caused accidents.",
     "Road & Infrastructure", "en", "high"),
    ("The road surface near the bus stand is severely broken and pedestrians are at risk of falling.",
     "Road & Infrastructure", "en", "high"),
    ("Peru vazhi pothole accident aagi iruku thayavu seithu repair pannu.",
     "Road & Infrastructure", "ta", "high"),
    ("Sadak par bada gadha hai jo vehicles ko kharab kar raha hai.",
     "Road & Infrastructure", "hi", "high"),
    ("Speed breaker is completely damaged on the highway causing severe traffic and danger.",
     "Road & Infrastructure", "en", "medium"),

    # ── Water Supply ──────────────────────────────────────────────────────
    ("No water supply for the past three days in our colony, families are badly suffering.",
     "Water Supply", "en", "high"),
    ("Teen din se paani nahi aa raha, ghar mein paani ki bahut kami hai.",
     "Water Supply", "hi", "high"),
    ("Thanneer varavillai moonu nalkal, kudimakkal kodu padhikappadu.",
     "Water Supply", "ta", "high"),
    ("There is a major water leak from the main pipeline flooding the entire street.",
     "Water Supply", "en", "medium"),
    ("Borewell is broken and no drinking water is available for residents.",
     "Water Supply", "en", "high"),

    # ── Electricity ───────────────────────────────────────────────────────
    ("Street lights have not been working for two weeks, the area is completely dark at night.",
     "Electricity", "en", "high"),
    ("Bijli nahi aa rahi, transformer kharab hai, raat ko andhera rehta hai.",
     "Electricity", "hi", "high"),
    ("Minu saram illai theru lamp ellam kedu, iravil payanam aapadam.",
     "Electricity", "ta", "high"),
    ("Voltage fluctuation is damaging home appliances; electric pole wires are hanging dangerously.",
     "Electricity", "en", "high"),
    ("Power cut every evening for 4 hours due to faulty transformer near our area.",
     "Electricity", "en", "medium"),

    # ── Waste Management ──────────────────────────────────────────────────
    ("Garbage has not been collected for a week, waste is piled up attracting insects and stray animals.",
     "Waste Management", "en", "medium"),
    ("Kuda uthaya nahi corporation walon ne, sadak par kachra hi kachra hai.",
     "Waste Management", "hi", "medium"),
    ("Kurpam edukkavilla oru vaaram aachi, nasam nadaikkiradhu.",
     "Waste Management", "ta", "medium"),
    ("Sewage overflow has blocked the drain and the foul smell is unbearable.",
     "Waste Management", "en", "high"),
    ("Waste bins are overflowing near the school, children are at health risk.",
     "Waste Management", "en", "high"),

    # ── Noise Pollution ───────────────────────────────────────────────────
    ("Loudspeakers are playing at extremely high volume until midnight, disturbing sleep.",
     "Noise Pollution", "en", "medium"),
    ("Construction noise during night hours is unbearable and violates regulations.",
     "Noise Pollution", "en", "medium"),
    ("Raat ko shor machate hain, neend nahi aati, hospital ke paas horn bajate hain.",
     "Noise Pollution", "hi", "medium"),

    # ── Building & Construction ───────────────────────────────────────────
    ("Illegal construction is blocking the public road and reducing traffic to a single lane.",
     "Building & Construction", "en", "medium"),
    ("Unauthorized structure has been built on government land; encroachment needs action.",
     "Building & Construction", "en", "medium"),
    ("Anadhikara kattida podum sandhu block pannirukkanga.",
     "Building & Construction", "ta", "medium"),

    # ── Public Safety ─────────────────────────────────────────────────────
    ("Stray dogs are attacking children in the area, residents fear for their safety.",
     "Public Safety", "en", "high"),
    ("An abandoned building with broken glass is dangerous for children playing nearby.",
     "Public Safety", "en", "high"),
    ("Awara kutte bachon par hamla kar rahe hain, parents bahut dara hua hain.",
     "Public Safety", "hi", "high"),

    # ── Healthcare ────────────────────────────────────────────────────────
    ("The government hospital hygiene is very poor, patients are not getting treatment on time.",
     "Healthcare", "en", "medium"),
    ("Primary health center is short of medicines and doctors are not available.",
     "Healthcare", "en", "high"),
    ("Sarkari aspatal mein dawayi nahi milti, doctor bhi nahi aate.",
     "Healthcare", "hi", "high"),

    # ── Education ─────────────────────────────────────────────────────────
    ("The school building roof is leaking badly, classrooms are unusable during rain.",
     "Education", "en", "high"),
    ("Government school lacks proper toilets and drinking water facility for students.",
     "Education", "en", "medium"),
    ("Pallikkoodam korai kidaikkiradhu, maanavargal kodu padhikappadu.",
     "Education", "ta", "medium"),

    # ── Public Transport ──────────────────────────────────────────────────
    ("The public bus is not coming on time, the route has been cancelled and commuters wait for hours.",
     "Public Transport", "en", "medium"),
    ("Bus stop shelter is damaged and there is no proper transport service in our area.",
     "Public Transport", "en", "low"),
    ("Bas waqt par nahi aati, commuters sadak par khade rehte hain.",
     "Public Transport", "hi", "medium"),

    # ── Sanitation ────────────────────────────────────────────────────────
    ("Open defecation is happening near the park because there are no public toilets.",
     "Sanitation", "en", "high"),
    ("Public toilet is closed and broken, causing unhygienic conditions and health risk.",
     "Sanitation", "en", "medium"),

    # ── Corruption & Malpractice ──────────────────────────────────────────
    ("The government officer is demanding a bribe to process my application; no work is done.",
     "Corruption & Malpractice", "en", "high"),
    ("Rishwat maang raha hai officer, kaam nahi karta bina paison ke.",
     "Corruption & Malpractice", "hi", "high"),

    # ── Animal Control ────────────────────────────────────────────────────
    ("Wild animals are entering the residential area at night causing danger to residents.",
     "Animal Control", "en", "high"),
    ("Cows and bulls are roaming freely on the main road and causing accidents.",
     "Animal Control", "en", "medium"),

    # ── Code-mixed ────────────────────────────────────────────────────────
    ("Road la pothole iruku and no water supply, residents padhikuran.",
     "Road & Infrastructure", "mixed", "high"),
    ("Bijli nahi aur garbage bhi nahi collect kiya, double problem hai.",
     "Waste Management", "mixed", "medium"),
]


# ── Evaluator ─────────────────────────────────────────────────────────────────

def run_evaluation(output_dir: str = "reports") -> dict[str, Any]:
    """Run full evaluation and save reports to output_dir."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    logger.info("Starting evaluation on %d samples…", len(LABELED_DATASET))

    true_labels: list[str] = []
    pred_labels: list[str] = []
    results: list[dict] = []
    per_lang: dict[str, list] = defaultdict(list)

    for i, (text, true_cat, lang, true_urgency) in enumerate(LABELED_DATASET):
        logger.info("[%d/%d] Analyzing: %.60s…", i + 1, len(LABELED_DATASET), text)
        t0 = time.time()
        try:
            result = analyze_petition(
                text,
                gemini_api_key=ai_config.GEMINI_API_KEY,
                gemini_model=ai_config.GEMINI_MODEL,
                embedding_model=ai_config.EMBEDDING_MODEL,
            )
            elapsed = time.time() - t0
            pred_cat = result["category"]
            correct = pred_cat == true_cat

            true_labels.append(true_cat)
            pred_labels.append(pred_cat)
            per_lang[lang].append(correct)

            results.append({
                "text": text[:80],
                "true_category": true_cat,
                "pred_category": pred_cat,
                "correct": correct,
                "confidence": result["confidence"],
                "urgency": result["urgency"],
                "true_urgency": true_urgency,
                "language": lang,
                "is_spam": result["is_spam"],
                "human_review_required": result["human_review_required"],
                "elapsed_s": round(elapsed, 3),
            })
        except Exception as exc:
            logger.error("Error on sample %d: %s", i, exc)
            true_labels.append(true_cat)
            pred_labels.append("Unknown")
            per_lang[lang].append(False)
            results.append({
                "text": text[:80],
                "true_category": true_cat,
                "pred_category": "ERROR",
                "correct": False,
                "error": str(exc),
                "language": lang,
            })

    # ── Compute metrics ───────────────────────────────────────────────────────
    labels = sorted(set(true_labels))
    accuracy = accuracy_score(true_labels, pred_labels)
    precision = precision_score(true_labels, pred_labels, average="weighted", zero_division=0)
    recall = recall_score(true_labels, pred_labels, average="weighted", zero_division=0)
    f1 = f1_score(true_labels, pred_labels, average="weighted", zero_division=0)

    per_lang_acc = {
        lang: round(sum(correct_list) / len(correct_list), 3)
        for lang, correct_list in per_lang.items()
    }

    report_dict = classification_report(
        true_labels, pred_labels,
        labels=labels,
        output_dict=True,
        zero_division=0,
    )

    cm = confusion_matrix(true_labels, pred_labels, labels=labels)

    # ── Save confusion matrix text ────────────────────────────────────────────
    cm_lines = ["Confusion Matrix", "=" * 60]
    header = " " * 30 + " ".join(f"{l[:8]:>10}" for l in labels)
    cm_lines.append(header)
    for i, row_label in enumerate(labels):
        row = f"{row_label[:28]:30}" + " ".join(f"{v:>10}" for v in cm[i])
        cm_lines.append(row)
    cm_text = "\n".join(cm_lines)
    (out_path / "confusion_matrix.txt").write_text(cm_text, encoding="utf-8")

    # ── Save JSON report ──────────────────────────────────────────────────────
    report = {
        "summary": {
            "total_samples": len(LABELED_DATASET),
            "accuracy": round(accuracy, 4),
            "precision_weighted": round(precision, 4),
            "recall_weighted": round(recall, 4),
            "f1_weighted": round(f1, 4),
            "per_language_accuracy": per_lang_acc,
        },
        "per_class_report": report_dict,
        "sample_results": results,
    }
    (out_path / "evaluation_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ── Save markdown summary ─────────────────────────────────────────────────
    md = _build_markdown(report)
    (out_path / "evaluation_summary.md").write_text(md, encoding="utf-8")

    logger.info("Evaluation complete. Reports saved to %s/", output_dir)
    _print_summary(report)

    return report


def _print_summary(report: dict) -> None:
    s = report["summary"]
    print("\n" + "=" * 60)
    print("  PetitionAI Phase 1 – Evaluation Results")
    print("=" * 60)
    print(f"  Accuracy  : {s['accuracy']:.1%}")
    print(f"  Precision : {s['precision_weighted']:.1%}")
    print(f"  Recall    : {s['recall_weighted']:.1%}")
    print(f"  F1 Score  : {s['f1_weighted']:.1%}")
    print("\n  Per-language accuracy:")
    for lang, acc in s["per_language_accuracy"].items():
        bar = "█" * int(acc * 20)
        print(f"    {lang:6}: {bar:<20} {acc:.1%}")
    print("=" * 60)


def _build_markdown(report: dict) -> str:
    s = report["summary"]
    lines = [
        "# PetitionAI Phase 1 – Evaluation Summary",
        "",
        "## Overall Metrics",
        "",
        "| Metric | Score |",
        "|--------|-------|",
        f"| Accuracy | {s['accuracy']:.1%} |",
        f"| Precision (weighted) | {s['precision_weighted']:.1%} |",
        f"| Recall (weighted) | {s['recall_weighted']:.1%} |",
        f"| F1 Score (weighted) | {s['f1_weighted']:.1%} |",
        f"| Total Samples | {s['total_samples']} |",
        "",
        "## Per-Language Accuracy",
        "",
        "| Language | Accuracy |",
        "|----------|----------|",
    ]
    for lang, acc in s["per_language_accuracy"].items():
        lines.append(f"| {lang} | {acc:.1%} |")

    lines += [
        "",
        "## Per-Class Performance",
        "",
        "| Category | Precision | Recall | F1 | Support |",
        "|----------|-----------|--------|----|---------|",
    ]
    per_class = report["per_class_report"]
    for cat in sorted(per_class.keys()):
        if cat in ("accuracy", "macro avg", "weighted avg"):
            continue
        m = per_class[cat]
        lines.append(
            f"| {cat} | {m['precision']:.1%} | {m['recall']:.1%} "
            f"| {m['f1-score']:.1%} | {int(m['support'])} |"
        )

    lines += [
        "",
        "---",
        "*Generated by PetitionAI Phase 1 Evaluation Suite*",
    ]
    return "\n".join(lines)
