"""
Streaming Tests
Tests for:
  - Stream token generation
  - Stream token verification
  - Token expiry
  - HLS manifest generation
  - Device pairing service
  - Playback command validation

Run: pytest tests/test_streaming.py -v
"""

import pytest
import sys
import os
import json
import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.streaming_service import StreamingService
from src.services.pairing_service import PairingService
from src.websocket.command_handler import CommandHandler, PlaybackCommand


# ─────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def streaming_service():
    """Create fresh StreamingService instance."""
    return StreamingService()


@pytest.fixture
def pairing_service():
    """Create fresh PairingService instance."""
    service = PairingService()
    service._pairing_codes = {}  # Clear state
    return service


@pytest.fixture
def command_handler():
    """Create fresh CommandHandler instance."""
    return CommandHandler()


@pytest.fixture
def sample_token_params():
    """Standard parameters for stream token generation."""
    return {
        "user_id": 42,
        "movie_id": 7,
        "session_id": 101
    }


# ─────────────────────────────────────────────────────────────
# STREAM TOKEN GENERATION TESTS
# ─────────────────────────────────────────────────────────────

class TestStreamTokenGeneration:
    """Tests for streaming token creation."""

    def test_generate_token_returns_dict(self, streaming_service, sample_token_params):
        """Token generation should return a dictionary."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        assert isinstance(result, dict)

    def test_generate_token_required_keys(self, streaming_service, sample_token_params):
        """Token dict must contain all required keys."""
        result = streaming_service.generate_stream_token(**sample_token_params)

        required_keys = ["stream_token", "expires_at", "stream_url", "token_type"]
        for key in required_keys:
            assert key in result, f"Missing key: {key}"

    def test_generate_token_type_is_bearer(self, streaming_service, sample_token_params):
        """Token type should be 'bearer'."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        assert result["token_type"] == "bearer"

    def test_generate_token_stream_url_format(self, streaming_service, sample_token_params):
        """Stream URL should contain correct movie ID."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        assert str(sample_token_params["movie_id"]) in result["stream_url"]
        assert ".m3u8" in result["stream_url"]

    def test_generate_token_expires_in_future(self, streaming_service, sample_token_params):
        """Token expiry should be in the future."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        expires_at = datetime.fromisoformat(result["expires_at"])
        assert expires_at > datetime.utcnow()

    def test_generate_token_different_users(self, streaming_service):
        """Different users should get different tokens."""
        token1 = streaming_service.generate_stream_token(1, 7, 100)["stream_token"]
        token2 = streaming_service.generate_stream_token(2, 7, 101)["stream_token"]
        assert token1 != token2

    def test_generate_token_different_movies(self, streaming_service):
        """Same user requesting different movies gets different tokens."""
        token1 = streaming_service.generate_stream_token(1, 7, 100)["stream_token"]
        token2 = streaming_service.generate_stream_token(1, 8, 100)["stream_token"]
        assert token1 != token2

    def test_generate_multiple_tokens_all_unique(self, streaming_service):
        """Generating 50 tokens should all be unique."""
        tokens = set()
        for i in range(50):
            result = streaming_service.generate_stream_token(i, 1, i)
            tokens.add(result["stream_token"])
        assert len(tokens) == 50


# ─────────────────────────────────────────────────────────────
# STREAM TOKEN VERIFICATION TESTS
# ─────────────────────────────────────────────────────────────

class TestStreamTokenVerification:
    """Tests for streaming token validation."""

    def test_verify_valid_token_returns_payload(
        self, streaming_service, sample_token_params
    ):
        """Valid token should return decoded payload."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        payload = streaming_service.verify_stream_token(result["stream_token"])

        assert payload is not None

    def test_verify_token_payload_contains_user_id(
        self, streaming_service, sample_token_params
    ):
        """Verified payload should contain correct user_id."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        payload = streaming_service.verify_stream_token(result["stream_token"])

        assert payload["user_id"] == sample_token_params["user_id"]

    def test_verify_token_payload_contains_movie_id(
        self, streaming_service, sample_token_params
    ):
        """Verified payload should contain correct movie_id."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        payload = streaming_service.verify_stream_token(result["stream_token"])

        assert payload["movie_id"] == sample_token_params["movie_id"]

    def test_verify_invalid_token_returns_none(self, streaming_service):
        """Invalid token string should return None."""
        result = streaming_service.verify_stream_token("invalid_garbage_token")
        assert result is None

    def test_verify_empty_token_returns_none(self, streaming_service):
        """Empty string token should return None."""
        result = streaming_service.verify_stream_token("")
        assert result is None

    def test_verify_truncated_token_returns_none(self, streaming_service, sample_token_params):
        """Truncated token should fail verification."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        truncated = result["stream_token"][:20]
        assert streaming_service.verify_stream_token(truncated) is None

    def test_verify_modified_token_returns_none(self, streaming_service, sample_token_params):
        """
        Tampered token (modified ciphertext) should fail decryption.
        Tests that we can't forge stream tokens.
        """
        result = streaming_service.generate_stream_token(**sample_token_params)
        token = result["stream_token"]

        # Modify middle character
        mid = len(token) // 2
        tampered = token[:mid] + ("A" if token[mid] != "A" else "B") + token[mid+1:]

        verified = streaming_service.verify_stream_token(tampered)
        assert verified is None

    def test_verify_token_type_is_stream_access(
        self, streaming_service, sample_token_params
    ):
        """Verified payload should have correct token type."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        payload = streaming_service.verify_stream_token(result["stream_token"])

        assert payload["type"] == "stream_access"

    def test_token_contains_expiry(self, streaming_service, sample_token_params):
        """Token payload should contain expires_at timestamp."""
        result = streaming_service.generate_stream_token(**sample_token_params)
        payload = streaming_service.verify_stream_token(result["stream_token"])

        assert "expires_at" in payload

    def test_verify_token_isolation(self, streaming_service):
        """
        Token for movie A should not validate as movie B.
        Tests token binding to specific content.
        """
        token_movie_a = streaming_service.generate_stream_token(1, 10, 100)
        token_movie_b = streaming_service.generate_stream_token(1, 20, 100)

        payload_a = streaming_service.verify_stream_token(
            token_movie_a["stream_token"]
        )
        payload_b = streaming_service.verify_stream_token(
            token_movie_b["stream_token"]
        )

        assert payload_a["movie_id"] != payload_b["movie_id"]
        assert payload_a["movie_id"] == 10
        assert payload_b["movie_id"] == 20


# ─────────────────────────────────────────────────────────────
# HLS MANIFEST TESTS
# ─────────────────────────────────────────────────────────────

class TestHLSManifest:
    """Tests for HLS manifest generation."""

    def test_manifest_starts_with_extm3u(self, streaming_service):
        """Valid M3U8 manifest must start with #EXTM3U."""
        segments = ["segment_0000", "segment_0001", "segment_0002"]
        manifest = streaming_service.create_m3u8_manifest(1, segments, "test-token")
        assert manifest.startswith("#EXTM3U")

    def test_manifest_contains_version(self, streaming_service):
        """Manifest must declare HLS version."""
        segments = ["segment_0000"]
        manifest = streaming_service.create_m3u8_manifest(1, segments, "token")
        assert "#EXT-X-VERSION" in manifest

    def test_manifest_contains_encryption_key_uri(self, streaming_service):
        """
        Manifest must reference encryption key URL.
        This is what enables HLS + AES-128 encryption.
        """
        segments = ["segment_0000", "segment_0001"]
        manifest = streaming_service.create_m3u8_manifest(7, segments, "auth-token")

        assert "#EXT-X-KEY" in manifest
        assert "METHOD=AES-128" in manifest
        assert "URI=" in manifest

    def test_manifest_key_url_contains_token(self, streaming_service):
        """Key URL must include the auth token."""
        segments = ["segment_0000"]
        test_token = "test-stream-token-12345"
        manifest = streaming_service.create_m3u8_manifest(1, segments, test_token)

        assert test_token in manifest

    def test_manifest_contains_all_segments(self, streaming_service):
        """Manifest should reference all provided segments."""
        segments = [f"segment_{i:04d}" for i in range(5)]
        manifest = streaming_service.create_m3u8_manifest(1, segments, "token")

        for segment in segments:
            assert segment in manifest

    def test_manifest_segment_urls_contain_token(self, streaming_service):
        """Each segment URL must include auth token."""
        segments = ["segment_0000", "segment_0001"]
        token = "secure-token-xyz"
        manifest = streaming_service.create_m3u8_manifest(1, segments, token)

        # Count token occurrences (should appear in each segment URL + key URL)
        assert manifest.count(token) >= len(segments)

    def test_manifest_ends_with_endlist(self, streaming_service):
        """Manifest must end with #EXT-X-ENDLIST for VOD content."""
        segments = ["segment_0000"]
        manifest = streaming_service.create_m3u8_manifest(1, segments, "token")
        assert manifest.strip().endswith("#EXT-X-ENDLIST")

    def test_manifest_contains_extinf(self, streaming_service):
        """Each segment must be preceded by #EXTINF duration tag."""
        segments = ["segment_0000", "segment_0001", "segment_0002"]
        manifest = streaming_service.create_m3u8_manifest(1, segments, "token")

        extinf_count = manifest.count("#EXTINF")
        assert extinf_count == len(segments)

    def test_manifest_empty_segments(self, streaming_service):
        """Empty segment list should produce minimal valid manifest."""
        manifest = streaming_service.create_m3u8_manifest(1, [], "token")
        assert "#EXTM3U" in manifest
        assert "#EXT-X-ENDLIST" in manifest

    def test_manifest_movie_id_in_segment_urls(self, streaming_service):
        """Segment URLs must contain the correct movie ID."""
        movie_id = 42
        segments = ["segment_0000"]
        manifest = streaming_service.create_m3u8_manifest(movie_id, segments, "token")

        assert str(movie_id) in manifest


# ─────────────────────────────────────────────────────────────
# DEVICE PAIRING TESTS
# ─────────────────────────────────────────────────────────────

class TestDevicePairing:
    """Tests for VR headset ↔ Web Controller pairing."""

    def test_generate_pairing_code_format(self, pairing_service):
        """Pairing code should be 6 uppercase alphanumeric characters."""
        code = pairing_service.generate_pairing_code(session_id=1)
        assert len(code) == 6
        assert code.isupper() or code.isdigit() or code.isalnum()

    def test_generate_pairing_code_is_alphanumeric(self, pairing_service):
        """Pairing code should only contain letters and digits."""
        code = pairing_service.generate_pairing_code(session_id=1)
        assert code.isalnum()

    def test_generate_pairing_codes_are_unique(self, pairing_service):
        """Multiple pairing codes should be unique."""
        codes = set()
        for i in range(20):
            code = pairing_service.generate_pairing_code(session_id=i)
            codes.add(code)

        # All codes should be unique (with very high probability)
        assert len(codes) >= 18

    def test_verify_valid_pairing_code(self, pairing_service):
        """Valid, unused, non-expired code should verify successfully."""
        code = pairing_service.generate_pairing_code(session_id=42)
        result = pairing_service.verify_pairing_code(code)

        assert result is not None
        assert result["session_id"] == 42

    def test_verify_invalid_pairing_code(self, pairing_service):
        """Non-existent code should return None."""
        result = pairing_service.verify_pairing_code("XXXXXX")
        assert result is None

    def test_verify_code_only_once(self, pairing_service):
        """
        Pairing code should be single-use.
        Second use should fail.
        """
        code = pairing_service.generate_pairing_code(session_id=1)

        first_result = pairing_service.verify_pairing_code(code)
        assert first_result is not None

        second_result = pairing_service.verify_pairing_code(code)
        assert second_result is None

    def test_verify_expired_pairing_code(self, pairing_service):
        """Expired pairing code should return None."""
        code = pairing_service.generate_pairing_code(session_id=1)

        # Manually expire the code
        pairing_service._pairing_codes[code]["expires_at"] = (
            datetime.utcnow() - timedelta(minutes=1)
        )

        result = pairing_service.verify_pairing_code(code)
        assert result is None

    def test_pairing_code_stored_with_session_id(self, pairing_service):
        """Generated code should be stored with correct session_id."""
        session_id = 999
        code = pairing_service.generate_pairing_code(session_id=session_id)

        assert code in pairing_service._pairing_codes
        assert pairing_service._pairing_codes[code]["session_id"] == session_id

    def test_pairing_code_not_used_initially(self, pairing_service):
        """Newly generated code should have is_used=False."""
        code = pairing_service.generate_pairing_code(session_id=1)
        assert pairing_service._pairing_codes[code]["is_used"] is False

    def test_active_pairs_count(self, pairing_service):
        """Active pairs count should reflect generated codes."""
        initial_count = pairing_service.get_active_pairs_count()

        pairing_service.generate_pairing_code(session_id=1)
        pairing_service.generate_pairing_code(session_id=2)

        assert pairing_service.get_active_pairs_count() == initial_count + 2


# ─────────────────────────────────────────────────────────────
# PLAYBACK COMMAND HANDLER TESTS
# ─────────────────────────────────────────────────────────────

class TestCommandHandler:
    """Tests for VR playback command validation and formatting."""

    def test_validate_play_command(self, command_handler):
        """Play command should validate successfully."""
        cmd = command_handler.validate_command("play", {})
        assert cmd.command == PlaybackCommand.PLAY

    def test_validate_pause_command(self, command_handler):
        """Pause command should validate successfully."""
        cmd = command_handler.validate_command("pause", {})
        assert cmd.command == PlaybackCommand.PAUSE

    def test_validate_stop_command(self, command_handler):
        """Stop command should validate successfully."""
        cmd = command_handler.validate_command("stop", {})
        assert cmd.command == PlaybackCommand.STOP

    def test_validate_seek_command_with_position(self, command_handler):
        """Seek command with position should validate."""
        cmd = command_handler.validate_command(
            "seek", {"position_seconds": 120.5}
        )
        assert cmd.command == PlaybackCommand.SEEK
        assert cmd.position_seconds == 120.5

    def test_validate_volume_command(self, command_handler):
        """Volume command with level should validate."""
        cmd = command_handler.validate_command(
            "volume", {"volume_level": 75}
        )
        assert cmd.command == PlaybackCommand.VOLUME
        assert cmd.volume_level == 75

    def test_validate_invalid_command_raises(self, command_handler):
        """Unknown command string should raise ValueError."""
        with pytest.raises(ValueError) as exc_info:
            command_handler.validate_command("fly", {})
        assert "fly" in str(exc_info.value).lower()

    def test_validate_load_movie_command(self, command_handler):
        """Load movie command should include movie_id."""
        cmd = command_handler.validate_command(
            "load_movie", {"movie_id": 42}
        )
        assert cmd.command == PlaybackCommand.LOAD_MOVIE
        assert cmd.movie_id == 42

    def test_format_play_command(self, command_handler):
        """Formatted play command should have correct action."""
        cmd = command_handler.validate_command("play", {})
        formatted = command_handler.format_vr_command(cmd)
        assert formatted["action"] == "play"

    def test_format_seek_command_includes_position(self, command_handler):
        """Formatted seek command must include seek position."""
        cmd = command_handler.validate_command(
            "seek", {"position_seconds": 300.0}
        )
        formatted = command_handler.format_vr_command(cmd)
        assert formatted["params"]["seek_to"] == 300.0

    def test_format_volume_command_includes_level(self, command_handler):
        """Formatted volume command must include volume level."""
        cmd = command_handler.validate_command(
            "volume", {"volume_level": 50}
        )
        formatted = command_handler.format_vr_command(cmd)
        assert formatted["params"]["volume"] == 50

    def test_all_valid_commands_accepted(self, command_handler):
        """All defined PlaybackCommand values should be accepted."""
        valid_commands = ["play", "pause", "stop", "seek", "volume",
                         "load_movie", "get_status"]

        for cmd_str in valid_commands:
            cmd = command_handler.validate_command(cmd_str, {})
            assert cmd.command.value == cmd_str

    def test_command_enum_values(self):
        """PlaybackCommand enum should have all required values."""
        required = {"play", "pause", "stop", "seek", "volume",
                   "load_movie", "get_status"}
        actual = {cmd.value for cmd in PlaybackCommand}
        assert required == actual


# ─────────────────────────────────────────────────────────────
# INTEGRATION-STYLE TESTS
# ─────────────────────────────────────────────────────────────

class TestStreamingIntegration:
    """
    Integration-style tests combining multiple components.
    Simulates real user streaming workflow.
    """

    def test_full_streaming_workflow(self, streaming_service):
        """
        Simulate complete streaming workflow:
        1. User requests stream token
        2. Token is verified
        3. Manifest is generated
        4. Tokens are included correctly
        """
        # Step 1: Generate stream token
        user_id, movie_id = 42, 7
        token_result = streaming_service.generate_stream_token(
            user_id=user_id,
            movie_id=movie_id,
            session_id=100
        )

        assert token_result["stream_token"] is not None

        # Step 2: Verify token
        payload = streaming_service.verify_stream_token(
            token_result["stream_token"]
        )

        assert payload is not None
        assert payload["user_id"] == user_id
        assert payload["movie_id"] == movie_id

        # Step 3: Generate manifest with token
        segments = [f"segment_{i:04d}" for i in range(5)]
        manifest = streaming_service.create_m3u8_manifest(
            movie_id=movie_id,
            segments=segments,
            token=token_result["stream_token"]
        )

        # Step 4: Verify manifest correctness
        assert "#EXTM3U" in manifest
        assert "AES-128" in manifest
        assert str(movie_id) in manifest
        assert "#EXT-X-ENDLIST" in manifest

    def test_full_pairing_workflow(self, pairing_service):
        """
        Simulate complete device pairing workflow:
        1. Web controller generates pairing code
        2. User enters code on VR headset
        3. Code verified → devices linked
        4. Code cannot be reused
        """
        session_id = 42

        # Step 1: Web controller generates code
        code = pairing_service.generate_pairing_code(session_id=session_id)
        assert len(code) == 6

        # Step 2 & 3: VR headset verifies code
        result = pairing_service.verify_pairing_code(code)
        assert result is not None
        assert result["session_id"] == session_id

        # Step 4: Code cannot be reused
        second_attempt = pairing_service.verify_pairing_code(code)
        assert second_attempt is None