"""File upload validation and scanning module.

Validates file uploads, enforces a strict 5 MB file size limit, and validates
magic bytes to prevent MIME-type spoofing (accepts only verified JPEG, PNG, and PDF).
"""
import base64
from fastapi import HTTPException

MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5 Megabytes


def validate_upload_content(data: bytes | str) -> tuple[bytes, str]:
    """Validate raw bytes or base64 encoded payload.

    Returns:
        tuple[bytes, str]: (raw_bytes, detected_mime_type)

    Raises:
        HTTPException: 400 for invalid format, unsupported mime, or oversized file.
    """
    if isinstance(data, str):
        raw_b64 = data
        if "," in data:
            raw_b64 = data.split(",", 1)[1]
        try:
            decoded = base64.b64decode(raw_b64)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid base64-encoded file payload.",
            ) from exc
    elif isinstance(data, bytes):
        decoded = data
    else:
        raise HTTPException(status_code=400, detail="Invalid file data format.")

    # Enforce 5 MB maximum size limit
    if len(decoded) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 5 MB ({len(decoded)} bytes).",
        )

    if len(decoded) < 4:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or corrupted.")

    # Magic byte verification (cannot be spoofed by file extension)
    if decoded.startswith(b"\xff\xd8\xff"):
        detected_mime = "image/jpeg"
    elif decoded.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_mime = "image/png"
    elif decoded.startswith(b"%PDF-"):
        detected_mime = "application/pdf"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only JPEG, PNG, and PDF documents are permitted.",
        )

    return decoded, detected_mime
