"""
Unit tests for backend/app/ai/evaluation.py
"""
import pytest
from pathlib import Path
from app.ai.evaluation import (
    find_dataset_path,
    load_dataset,
    build_pipeline,
    evaluate_classifier,
)

def test_find_dataset_exists():
    path = find_dataset_path()
    assert path.exists()
    assert path.name == "petitions_labeled.csv"

def test_load_dataset_valid():
    path = find_dataset_path()
    data = load_dataset(path)
    assert len(data) >= 600
    first = data[0]
    assert "text" in first
    assert "department" in first
    assert "priority" in first

def test_build_pipeline_and_predict():
    pipeline = build_pipeline()
    train_texts = [
        "Major road collapse and deep pothole on highway",
        "Water supply pipe broken with contaminated dirty water",
        "Garbage pile overflowing with rotting food waste",
        "High voltage wire sparking near transformer pole",
    ]
    train_labels = [
        "Roads & Infrastructure",
        "Water Works",
        "Waste Management",
        "Electricity Board",
    ]
    pipeline.fit(train_texts, train_labels)

    test_pred = pipeline.predict(["Huge pothole causing vehicle accident"])
    assert test_pred[0] == "Roads & Infrastructure"

def test_evaluate_classifier_output_structure():
    path = find_dataset_path()
    data = load_dataset(path)
    # Subset for fast testing
    results = evaluate_classifier(data[:120], test_size=0.25, random_state=42)
    assert "overall_accuracy" in results
    assert "weighted_f1" in results
    assert "macro_f1" in results
    assert "confusion_matrix" in results
    assert "per_language" in results
    assert results["overall_accuracy"] > 0.0
