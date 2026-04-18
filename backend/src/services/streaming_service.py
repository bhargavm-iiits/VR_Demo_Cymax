"""
Streaming Service
Handles HLS token generation and secure stream URLs
Equivalent to TypeScript's streamingService.ts
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from src.config.environment import env
from src.services.encryption_service import encryption_service
import logging

logger = logging.getLogger(__name__)

class StreamingService:
    
    def generate_stream_token(self, user_id: int, movie_id: int, 
                               session_id: int) -> dict:
        """
        Generate a time-limited streaming token
        This token authorizes HLS stream access
        """
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(
            seconds=env.STREAM_TOKEN_EXPIRY
        )
        
        # Create signed payload
        payload = {
            "token": token,
            "user_id": user_id,
            "movie_id": movie_id,
            "session_id": session_id,
            "expires_at": expires_at.isoformat(),
            "type": "stream_access"
        }
        
        # Encrypt the payload
        import json
        encrypted_token = encryption_service.encrypt_text(json.dumps(payload))
        
        logger.info(f"🎬 Stream token generated for user {user_id}, movie {movie_id}")
        
        return {
            "stream_token": encrypted_token,
            "expires_at": expires_at.isoformat(),
            "stream_url": f"/api/stream/{movie_id}/manifest.m3u8",
            "token_type": "bearer"
        }
    
    def verify_stream_token(self, encrypted_token: str) -> Optional[dict]:
        """
        Verify and decode a streaming token
        """
        try:
            import json
            payload_str = encryption_service.decrypt_text(encrypted_token)
            payload = json.loads(payload_str)
            
            # Check expiry
            expires_at = datetime.fromisoformat(payload["expires_at"])
            if datetime.utcnow() > expires_at:
                logger.warning("⚠️ Stream token expired")
                return None
            
            return payload
        except Exception as e:
            logger.error(f"❌ Stream token verification failed: {e}")
            return None
    
    def generate_hls_key_url(self, movie_id: int, token: str) -> str:
        """Generate URL for HLS encryption key delivery"""
        return f"/api/stream/{movie_id}/key?token={token}"
    
    def create_m3u8_manifest(self, movie_id: int, 
                              segments: list, token: str) -> str:
        """
        Create HLS manifest file with encryption
        Each segment references encrypted key URL
        """
        key_url = self.generate_hls_key_url(movie_id, token)
        
        manifest = "#EXTM3U\n"
        manifest += "#EXT-X-VERSION:3\n"
        manifest += f"#EXT-X-TARGETDURATION:{env.HLS_SEGMENT_DURATION}\n"
        manifest += "#EXT-X-MEDIA-SEQUENCE:0\n"
        
        # Add encryption info
        manifest += f'#EXT-X-KEY:METHOD=AES-128,'
        manifest += f'URI="{key_url}",IV=0x00000000000000000000000000000000\n'
        
        for i, segment in enumerate(segments):
            manifest += f"#EXTINF:{env.HLS_SEGMENT_DURATION}.0,\n"
            manifest += f"/api/stream/{movie_id}/segment_{i:04d}.ts?token={token}\n"
        
        manifest += "#EXT-X-ENDLIST\n"
        return manifest

# Singleton
streaming_service = StreamingService()