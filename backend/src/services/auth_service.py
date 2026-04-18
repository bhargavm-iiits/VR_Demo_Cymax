"""
Authentication Service
FIXED: Replaced passlib[bcrypt] with argon2-cffi
Reason: bcrypt 4.x is incompatible with passlib on Python 3.11

Install fix:
    pip uninstall bcrypt passlib
    pip install argon2-cffi python-jose[cryptography]
"""

import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from src.config.environment import env

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Argon2 Password Hasher
# Argon2id is the OWASP recommended algorithm (2024)
# Better than bcrypt: memory-hard, GPU-resistant
# ─────────────────────────────────────────────────────────────
_ph = PasswordHasher(
    time_cost=2,        # Number of iterations
    memory_cost=65536,  # 64 MB memory usage
    parallelism=2,      # Parallel threads
    hash_len=32,        # Output length
    salt_len=16         # Salt length
)


class AuthService:
    """
    Authentication Service using Argon2id + JWT

    Why Argon2 over bcrypt?
      ✅ Winner of Password Hashing Competition (PHC)
      ✅ Memory-hard (defeats GPU brute-force attacks)
      ✅ No 72-byte password limit (bcrypt limitation)
      ✅ Compatible with all Python 3.x versions
      ✅ OWASP recommended since 2022
      ✅ No dependency conflicts on Windows
    """

    # ── Password Hashing ──────────────────────────────────────

    def hash_password(self, password: str) -> str:
        """
        Hash password using Argon2id algorithm.

        Args:
            password: Plain text password (any length)

        Returns:
            Argon2 hash string (includes salt + params)

        Example:
            hash = auth_service.hash_password("MyPass123!")
            # Returns: $argon2id$v=19$m=65536,t=2,p=2$...
        """
        if not isinstance(password, str):
            raise TypeError("Password must be a string")

        hashed = _ph.hash(password)
        logger.debug("🔑 Password hashed with Argon2id")
        return hashed

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify plain password against Argon2 hash.

        Args:
            plain_password: Password to verify
            hashed_password: Stored Argon2 hash

        Returns:
            True if correct, False otherwise (never raises)
        """
        if not plain_password or not hashed_password:
            return False

        try:
            return _ph.verify(hashed_password, plain_password)
        except VerifyMismatchError:
            # Wrong password
            return False
        except (VerificationError, InvalidHashError) as e:
            logger.warning(f"⚠️ Password verification error: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected verification error: {e}")
            return False

    def needs_rehash(self, hashed_password: str) -> bool:
        """
        Check if hash needs to be upgraded
        (when Argon2 parameters change).
        """
        return _ph.check_needs_rehash(hashed_password)

    # ── JWT Token Management ──────────────────────────────────

    def create_access_token(self, user_id: int, username: str) -> str:
        """
        Create JWT access token.

        Args:
            user_id: Database user ID
            username: User's username

        Returns:
            Signed JWT token string
        """
        now = datetime.utcnow()
        payload = {
            "sub": str(user_id),
            "username": username,
            "iat": now,
            "exp": now + timedelta(hours=env.JWT_EXPIRY_HOURS),
            "type": "access"
        }

        token = jwt.encode(
            payload,
            env.JWT_SECRET,
            algorithm=env.JWT_ALGORITHM
        )

        logger.info(f"🎫 Token created for user: {username}")
        return token

    def verify_token(self, token: str) -> Optional[dict]:
        """
        Verify and decode JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded payload dict, or None if invalid/expired
        """
        if not token or not token.strip():
            return None

        try:
            payload = jwt.decode(
                token,
                env.JWT_SECRET,
                algorithms=[env.JWT_ALGORITHM]
            )
            return payload
        except JWTError as e:
            logger.warning(f"⚠️ Token verification failed: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected token error: {e}")
            return None

    # ── User Operations ───────────────────────────────────────

    def register_user(
        self,
        db: Session,
        username: str,
        email: str,
        password: str
    ):
        """
        Register a new user with Argon2-hashed password.
        """
        from src.models.user import User

        # Check if user already exists
        existing = db.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()

        if existing:
            raise ValueError("Username or email already exists")

        # Hash password with Argon2id
        password_hash = self.hash_password(password)

        # Create user
        user = User(
            username=username,
            email=email,
            password_hash=password_hash
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(f"✅ User registered: {username}")
        return user

    def authenticate_user(
        self,
        db: Session,
        username: str,
        password: str
    ) -> Optional[object]:
        """
        Authenticate user credentials.

        Returns:
            User object if valid, None if invalid
        """
        from src.models.user import User

        user = db.query(User).filter(
            User.username == username
        ).first()

        if not user:
            logger.warning(f"⚠️ User not found: {username}")
            return None

        if not self.verify_password(password, user.password_hash):
            logger.warning(f"⚠️ Wrong password for: {username}")
            return None

        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()

        logger.info(f"✅ Authenticated: {username}")
        return user


# Singleton instance
auth_service = AuthService()