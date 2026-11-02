"""
Input Ingestion Module
======================
Extracts text from: plain text, PDF, DOCX, images, and video files.
All heavy imports are guarded so the module degrades gracefully when
optional dependencies (whisper, opencv, etc.) are not installed.
"""
from __future__ import annotations

import base64
import io
import logging
import tempfile
from pathlib import Path
from typing import Union

logger = logging.getLogger(__name__)

# ── Optional heavy imports ────────────────────────────────────────────────────

def _try_import(name: str):
    try:
        import importlib
        return importlib.import_module(name)
    except ImportError:
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def extract_text_from_file(file_path: Union[str, Path], *, gemini_key: str = "") -> dict:
    """
    Accepts a file path and returns:
        {
            "raw_text": str,
            "source_type": "text"|"pdf"|"docx"|"image"|"video",
            "page_count": int | None,
            "frame_count": int | None,
            "audio_transcript": str | None,
            "base64_images": list[str],   # for LLM vision (max 3 frames)
        }
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    ext = path.suffix.lower()

    if ext in {".txt", ".md"}:
        return _from_text(path)
    elif ext == ".pdf":
        return _from_pdf(path)
    elif ext in {".docx", ".doc"}:
        return _from_docx(path)
    elif ext in {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".gif"}:
        return _from_image(path, gemini_key=gemini_key)
    elif ext in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        return _from_video(path, gemini_key=gemini_key)
    else:
        # Try reading as plain text; fail if it's clearly binary
        try:
            content = path.read_bytes()
            sample = content[:512]
            # Count control/null bytes and high-bytes as binary indicators
            binary_bytes = sum(
                1 for b in sample
                if b > 127 or (b < 9) or (14 <= b <= 31)
            )
            if len(sample) > 0 and binary_bytes / len(sample) > 0.10:
                raise ValueError(f"Unsupported binary file type: {ext}")
            return _result(content.decode("utf-8", errors="replace").strip(), "text")
        except ValueError:
            raise
        except Exception:
            raise ValueError(f"Unsupported file type: {ext}")


def extract_text_from_bytes(
    data: bytes, mime_type: str, filename: str = "upload", *, gemini_key: str = ""
) -> dict:
    """Write bytes to a temp file, then delegate to extract_text_from_file."""
    suffix = _mime_to_ext(mime_type) or Path(filename).suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    return extract_text_from_file(tmp_path, gemini_key=gemini_key)


# ── Format-specific extractors ────────────────────────────────────────────────

def _from_text(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    return _result(text, "text")


def _from_pdf(path: Path) -> dict:
    pypdf = _try_import("pypdf")
    if pypdf is None:
        raise ImportError("pypdf not installed. Run: pip install pypdf")
    reader = pypdf.PdfReader(str(path))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(pages)
    return _result(text, "pdf", page_count=len(pages))


def _from_docx(path: Path) -> dict:
    docx = _try_import("docx")
    if docx is None:
        raise ImportError("python-docx not installed. Run: pip install python-docx")
    doc = docx.Document(str(path))
    text = "\n".join(para.text for para in doc.paragraphs)
    return _result(text, "docx")


def _from_image(path: Path, *, gemini_key: str = "") -> dict:
    """Return base64 image + optional Gemini OCR text."""
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    text = _ocr_with_gemini([b64], gemini_key=gemini_key) if gemini_key else ""
    return _result(text, "image", base64_images=[b64])


def _from_video(path: Path, *, gemini_key: str = "") -> dict:
    """Extract sampled frames (for vision) + audio transcript (whisper)."""
    cv2 = _try_import("cv2")
    frames_b64: list[str] = []
    frame_count = 0

    if cv2:
        cap = cv2.VideoCapture(str(path))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        # Sample at most 3 frames evenly
        sample_indices = [int(total * i / 4) for i in range(1, 4)]
        frame_count = total
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                success, buf = cv2.imencode(".jpg", frame)
                if success:
                    frames_b64.append(base64.b64encode(buf.tobytes()).decode())
        cap.release()

    audio_transcript = _transcribe_audio(path)
    vision_text = _ocr_with_gemini(frames_b64, gemini_key=gemini_key) if (gemini_key and frames_b64) else ""
    combined = "\n".join(filter(None, [vision_text, audio_transcript]))

    return _result(combined, "video", frame_count=frame_count,
                   audio_transcript=audio_transcript, base64_images=frames_b64)


def _transcribe_audio(video_path: Path) -> str:
    """Extract audio from video and transcribe with Whisper (optional)."""
    whisper = _try_import("whisper")
    if whisper is None:
        logger.info("openai-whisper not installed; skipping audio transcript.")
        return ""
    try:
        model = whisper.load_model("tiny")
        result = model.transcribe(str(video_path))
        return result.get("text", "")
    except Exception as exc:
        logger.warning("Whisper transcription failed: %s", exc)
        return ""


def _ocr_with_gemini(b64_images: list[str], *, gemini_key: str) -> str:
    """Ask Gemini to describe / OCR images. Returns empty string on failure."""
    if not b64_images or not gemini_key:
        return ""
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        parts = [{"text": "Extract and transcribe all visible text from this image. "
                           "If it is a petition or grievance, summarize the key complaint."}]
        for b64 in b64_images[:3]:
            parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64}})
        response = model.generate_content(parts)
        return response.text or ""
    except Exception as exc:
        logger.warning("Gemini OCR failed: %s", exc)
        return ""


# ── Helpers ────────────────────────────────────────────────────────────────────

def _result(
    raw_text: str,
    source_type: str,
    *,
    page_count: int | None = None,
    frame_count: int | None = None,
    audio_transcript: str | None = None,
    base64_images: list[str] | None = None,
) -> dict:
    return {
        "raw_text": raw_text.strip(),
        "source_type": source_type,
        "page_count": page_count,
        "frame_count": frame_count,
        "audio_transcript": audio_transcript,
        "base64_images": base64_images or [],
    }


def _mime_to_ext(mime: str) -> str:
    mapping = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "video/mp4": ".mp4",
        "text/plain": ".txt",
    }
    return mapping.get(mime, "")
