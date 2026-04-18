"""
AES Encryption Service - FIXED VERSION

BUG FIXED: encrypt_file / decrypt_file roundtrip
ROOT CAUSE:
  - Old code created ONE AES cipher but encrypted
    each 64KB chunk independently with pad()
  - Each padded chunk = separate CBC "message"
  - Decryption tried to treat it as one stream → padding error

FIX:
  - Collect ALL data first, pad ONCE, encrypt as ONE block
  - OR use a proper streaming approach with no inter-chunk padding
  - We use: read all → pad once → encrypt once (simplest + correct)
"""

import os
import hashlib
import secrets
import base64
import logging
from typing import Tuple, Optional

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes

from src.config.environment import env

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    AES-256-CBC Encryption Service

    FIXED METHODS:
      - encrypt_file()  → reads all data, pads ONCE, encrypts once
      - decrypt_file()  → reads all data, decrypts once, unpads once
    """

    BLOCK_SIZE = 16
    KEY_SIZE   = 32   # AES-256
    IV_SIZE    = 16

    def __init__(self):
        self._master_key = bytes.fromhex(env.AES_KEY)
        logger.info("🔐 EncryptionService initialized")

    # ─────────────────────────────────────────
    # KEY MANAGEMENT
    # ─────────────────────────────────────────

    def generate_content_key(self) -> Tuple[bytes, str]:
        """Generate unique AES-256 key for a video file."""
        key    = get_random_bytes(self.KEY_SIZE)
        key_id = secrets.token_hex(16)
        logger.info(f"🔑 Generated content key: {key_id}")
        return key, key_id

    def derive_key_from_password(
        self,
        password: str,
        salt: bytes = None
    ) -> Tuple[bytes, bytes]:
        """Derive AES key from password using PBKDF2-HMAC-SHA256."""
        if salt is None:
            salt = get_random_bytes(16)
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt,
            iterations=100_000,
            dklen=self.KEY_SIZE
        )
        return key, salt

    def encrypt_content_key(self, content_key: bytes) -> str:
        """Wrap a content key with the master key (AES-CBC)."""
        iv      = get_random_bytes(self.IV_SIZE)
        cipher  = AES.new(self._master_key, AES.MODE_CBC, iv)
        wrapped = cipher.encrypt(pad(content_key, self.BLOCK_SIZE))
        return base64.b64encode(iv + wrapped).decode('utf-8')

    def decrypt_content_key(self, encrypted_key_b64: str) -> bytes:
        """Unwrap a content key using the master key."""
        raw     = base64.b64decode(encrypted_key_b64.encode('utf-8'))
        iv      = raw[:self.IV_SIZE]
        wrapped = raw[self.IV_SIZE:]
        cipher  = AES.new(self._master_key, AES.MODE_CBC, iv)
        return unpad(cipher.decrypt(wrapped), self.BLOCK_SIZE)

    # ─────────────────────────────────────────
    # FILE ENCRYPTION  ← FIXED
    # ─────────────────────────────────────────

    def encrypt_file(
        self,
        input_path: str,
        output_path: str,
        key: bytes = None
    ) -> dict:
        """
        Encrypt a video file with AES-256-CBC.

        FIX: Read ALL data → pad ONCE → encrypt ONCE.
        This ensures a single, correct CBC ciphertext
        that can be fully decrypted later.

        File format written:
          [IV  : 16 bytes ]
          [key_id_len : 4 bytes big-endian]
          [key_id : key_id_len bytes     ]
          [ciphertext : N bytes          ]
        """
        # ── Generate / accept key ──────────────────────────
        if key is None:
            key, key_id = self.generate_content_key()
        else:
            key_id = secrets.token_hex(16)

        iv     = get_random_bytes(self.IV_SIZE)
        cipher = AES.new(key, AES.MODE_CBC, iv)

        # ── Read entire file ───────────────────────────────
        with open(input_path, 'rb') as f:
            plaintext = f.read()

        # ── Hash before encryption (integrity check) ───────
        file_hash = hashlib.sha256(plaintext).hexdigest()

        # ── Pad ONCE, encrypt ONCE ─────────────────────────
        padded_plaintext = pad(plaintext, self.BLOCK_SIZE)
        ciphertext       = cipher.encrypt(padded_plaintext)

        # ── Write encrypted file ───────────────────────────
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        key_id_bytes = key_id.encode('utf-8')

        with open(output_path, 'wb') as f:
            f.write(iv)                                          # 16 bytes
            f.write(len(key_id_bytes).to_bytes(4, 'big'))       #  4 bytes
            f.write(key_id_bytes)                               # variable
            f.write(ciphertext)                                 # ciphertext

        # ── Wrap content key with master key ───────────────
        encrypted_content_key = self.encrypt_content_key(key)

        result = {
            "key_id":         key_id,
            "encrypted_key":  encrypted_content_key,
            "iv":             base64.b64encode(iv).decode('utf-8'),
            "file_hash":      file_hash,
            "algorithm":      "AES-256-CBC"
        }

        logger.info(
            f"✅ File encrypted: {output_path} | "
            f"key_id={key_id} | "
            f"plain={len(plaintext)}B → cipher={len(ciphertext)}B"
        )
        return result

    def decrypt_file(
        self,
        input_path: str,
        output_path: str,
        encrypted_key: str,
        iv_b64: str
    ) -> bool:
        """
        Decrypt an AES-256-CBC encrypted video file.

        FIX: Read ALL ciphertext → decrypt ONCE → unpad ONCE.

        Used ONLY during authorized playback.
        Decrypted output is TEMPORARY (never stored permanently).
        """
        try:
            # ── Recover content key ────────────────────────
            content_key = self.decrypt_content_key(encrypted_key)

            # ── Read encrypted file ────────────────────────
            with open(input_path, 'rb') as f:
                # Skip header: IV (16) + key_id_len (4) + key_id (N)
                f.read(self.IV_SIZE)                       # skip stored IV
                key_id_len = int.from_bytes(f.read(4), 'big')
                f.read(key_id_len)                         # skip key_id
                ciphertext = f.read()                      # rest = ciphertext

            # ── Recover IV from parameter ──────────────────
            # NOTE: We use iv_b64 passed in (same IV used during encrypt)
            iv = base64.b64decode(iv_b64.encode('utf-8'))

            # ── Decrypt ONCE, unpad ONCE ───────────────────
            cipher    = AES.new(content_key, AES.MODE_CBC, iv)
            padded_pt = cipher.decrypt(ciphertext)
            plaintext = unpad(padded_pt, self.BLOCK_SIZE)

            # ── Write decrypted output ─────────────────────
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'wb') as f:
                f.write(plaintext)

            logger.info(
                f"✅ File decrypted: {output_path} | "
                f"cipher={len(ciphertext)}B → plain={len(plaintext)}B"
            )
            return True

        except Exception as e:
            logger.error(f"❌ Decryption failed: {e}")
            return False

    # ─────────────────────────────────────────
    # BYTE ENCRYPTION  (HLS segments)
    # ─────────────────────────────────────────

    def encrypt_bytes(self, data: bytes, key: bytes = None) -> dict:
        """Encrypt raw bytes (HLS segments). Pad once, encrypt once."""
        if key is None:
            key = self._master_key

        iv         = get_random_bytes(self.IV_SIZE)
        cipher     = AES.new(key, AES.MODE_CBC, iv)
        ciphertext = cipher.encrypt(pad(data, self.BLOCK_SIZE))

        return {
            "ciphertext": base64.b64encode(ciphertext).decode('utf-8'),
            "iv":         base64.b64encode(iv).decode('utf-8'),
            "algorithm":  "AES-256-CBC",
            "key_size":   f"{len(key) * 8}-bit"
        }

    def decrypt_bytes(
        self,
        ciphertext_b64: str,
        iv_b64: str,
        key: bytes = None
    ) -> bytes:
        """Decrypt raw bytes (HLS segments). Decrypt once, unpad once."""
        if key is None:
            key = self._master_key

        ciphertext = base64.b64decode(ciphertext_b64.encode('utf-8'))
        iv         = base64.b64decode(iv_b64.encode('utf-8'))
        cipher     = AES.new(key, AES.MODE_CBC, iv)
        return unpad(cipher.decrypt(ciphertext), self.BLOCK_SIZE)

    # ─────────────────────────────────────────
    # TEXT ENCRYPTION  (tokens, metadata)
    # ─────────────────────────────────────────

    def encrypt_text(self, plaintext: str) -> str:
        """Encrypt text. Returns base64(IV + ciphertext)."""
        iv         = get_random_bytes(self.IV_SIZE)
        cipher     = AES.new(self._master_key, AES.MODE_CBC, iv)
        ciphertext = cipher.encrypt(pad(plaintext.encode('utf-8'), self.BLOCK_SIZE))
        return base64.b64encode(iv + ciphertext).decode('utf-8')

    def decrypt_text(self, encrypted_b64: str) -> str:
        """Decrypt text. Expects base64(IV + ciphertext)."""
        raw        = base64.b64decode(encrypted_b64.encode('utf-8'))
        iv         = raw[:self.IV_SIZE]
        ciphertext = raw[self.IV_SIZE:]
        cipher     = AES.new(self._master_key, AES.MODE_CBC, iv)
        return unpad(cipher.decrypt(ciphertext), self.BLOCK_SIZE).decode('utf-8')

    # ─────────────────────────────────────────
    # UTILITIES
    # ─────────────────────────────────────────

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate cryptographically secure URL-safe token."""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password_file(file_path: str) -> str:
        """SHA-256 hash of a file for integrity verification."""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        return sha256.hexdigest()


# Singleton
encryption_service = EncryptionService()