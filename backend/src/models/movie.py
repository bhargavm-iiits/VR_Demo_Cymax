"""
Movie Model
Equivalent to TypeScript's Movie.ts
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Enum
from datetime import datetime
from src.config.database import Base
import enum

class ContentRating(str, enum.Enum):
    G = "G"
    PG = "PG"
    PG13 = "PG-13"
    R = "R"
    NC17 = "NC-17"

class Movie(Base):
    __tablename__ = "movies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    
    # Content
    genre = Column(String(100), nullable=True)
    rating = Column(Enum(ContentRating), default=ContentRating.PG)
    release_year = Column(Integer, nullable=True)
    
    # File Information
    encrypted_file_path = Column(String(500), nullable=False)
    encryption_key_id = Column(String(100), nullable=False)  # Reference to key vault
    file_size_bytes = Column(Integer, nullable=True)
    
    # HLS Streaming
    hls_manifest_path = Column(String(500), nullable=True)
    is_hls_ready = Column(Boolean, default=False)
    
    # VR Specific
    is_360_video = Column(Boolean, default=False)
    vr_format = Column(String(50), nullable=True)  # "mono", "stereo_lr", "stereo_tb"
    
    # Metadata
    thumbnail_url = Column(String(500), nullable=True)
    required_subscription = Column(String(20), default="basic")
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "duration_minutes": self.duration_minutes,
            "genre": self.genre,
            "rating": self.rating,
            "is_360_video": self.is_360_video,
            "thumbnail_url": self.thumbnail_url,
        }