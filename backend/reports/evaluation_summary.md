# PetitionAI Model Evaluation Report

## Executive Summary

| Metric | Score |
|:-------|------:|
| **Overall Accuracy** | **52.8%** |
| **Weighted F1 Score** | **52.3%** |
| **Macro F1 Score** | 51.0% |
| **Precision (Weighted)** | 55.1% |
| **Recall (Weighted)** | 52.8% |
| **Total Labeled Petitions** | 431 |
| **Test Evaluation Split** | 108 (25%) |

## Per-Language Accuracy

| Language | Accuracy | Test Samples | Status |
|:---------|:--------:|:------------:|:-------|
| English (`en`) | 70.0% | 40 | PASSED |
| Hindi (`hi`) | 38.9% | 36 | NEEDS_TUNING |
| Tamil (`ta`) | 46.9% | 32 | NEEDS_TUNING |

## Per-Category Performance Breakdown

| Category | Precision | Recall | F1 Score | Support |
|:---------|:---------:|:------:|:--------:|:-------:|
| Building & Construction | 100.0% | 28.6% | 44.4% | 7 |
| Education | 54.5% | 50.0% | 52.2% | 12 |
| Electricity | 50.0% | 41.7% | 45.5% | 12 |
| Healthcare | 76.9% | 90.9% | 83.3% | 11 |
| Public Safety | 36.4% | 33.3% | 34.8% | 12 |
| Public Transport | 75.0% | 81.8% | 78.3% | 11 |
| Road & Infrastructure | 22.2% | 33.3% | 26.7% | 12 |
| Sanitation | 20.0% | 14.3% | 16.7% | 7 |
| Waste Management | 53.8% | 58.3% | 56.0% | 12 |
| Water Supply | 69.2% | 75.0% | 72.0% | 12 |

## Confusion Matrix

```text
PetitionAI Classification Confusion Matrix
================================================================================
True \ Pred               Buildin  Educati  Electri  Healthc  Public   Public   Road &   Sanitat  Waste M  Water S
--------------------------------------------------------------------------------
Building & Construction         2        0        1        0        0        0        3        0        1        0
Education                       0        6        3        0        1        1        0        1        0        0
Electricity                     0        0        5        1        3        0        3        0        0        0
Healthcare                      0        0        0       10        0        0        1        0        0        0
Public Safety                   0        2        0        0        4        1        5        0        0        0
Public Transport                0        1        1        0        0        9        0        0        0        0
Road & Infrastructure           0        0        0        1        2        0        4        1        3        1
Sanitation                      0        2        0        0        1        0        0        1        2        1
Waste Management                0        0        0        1        0        0        1        1        7        2
Water Supply                    0        0        0        0        0        1        1        1        0        9
================================================================================
```

---
*Generated automatically by backend/scripts/evaluate.py*