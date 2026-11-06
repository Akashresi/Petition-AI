# PetitionAI Model Evaluation Report

## Executive Summary

| Metric | Score |
|:-------|------:|
| **Overall Accuracy** | **46.0%** |
| **Weighted F1 Score** | **44.8%** |
| **Macro F1 Score** | 41.7% |
| **Precision (Weighted)** | 45.6% |
| **Recall (Weighted)** | 46.0% |
| **Spam Catch Rate** | **100.0%** |
| **Spam False Positive Rate** | 0.0% |
| **Total Labeled Petitions** | 451 |
| **Test Evaluation Split** | 113 (25%) |

## Per-Language Accuracy

| Language | Accuracy | Test Samples | Status |
|:---------|:--------:|:------------:|:-------|
| English (`en`) | 57.5% | 40 | NEEDS_TUNING |
| Hindi (`hi`) | 36.1% | 36 | NEEDS_TUNING |
| Tamil (`ta`) | 44.4% | 18 | NEEDS_TUNING |
| Tanglish (`tanglish`) | 42.1% | 19 | NEEDS_TUNING |

## Spam & Abuse Detection Performance

| Metric | Score | Details |
|:-------|------:|:--------|
| **Spam Catch Rate (Recall)** | **100.0%** | Flags keyboard mash, repetition, abuse (EN/HI/TA/Tanglish) |
| **False Positive Rate** | **0.0%** | Legitimate citizen complaints incorrectly flagged |
| **Spam Filter Accuracy** | **100.0%** | Overall discrimination accuracy |
| **Spam Test Samples** | 28 | Tested across English, Hindi, Tamil & Tanglish |
| **Clean Validation Samples** | 50 | Sampled from verified citizen petitions |

## Per-Category Performance Breakdown

| Category | Precision | Recall | F1 Score | Support |
|:---------|:---------:|:------:|:--------:|:-------:|
| Building & Construction | 0.0% | 0.0% | 0.0% | 7 |
| Education | 66.7% | 50.0% | 57.1% | 12 |
| Electricity | 35.7% | 38.5% | 37.0% | 13 |
| Healthcare | 72.7% | 66.7% | 69.6% | 12 |
| Public Safety | 8.3% | 8.3% | 8.3% | 12 |
| Public Transport | 88.9% | 66.7% | 76.2% | 12 |
| Road & Infrastructure | 23.8% | 38.5% | 29.4% | 13 |
| Sanitation | 20.0% | 14.3% | 16.7% | 7 |
| Waste Management | 54.5% | 50.0% | 52.2% | 12 |
| Water Supply | 57.1% | 92.3% | 70.6% | 13 |

## Confusion Matrix

```text
PetitionAI Classification Confusion Matrix
================================================================================
True \ Pred               Buildin  Educati  Electri  Healthc  Public   Public   Road &   Sanitat  Waste M  Water S
--------------------------------------------------------------------------------
Building & Construction         0        0        1        0        1        0        4        0        1        0
Education                       0        6        2        0        1        0        1        1        0        1
Electricity                     0        0        5        1        3        0        4        0        0        0
Healthcare                      0        0        0        8        1        0        1        0        1        1
Public Safety                   0        1        4        0        1        1        3        0        2        0
Public Transport                0        1        0        1        1        8        1        0        0        0
Road & Infrastructure           0        1        1        0        3        0        5        1        1        1
Sanitation                      0        0        0        0        1        0        1        1        0        4
Waste Management                0        0        1        1        0        0        1        1        6        2
Water Supply                    0        0        0        0        0        0        0        1        0       12
================================================================================
```

---
*Generated automatically by backend/scripts/evaluate.py*