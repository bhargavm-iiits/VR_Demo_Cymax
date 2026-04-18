"""
Simple standalone VR Cinema server - no imports from src needed
"""
import logging
import secrets
import random
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="VR Cinema API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Simple in-memory store ───────────────────────────────────
USERS = {}
TOKENS = {}

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    user = TOKENS.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


# ── Schemas ──────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


# ── Auth routes ──────────────────────────────────────────────
@app.post("/api/auth/register", status_code=201)
async def register(body: RegisterRequest):
    if body.username in USERS:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    user = {
        "id": len(USERS) + 1,
        "username": body.username,
        "email": body.email,
        "subscription_tier": "FREE",
        "is_active": True,
    }
    USERS[body.username] = {**user, "password": body.password}
    token = secrets.token_urlsafe(32)
    TOKENS[token] = user

    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    stored = USERS.get(body.username)
    if not stored or stored["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = {k: v for k, v in stored.items() if k != "password"}
    token = secrets.token_urlsafe(32)
    TOKENS[token] = user

    return {"access_token": token, "token_type": "bearer", "user": user}


@app.get("/api/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {"user": current_user}


@app.post("/api/auth/logout")
async def logout():
    return {"message": "Logged out"}


# ── Movies ───────────────────────────────────────────────────
MOVIES = [
    {
        "id": 1, "title": "Interstellar VR Experience",
        "description": "Journey through space", "duration_minutes": 169,
        "genre": "Sci-Fi", "rating": "PG-13", "is_360_video": True,
        "vr_format": "stereo_lr", "thumbnail_url": None,
        "required_subscription": "basic", "is_hls_ready": True,
        "is_accessible": True, "release_year": 2024,
    },
    {
        "id": 2, "title": "Avatar: Deep Dive",
        "description": "Explore Pandora in 360°", "duration_minutes": 192,
        "genre": "Action", "rating": "PG-13", "is_360_video": True,
        "vr_format": "stereo_tb", "thumbnail_url": None,
        "required_subscription": "premium", "is_hls_ready": True,
        "is_accessible": False, "release_year": 2024,
    },
    {
        "id": 3, "title": "The Matrix Awakens",
        "description": "Enter the Matrix", "duration_minutes": 135,
        "genre": "Action", "rating": "R", "is_360_video": False,
        "vr_format": "mono", "thumbnail_url": None,
        "required_subscription": "basic", "is_hls_ready": True,
        "is_accessible": True, "release_year": 2024,
    },
    {
        "id": 4, "title": "Ocean VR: Deep Blue",
        "description": "Dive into the ocean", "duration_minutes": 90,
        "genre": "Documentary", "rating": "G", "is_360_video": True,
        "vr_format": "stereo_lr", "thumbnail_url": None,
        "required_subscription": "free", "is_hls_ready": True,
        "is_accessible": True, "release_year": 2024,
    },
    {
        "id": 5, "title": "Dune: Arrakis VR",
        "description": "Walk the desert sands", "duration_minutes": 155,
        "genre": "Sci-Fi", "rating": "PG-13", "is_360_video": True,
        "vr_format": "stereo_lr", "thumbnail_url": None,
        "required_subscription": "premium", "is_hls_ready": False,
        "is_accessible": False, "release_year": 2024,
    },
    {
        "id": 6, "title": "Space Walk: ISS",
        "description": "Experience the ISS", "duration_minutes": 45,
        "genre": "Documentary", "rating": "G", "is_360_video": True,
        "vr_format": "mono", "thumbnail_url": None,
        "required_subscription": "free", "is_hls_ready": True,
        "is_accessible": True, "release_year": 2024,
    },
]


@app.get("/api/movies/")
async def get_movies(current_user=Depends(get_current_user)):
    return {
        "movies": MOVIES,
        "pagination": {"page": 1, "limit": 20, "total": len(MOVIES), "total_pages": 1},
    }


@app.get("/api/movies/{movie_id}")
async def get_movie(movie_id: int, current_user=Depends(get_current_user)):
    movie = next((m for m in MOVIES if m["id"] == movie_id), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return {"movie": movie}


# ── Stream ───────────────────────────────────────────────────
@app.post("/api/stream/{movie_id}/token")
async def get_stream_token(movie_id: int, current_user=Depends(get_current_user)):
    return {
        "stream_token": secrets.token_urlsafe(32),
        "movie_id": movie_id,
        "expires_in": 3600,
    }


@app.post("/api/stream/session/pair")
async def get_pairing_code(current_user=Depends(get_current_user)):
    code = str(random.randint(100000, 999999))
    return {"pairing_code": code, "expires_in": 600}


@app.get("/api/stream/session/status")
async def get_session_status(current_user=Depends(get_current_user)):
    return {"status": "idle", "paired": False, "device_id": None}


@app.post("/api/stream/session/command")
async def send_command(current_user=Depends(get_current_user)):
    return {"status": "ok"}


# ── Health ───────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("simple_server:app", host="0.0.0.0", port=8000, reload=True)