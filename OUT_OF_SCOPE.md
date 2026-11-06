# Out-of-Scope Issues

This file logs problems noticed during the upgrade/all workstream that were NOT fixed (per Hard Rule 4).

| # | Issue | Location | Recommended Action |
|---|-------|----------|--------------------|
| 1 | `on_event` deprecation warning (FastAPI lifespan) | backend/app/main.py | Migrate to `lifespan` context manager in a future sprint |
| 2 | Pydantic V2 `.dict()` deprecation | backend/tests/test_voice_transcription.py | Replace with `.model_dump()` |
| 3 | Large JS bundle (>500 kB) – single chunk | vite.config.ts | Add `manualChunks` to split recharts/leaflet/html2canvas |
| 4 | No rate-limiting middleware for general routes | backend/app/main.py | Add slowapi or similar global rate limiter |
| 5 | demo passwords in backend/.env.example SEED section | backend/.env.example | Move to seed.py only; env example already noted as template |
| 6 | `src/lib/pdfExport.ts` and `src/lib/excelExport.ts` unused by core citizen flow | src/lib/ | Evaluate removal or move to officer-only bundle |
| 7 | `backend/ai_engine/` shadow copy of AI logic (old folder) | backend/ai_engine/ | Consolidate into backend/app/ai/ in future sprint |
