"""
Movie Controller
Handles all HTTP request/response logic for movie catalog
Equivalent to TypeScript's movieController.ts

Endpoints:
  GET  /api/movies              → List all movies (with filters)
  GET  /api/movies/{id}         → Get movie details
  POST /api/movies              → Add movie (admin only)
  PUT  /api/movies/{id}         → Update movie (admin only)
  DEL  /api/movies/{id}         → Delete movie (admin only)
  GET  /api/movies/search       → Search movies
  GET  /api/movies/genres       → List all genres
"""

import logging
import os
from typing import Optional, List
from datetime import datetime

from fastapi import (
    APIRouter, Depends, HTTPException,
    status, Query, UploadFile, File, Form
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from src.config.database import get_db
from src.config.environment import env
from src.models.movie import Movie, ContentRating
from src.models.user import User, SubscriptionTier
from src.middleware.auth_middleware import get_current_user
from src.services.encryption_service import encryption_service

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────

class MovieCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    duration_minutes: int
    genre: Optional[str] = None
    rating: str = "PG"
    release_year: Optional[int] = None
    is_360_video: bool = False
    vr_format: Optional[str] = "mono"
    thumbnail_url: Optional[str] = None
    required_subscription: str = "basic"


class MovieUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    genre: Optional[str] = None
    rating: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_active: Optional[bool] = None
    required_subscription: Optional[str] = None


class MovieResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    duration_minutes: int
    genre: Optional[str]
    rating: str
    is_360_video: bool
    thumbnail_url: Optional[str]
    required_subscription: str
    is_hls_ready: bool

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────────
# ROUTER SETUP
# ─────────────────────────────────────────────────────────────

router = APIRouter(
    prefix="/api/movies",
    tags=["Movies"],
    responses={
        401: {"description": "Unauthorized - Login required"},
        403: {"description": "Forbidden - Subscription required"},
    }
)


# ─────────────────────────────────────────────────────────────
# HELPER: Check subscription access
# ─────────────────────────────────────────────────────────────

def check_subscription_access(
    user: User,
    required_tier: str
) -> bool:
    """
    Check if user has sufficient subscription for content.

    Tier hierarchy:
      free < basic < premium
    """
    tier_levels = {
        "free": 0,
        "basic": 1,
        "premium": 2
    }

    user_level = tier_levels.get(str(user.subscription_tier), 0)
    required_level = tier_levels.get(required_tier, 1)

    return user_level >= required_level


# ─────────────────────────────────────────────────────────────
# ENDPOINT: LIST ALL MOVIES
# ─────────────────────────────────────────────────────────────

@router.get(
    "/",
    summary="Get movie catalog",
    response_description="List of available movies"
)
async def get_movies(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    genre: Optional[str] = Query(default=None, description="Filter by genre"),
    rating: Optional[str] = Query(default=None, description="Filter by content rating"),
    is_360: Optional[bool] = Query(default=None, description="Filter 360° videos only"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of movies from the catalog.

    Filters:
      - genre: Action, Drama, Sci-Fi, etc.
      - rating: G, PG, PG-13, R
      - is_360: True for VR 360° content only

    Returns movies accessible based on user's subscription tier.
    """
    logger.info(
        f"🎬 Movie list: user_id={current_user.id} | "
        f"page={page} | genre={genre}"
    )

    # Build query
    query = db.query(Movie).filter(Movie.is_active == True)

    # Apply filters
    if genre:
        query = query.filter(Movie.genre.ilike(f"%{genre}%"))
    if rating:
        query = query.filter(Movie.rating == rating)
    if is_360 is not None:
        query = query.filter(Movie.is_360_video == is_360)

    # Total count
    total = query.count()

    # Paginate
    offset = (page - 1) * limit
    movies = query.offset(offset).limit(limit).all()

    # Mark accessible movies based on subscription
    movie_list = []
    for movie in movies:
        movie_dict = movie.to_dict()
        movie_dict["is_accessible"] = check_subscription_access(
            current_user, movie.required_subscription
        )
        movie_list.append(movie_dict)

    return JSONResponse(content={
        "movies": movie_list,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: SEARCH MOVIES
# ─────────────────────────────────────────────────────────────

@router.get(
    "/search",
    summary="Search movies by title or description",
    response_description="Matching movies"
)
async def search_movies(
    q: str = Query(..., min_length=2, description="Search query"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search movies by title or description text."""
    logger.info(f"🔍 Movie search: query='{q}' | user_id={current_user.id}")

    movies = db.query(Movie).filter(
        Movie.is_active == True,
        or_(
            Movie.title.ilike(f"%{q}%"),
            Movie.description.ilike(f"%{q}%")
        )
    ).limit(50).all()

    results = []
    for movie in movies:
        movie_dict = movie.to_dict()
        movie_dict["is_accessible"] = check_subscription_access(
            current_user, movie.required_subscription
        )
        results.append(movie_dict)

    return JSONResponse(content={
        "query": q,
        "count": len(results),
        "results": results
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: GET ALL GENRES
# ─────────────────────────────────────────────────────────────

@router.get(
    "/genres",
    summary="Get all available genres",
    response_description="List of genres"
)
async def get_genres(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get distinct list of genres from active movies."""
    genres = db.query(Movie.genre).filter(
        Movie.is_active == True,
        Movie.genre.isnot(None)
    ).distinct().all()

    genre_list = sorted([g[0] for g in genres if g[0]])

    return JSONResponse(content={"genres": genre_list})


# ─────────────────────────────────────────────────────────────
# ENDPOINT: GET SINGLE MOVIE
# ─────────────────────────────────────────────────────────────

@router.get(
    "/{movie_id}",
    summary="Get movie details by ID",
    response_description="Movie details"
)
async def get_movie(
    movie_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information for a specific movie.

    Also returns:
      - Whether user has access based on subscription
      - Streaming readiness status (HLS)
      - VR format information
    """
    logger.info(f"🎬 Movie detail: movie_id={movie_id} | user_id={current_user.id}")

    movie = db.query(Movie).filter(
        Movie.id == movie_id,
        Movie.is_active == True
    ).first()

    if not movie:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Movie with ID {movie_id} not found"
        )

    movie_dict = movie.to_dict()
    movie_dict["is_accessible"] = check_subscription_access(
        current_user, movie.required_subscription
    )
    movie_dict["is_hls_ready"] = movie.is_hls_ready
    movie_dict["vr_format"] = movie.vr_format
    movie_dict["required_subscription"] = movie.required_subscription

    return JSONResponse(content={"movie": movie_dict})


# ─────────────────────────────────────────────────────────────
# ENDPOINT: CREATE MOVIE (Admin)
# ─────────────────────────────────────────────────────────────

@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Add new movie to catalog (Admin)",
    response_description="Created movie"
)
async def create_movie(
    request: MovieCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a new movie to the catalog.

    ⚠️ Admin only endpoint.
    After creating movie record, use /upload endpoint
    to upload and encrypt the video file.
    """
    logger.info(
        f"➕ Create movie: '{request.title}' | user_id={current_user.id}"
    )

    # Check admin (basic check - extend with role system)
    if str(current_user.subscription_tier) != "premium":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    # Validate rating
    valid_ratings = ["G", "PG", "PG-13", "R", "NC-17"]
    if request.rating not in valid_ratings:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rating. Choose from: {valid_ratings}"
        )

    # Create movie record
    movie = Movie(
        title=request.title,
        description=request.description,
        duration_minutes=request.duration_minutes,
        genre=request.genre,
        rating=request.rating,
        release_year=request.release_year,
        is_360_video=request.is_360_video,
        vr_format=request.vr_format,
        thumbnail_url=request.thumbnail_url,
        required_subscription=request.required_subscription,
        encrypted_file_path="pending",  # Updated after file upload
        encryption_key_id="pending",    # Updated after encryption
        is_hls_ready=False
    )

    db.add(movie)
    db.commit()
    db.refresh(movie)

    logger.info(f"✅ Movie created: id={movie.id} | title='{movie.title}'")

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Movie created successfully",
            "movie": movie.to_dict(),
            "next_step": f"POST /api/movies/{movie.id}/upload to add video file"
        }
    )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: UPLOAD & ENCRYPT VIDEO FILE
# ─────────────────────────────────────────────────────────────

@router.post(
    "/{movie_id}/upload",
    summary="Upload and encrypt video file (Admin)",
    response_description="Upload and encryption result"
)
async def upload_movie_file(
    movie_id: int,
    file: UploadFile = File(..., description="Video file to encrypt and store"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a video file, encrypt it with AES-256-CBC,
    and store in the Content Vault.

    Process:
      1. Save temporary upload
      2. Encrypt with AES-256-CBC
      3. Store encrypted file in vault
      4. Delete original unencrypted file
      5. Update movie record with key info
    """
    logger.info(
        f"📤 Upload start: movie_id={movie_id} | "
        f"file='{file.filename}' | size={file.size}"
    )

    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    # Paths
    temp_path = f"./vault/temp/upload_{movie_id}_{file.filename}"
    encrypted_path = f"{env.CONTENT_VAULT_PATH}/movie_{movie_id}.enc"

    os.makedirs(os.path.dirname(temp_path), exist_ok=True)
    os.makedirs(env.CONTENT_VAULT_PATH, exist_ok=True)

    try:
        # Save uploaded file temporarily
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        logger.info(f"💾 Temp file saved: {temp_path}")

        # Encrypt file using AES-256-CBC
        encryption_result = encryption_service.encrypt_file(
            input_path=temp_path,
            output_path=encrypted_path
        )

        # Update movie record
        movie.encrypted_file_path = encrypted_path
        movie.encryption_key_id = encryption_result["key_id"]
        movie.file_size_bytes = len(content)
        db.commit()

        # Delete original unencrypted file
        os.remove(temp_path)
        logger.info(f"🗑️ Original file deleted: {temp_path}")

        logger.info(f"✅ Movie encrypted: id={movie_id} | key_id={encryption_result['key_id']}")

        return JSONResponse(content={
            "message": "Video uploaded and encrypted successfully",
            "movie_id": movie_id,
            "key_id": encryption_result["key_id"],
            "file_hash": encryption_result["file_hash"],
            "algorithm": encryption_result["algorithm"],
            "encrypted_path": encrypted_path
        })

    except Exception as e:
        # Cleanup on failure
        if os.path.exists(temp_path):
            os.remove(temp_path)
        logger.error(f"❌ Upload failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Upload and encryption failed: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: UPDATE MOVIE
# ─────────────────────────────────────────────────────────────

@router.put(
    "/{movie_id}",
    summary="Update movie details (Admin)",
    response_description="Updated movie"
)
async def update_movie(
    movie_id: int,
    request: MovieUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update movie metadata."""
    logger.info(f"✏️ Update movie: id={movie_id} | user_id={current_user.id}")

    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    # Apply updates
    update_data = request.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(movie, field, value)

    movie.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(movie)

    return JSONResponse(content={
        "message": "Movie updated successfully",
        "movie": movie.to_dict()
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: DELETE MOVIE
# ─────────────────────────────────────────────────────────────

@router.delete(
    "/{movie_id}",
    summary="Delete movie (Admin)",
    response_description="Deletion confirmation"
)
async def delete_movie(
    movie_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a movie (sets is_active=False)."""
    logger.info(f"🗑️ Delete movie: id={movie_id} | user_id={current_user.id}")

    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    movie.is_active = False
    movie.updated_at = datetime.utcnow()
    db.commit()

    logger.info(f"✅ Movie soft-deleted: id={movie_id}")

    return JSONResponse(content={
        "message": f"Movie '{movie.title}' deleted successfully"
    })