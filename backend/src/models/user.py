"""
User Model
Equivalent to TypeScript's User.ts
Uses SQLAlchemy ORM instead of TypeORM entities
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from src.config.database import Base
import enum

class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"

class User(Base):
    __tablename__ = "users"
    
    sessions = relationship("Session", back_populates="user")
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Subscription
    subscription_tier = Column(
        Enum(SubscriptionTier), 
        default=SubscriptionTier.FREE
    )
    subscription_expires = Column(DateTime, nullable=True)
    
    # VR Device
    vr_device_id = Column(String(100), nullable=True)
    is_device_paired = Column(Boolean, default=False)
    
    # Account Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}')>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "subscription_tier": self.subscription_tier,
            "is_device_paired": self.is_device_paired,
            "created_at": self.created_at.isoformat()
        }