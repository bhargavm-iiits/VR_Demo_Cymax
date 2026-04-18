"""
Environment Configuration
Equivalent to TypeScript's environment.ts
Uses python-dotenv instead of dotenv npm package
"""

import os
from dotenv import load_dotenv
from dataclasses import dataclass

load_dotenv()

@dataclass
class Environment:
    # Server Config
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Database Config
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./vr_cinema.db"
    )
    
    # JWT Config
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-super-secret-key-change-this")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
    
    # AES Encryption Config
    AES_KEY: str = os.getenv("AES_KEY", "0" * 64)  # 32 bytes hex = 256-bit
    AES_MODE: str = os.getenv("AES_MODE", "CBC")
    
    # Streaming Config
    STREAM_TOKEN_EXPIRY: int = int(os.getenv("STREAM_TOKEN_EXPIRY", "3600"))
    HLS_SEGMENT_DURATION: int = int(os.getenv("HLS_SEGMENT_DURATION", "6"))
    
    # Content Vault
    CONTENT_VAULT_PATH: str = os.getenv("CONTENT_VAULT_PATH", "./vault/encrypted")
    TEMP_DECRYPT_PATH: str = os.getenv("TEMP_DECRYPT_PATH", "./vault/temp")
    
    # Redis Config (for session management)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

# Singleton instance
env = Environment()