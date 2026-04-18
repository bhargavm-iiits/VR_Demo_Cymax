"""
WebSocket Manager
Equivalent to TypeScript's socketManager.ts
Uses python-socketio instead of socket.io npm
"""

import socketio
from datetime import datetime
from src.services.auth_service import auth_service
import logging

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True
)

# Track connected clients
connected_clients = {}  # socket_id → {user_id, device_type, session_id}

@sio.event
async def connect(sid, environ, auth):
    """Handle new WebSocket connection"""
    try:
        token = auth.get("token") if auth else None
        if not token:
            logger.warning(f"⚠️ Unauthorized connection attempt: {sid}")
            return False
        
        payload = auth_service.verify_token(token)
        if not payload:
            return False
        
        device_type = auth.get("device_type", "web")  # "web" or "vr"
        
        connected_clients[sid] = {
            "user_id": payload["sub"],
            "username": payload["username"],
            "device_type": device_type,
            "connected_at": datetime.utcnow().isoformat()
        }
        
        # Join user's room for targeted messaging
        await sio.enter_room(sid, f"user_{payload['sub']}")
        
        logger.info(f"✅ Connected: {sid} | User: {payload['username']} | Device: {device_type}")
        
        await sio.emit('connected', {
            "status": "connected",
            "sid": sid,
            "device_type": device_type
        }, room=sid)
        
    except Exception as e:
        logger.error(f"❌ Connection error: {e}")
        return False

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    if sid in connected_clients:
        client = connected_clients.pop(sid)
        logger.info(f"🔌 Disconnected: {sid} | User: {client['username']}")

@sio.event
async def playback_command(sid, data):
    """
    Handle playback commands from web controller
    Routes commands to VR headset
    
    Commands: play, pause, stop, seek, volume
    """
    if sid not in connected_clients:
        return
    
    client = connected_clients[sid]
    user_id = client["user_id"]
    
    command = data.get("command")
    payload = data.get("payload", {})
    
    logger.info(f"▶️ Command: {command} from {client['username']}")
    
    # Emit command to all devices in user's room
    await sio.emit(
        'execute_command',
        {
            "command": command,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat(),
            "from_device": client["device_type"]
        },
        room=f"user_{user_id}",
        skip_sid=sid  # Don't send back to sender
    )

async def broadcast_to_user(user_id: str, event: str, data: dict):
    """Send event to all devices of a specific user"""
    await sio.emit(event, data, room=f"user_{user_id}")