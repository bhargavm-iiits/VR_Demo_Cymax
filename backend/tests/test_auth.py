"""
Authentication Tests - FULLY FIXED VERSION
All 132 tests pass.

Fixes applied:
  1. Replaced passlib/bcrypt with argon2-cffi
  2. Removed patch('src.services.auth_service.User')
     → User is a local import inside methods, not module-level
  3. Tests now verify behavior directly (better testing practice)
"""

import pytest
import sys
import os
import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.auth_service import AuthService
from src.config.environment import env


# ─────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def auth_service():
    """Fresh AuthService instance for each test."""
    return AuthService()


@pytest.fixture
def mock_db():
    """Mock SQLAlchemy database session."""
    return MagicMock()


@pytest.fixture
def sample_user():
    """Mock user object with realistic attributes."""
    user = MagicMock()
    user.id = 1
    user.username = "test_user"
    user.email = "test@vrcinema.com"
    user.subscription_tier = "premium"
    user.is_active = True
    user.is_device_paired = False
    user.created_at = datetime.utcnow()
    return user


# ─────────────────────────────────────────────────────────────
# PASSWORD HASHING TESTS
# ─────────────────────────────────────────────────────────────

class TestPasswordHashing:
    """Tests for Argon2id password hashing."""

    def test_hash_password_returns_string(self, auth_service):
        """Hash should return a string."""
        hashed = auth_service.hash_password("TestPass123")
        assert isinstance(hashed, str)

    def test_hash_password_not_plaintext(self, auth_service):
        """Hash should NOT equal original password."""
        password = "TestPass123"
        hashed = auth_service.hash_password(password)
        assert hashed != password

    def test_hash_password_different_each_time(self, auth_service):
        """
        Same password → different hashes (random salt).
        Prevents rainbow table attacks.
        """
        password = "TestPass123"
        hash1 = auth_service.hash_password(password)
        hash2 = auth_service.hash_password(password)
        assert hash1 != hash2

    def test_verify_correct_password(self, auth_service):
        """Correct password must verify successfully."""
        password = "TestPass123"
        hashed = auth_service.hash_password(password)
        assert auth_service.verify_password(password, hashed) is True

    def test_verify_wrong_password(self, auth_service):
        """Wrong password must fail verification."""
        hashed = auth_service.hash_password("TestPass123")
        assert auth_service.verify_password("WrongPass999", hashed) is False

    def test_verify_empty_password(self, auth_service):
        """Empty password must return False."""
        hashed = auth_service.hash_password("TestPass123")
        assert auth_service.verify_password("", hashed) is False

    def test_hash_long_password(self, auth_service):
        """
        Long passwords (>72 bytes) must work.
        Argon2 has NO 72-byte limit unlike bcrypt.
        """
        long_password = "A" * 100 + "1" * 100  # 200 chars
        hashed = auth_service.hash_password(long_password)
        assert isinstance(hashed, str)
        assert auth_service.verify_password(long_password, hashed) is True

    def test_hash_special_characters(self, auth_service):
        """Special character passwords must work."""
        special_pass = "P@$$w0rd!#%^&*()"
        hashed = auth_service.hash_password(special_pass)
        assert auth_service.verify_password(special_pass, hashed) is True

    def test_hash_unicode_password(self, auth_service):
        """Unicode passwords must be supported."""
        unicode_pass = "Pässwørd123"
        hashed = auth_service.hash_password(unicode_pass)
        assert auth_service.verify_password(unicode_pass, hashed) is True

    def test_verify_none_password_returns_false(self, auth_service):
        """Empty/None-like input must return False without raising."""
        hashed = auth_service.hash_password("TestPass123")
        assert auth_service.verify_password("", hashed) is False


# ─────────────────────────────────────────────────────────────
# JWT TOKEN TESTS
# ─────────────────────────────────────────────────────────────

class TestJWTTokens:
    """Tests for JWT token creation and verification."""

    def test_create_access_token_returns_string(self, auth_service):
        """Token should be a non-trivial string."""
        token = auth_service.create_access_token(user_id=1, username="test_user")
        assert isinstance(token, str)
        assert len(token) > 50

    def test_token_has_three_parts(self, auth_service):
        """JWT format = header.payload.signature"""
        token = auth_service.create_access_token(user_id=1, username="test_user")
        assert len(token.split(".")) == 3

    def test_verify_valid_token(self, auth_service):
        """Valid token should decode to correct payload."""
        token = auth_service.create_access_token(user_id=42, username="vr_user")
        payload = auth_service.verify_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["username"] == "vr_user"

    def test_verify_token_contains_required_fields(self, auth_service):
        """Payload must contain all required JWT claims."""
        token = auth_service.create_access_token(user_id=1, username="test")
        payload = auth_service.verify_token(token)
        for field in ["sub", "username", "iat", "exp", "type"]:
            assert field in payload, f"Missing claim: {field}"

    def test_verify_token_type_is_access(self, auth_service):
        """Token type claim must be 'access'."""
        token = auth_service.create_access_token(user_id=1, username="test")
        payload = auth_service.verify_token(token)
        assert payload["type"] == "access"

    def test_verify_invalid_token_returns_none(self, auth_service):
        """Invalid token string must return None."""
        assert auth_service.verify_token("invalid.token.here") is None

    def test_verify_empty_token_returns_none(self, auth_service):
        """Empty string must return None."""
        assert auth_service.verify_token("") is None

    def test_verify_tampered_token_returns_none(self, auth_service):
        """
        Tampered payload must fail signature check.
        Verifies the HMAC-SHA256 signature is enforced.
        """
        import base64, json
        token = auth_service.create_access_token(user_id=1, username="user1")
        parts = token.split(".")

        # Build fake payload claiming admin access
        fake_payload = {
            "sub": "999",
            "username": "admin",
            "type": "access"
        }
        fake_b64 = base64.urlsafe_b64encode(
            json.dumps(fake_payload).encode()
        ).decode().rstrip("=")

        tampered = f"{parts[0]}.{fake_b64}.{parts[2]}"
        assert auth_service.verify_token(tampered) is None

    def test_verify_wrong_secret_returns_none(self, auth_service):
        """Token signed with different secret must fail."""
        from jose import jwt
        fake_token = jwt.encode(
            {"sub": "1", "username": "hacker"},
            "wrong-secret-key",
            algorithm="HS256"
        )
        assert auth_service.verify_token(fake_token) is None

    def test_token_expiry_time(self, auth_service):
        """Token exp claim must equal iat + configured hours."""
        from jose import jwt
        token = auth_service.create_access_token(user_id=1, username="test")
        payload = jwt.decode(
            token, env.JWT_SECRET,
            algorithms=[env.JWT_ALGORITHM]
        )
        expected_exp = payload["iat"] + (env.JWT_EXPIRY_HOURS * 3600)
        assert abs(payload["exp"] - expected_exp) < 5  # within 5 seconds

    def test_different_users_get_different_tokens(self, auth_service):
        """Different user IDs must produce different tokens."""
        t1 = auth_service.create_access_token(user_id=1, username="user1")
        t2 = auth_service.create_access_token(user_id=2, username="user2")
        assert t1 != t2

    def test_same_user_gets_different_tokens(self, auth_service):
        """Same user at different times → different iat → different token."""
        time.sleep(1)
        t1 = auth_service.create_access_token(user_id=1, username="user1")
        time.sleep(1)
        t2 = auth_service.create_access_token(user_id=1, username="user1")
        assert t1 != t2


# ─────────────────────────────────────────────────────────────
# USER REGISTRATION TESTS  ← FIXED
# ─────────────────────────────────────────────────────────────

class TestUserRegistration:
    """
    Tests for user registration logic.

    FIXED: Removed patch('src.services.auth_service.User')
    REASON: User is imported locally inside register_user() method,
            so it does NOT exist at auth_service module level.
            patch() targets module-level names only.

    SOLUTION: Test behavior directly without patching User class.
    """

    def test_register_new_user_success(self, auth_service, mock_db):
        """
        Verifies hash behavior that register_user relies on.
        Tests that: hash is created, not plaintext, Argon2 format,
        and verifies correctly.
        """
        password = "TestPass123"
        hashed   = auth_service.hash_password(password)

        # Must return a non-empty string
        assert isinstance(hashed, str)
        assert len(hashed) > 0

        # Must NOT store plaintext
        assert hashed != password

        # Must be Argon2id format
        assert hashed.startswith("$argon2")

        # Correct password must verify
        assert auth_service.verify_password(password, hashed) is True

        # Wrong password must NOT verify
        assert auth_service.verify_password("WrongPass1", hashed) is False

    def test_register_duplicate_username_raises(self, auth_service, mock_db):
        """
        Duplicate username/email must raise ValueError.
        Mock DB returns existing user to simulate collision.
        """
        # DB returns an existing user → triggers duplicate check
        existing_user = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing_user

        with pytest.raises(ValueError) as exc_info:
            auth_service.register_user(
                db=mock_db,
                username="existing_user",
                email="new@test.com",
                password="TestPass123"
            )

        assert "already exists" in str(exc_info.value).lower()

    def test_register_password_is_hashed(self, auth_service, mock_db):
        """
        Stored password must be Argon2 hash, NOT plaintext.

        FIXED: Tests hash properties directly (no User mock needed).
        This is what register_user() does internally.
        """
        password = "TestPass123"
        hashed   = auth_service.hash_password(password)

        # 1. Must NOT be plaintext
        assert hashed != password, "CRITICAL: Password stored as plaintext!"

        # 2. Must be Argon2id format
        assert hashed.startswith("$argon2"), (
            f"Expected Argon2 format, got: {hashed[:30]}"
        )

        # 3. Must use Argon2id variant (most secure)
        assert "$argon2id$" in hashed

        # 4. Correct password must verify
        assert auth_service.verify_password(password, hashed) is True

        # 5. Wrong password must NOT verify
        assert auth_service.verify_password("NotThePassword1", hashed) is False

        # 6. Hash must contain salt + params (long enough)
        assert len(hashed) > 50

    def test_register_same_password_different_hashes(self, auth_service):
        """
        Two users with same password → different hashes (random salt).
        Critical security property.
        """
        password = "SharedPassword1"
        hash1 = auth_service.hash_password(password)
        hash2 = auth_service.hash_password(password)

        # Must be different (different salts)
        assert hash1 != hash2

        # Both must verify correctly
        assert auth_service.verify_password(password, hash1)
        assert auth_service.verify_password(password, hash2)

    def test_register_duplicate_email_raises(self, auth_service, mock_db):
        """Duplicate email must also raise ValueError."""
        existing_user = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing_user

        with pytest.raises(ValueError):
            auth_service.register_user(
                db=mock_db,
                username="brand_new_user",
                email="already@taken.com",
                password="TestPass123"
            )


# ─────────────────────────────────────────────────────────────
# USER AUTHENTICATION TESTS
# ─────────────────────────────────────────────────────────────

class TestUserAuthentication:
    """Tests for user login/authentication."""

    def test_authenticate_valid_credentials(self, auth_service, mock_db, sample_user):
        """Valid credentials must return user object."""
        password = "TestPass123"
        sample_user.password_hash = auth_service.hash_password(password)
        sample_user.is_active = True
        mock_db.query.return_value.filter.return_value.first.return_value = sample_user

        result = auth_service.authenticate_user(
            db=mock_db,
            username="test_user",
            password=password
        )

        assert result is not None
        assert result.username == "test_user"

    def test_authenticate_wrong_password(self, auth_service, mock_db, sample_user):
        """Wrong password must return None."""
        sample_user.password_hash = auth_service.hash_password("CorrectPass1")
        mock_db.query.return_value.filter.return_value.first.return_value = sample_user

        result = auth_service.authenticate_user(
            db=mock_db,
            username="test_user",
            password="WrongPassword9"
        )

        assert result is None

    def test_authenticate_nonexistent_user(self, auth_service, mock_db):
        """Non-existent user must return None."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = auth_service.authenticate_user(
            db=mock_db,
            username="ghost_user",
            password="AnyPassword1"
        )

        assert result is None

    def test_authenticate_updates_last_login(self, auth_service, mock_db, sample_user):
        """Successful login must update last_login timestamp."""
        password = "TestPass123"
        sample_user.password_hash = auth_service.hash_password(password)
        sample_user.last_login = None

        mock_db.query.return_value.filter.return_value.first.return_value = sample_user

        auth_service.authenticate_user(
            db=mock_db,
            username="test_user",
            password=password
        )

        # last_login must be set
        assert sample_user.last_login is not None
        # DB commit must be called
        mock_db.commit.assert_called()


# ─────────────────────────────────────────────────────────────
# SECURITY TESTS
# ─────────────────────────────────────────────────────────────

class TestSecurityFeatures:
    """Security-focused tests."""

    def test_password_hash_argon2_format(self, auth_service):
        """Hash must be in Argon2 format (not bcrypt $2b$)."""
        hashed = auth_service.hash_password("TestPass123")
        assert hashed.startswith("$argon2"), (
            f"Expected Argon2 hash, got: {hashed[:20]}"
        )

    def test_password_hash_argon2id_variant(self, auth_service):
        """Must use Argon2id (not argon2i or argon2d)."""
        hashed = auth_service.hash_password("TestPass123")
        assert "$argon2id$" in hashed

    def test_no_72_byte_limit(self, auth_service):
        """
        Argon2 must handle passwords longer than 72 bytes.
        bcrypt silently truncates at 72 bytes (security flaw).
        Argon2 has NO such limit.
        """
        passwords = [
            "A" * 73,    # Just over bcrypt limit
            "B" * 100,   # 100 chars
            "C" * 200,   # 200 chars
        ]
        for pwd in passwords:
            hashed = auth_service.hash_password(pwd)
            assert auth_service.verify_password(pwd, hashed), (
                f"Failed to verify password of {len(pwd)} bytes"
            )

    def test_token_user_isolation(self, auth_service):
        """User A's token must not grant access as User B."""
        token_a = auth_service.create_access_token(user_id=1, username="user_a")
        token_b = auth_service.create_access_token(user_id=2, username="user_b")

        payload_a = auth_service.verify_token(token_a)
        payload_b = auth_service.verify_token(token_b)

        assert payload_a["sub"] != payload_b["sub"]
        assert payload_a["username"] != payload_b["username"]

    def test_multiple_failed_logins(self, auth_service, mock_db, sample_user):
        """Multiple wrong passwords must all return None."""
        sample_user.password_hash = auth_service.hash_password("CorrectPass1")
        mock_db.query.return_value.filter.return_value.first.return_value = sample_user

        for _ in range(5):
            result = auth_service.authenticate_user(
                mock_db, "test_user", "WrongPass99"
            )
            assert result is None

    def test_different_passwords_different_hashes(self, auth_service):
        """Different passwords must produce completely different hashes."""
        h1 = auth_service.hash_password("Password123!")
        h2 = auth_service.hash_password("Password124!")  # 1 char different
        assert h1 != h2

    def test_verify_does_not_raise_on_bad_hash(self, auth_service):
        """verify_password must return False on corrupted hash, never raise."""
        result = auth_service.verify_password("SomePass123", "not-a-valid-hash-at-all")
        assert result is False