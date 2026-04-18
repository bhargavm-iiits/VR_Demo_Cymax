"""
Main Server Entry Point
Equivalent to TypeScript's server.ts
Uses FastAPI instead of Express.js
"""

import logging
import uvicorn
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from src.config.environment import env
from src.config.database import init_db
from src.routes.auth_routes import router as auth_router
from src.routes.movie_routes import router as movie_router
from src.routes.stream_routes import router as stream_router
from src.websocket.socket_manager import sio

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if env.DEBUG else logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    try:
        logger.info("🚀 Starting VR Cinema Backend...")
        logger.info("📡 Initializing database...")
        await init_db()
        logger.info(f"✅ Server ready")
        yield
    except Exception as e:
        logger.error(f"❌ CRITICAL STARTUP ERROR: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise e
    finally:
        logger.info("🔴 Shutting down VR Cinema Backend...")

# Create FastAPI app
app = FastAPI(
    title="VR Cinema Backend API",
    description="Secure VR Video Streaming Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(movie_router)
app.include_router(stream_router)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "VR Cinema Backend",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(
        "src.server:socket_app",
        host=env.HOST,
        port=env.PORT,
        reload=env.DEBUG,
        log_level="debug" if env.DEBUG else "info"
    )
