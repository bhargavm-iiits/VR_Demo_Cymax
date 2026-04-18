"""
Encryption Tests - FIXED VERSION

BUG FIXED: test_encrypt_decrypt_file_roundtrip
ROOT CAUSE: encrypt_file wrote IV into file header
            BUT decrypt_file also read iv_b64 parameter
            → the two IVs matched (both from result["iv"])
            → actual bug was chunked encryption padding

The real fix is in encryption_service.py (encrypt/decrypt once).
Test is also cleaned up to be more explicit.
"""

import pytest
import os
import sys
import base64
import hashlib
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from Crypto.Random import get_random_bytes
from src.services.encryption_service import EncryptionService


# ─────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def encryption_service():
    """EncryptionService with a random test master key."""
    svc = EncryptionService.__new__(EncryptionService)
    svc._master_key = get_random_bytes(32)
    svc.BLOCK_SIZE  = 16
    svc.KEY_SIZE    = 32
    svc.IV_SIZE     = 16
    return svc


@pytest.fixture
def sample_plaintext():
    return '{"movie_id": 42, "user_id": 7, "token": "vr-access-2024"}'


@pytest.fixture
def sample_binary_data():
    return os.urandom(1024)


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


# ─────────────────────────────────────────────────────────────
# KEY GENERATION TESTS (all passing — no changes needed)
# ─────────────────────────────────────────────────────────────

class TestKeyGeneration:

    def test_generate_content_key_returns_tuple(self, encryption_service):
        key, key_id = encryption_service.generate_content_key()
        assert isinstance(key, bytes)
        assert isinstance(key_id, str)

    def test_generated_key_correct_size(self, encryption_service):
        key, _ = encryption_service.generate_content_key()
        assert len(key) == 32

    def test_generated_key_id_unique(self, encryption_service):
        _, id1 = encryption_service.generate_content_key()
        _, id2 = encryption_service.generate_content_key()
        assert id1 != id2

    def test_generated_keys_are_unique(self, encryption_service):
        k1, _ = encryption_service.generate_content_key()
        k2, _ = encryption_service.generate_content_key()
        assert k1 != k2

    def test_generate_secure_token_length(self, encryption_service):
        token = encryption_service.generate_secure_token(32)
        assert len(token) >= 32

    def test_generate_multiple_secure_tokens_unique(self, encryption_service):
        tokens = {encryption_service.generate_secure_token() for _ in range(100)}
        assert len(tokens) == 100

    def test_key_derivation_from_password(self, encryption_service):
        password = "test_password_123"
        k1, salt = encryption_service.derive_key_from_password(password)
        k2, _    = encryption_service.derive_key_from_password(password, salt)
        assert k1 == k2

    def test_key_derivation_different_passwords(self, encryption_service):
        salt = get_random_bytes(16)
        k1, _ = encryption_service.derive_key_from_password("password1", salt)
        k2, _ = encryption_service.derive_key_from_password("password2", salt)
        assert k1 != k2

    def test_key_derivation_correct_size(self, encryption_service):
        key, _ = encryption_service.derive_key_from_password("test_pass")
        assert len(key) == 32


# ─────────────────────────────────────────────────────────────
# TEXT ENCRYPTION TESTS
# ─────────────────────────────────────────────────────────────

class TestTextEncryption:

    def test_encrypt_text_returns_string(self, encryption_service, sample_plaintext):
        assert isinstance(encryption_service.encrypt_text(sample_plaintext), str)

    def test_encrypt_text_not_plaintext(self, encryption_service, sample_plaintext):
        encrypted = encryption_service.encrypt_text(sample_plaintext)
        assert sample_plaintext not in encrypted

    def test_encrypt_decrypt_roundtrip(self, encryption_service, sample_plaintext):
        encrypted = encryption_service.encrypt_text(sample_plaintext)
        assert encryption_service.decrypt_text(encrypted) == sample_plaintext

    def test_encrypt_produces_different_ciphertexts(self, encryption_service, sample_plaintext):
        e1 = encryption_service.encrypt_text(sample_plaintext)
        e2 = encryption_service.encrypt_text(sample_plaintext)
        assert e1 != e2

    def test_decrypt_both_give_same_plaintext(self, encryption_service, sample_plaintext):
        e1 = encryption_service.encrypt_text(sample_plaintext)
        e2 = encryption_service.encrypt_text(sample_plaintext)
        assert encryption_service.decrypt_text(e1) == sample_plaintext
        assert encryption_service.decrypt_text(e2) == sample_plaintext

    def test_encrypt_empty_string(self, encryption_service):
        enc = encryption_service.encrypt_text("")
        assert encryption_service.decrypt_text(enc) == ""

    def test_encrypt_long_text(self, encryption_service):
        long_text = "VR Cinema Security Test " * 1000
        enc = encryption_service.encrypt_text(long_text)
        assert encryption_service.decrypt_text(enc) == long_text

    def test_encrypt_json_payload(self, encryption_service):
        import json
        payload = json.dumps({"user_id": 42, "movie_id": 7})
        enc = encryption_service.encrypt_text(payload)
        recovered = json.loads(encryption_service.decrypt_text(enc))
        assert recovered["user_id"] == 42

    def test_encrypt_unicode_text(self, encryption_service):
        text = "VR Cinéma - 映画館 - кино"
        enc = encryption_service.encrypt_text(text)
        assert encryption_service.decrypt_text(enc) == text

    def test_wrong_key_cannot_decrypt(self):
        def make_svc():
            s = EncryptionService.__new__(EncryptionService)
            s._master_key = get_random_bytes(32)
            s.BLOCK_SIZE = s.KEY_SIZE = s.IV_SIZE = 16
            s.KEY_SIZE = 32
            s.IV_SIZE  = 16
            return s

        s1, s2 = make_svc(), make_svc()
        encrypted = s1.encrypt_text("secret VR content")
        with pytest.raises(Exception):
            s2.decrypt_text(encrypted)


# ─────────────────────────────────────────────────────────────
# BYTE ENCRYPTION TESTS
# ─────────────────────────────────────────────────────────────

class TestByteEncryption:

    def test_encrypt_bytes_returns_dict(self, encryption_service, sample_binary_data):
        result = encryption_service.encrypt_bytes(sample_binary_data)
        for k in ["ciphertext", "iv", "algorithm", "key_size"]:
            assert k in result

    def test_encrypt_bytes_algorithm_label(self, encryption_service, sample_binary_data):
        assert encryption_service.encrypt_bytes(sample_binary_data)["algorithm"] == "AES-256-CBC"

    def test_encrypt_bytes_roundtrip(self, encryption_service, sample_binary_data):
        result = encryption_service.encrypt_bytes(sample_binary_data)
        assert encryption_service.decrypt_bytes(result["ciphertext"], result["iv"]) == sample_binary_data

    def test_encrypt_bytes_output_is_base64(self, encryption_service, sample_binary_data):
        result = encryption_service.encrypt_bytes(sample_binary_data)
        base64.b64decode(result["ciphertext"])  # should not raise
        base64.b64decode(result["iv"])

    def test_encrypt_hls_segment_size(self, encryption_service):
        segment = (b"\x47\x40\x00\x10" + b"\x00" * 184) * 100
        result  = encryption_service.encrypt_bytes(segment)
        assert encryption_service.decrypt_bytes(result["ciphertext"], result["iv"]) == segment

    def test_encrypt_empty_bytes_handled(self, encryption_service):
        result = encryption_service.encrypt_bytes(b"")
        assert encryption_service.decrypt_bytes(result["ciphertext"], result["iv"]) == b""

    def test_custom_key_encryption(self, encryption_service):
        key  = get_random_bytes(32)
        data = b"Custom key test data"
        result = encryption_service.encrypt_bytes(data, key=key)
        assert encryption_service.decrypt_bytes(result["ciphertext"], result["iv"], key=key) == data


# ─────────────────────────────────────────────────────────────
# CONTENT KEY MANAGEMENT TESTS
# ─────────────────────────────────────────────────────────────

class TestContentKeyManagement:

    def test_encrypt_content_key_returns_string(self, encryption_service):
        key = get_random_bytes(32)
        assert isinstance(encryption_service.encrypt_content_key(key), str)

    def test_content_key_roundtrip(self, encryption_service):
        key = get_random_bytes(32)
        enc = encryption_service.encrypt_content_key(key)
        assert encryption_service.decrypt_content_key(enc) == key

    def test_different_content_keys_different_encrypted(self, encryption_service):
        k1, k2 = get_random_bytes(32), get_random_bytes(32)
        assert encryption_service.encrypt_content_key(k1) != encryption_service.encrypt_content_key(k2)


# ─────────────────────────────────────────────────────────────
# FILE ENCRYPTION TESTS  ← FIXED
# ─────────────────────────────────────────────────────────────

class TestFileEncryption:

    def _write_file(self, path: str, data: bytes):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)

    def test_encrypt_file_creates_output(self, encryption_service, temp_dir):
        inp = os.path.join(temp_dir, "sub", "test.mp4")
        out = os.path.join(temp_dir, "sub", "test.enc")
        self._write_file(inp, b"FAKE_VIDEO_DATA_" * 100)
        result = encryption_service.encrypt_file(inp, out)
        assert os.path.exists(out)
        assert "key_id" in result

    def test_encrypt_file_metadata(self, encryption_service, temp_dir):
        inp = os.path.join(temp_dir, "sub2", "test.mp4")
        out = os.path.join(temp_dir, "sub2", "test.enc")
        self._write_file(inp, b"VIDEO_CONTENT_" * 50)
        result = encryption_service.encrypt_file(inp, out)
        for k in ["key_id", "encrypted_key", "iv", "file_hash", "algorithm"]:
            assert k in result, f"Missing key: {k}"

    def test_encrypt_file_algorithm_is_aes256(self, encryption_service, temp_dir):
        inp = os.path.join(temp_dir, "sub3", "test.mp4")
        out = os.path.join(temp_dir, "sub3", "test.enc")
        self._write_file(inp, b"x" * 1000)
        result = encryption_service.encrypt_file(inp, out)
        assert result["algorithm"] == "AES-256-CBC"

    def test_encrypt_file_output_different_from_input(self, encryption_service, temp_dir):
        inp = os.path.join(temp_dir, "sub4", "video.mp4")
        out = os.path.join(temp_dir, "sub4", "video.enc")
        original = b"RECOGNIZABLE_VIDEO_FRAME_DATA_123456789" * 100
        self._write_file(inp, original)
        encryption_service.encrypt_file(inp, out)
        with open(out, "rb") as f:
            encrypted = f.read()
        assert encrypted != original
        assert b"RECOGNIZABLE_VIDEO_FRAME_DATA" not in encrypted

    def test_file_hash_integrity(self, encryption_service, temp_dir):
        inp = os.path.join(temp_dir, "sub5", "test.mp4")
        out = os.path.join(temp_dir, "sub5", "test.enc")
        original = b"VR_VIDEO_CONTENT_" * 200
        self._write_file(inp, original)
        result = encryption_service.encrypt_file(inp, out)
        assert result["file_hash"] == hashlib.sha256(original).hexdigest()

    def test_encrypt_decrypt_file_roundtrip(self, encryption_service, temp_dir):
        """
        FIXED TEST:
        Verifies that encrypt_file → decrypt_file restores
        the exact original bytes.

        Fix in service: read-all → pad-once → encrypt-once
        This ensures a single valid CBC ciphertext with correct padding.
        """
        inp = os.path.join(temp_dir, "orig_sub", "original.mp4")
        enc = os.path.join(temp_dir, "enc_sub",  "encrypted.enc")
        dec = os.path.join(temp_dir, "dec_sub",  "decrypted.mp4")

        original_data = b"VR_SECURE_VIDEO_FRAME_DATA_" * 500  # ~13 KB

        self._write_file(inp, original_data)

        # Step 1 — Encrypt
        result = encryption_service.encrypt_file(inp, enc)
        assert os.path.exists(enc), "Encrypted file not created"

        # Step 2 — Decrypt using returned key + IV
        success = encryption_service.decrypt_file(
            input_path=enc,
            output_path=dec,
            encrypted_key=result["encrypted_key"],
            iv_b64=result["iv"]
        )

        assert success is True, "decrypt_file returned False"
        assert os.path.exists(dec), "Decrypted file not created"

        with open(dec, "rb") as f:
            recovered = f.read()

        assert recovered == original_data, (
            f"Data mismatch! "
            f"Original {len(original_data)}B vs Recovered {len(recovered)}B"
        )

    def test_encrypt_decrypt_small_file(self, encryption_service, temp_dir):
        """Small file (less than one block) must roundtrip correctly."""
        inp = os.path.join(temp_dir, "small_sub", "small.mp4")
        enc = os.path.join(temp_dir, "small_sub", "small.enc")
        dec = os.path.join(temp_dir, "small_sub", "small_dec.mp4")

        original = b"TINY"
        self._write_file(inp, original)

        result = encryption_service.encrypt_file(inp, enc)
        success = encryption_service.decrypt_file(enc, dec, result["encrypted_key"], result["iv"])

        assert success is True
        with open(dec, "rb") as f:
            assert f.read() == original

    def test_encrypt_decrypt_exact_block_size(self, encryption_service, temp_dir):
        """File exactly = one AES block (16 bytes) must roundtrip correctly."""
        inp = os.path.join(temp_dir, "block_sub", "block.mp4")
        enc = os.path.join(temp_dir, "block_sub", "block.enc")
        dec = os.path.join(temp_dir, "block_sub", "block_dec.mp4")

        original = b"A" * 16   # Exactly one AES block
        self._write_file(inp, original)

        result = encryption_service.encrypt_file(inp, enc)
        success = encryption_service.decrypt_file(enc, dec, result["encrypted_key"], result["iv"])

        assert success is True
        with open(dec, "rb") as f:
            assert f.read() == original

    def test_encrypt_decrypt_large_file(self, encryption_service, temp_dir):
        """Large file (1 MB) must roundtrip correctly."""
        inp = os.path.join(temp_dir, "large_sub", "large.mp4")
        enc = os.path.join(temp_dir, "large_sub", "large.enc")
        dec = os.path.join(temp_dir, "large_sub", "large_dec.mp4")

        original = os.urandom(1024 * 1024)  # 1 MB random
        self._write_file(inp, original)

        result  = encryption_service.encrypt_file(inp, enc)
        success = encryption_service.decrypt_file(enc, dec, result["encrypted_key"], result["iv"])

        assert success is True
        with open(dec, "rb") as f:
            assert f.read() == original


# ─────────────────────────────────────────────────────────────
# SECURITY PROPERTY TESTS
# ─────────────────────────────────────────────────────────────

class TestSecurityProperties:

    def test_iv_is_random_each_encryption(self, encryption_service):
        """Each encryption must use a unique IV."""
        text = "same text every time"
        ivs  = set()
        for _ in range(10):
            enc     = encryption_service.encrypt_text(text)
            decoded = base64.b64decode(enc)
            ivs.add(decoded[:16].hex())
        assert len(ivs) == 10

    def test_ciphertext_length_multiple_of_block_size(self, encryption_service):
        for n in [1, 5, 16, 17, 32, 100]:
            enc     = encryption_service.encrypt_text("A" * n)
            decoded = base64.b64decode(enc)
            cipher  = decoded[16:]   # skip IV
            assert len(cipher) % 16 == 0

    def test_no_plaintext_patterns_in_ciphertext(self, encryption_service):
        """CBC mode: identical plaintext blocks → different ciphertext blocks."""
        plaintext = "BLOCK_OF_16_BYTE" * 10
        result    = encryption_service.encrypt_bytes(plaintext.encode())
        ciphertext = base64.b64decode(result["ciphertext"])
        blocks     = [ciphertext[i:i+16] for i in range(0, len(ciphertext), 16)]
        assert len(set(blocks)) == len(blocks)

    def test_bit_flip_in_ciphertext_corrupts_decryption(self, encryption_service):
        """Modified ciphertext must cause decryption to raise."""
        enc    = encryption_service.encrypt_text("VR Cinema Secure Content")
        raw    = bytearray(base64.b64decode(enc))
        raw[20] ^= 0xFF
        corrupted = base64.b64encode(bytes(raw)).decode()
        with pytest.raises(Exception):
            encryption_service.decrypt_text(corrupted)

    def test_key_strength_256_bits(self, encryption_service):
        """Master key must be 32 bytes (256 bits)."""
        assert len(encryption_service._master_key) == 32

    def test_encrypt_produces_longer_output(self, encryption_service):
        """Output must be longer than input (IV + padding)."""
        enc    = encryption_service.encrypt_text("short")
        decoded = base64.b64decode(enc)
        assert len(decoded) > 5