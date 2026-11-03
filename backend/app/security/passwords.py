"""Password hashing utilities.

New passwords are hashed with bcrypt (salted). Verification also accepts the
legacy unsalted SHA-256 format used by earlier versions of this demo so that
existing seeded accounts keep working; such hashes are transparently upgraded
to bcrypt on the next successful login.
"""
import hashlib
import bcrypt

_LEGACY_PREFIX = "petitionai:"
_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def _legacy_hash(password: str) -> str:
    """Old unsalted SHA-256 scheme - kept only to verify existing accounts."""
    return hashlib.sha256(f"{_LEGACY_PREFIX}{password}".encode()).hexdigest()


def hash_password(password: str) -> str:
    """Hash a password with bcrypt (salt is embedded in the result)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash (bcrypt or legacy SHA-256)."""
    if not stored_hash:
        return False
    if stored_hash.startswith(_BCRYPT_PREFIXES):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    # Legacy comparison - constant-time to reduce timing leakage.
    return hashlib_compare(_legacy_hash(password), stored_hash)


def needs_rehash(stored_hash: str) -> bool:
    """True when a stored hash uses the legacy scheme and should be upgraded."""
    return bool(stored_hash) and not stored_hash.startswith(_BCRYPT_PREFIXES)


def hashlib_compare(a: str, b: str) -> bool:
    """Constant-time string comparison."""
    import hmac

    return hmac.compare_digest(a, b)
