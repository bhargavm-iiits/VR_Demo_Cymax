"""
Command Handler
Processes VR playback commands
Equivalent to TypeScript's commandHandler.ts
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class PlaybackCommand(str, Enum):
    PLAY = "play"
    PAUSE = "pause"
    STOP = "stop"
    SEEK = "seek"
    VOLUME = "volume"
    LOAD_MOVIE = "load_movie"
    GET_STATUS = "get_status"

@dataclass
class CommandPayload:
    command: PlaybackCommand
    position_seconds: Optional[float] = None
    volume_level: Optional[int] = None
    movie_id: Optional[int] = None
    stream_token: Optional[str] = None

class CommandHandler:
    
    def validate_command(self, command_str: str, payload: dict) -> CommandPayload:
        """Validate and parse incoming command"""
        try:
            command = PlaybackCommand(command_str)
        except ValueError:
            raise ValueError(f"Unknown command: {command_str}")
        
        return CommandPayload(
            command=command,
            position_seconds=payload.get("position_seconds"),
            volume_level=payload.get("volume_level"),
            movie_id=payload.get("movie_id"),
            stream_token=payload.get("stream_token")
        )
    
    def format_vr_command(self, cmd: CommandPayload) -> dict:
        """Format command for VR headset consumption"""
        return {
            "action": cmd.command.value,
            "params": {
                "seek_to": cmd.position_seconds,
                "volume": cmd.volume_level,
                "movie_id": cmd.movie_id,
            }
        }

command_handler = CommandHandler()