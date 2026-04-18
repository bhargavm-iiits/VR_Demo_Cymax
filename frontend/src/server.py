"""
Main Server - Fixed
"""
import logging
import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from src.config.environment import env
from src.config.database import init_db
from src.routes.auth_routes import router as auth_router
from src.middleware.auth_middleware import get_current_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting VR Cinema Backend...")
    await init_db()
    logger.info(f"✅ Server ready on {env.HOST}:{env.PORT}")
    yield
    logger.info("🔴 Shutting down...")


app = FastAPI(
    title="VR Cinema API",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────
app.include_router(auth_router)


# ── Health ───────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "VR Cinema Backend"}


# ── Auth/Me ──────────────────────────────────────────────────
@app.get("/api/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "subscription_tier": current_user.subscription_tier,
            "is_active": current_user.is_active,
            "created_at": str(current_user.created_at),
        }
    }


# ── Movies ───────────────────────────────────────────────────
MOCK_MOVIES = [
    {
        "id": 1,
        "title": "Interstellar VR Experience",
        "description": "Journey through space in stunning VR",
        "duration_minutes": 169,
        "genre": "Sci-Fi",
        "rating": "PG-13",
        "is_360_video": True,
        "vr_format": "stereo_lr",
        "thumbnail_url": None,
        "required_subscription": "basic",
        "is_hls_ready": True,
        "is_accessible": True,
        "release_year": 2024,
    },
    {
        "id": 2,
        "title": "Avatar: Deep Dive",
        "description": "Explore Pandora in immersive 360°",
        "duration_minutes": 192,
        "genre": "Action",
        "rating": "PG-13",
        "is_360_video": True,
        "vr_format": "stereo_tb",
        "thumbnail_url": None,
        "required_subscription": "premium",
        "is_hls_ready": True,
        "is_accessible": False,
        "release_year": 2024,
    },
    {
        "id": 3,
        "title": "The Matrix Awakens",
        "description": "Enter the Matrix like never before",
        "duration_minutes": 135,
        "genre": "Action",
        "rating": "R",
        "is_360_video": False,
        "vr_format": "mono",
        "thumbnail_url": None,
        "required_subscription": "basic",
        "is_hls_ready": True,
        "is_accessible": True,
        "release_year": 2024,
    },
    {
        "id": 4,
        "title": "Ocean VR: Deep Blue",
        "description": "Dive into the depths of the ocean",
        "duration_minutes": 90,
        "genre": "Documentary",
        "rating": "G",
        "is_360_video": True,
        "vr_format": "stereo_lr",
        "thumbnail_url": None,
        "required_subscription": "free",
        "is_hls_ready": True,
        "is_accessible": True,
        "release_year": 2024,
    },
    {
        "id": 5,
        "title": "Dune: Arrakis VR",
        "description": "Walk the desert sands of Arrakis",
        "duration_minutes": 155,
        "genre": "Sci-Fi",
        "rating": "PG-13",
        "is_360_video": True,
        "vr_format": "stereo_lr",
        "thumbnail_url": None,
        "required_subscription": "premium",
        "is_hls_ready": False,
        "is_accessible": False,
        "release_year": 2024,
    },
    {
        "id": 6,
        "title": "Space Walk: ISS",
        "description": "Experience a spacewalk from the ISS",
        "duration_minutes": 45,
        "genre": "Documentary",
        "rating": "G",
        "is_360_video": True,
        "vr_format": "mono",
        "thumbnail_url": None,
        "required_subscription": "free",
        "is_hls_ready": True,
        "is_accessible": True,
        "release_year": 2024,
    },
]


@app.get("/api/movies/")
async def get_movies(current_user=Depends(get_current_user)):
    return {
        "movies": MOCK_MOVIES,
        "pagination": {
            "page": 1,
            "limit": 20,
            "total": len(MOCK_MOVIES),
            "total_pages": 1,
        },
    }


@app.get("/api/movies/{movie_id}")
async def get_movie(movie_id: int, current_user=Depends(get_current_user)):
    movie = next((m for m in MOCK_MOVIES if m["id"] == movie_id), None)
    if not movie:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Movie not found")
    return {"movie": movie}


# ── Stream token (mock) ──────────────────────────────────────
@app.post("/api/stream/{movie_id}/token")
async def get_stream_token(movie_id: int, current_user=Depends(get_current_user)):
    import secrets
    return {
        "stream_token": secrets.token_urlsafe(32),
        "movie_id": movie_id,
        "expires_in": 3600,
    }


# ── Pairing (mock) ───────────────────────────────────────────
@app.post("/api/stream/session/pair")
async def get_pairing_code(current_user=Depends(get_current_user)):
    import random
    code = str(random.randint(100000, 999999))
    return {"pairing_code": code, "expires_in": 600}


@app.get("/api/stream/session/status")
async def get_session_status(current_user=Depends(get_current_user)):
    return {
        "status": "idle",
        "paired": False,
        "device_id": None,
    }


@app.post("/api/stream/session/command")
async def send_command(current_user=Depends(get_current_user)):
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "src.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )