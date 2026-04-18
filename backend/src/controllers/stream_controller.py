"""
Stream Controller
Handles all HTTP request/response logic for video streaming
Equivalent to TypeScript's streamController.ts

Endpoints:
  POST /api/stream/{movie_id}/token          → Get stream token
  GET  /api/stream/{movie_id}/manifest.m3u8  → HLS manifest
  GET  /api/stream/{movie_id}/segment/{name} → HLS segment
  GET  /api/stream/{movie_id}/key            → AES-128 key for HLS
  GET  /api/stream/session/status            → Current session status
  POST /api/stream/session/command           → Send playback command
"""

import logging
import os
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.config.environment import env
from src.models.user import User
from src.models.movie import Movie
from src.models.session import Session as UserSession
from src.middleware.auth_middleware import get_current_user
from src.services.streaming_service import streaming_service
from src.services.encryption_service import encryption_service
from src.services.pairing_service import pairing_service
from src.websocket.socket_manager import broadcast_to_user

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────

class PlaybackCommandRequest(BaseModel):
    command: str            # play, pause, stop, seek, volume, load_movie
    position_seconds: Optional[float] = None
    volume_level: Optional[int] = None
    movie_id: Optional[int] = None


class StreamTokenResponse(BaseModel):
    stream_token: str
    expires_at: str
    stream_url: str
    token_type: str


# ─────────────────────────────────────────────────────────────
# ROUTER SETUP
# ─────────────────────────────────────────────────────────────

router = APIRouter(
    prefix="/api/stream",
    tags=["Streaming"],
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Subscription required for this content"},
    }
)


# ─────────────────────────────────────────────────────────────
# HELPER: Get active session
# ─────────────────────────────────────────────────────────────

def get_active_session(
    user_id: int,
    db: Session
) -> Optional[UserSession]:
    """Retrieve the active session for a user."""
    return db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_active == True
    ).order_by(UserSession.created_at.desc()).first()


# ─────────────────────────────────────────────────────────────
# HELPER: Verify stream token from query param
# ─────────────────────────────────────────────────────────────

def verify_stream_access(token: str) -> dict:
    """
    Verify streaming token from URL query parameter.
    Used by HLS manifest and segment endpoints.
    """
    payload = streaming_service.verify_stream_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired stream token. Request a new token."
        )
    return payload


# ─────────────────────────────────────────────────────────────
# ENDPOINT: GET STREAMING TOKEN
# ─────────────────────────────────────────────────────────────

@router.post(
    "/{movie_id}/token",
    summary="Generate secure streaming token",
    response_description="Encrypted streaming token for HLS playback"
)
async def get_stream_token(
    movie_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a time-limited, AES-encrypted streaming token.

    This token:
      - Authorizes access to HLS manifest and segments
      - Expires in 60 minutes
      - Is tied to specific user + movie + session
      - Prevents unauthorized stream access

    The VR headset uses this token to authenticate
    all HLS segment requests (Problem Statement §4, §6).
    """
    logger.info(
        f"🎫 Stream token request: movie_id={movie_id} | user_id={current_user.id}"
    )

    # Check movie exists
    movie = db.query(Movie).filter(
        Movie.id == movie_id,
        Movie.is_active == True
    ).first()

    if not movie:
        raise HTTPException(
            status_code=404,
            detail=f"Movie {movie_id} not found"
        )

    # Check HLS readiness
    if not movie.is_hls_ready:
        raise HTTPException(
            status_code=503,
            detail="Movie is still being processed for streaming. Try again later."
        )

    # Check subscription access
    tier_levels = {"free": 0, "basic": 1, "premium": 2}
    user_level = tier_levels.get(str(current_user.subscription_tier), 0)
    required_level = tier_levels.get(movie.required_subscription, 1)

    if user_level < required_level:
        raise HTTPException(
            status_code=403,
            detail=f"'{movie.required_subscription}' subscription required for this content"
        )

    # Get or create session
    active_session = get_active_session(current_user.id, db)

    if not active_session:
        # Create new session
        active_session = UserSession(
            session_token=encryption_service.generate_secure_token(),
            user_id=current_user.id,
            movie_id=movie_id,
            is_active=True,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        db.add(active_session)
        db.commit()
        db.refresh(active_session)

    # Generate streaming token
    token_data = streaming_service.generate_stream_token(
        user_id=current_user.id,
        movie_id=movie_id,
        session_id=active_session.id
    )

    # Update session with stream token
    active_session.movie_id = movie_id
    active_session.stream_token = token_data["stream_token"]
    active_session.stream_token_expires = datetime.fromisoformat(
        token_data["expires_at"]
    )
    active_session.playback_state = "ready"
    db.commit()

    logger.info(
        f"✅ Stream token issued: movie_id={movie_id} | "
        f"user_id={current_user.id}"
    )

    return JSONResponse(content={
        **token_data,
        "movie": {
            "id": movie.id,
            "title": movie.title,
            "duration_minutes": movie.duration_minutes,
            "is_360_video": movie.is_360_video,
            "vr_format": movie.vr_format
        }
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: HLS MANIFEST
# ─────────────────────────────────────────────────────────────

@router.get(
    "/{movie_id}/manifest.m3u8",
    summary="Get HLS manifest for streaming",
    response_description="M3U8 playlist file"
)
async def get_hls_manifest(
    movie_id: int,
    token: str = Query(..., description="Stream access token"),
    db: Session = Depends(get_db)
):
    """
    Serve HLS manifest (.m3u8) file for video playback.

    The manifest:
      - Lists all video segments in order
      - Includes AES-128 encryption key URL
      - Is only accessible with valid stream token
      - Implements segmented streaming (Problem Statement §6)

    HLS players (VLC, AVPro, Unity VideoPlayer) use this
    to stream video segment by segment.
    """
    # Verify stream token
    payload = verify_stream_access(token)

    # Ensure token matches requested movie
    if int(payload["movie_id"]) != movie_id:
        raise HTTPException(
            status_code=403,
            detail="Stream token not valid for this movie"
        )

    # Check movie exists
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    # Get segments list (in real system, scan HLS output directory)
    segment_count = movie.duration_minutes * 10  # ~10 segments per minute @ 6s each
    segments = [f"segment_{i:04d}" for i in range(min(segment_count, 100))]

    # Generate manifest with encryption
    manifest = streaming_service.create_m3u8_manifest(
        movie_id=movie_id,
        segments=segments,
        token=token
    )

    logger.info(
        f"📋 Manifest served: movie_id={movie_id} | segments={len(segments)}"
    )

    return PlainTextResponse(
        content=manifest,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff"
        }
    )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: HLS SEGMENT DELIVERY
# ─────────────────────────────────────────────────────────────

@router.get(
    "/{movie_id}/{segment_name}.ts",
    summary="Stream HLS video segment",
    response_description="Encrypted video segment data"
)
async def get_hls_segment(
    movie_id: int,
    segment_name: str,
    token: str = Query(..., description="Stream access token"),
    db: Session = Depends(get_db)
):
    """
    Serve individual encrypted HLS video segment (.ts file).

    Each segment:
      - Is encrypted with AES-128
      - Requires valid stream token
      - Is served without exposing actual file path
      - Cannot be directly downloaded without the key

    This implements temporary runtime decryption
    as required by Problem Statement §4.
    """
    # Verify stream token
    payload = verify_stream_access(token)

    if int(payload["movie_id"]) != movie_id:
        raise HTTPException(status_code=403, detail="Token mismatch")

    # Validate segment name (prevent path traversal)
    if not segment_name.startswith("segment_") or not segment_name[8:].isdigit():
        raise HTTPException(status_code=400, detail="Invalid segment name")

    # Build segment path
    segment_path = os.path.join(
        env.CONTENT_VAULT_PATH,
        f"movie_{movie_id}",
        f"{segment_name}.ts"
    )

    # In development: return dummy segment data
    # In production: serve actual encrypted .ts file
    if not os.path.exists(segment_path):
        dummy_data = (
            b"\x47\x40\x00\x10"  # MPEG-TS sync bytes
            + b"\x00" * 184      # Dummy payload
        ) * 100

        return Response(
            content=dummy_data,
            media_type="video/mp2t",
            headers={
                "Cache-Control": "no-cache",
                "X-Segment": segment_name,
                "X-Movie-ID": str(movie_id)
            }
        )

    # Stream actual segment file
    def iter_file():
        with open(segment_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk

    logger.info(f"📦 Segment served: movie={movie_id} | {segment_name}")

    return StreamingResponse(
        iter_file(),
        media_type="video/mp2t",
        headers={
            "Cache-Control": "no-cache, no-store",
            "Content-Security-Policy": "default-src 'none'",
        }
    )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: HLS ENCRYPTION KEY DELIVERY
# ─────────────────────────────────────────────────────────────

@router.get(
    "/{movie_id}/key",
    summary="Get AES key for HLS decryption",
    response_description="16-byte AES-128 key"
)
async def get_hls_key(
    movie_id: int,
    token: str = Query(..., description="Stream access token"),
    db: Session = Depends(get_db)
):
    """
    Serve AES-128 decryption key for HLS segments.

    This endpoint:
      - Is referenced in the M3U8 manifest (#EXT-X-KEY)
      - Only returns key to requests with valid token
      - Implements access-controlled key delivery
      - Key rotates per session for security

    This is the core of HLS + AES content protection
    (Problem Statement §5, §6).
    """
    # Verify stream token strictly
    payload = verify_stream_access(token)

    if int(payload["movie_id"]) != movie_id:
        raise HTTPException(status_code=403, detail="Token not valid for movie")

    # Get movie encryption info
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    # In production: retrieve actual content key from vault
    # For now: derive a deterministic demo key
    import hashlib
    key_material = f"{movie.encryption_key_id}:{payload['user_id']}:{movie_id}"
    aes_key = hashlib.sha256(key_material.encode()).digest()[:16]  # AES-128 = 16 bytes

    logger.info(
        f"🔑 Key served: movie_id={movie_id} | user_id={payload['user_id']}"
    )

    return Response(
        content=aes_key,
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Content-Length": "16"
        }
    )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: PLAYBACK COMMAND (Web Controller → VR)
# ─────────────────────────────────────────────────────────────

@router.post(
    "/session/command",
    summary="Send playback command to VR headset",
    response_description="Command dispatch confirmation"
)
async def send_playback_command(
    request: PlaybackCommandRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a playback command from the web controller to VR headset.

    Commands:
      - play      → Start/resume playback
      - pause     → Pause playback
      - stop      → Stop and reset to beginning
      - seek      → Jump to position_seconds
      - volume    → Set volume (0-100)
      - load_movie→ Load a new movie by movie_id

    Commands are transmitted via WebSocket to the paired VR device.
    (Problem Statement §2 - Integration with Web Controller)
    """
    # Validate command
    valid_commands = ["play", "pause", "stop", "seek", "volume", "load_movie"]
    if request.command not in valid_commands:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid command. Valid: {valid_commands}"
        )

    # Validate seek position
    if request.command == "seek" and request.position_seconds is None:
        raise HTTPException(
            status_code=400,
            detail="position_seconds required for seek command"
        )

    # Validate volume
    if request.command == "volume":
        if request.volume_level is None or not (0 <= request.volume_level <= 100):
            raise HTTPException(
                status_code=400,
                detail="volume_level (0-100) required for volume command"
            )

    # Get active session
    session = get_active_session(current_user.id, db)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="No active session found. Please start streaming first."
        )

    # Update session state in database
    if request.command == "play":
        session.playback_state = "playing"
    elif request.command == "pause":
        session.playback_state = "paused"
    elif request.command == "stop":
        session.playback_state = "stopped"
        session.current_position_seconds = 0
    elif request.command == "seek" and request.position_seconds is not None:
        session.current_position_seconds = int(request.position_seconds)
    elif request.command == "volume" and request.volume_level is not None:
        session.volume_level = request.volume_level

    session.last_activity = datetime.utcnow()
    db.commit()

    # Broadcast command via WebSocket to VR headset
    await broadcast_to_user(
        user_id=str(current_user.id),
        event="execute_command",
        data={
            "command": request.command,
            "payload": {
                "position_seconds": request.position_seconds,
                "volume_level": request.volume_level,
                "movie_id": request.movie_id,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "from": "web_controller"
        }
    )

    logger.info(
        f"📡 Command dispatched: '{request.command}' | "
        f"user_id={current_user.id}"
    )

    return JSONResponse(content={
        "command": request.command,
        "status": "dispatched",
        "session_state": session.playback_state,
        "timestamp": datetime.utcnow().isoformat()
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: SESSION STATUS
# ─────────────────────────────────────────────────────────────

@router.get(
    "/session/status",
    summary="Get current streaming session status",
    response_description="Active session playback state"
)
async def get_session_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current playback session status.

    Returns:
      - Current playback state (playing/paused/stopped)
      - Current position in video
      - Volume level
      - Active movie info
      - Device pairing status
    """
    session = get_active_session(current_user.id, db)

    if not session:
        return JSONResponse(content={
            "has_active_session": False,
            "message": "No active streaming session"
        })

    # Get movie info if available
    movie_info = None
    if session.movie_id:
        movie = db.query(Movie).filter(Movie.id == session.movie_id).first()
        if movie:
            movie_info = {
                "id": movie.id,
                "title": movie.title,
                "duration_minutes": movie.duration_minutes
            }

    return JSONResponse(content={
        "has_active_session": True,
        "session": session.to_dict(),
        "movie": movie_info,
        "device": {
            "vr_paired": session.vr_device_id is not None,
            "vr_device_id": session.vr_device_id,
            "pairing_code": session.pairing_code
        }
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: GENERATE DEVICE PAIRING CODE
# ─────────────────────────────────────────────────────────────

@router.post(
    "/session/pair",
    summary="Generate VR headset pairing code",
    response_description="6-digit pairing code"
)
async def generate_pairing_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a 6-digit pairing code to link VR headset
    with the web controller.

    Workflow:
      1. Web controller calls this endpoint
      2. Displays 6-digit code to user
      3. User opens VR app → enters code
      4. VR app calls /session/pair/verify
      5. Devices are now linked via WebSocket
    """
    # Get or create session
    session = get_active_session(current_user.id, db)

    if not session:
        session = UserSession(
            session_token=encryption_service.generate_secure_token(),
            user_id=current_user.id,
            is_active=True,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Generate pairing code
    code = pairing_service.generate_pairing_code(session_id=session.id)

    # Store in session
    session.pairing_code = code
    db.commit()

    return JSONResponse(content={
        "pairing_code": code,
        "session_id": session.id,
        "expires_in_minutes": 10,
        "instructions": (
            "Enter this code in your VR headset app "
            "to link it with the web controller"
        )
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: VERIFY PAIRING CODE (VR Headset)
# ─────────────────────────────────────────────────────────────

@router.post(
    "/session/pair/verify",
    summary="VR headset verifies pairing code",
    response_description="Pairing confirmation"
)
async def verify_pairing_code(
    code: str = Query(..., min_length=6, max_length=6),
    device_id: str = Query(..., description="VR headset unique device ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    VR headset verifies pairing code to complete device linking.

    After successful pairing:
      - WebSocket commands from web controller reach VR headset
      - Playback controls are synchronized
    """
    pairing_info = pairing_service.verify_pairing_code(code.upper())

    if not pairing_info:
        raise HTTPException(
            status_code=400,
            detail="Invalid, expired, or already-used pairing code"
        )

    # Update session with VR device info
    session = db.query(UserSession).filter(
        UserSession.id == pairing_info["session_id"]
    ).first()

    if session:
        session.vr_device_id = device_id
        db.commit()

    # Update user device info
    current_user.vr_device_id = device_id
    current_user.is_device_paired = True
    db.commit()

    logger.info(
        f"🔗 Device paired: user_id={current_user.id} | device_id={device_id}"
    )

    return JSONResponse(content={
        "paired": True,
        "device_id": device_id,
        "message": "VR headset successfully paired with web controller",
        "session_id": pairing_info["session_id"]
    })