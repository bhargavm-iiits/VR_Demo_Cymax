"""
Database Configuration
Equivalent to TypeScript's database.ts
Uses SQLAlchemy instead of TypeORM/Prisma
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from src.config.environment import env
import logging

logger = logging.getLogger(__name__)

# Create SQLAlchemy engine
engine = create_engine(
    env.DATABASE_URL,
    # For SQLite (development)
    connect_args={"check_same_thread": False} 
    if "sqlite" in env.DATABASE_URL else {},
    echo=env.DEBUG,  # Log SQL queries in debug mode
    pool_pre_ping=True,  # Verify connections before use
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

# Base class for all models
Base = declarative_base()

def get_db():
    """
    Dependency injection for database sessions
    Used with FastAPI's Depends()
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

async def init_db():
    """Initialize database - create all tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise