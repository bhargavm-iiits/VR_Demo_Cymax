"""
Device Pairing Service
Handles VR headset ↔ Web Controller pairing
"""

import secrets
import string
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class PairingService:
    
    # Store active pairing codes (use Redis in production)
    _pairing_codes: dict = {}
    
    def generate_pairing_code(self, session_id: int) -> str:
        """
        Generate 6-digit pairing code for VR headset
        User enters this code in web controller to pair devices
        """
        # Generate 6-character alphanumeric code
        code = ''.join(secrets.choice(
            string.ascii_uppercase + string.digits
        ) for _ in range(6))
        
        # Store with expiry (10 minutes)
        self._pairing_codes[code] = {
            "session_id": session_id,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "is_used": False
        }
        
        logger.info(f"🔗 Pairing code generated: {code} for session {session_id}")
        return code
    
    def verify_pairing_code(self, code: str) -> Optional[dict]:
        """Verify pairing code and return session info"""
        if code not in self._pairing_codes:
            return None
        
        pairing_info = self._pairing_codes[code]
        
        # Check expiry
        if datetime.utcnow() > pairing_info["expires_at"]:
            del self._pairing_codes[code]
            logger.warning(f"⚠️ Pairing code expired: {code}")
            return None
        
        # Check if already used
        if pairing_info["is_used"]:
            logger.warning(f"⚠️ Pairing code already used: {code}")
            return None
        
        # Mark as used
        pairing_info["is_used"] = True
        logger.info(f"✅ Device paired with code: {code}")
        
        return pairing_info
    
    def get_active_pairs_count(self) -> int:
        """Get count of active pairings"""
        now = datetime.utcnow()
        return sum(
            1 for p in self._pairing_codes.values() 
            if not p["is_used"] and p["expires_at"] > now
        )

# Singleton
pairing_service = PairingService()