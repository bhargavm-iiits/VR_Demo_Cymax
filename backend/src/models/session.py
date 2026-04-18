"""
Session Model
Equivalent to TypeScript's Session.ts
Tracks active VR streaming sessions
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from src.config.database import Base

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_token = Column(String(500), unique=True, nullable=False, index=True)
    
    # Foreign Keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    movie_id = Column(Integer, nullable=True)
    
    user = relationship("User", back_populates="sessions")
    
    # Device Info
    vr_device_id = Column(String(100), nullable=True)
    web_controller_id = Column(String(100), nullable=True)
    pairing_code = Column(String(10), nullable=True)  # 6-digit pairing code
    
    # Playback State
    playback_state = Column(String(20), default="idle")  # idle/playing/paused/stopped
    current_position_seconds = Column(Integer, default=0)
    volume_level = Column(Integer, default=80)  # 0-100
    
    # Streaming
    stream_token = Column(String(500), nullable=True)
    stream_token_expires = Column(DateTime, nullable=True)
    
    # Security
    is_active = Column(Boolean, default=True)
    ip_address = Column(String(50), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_activity = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at
    
    def to_dict(self):
        return {
            "session_token": self.session_token,
            "playback_state": self.playback_state,
            "current_position": self.current_position_seconds,
            "volume": self.volume_level,
            "is_active": self.is_active,
        }