"""
Evaluation CLI & Benchmark Engine for PetitionAI
=================================================
Runs standalone evaluation of the department & priority classifier against
the benchmark dataset (backend/data/petitions_labeled.csv).

Usage:
    cd backend
    python -m app.ai.evaluation
    # or from repository root:
    python -m backend.app.ai.evaluation
"""
from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure app is in path when executed directly
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent
REPO_ROOT = BACKEND_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


DATASET_CANDIDATE_PATHS = [
    BACKEND_DIR / "data" / "petitions_labeled.csv",
    REPO_ROOT / "backend" / "data" / "petitions_labeled.csv",
    Path("backend/data/petitions_labeled.csv"),
    Path("data/petitions_labeled.csv"),
]

DOCS_DIR_CANDIDATES = [
    REPO_ROOT / "docs",
    BACKEND_DIR / "docs",
    Path("docs"),
]


def find_dataset_path() -> Path:
    for p in DATASET_CANDIDATE_PATHS:
        if p.exists():
            return p.resolve()
    raise FileNotFoundError(f"petitions_labeled.csv not found in candidate paths: {DATASET_CANDIDATE_PATHS}")


def find_docs_dir() -> Path:
    for d in DOCS_DIR_CANDIDATES:
        if d.exists() or d.parent.exists():
            d.mkdir(parents=True, exist_ok=True)
            return d.resolve()
    target = REPO_ROOT / "docs"
    target.mkdir(parents=True, exist_ok=True)
    return target


def load_dataset(csv_path: Path) -> List[Dict[str, str]]:
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [row for row in reader if row.get("text") and row.get("department")]
    if not rows:
        raise ValueError(f"No valid rows found in {csv_path}")
    return rows


def build_pipeline() -> Pipeline:
    """Build a robust TF-IDF + Logistic Regression pipeline."""
    return Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                ngram_range=(1, 2),
                sublinear_tf=True,
                max_features=5000,
                token_pattern=r"(?u)\b\w+\b",
            ),
        ),
        (
            "clf",
            LogisticRegression(
                C=1.5,
                max_iter=400,
                class_weight="balanced",
                random_state=42,
            ),
        ),
    ])


def evaluate_classifier(
    data: List[Dict[str, str]],
    test_size: float = 0.25,
    random_state: int = 42,
) -> Dict[str, Any]:
    texts = [r["text"] for r in data]
    labels = [r["department"] for r in data]
    unique_classes = sorted(list(set(labels)))

    # Stratified split using data indices so we retain all row metadata (language, length, etc.)
    indices = list(range(len(data)))
    train_idx, test_idx = train_test_split(
        indices, test_size=test_size, random_state=random_state, stratify=labels
    )

    X_train = [texts[i] for i in train_idx]
    y_train = [labels[i] for i in train_idx]
    X_test = [texts[i] for i in test_idx]
    y_test = [labels[i] for i in test_idx]
    test_rows = [data[i] for i in test_idx]

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    report_dict = classification_report(
        y_test, y_pred, labels=unique_classes, output_dict=True, zero_division=0
    )
    cm = confusion_matrix(y_test, y_pred, labels=unique_classes)

    overall_accuracy = float(report_dict.get("accuracy", 0.0))
    macro_f1 = float(report_dict.get("macro avg", {}).get("f1-score", 0.0))
    weighted_f1 = float(report_dict.get("weighted avg", {}).get("f1-score", 0.0))
    weighted_precision = float(report_dict.get("weighted avg", {}).get("precision", 0.0))
    weighted_recall = float(report_dict.get("weighted avg", {}).get("recall", 0.0))

    # Per-language breakdown
    lang_metrics = {}
    for lang in ["en", "hi", "ta"]:
        sub_indices = [i for i, r in enumerate(test_rows) if r.get("language") == lang]
        if sub_indices:
            sub_y_true = [y_test[i] for i in sub_indices]
            sub_y_pred = [y_pred[i] for i in sub_indices]
            sub_acc = float(np.mean([t == p for t, p in zip(sub_y_true, sub_y_pred)]))
            lang_metrics[lang] = {
                "count": len(sub_indices),
                "accuracy": round(sub_acc, 3),
            }

    return {
        "pipeline": pipeline,
        "classes": unique_classes,
        "sample_count": len(data),
        "train_count": len(X_train),
        "test_count": len(X_test),
        "overall_accuracy": overall_accuracy,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "weighted_precision": weighted_precision,
        "weighted_recall": weighted_recall,
        "per_language": lang_metrics,
        "classification_report": report_dict,
        "confusion_matrix": cm.tolist(),
        "cm_numpy": cm,
    }


def save_confusion_matrix_plot(
    cm: np.ndarray, classes: List[str], output_path: Path
) -> Path:
    """Save an aesthetic confusion matrix heatmap to output_path using matplotlib."""
    try:
        import matplotlib
        matplotlib.use("Agg")  # Non-interactive backend for server/CLI
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 8), dpi=300)
        im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        ax.figure.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

        ax.set(
            xticks=np.arange(cm.shape[1]),
            yticks=np.arange(cm.shape[0]),
            xticklabels=classes,
            yticklabels=classes,
            title="PetitionAI - Department Classification Confusion Matrix",
            ylabel="True Department",
            xlabel="Predicted Department",
        )

        plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

        # Loop over data dimensions and create text annotations.
        thresh = cm.max() / 2.0
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                ax.text(
                    j,
                    i,
                    format(cm[i, j], "d"),
                    ha="center",
                    va="center",
                    color="white" if cm[i, j] > thresh else "black",
                    fontweight="bold" if i == j else "normal",
                )

        fig.tight_layout()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, bbox_inches="tight")
        plt.close(fig)
        return output_path
    except Exception as exc:
        print(f"Warning: could not render matplotlib plot: {exc}", file=sys.stderr)
        return output_path


def format_evaluation_output(results: Dict[str, Any], cm_path: Path) -> str:
    lines = [
        "",
        "=" * 72,
        "  PetitionAI Model Evaluation & Benchmark Results",
        "=" * 72,
        f"  Total Labeled Samples : {results['sample_count']} across {len(results['classes'])} departments",
        f"  Training Set          : {results['train_count']} samples (75%)",
        f"  Test Set (Held-Out)   : {results['test_count']} samples (25%)",
        "-" * 72,
        f"  Overall Accuracy      : {results['overall_accuracy'] * 100:.1f}%",
        f"  Weighted Precision    : {results['weighted_precision'] * 100:.1f}%",
        f"  Weighted Recall       : {results['weighted_recall'] * 100:.1f}%",
        f"  Weighted F1-Score     : {results['weighted_f1'] * 100:.1f}%",
        f"  Macro F1-Score        : {results['macro_f1'] * 100:.1f}%",
        "-" * 72,
        "  Per-Class Performance:",
        f"  {'Department':<28} {'Precision':<10} {'Recall':<10} {'F1-Score':<10} {'Support':<8}",
        f"  {'-'*28} {'-'*10} {'-'*10} {'-'*10} {'-'*8}",
    ]

    report = results["classification_report"]
    for c in results["classes"]:
        metrics = report.get(c, {})
        p = metrics.get("precision", 0.0) * 100
        r = metrics.get("recall", 0.0) * 100
        f1 = metrics.get("f1-score", 0.0) * 100
        sup = int(metrics.get("support", 0))
        lines.append(f"  {c:<28} {p:>8.1f}% {r:>8.1f}% {f1:>8.1f}% {sup:>8}")

    if results.get("per_language"):
        lines.extend([
            "-" * 72,
            "  Per-Language Performance:",
            f"  {'Language':<24} {'Test Samples':<16} {'Accuracy':<10}",
            f"  {'-'*24} {'-'*16} {'-'*10}",
        ])
        lang_names = {"en": "English", "hi": "Hindi", "ta": "Tamil"}
        for lcode, ldata in results["per_language"].items():
            name = lang_names.get(lcode, lcode)
            lines.append(f"  {name:<24} {ldata['count']:<16} {ldata['accuracy']*100:>8.1f}%")

    lines.extend([
        "-" * 72,
        f"  Confusion Matrix saved to: {cm_path}",
        "=" * 72,
        "",
    ])
    return "\n".join(lines)


def run_evaluation() -> Dict[str, Any]:
    dataset_path = find_dataset_path()
    docs_dir = find_docs_dir()
    cm_path = docs_dir / "confusion_matrix.png"

    data = load_dataset(dataset_path)
    results = evaluate_classifier(data)
    save_confusion_matrix_plot(results["cm_numpy"], results["classes"], cm_path)

    output_text = format_evaluation_output(results, cm_path)
    print(output_text)

    # Save JSON summary to reports/
    reports_dir = REPO_ROOT / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    json_path = reports_dir / "phase1_evaluation_report.json"
    clean_results = {
        "sample_count": results["sample_count"],
        "train_count": results["train_count"],
        "test_count": results["test_count"],
        "overall_accuracy": results["overall_accuracy"],
        "weighted_precision": results["weighted_precision"],
        "weighted_recall": results["weighted_recall"],
        "weighted_f1": results["weighted_f1"],
        "macro_f1": results["macro_f1"],
        "classification_report": results["classification_report"],
        "confusion_matrix_path": str(cm_path),
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(clean_results, f, indent=2)

    return results


if __name__ == "__main__":
    run_evaluation()
