"""Security tests: PII masking, file upload validation/limits, rate limiting, and input sanitization."""
import base64
import pytest
from fastapi.testclient import TestClient

from app.database import db
from app.main import app
from app.security.pii import contains_pii, mask_pii
from app.security.rate_limiter import image_analysis_limiter, submission_limiter
from app.security.uploads import MAX_UPLOAD_SIZE_BYTES, validate_upload_content

client = TestClient(app)

# Minimal 1x1 valid PNG base64
VALID_PNG_BASE64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
# Minimal valid PDF base64 (%PDF-1.4 ...)
VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 1\ntrailer<</Root 1 0 R>>\nstartxref\n40\n%%EOF"
VALID_PDF_BASE64 = "data:application/pdf;base64," + base64.b64encode(VALID_PDF_BYTES).decode("ascii")


def get_token(role: str = "citizen", email: str = "sec_user@example.com") -> str:
    db.delete("users", {"email": email.lower()})
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Security Tester",
            "email": email,
            "password": "Password123!",
            "phone": "9876543210",
            "address": "Coimbatore",
        },
    )
    assert reg.status_code == 200
    user = db.find_one("users", {"email": email.lower()})
    if role != "citizen":
        db.update("users", {"id": user["id"]}, {"role": role})

    login = client.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    return login.json()["token"]


def test_pii_masking_phone_and_ids():
    text = (
        "Citizen details: Contact +91 9876543210 or 9876543211. "
        "Aadhaar is 2345 6789 0123. PAN is ABCDE1234F. "
        "Official email: citizen.grievance@tn.gov.in."
    )

    assert contains_pii(text) is True
    assert contains_pii("Just a regular pothole issue on Nehru Street") is False

    # Redaction style
    redacted = mask_pii(text, replacement_style="tag")
    assert "[PHONE_REDACTED]" in redacted
    assert "[AADHAAR_REDACTED]" in redacted
    assert "[PAN_REDACTED]" in redacted
    assert "[EMAIL_REDACTED]" in redacted
    assert "9876543210" not in redacted
    assert "2345 6789 0123" not in redacted
    assert "ABCDE1234F" not in redacted
    assert "citizen.grievance@tn.gov.in" not in redacted

    # Masking style
    masked = mask_pii(text, replacement_style="mask")
    assert "XXXX-XXXX-0123" in masked
    assert "XXXXX1234X" in masked
    assert "9876543210" not in masked


def test_oversized_upload_rejected():
    token = get_token("citizen", "sec_upload@example.com")

    # Generate oversized base64 payload (> 5 MB)
    large_raw = b"\xff\xd8\xff" + b"0" * (MAX_UPLOAD_SIZE_BYTES + 1024)
    oversized_b64 = "data:image/jpeg;base64," + base64.b64encode(large_raw).decode("ascii")

    res = client.post(
        "/api/ai/analyze-image",
        headers={"Authorization": f"Bearer {token}"},
        json={"image": oversized_b64},
    )
    assert res.status_code == 400
    assert "exceeds maximum allowed size of 5 MB" in res.json()["detail"]


def test_disallowed_file_type_rejected():
    token = get_token("citizen", "sec_disallow@example.com")

    # Raw text file or executable magic byte payload
    disallowed_bytes = b"MZ\x90\x00This is a Windows executable simulation."
    disallowed_b64 = "data:application/octet-stream;base64," + base64.b64encode(disallowed_bytes).decode("ascii")

    res = client.post(
        "/api/ai/analyze-image",
        headers={"Authorization": f"Bearer {token}"},
        json={"image": disallowed_b64},
    )
    assert res.status_code == 400
    assert "Unsupported file type" in res.json()["detail"]


def test_valid_uploads_accepted():
    token = get_token("citizen", "sec_valid@example.com")

    # Valid PNG
    res_png = client.post(
        "/api/ai/analyze-image",
        headers={"Authorization": f"Bearer {token}"},
        json={"image": VALID_PNG_BASE64},
    )
    assert res_png.status_code == 200
    assert "confidence" in res_png.json()

    # Valid PDF
    res_pdf = client.post(
        "/api/ai/analyze-image",
        headers={"Authorization": f"Bearer {token}"},
        json={"image": VALID_PDF_BASE64},
    )
    assert res_pdf.status_code == 200
    assert "confidence" in res_pdf.json()


def test_input_validation_rejections():
    token = get_token("citizen", "sec_val_input@example.com")

    # 1. Short title (< 3 chars)
    res_short_title = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "ab",
            "description": "Valid description of an issue on the road.",
            "location": "RS Puram",
        },
    )
    assert res_short_title.status_code == 400
    assert "Title must be at least 3 characters" in res_short_title.json()["detail"]

    # 2. Short description (< 5 chars)
    res_short_desc = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Water leakage",
            "description": "bad",
            "location": "RS Puram",
        },
    )
    assert res_short_desc.status_code == 400
    assert "Description must be at least 5 characters" in res_short_desc.json()["detail"]

    # 3. Oversized image in complaint submission
    large_raw = b"\xff\xd8\xff" + b"0" * (MAX_UPLOAD_SIZE_BYTES + 500)
    oversized_b64 = "data:image/jpeg;base64," + base64.b64encode(large_raw).decode("ascii")
    res_bad_img = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Pipeline burst",
            "description": "Water overflowing onto the road for hours",
            "location": "Cross Cut Road",
            "images": [oversized_b64],
        },
    )
    assert res_bad_img.status_code == 400
    assert "exceeds maximum allowed size" in res_bad_img.json()["detail"]


def test_rate_limiting_enforcement():
    token = get_token("citizen", "sec_rate_limit@example.com")
    user = db.find_one("users", {"email": "sec_rate_limit@example.com"})
    user_id = user["id"]

    # Reset limiter for this user
    image_analysis_limiter.reset()

    # Hit 10 times (the max allowed limit per minute)
    for _ in range(10):
        res = client.post(
            "/api/ai/analyze-image",
            headers={"Authorization": f"Bearer {token}"},
            json={"image": VALID_PNG_BASE64},
        )
        assert res.status_code == 200

    # 11th request must be rejected with 429
    res_exceeded = client.post(
        "/api/ai/analyze-image",
        headers={"Authorization": f"Bearer {token}"},
        json={"image": VALID_PNG_BASE64},
    )
    assert res_exceeded.status_code == 429
    assert "Rate limit exceeded" in res_exceeded.json()["detail"]
    assert "Retry-After" in res_exceeded.headers


def test_pii_masked_in_audit_logs():
    admin_token = get_token("admin", "sec_admin_audit@example.com")
    citizen_token = get_token("citizen", "sec_cit_audit@example.com")

    # Create complaint
    create_res = client.post(
        "/api/complaints",
        headers={"Authorization": f"Bearer {citizen_token}"},
        json={
            "title": "Broken transformer on Main Road",
            "description": "Continuous sparks and danger near the bus stand",
            "location": "Main Road",
        },
    )
    assert create_res.status_code == 200
    complaint_id = create_res.json()["id"]

    # Admin updates with note containing phone & Aadhaar
    update_res = client.patch(
        f"/api/complaints/{complaint_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "status": "in_progress",
            "note": "Citizen phone 9876543210 verified. Aadhaar 2345 6789 0123 logged for site inspection.",
        },
    )
    assert update_res.status_code == 200

    # Verify audit log in database has masked note
    logs = [
        l for l in db.find("audit_logs", {})
        if l.get("entityId") == complaint_id and l.get("action") == "human_override"
    ]
    assert len(logs) >= 1
    stored_note = logs[0]["details"]["officerRemarks"]
    assert "9876543210" not in stored_note
    assert "2345 6789 0123" not in stored_note
    assert "[PHONE_REDACTED]" in stored_note
    assert "[AADHAAR_REDACTED]" in stored_note
