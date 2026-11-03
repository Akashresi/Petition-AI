"""PII (Personally Identifiable Information) masking and sanitization module.

Masks Indian mobile phone numbers, Aadhaar IDs, PAN card numbers, and email addresses
before data is sent to external LLM providers or recorded in audit trails and logs.
"""
import re

# Regex patterns for sensitive identifiers
# Aadhaar: 12-digit format, optional space or dash separator
AADHAAR_PATTERN = re.compile(r"\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b")

# Indian PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
PAN_PATTERN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b")

# Indian Phone numbers: optional +91/91/0 prefix, 10 digits starting with 6-9
PHONE_PATTERN = re.compile(
    r"(?:\+91[\s\-]?)?(?:91[\s\-]?)?(?:0)?[6-9]\d{2}[\s\-]?\d{3}[\s\-]?\d{4}\b"
)

# Email address pattern
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


def mask_pii(text: str, replacement_style: str = "tag") -> str:
    """Mask sensitive PII (Phone, Aadhaar, PAN, Email) in text.

    Args:
        text: The source string possibly containing PII.
        replacement_style:
            - 'tag': replaces with [PHONE_REDACTED], [AADHAAR_REDACTED], etc.
            - 'mask': partially masks (e.g., +91 98*****210, XXXX-XXXX-9012)
    """
    if not text or not isinstance(text, str):
        return text or ""

    result = text

    # 1. Mask Aadhaar numbers first (to avoid phone regex partially matching 12 digits)
    if replacement_style == "mask":
        result = AADHAAR_PATTERN.sub(
            lambda m: f"XXXX-XXXX-{m.group(0).replace(' ', '').replace('-', '')[-4:]}",
            result,
        )
    else:
        result = AADHAAR_PATTERN.sub("[AADHAAR_REDACTED]", result)

    # 2. Mask PAN numbers
    if replacement_style == "mask":
        result = PAN_PATTERN.sub(
            lambda m: f"XXXXX{m.group(0)[5:9]}X",
            result,
        )
    else:
        result = PAN_PATTERN.sub("[PAN_REDACTED]", result)

    # 3. Mask Phone numbers
    if replacement_style == "mask":
        def _mask_phone(match: re.Match) -> str:
            raw = match.group(0).replace(" ", "").replace("-", "")
            return f"{raw[:3]}*****{raw[-2:]}"
        result = PHONE_PATTERN.sub(_mask_phone, result)
    else:
        result = PHONE_PATTERN.sub("[PHONE_REDACTED]", result)

    # 4. Mask Emails
    if replacement_style == "mask":
        def _mask_email(match: re.Match) -> str:
            val = match.group(0)
            user, domain = val.split("@", 1)
            return f"{user[0]}***@{domain}"
        result = EMAIL_PATTERN.sub(_mask_email, result)
    else:
        result = EMAIL_PATTERN.sub("[EMAIL_REDACTED]", result)

    return result


def contains_pii(text: str) -> bool:
    """Check if the given text contains any detectable PII."""
    if not text or not isinstance(text, str):
        return False
    return bool(
        AADHAAR_PATTERN.search(text)
        or PAN_PATTERN.search(text)
        or PHONE_PATTERN.search(text)
        or EMAIL_PATTERN.search(text)
    )
