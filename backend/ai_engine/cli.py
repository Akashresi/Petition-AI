#!/usr/bin/env python
"""
PetitionAI – Phase 1 CLI
========================
Usage examples:

  # Analyze a text petition
  python -m ai_engine.cli analyze --text "There is a large pothole on MG Road."

  # Analyze from file (PDF, DOCX, image, video)
  python -m ai_engine.cli analyze --file petition.pdf

  # Run the evaluation suite
  python -m ai_engine.cli evaluate

  # Run with explicit Gemini key (overrides .env)
  python -m ai_engine.cli analyze --text "..." --gemini-key AIza...
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

# Fix Windows console UTF-8 output for Indic languages & unicode arrows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("petition_cli")


def cmd_analyze(args: argparse.Namespace) -> None:
    from ai_engine.ingestion import extract_text_from_file
    from ai_engine.analyzer import analyze_petition
    from ai_engine.config import ai_config

    api_key = args.gemini_key or ai_config.GEMINI_API_KEY

    if args.file:
        logger.info("Extracting text from: %s", args.file)
        ingested = extract_text_from_file(args.file, gemini_key=api_key)
        raw_text = ingested["raw_text"]
        source_type = ingested["source_type"]
        if not raw_text.strip():
            logger.error("No text could be extracted from the file.")
            sys.exit(1)
        logger.info("Extracted %d chars from %s", len(raw_text), source_type)
    elif args.text:
        raw_text = args.text
        source_type = "text"
    else:
        logger.error("Provide --text or --file.")
        sys.exit(1)

    logger.info("Running petition analysis…")
    result = analyze_petition(
        raw_text,
        source_type=source_type,
        gemini_api_key=api_key,
    )

    output = json.dumps(result, ensure_ascii=False, indent=2)
    print(output)

    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
        logger.info("Output saved to %s", args.output)


def cmd_evaluate(args: argparse.Namespace) -> None:
    from ai_engine.evaluator import run_evaluation
    run_evaluation(output_dir=args.output_dir)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="petition-ai",
        description="PetitionAI Phase 1 – CLI petition analyzer",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # ── analyze sub-command ───────────────────────────────────────────────────
    p_analyze = sub.add_parser("analyze", help="Analyze a petition")
    input_group = p_analyze.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--text", type=str, help="Raw petition text")
    input_group.add_argument("--file", type=str, help="Path to petition file (PDF/DOCX/image/video)")
    p_analyze.add_argument("--gemini-key", type=str, default="", help="Gemini API key (overrides .env)")
    p_analyze.add_argument("--output", type=str, default="", help="Save JSON output to file")
    p_analyze.set_defaults(func=cmd_analyze)

    # ── evaluate sub-command ──────────────────────────────────────────────────
    p_eval = sub.add_parser("evaluate", help="Run evaluation suite and generate reports")
    p_eval.add_argument("--output-dir", type=str, default="reports", help="Directory for reports")
    p_eval.set_defaults(func=cmd_evaluate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
