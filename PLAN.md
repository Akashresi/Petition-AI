# PetitionAI Upgrade Plan

Branch: upgrade/all | Executed: 2026-11-07

## 8 Workstreams (executed in order, autonomous)

1. **WS1 Security** – move Gemini image analysis to backend; purge VITE_GEMINI_API_KEY from frontend; centralize AI in backend/app/ai/; README hygiene; CI workflow
2. **WS2 SLA** – shared SLA config; APScheduler reminders & breach escalation; citizen expected date; officer Due/Overdue triage
3. **WS3 Languages + Voice** – modular i18n (en/hi/ta); first-launch modal; backend language detect/normalize; localized SMS/email; Web Speech API mic; TTS read-aloud; Indian fonts
4. **WS4 Simple UI** – design tokens; accessible citizen flow: Home → 4-step wizard → Confirmation → Tracking; A+/A- scale; WCAG 4.5:1
5. **WS5 Spam** – multi-vector spam filter (gibberish, repetition, abuse) in EN/HI/TA/Tanglish; suspicious petitions → "being checked" state; never deleted
6. **WS6 Human Review** – hybrid TF-IDF + LLM classifier; Admin review queue with 4 one-click actions; audit log; corrections collection; retraining script
7. **WS7 Evaluation** – 300+ labeled petitions CSV; evaluate.py (accuracy, F1, confusion matrix, spam catch rate, per-language); admin analytics card
8. **WS8 Final** – accessibility check; FIRST_TIME_USER_TEST.md; README update; FINAL_REPORT.md; OUT_OF_SCOPE.md

## Defaults Applied
- License: LICENSE_TODO.md only. Credits in README pointing to upstream repo.
- Voice: Web Speech API, text fallback always present.
- SMS: existing console/Twilio abstraction.
- Languages: en, hi, ta (Tanglish handled by normalizer).
- LLM: backend Gemini only; local fallback if LLM fails.

