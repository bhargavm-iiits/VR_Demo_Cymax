"""
Streaming and pairing routes used by the web controller and VR headset.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse, Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.config.environment import env
from src.middleware.auth_middleware import get_current_user
from src.models.movie import Movie
from src.models.session import Session as UserSession
from src.models.user import User
from src.services.encryption_service import encryption_service
from src.services.pairing_service import pairing_service
from src.services.streaming_service import streaming_service
from src.websocket.socket_manager import broadcast_to_user

router = APIRouter(prefix="/api/stream", tags=["Streaming"])


class PlaybackCommandRequest(BaseModel):
    command: str
    position_seconds: Optional[float] = None
    volume_level: Optional[int] = None
    movie_id: Optional[int] = None


def get_active_session(user_id: int, db: Session) -> Optional[UserSession]:
    return db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow(),
    ).order_by(UserSession.created_at.desc()).first()


def serialize_session_status(session: Optional[UserSession]) -> dict:
    if not session:
        return {
            "has_active_session": False,
            "pairing_status": "idle",
            "paired": False,
            "device_id": None,
            "pairing_code": None,
        }

    pairing_status = "paired" if session.vr_device_id else ("waiting" if session.pairing_code else "idle")
    return {
        "has_active_session": True,
        "pairing_status": pairing_status,
        "paired": bool(session.vr_device_id),
        "device_id": session.vr_device_id,
        "pairing_code": session.pairing_code,
        "session": session.to_dict(),
        "device": {
            "vr_paired": bool(session.vr_device_id),
            "vr_device_id": session.vr_device_id,
            "pairing_code": session.pairing_code,
        },
    }


@router.post("/{movie_id}/token")
async def get_stream_token(
    movie_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    movie = db.query(Movie).filter(
        Movie.id == movie_id,
        Movie.is_active == True,
    ).first()

    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    tier_levels = {"free": 0, "basic": 1, "premium": 2}
    user_level = tier_levels.get(str(current_user.subscription_tier), 0)
    required_level = tier_levels.get(movie.required_subscription, 1)
    if user_level < required_level:
        raise HTTPException(
            status_code=403,
            detail=f"{movie.required_subscription} subscription required for this content",
        )

    active_session = get_active_session(current_user.id, db)
    if not active_session:
        active_session = UserSession(
            session_token=encryption_service.generate_secure_token(),
            user_id=current_user.id,
            movie_id=movie_id,
            is_active=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(active_session)
        db.commit()
        db.refresh(active_session)

    token_data = streaming_service.generate_stream_token(
        user_id=current_user.id,
        movie_id=movie_id,
        session_id=active_session.id,
    )

    active_session.movie_id = movie_id
    active_session.stream_token = token_data["stream_token"]
    active_session.stream_token_expires = datetime.fromisoformat(token_data["expires_at"])
    active_session.playback_state = "ready"
    active_session.last_activity = datetime.utcnow()
    db.commit()

    return JSONResponse(content={
        **token_data,
        "movie": {
            "id": movie.id,
            "title": movie.title,
            "duration_minutes": movie.duration_minutes,
            "is_360_video": movie.is_360_video,
            "vr_format": movie.vr_format,
        },
    })


@router.get("/{movie_id}/manifest.m3u8")
async def get_hls_manifest(movie_id: int, token: str):
    payload = streaming_service.verify_stream_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid stream token")
    if int(payload["movie_id"]) != movie_id:
        raise HTTPException(status_code=403, detail="Stream token not valid for this movie")

    segments = [f"segment_{i:04d}" for i in range(10)]
    manifest = streaming_service.create_m3u8_manifest(movie_id, segments, token)

    return PlainTextResponse(
        manifest,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{movie_id}/{segment_name}.ts")
async def get_hls_segment(movie_id: int, segment_name: str, token: str = Query(...)):
    payload = streaming_service.verify_stream_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid stream token")
    if int(payload["movie_id"]) != movie_id:
        raise HTTPException(status_code=403, detail="Stream token not valid for this movie")
    if not segment_name.startswith("segment_") or not segment_name[8:].isdigit():
        raise HTTPException(status_code=400, detail="Invalid segment name")

    segment_path = os.path.join(
        env.CONTENT_VAULT_PATH,
        f"movie_{movie_id}",
        f"{segment_name}.ts",
    )

    if not os.path.exists(segment_path):
        dummy_data = (b"\x47\x40\x00\x10" + b"\x00" * 184) * 100
        return Response(
            content=dummy_data,
            media_type="video/mp2t",
            headers={"Cache-Control": "no-cache"},
        )

    def iter_file():
        with open(segment_path, "rb") as file_handle:
            while chunk := file_handle.read(8192):
                yield chunk

    return StreamingResponse(
        iter_file(),
        media_type="video/mp2t",
        headers={
            "Cache-Control": "no-cache, no-store",
            "Content-Security-Policy": "default-src 'none'",
        },
    )


@router.get("/{movie_id}/key")
async def get_hls_key(movie_id: int, token: str = Query(...), db: Session = Depends(get_db)):
    payload = streaming_service.verify_stream_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid stream token")
    if int(payload["movie_id"]) != movie_id:
        raise HTTPException(status_code=403, detail="Stream token not valid for this movie")

    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    import hashlib

    key_material = f"{movie.encryption_key_id}:{payload['user_id']}:{movie_id}"
    aes_key = hashlib.sha256(key_material.encode()).digest()[:16]

    return Response(
        content=aes_key,
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Content-Length": "16",
        },
    )


@router.post("/session/pair")
async def get_pairing_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active_session = get_active_session(current_user.id, db)
    if not active_session:
        active_session = UserSession(
            session_token=encryption_service.generate_secure_token(),
            user_id=current_user.id,
            is_active=True,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(active_session)
        db.commit()
        db.refresh(active_session)

    code = pairing_service.generate_pairing_code(session_id=active_session.id)
    active_session.pairing_code = code
    active_session.last_activity = datetime.utcnow()
    db.commit()

    return JSONResponse(content={
        "pairing_code": code,
        "session_id": active_session.id,
        "expires_in": 600,
        "expires_in_minutes": 10,
        "instructions": "Enter this code in your VR headset app to pair devices.",
    })


@router.post("/session/pair/verify")
async def verify_pairing_code(
    code: str = Query(..., min_length=6, max_length=6),
    device_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pairing_info = pairing_service.verify_pairing_code(code.upper())
    if not pairing_info:
        raise HTTPException(status_code=400, detail="Invalid, expired, or already-used pairing code")

    session = db.query(UserSession).filter(UserSession.id == pairing_info["session_id"]).first()
    if not session:
        raise HTTPException(status_code=404, detail="Pairing session not found")

    session.vr_device_id = device_id
    session.pairing_code = code.upper()
    session.last_activity = datetime.utcnow()
    current_user.vr_device_id = device_id
    current_user.is_device_paired = True
    db.commit()

    await broadcast_to_user(
        user_id=str(session.user_id),
        event="pairing_updated",
        data={
            "paired": True,
            "device_id": device_id,
            "pairing_code": code.upper(),
            "session_id": session.id,
        },
    )

    return JSONResponse(content={
        "paired": True,
        "device_id": device_id,
        "session_id": session.id,
        "message": "VR headset successfully paired with web controller",
    })


@router.get("/session/status")
async def get_session_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = get_active_session(current_user.id, db)
    return JSONResponse(content=serialize_session_status(session))


@router.post("/session/command")
async def send_command(
    request: PlaybackCommandRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    valid_commands = {"play", "pause", "stop", "seek", "volume", "load_movie"}
    if request.command not in valid_commands:
        raise HTTPException(status_code=400, detail="Invalid command")

    session = get_active_session(current_user.id, db)
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")

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
        if request.volume_level < 0 or request.volume_level > 100:
            raise HTTPException(status_code=400, detail="volume_level must be between 0 and 100")
        session.volume_level = request.volume_level
    elif request.command == "load_movie" and request.movie_id is not None:
        session.movie_id = request.movie_id
        session.playback_state = "ready"

    session.last_activity = datetime.utcnow()
    db.commit()

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
            "from": "web_controller",
        },
    )

    return JSONResponse(content={
        "status": "ok",
        "command": request.command,
        "session_state": session.playback_state,
    })


@router.get("/system/overview")
async def get_system_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    active_sessions = db.query(UserSession).filter(
        UserSession.is_active == True,
        UserSession.expires_at > now,
    ).all()

    active_user_ids = {session.user_id for session in active_sessions}
    connected_headsets = sum(1 for session in active_sessions if session.vr_device_id)
    current_session = get_active_session(current_user.id, db)

    return JSONResponse(content={
        "active_users": len(active_user_ids),
        "connected_headsets": connected_headsets,
        "active_sessions": len(active_sessions),
        "active_pairings": pairing_service.get_active_pairs_count(),
        "current_user": {
            "id": current_user.id,
            "subscription_tier": str(current_user.subscription_tier),
            "is_device_paired": current_user.is_device_paired,
        },
        "current_session": serialize_session_status(current_session),
        "generated_at": now.isoformat(),
    })
