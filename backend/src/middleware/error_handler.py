"""
Global Error Handler Middleware
Equivalent to TypeScript's errorHandler.ts

Catches all unhandled exceptions and returns
consistent JSON error responses.
"""

import logging
import traceback
from datetime import datetime
from typing import Union

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from jose import JWTError

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# CUSTOM EXCEPTION CLASSES
# ─────────────────────────────────────────────────────────────

class VRCinemaException(Exception):
    """Base exception for VR Cinema application"""
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR"
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)


class AuthenticationError(VRCinemaException):
    """Raised for authentication failures"""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            status_code=401,
            error_code="AUTH_FAILED"
        )


class AuthorizationError(VRCinemaException):
    """Raised for authorization/permission failures"""
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            message=message,
            status_code=403,
            error_code="ACCESS_DENIED"
        )


class SubscriptionError(VRCinemaException):
    """Raised when subscription tier is insufficient"""
    def __init__(self, required_tier: str):
        super().__init__(
            message=f"'{required_tier}' subscription required for this content",
            status_code=403,
            error_code="SUBSCRIPTION_REQUIRED"
        )


class ContentNotFoundError(VRCinemaException):
    """Raised when requested content does not exist"""
    def __init__(self, resource: str, resource_id: Union[int, str]):
        super().__init__(
            message=f"{resource} with ID '{resource_id}' not found",
            status_code=404,
            error_code="NOT_FOUND"
        )


class EncryptionError(VRCinemaException):
    """Raised for encryption/decryption failures"""
    def __init__(self, message: str = "Encryption operation failed"):
        super().__init__(
            message=message,
            status_code=500,
            error_code="ENCRYPTION_ERROR"
        )


class StreamTokenError(VRCinemaException):
    """Raised for invalid or expired stream tokens"""
    def __init__(self, message: str = "Invalid or expired stream token"):
        super().__init__(
            message=message,
            status_code=401,
            error_code="STREAM_TOKEN_INVALID"
        )


class DevicePairingError(VRCinemaException):
    """Raised for device pairing failures"""
    def __init__(self, message: str = "Device pairing failed"):
        super().__init__(
            message=message,
            status_code=400,
            error_code="PAIRING_FAILED"
        )


# ─────────────────────────────────────────────────────────────
# ERROR RESPONSE BUILDER
# ─────────────────────────────────────────────────────────────

def build_error_response(
    status_code: int,
    error_code: str,
    message: str,
    details: Union[dict, list, None] = None
) -> JSONResponse:
    """
    Build a standardized JSON error response.

    All errors follow this structure:
    {
        "error": true,
        "error_code": "SPECIFIC_ERROR_CODE",
        "message": "Human-readable message",
        "details": {...},
        "timestamp": "2024-..."
    }
    """
    content = {
        "error": True,
        "error_code": error_code,
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }

    if details:
        content["details"] = details

    return JSONResponse(
        status_code=status_code,
        content=content
    )


# ─────────────────────────────────────────────────────────────
# REGISTER ALL HANDLERS
# ─────────────────────────────────────────────────────────────

def register_error_handlers(app: FastAPI) -> None:
    """
    Register all exception handlers with FastAPI app.
    Call this in server.py during app initialization.

    Usage in server.py:
        from src.middleware.error_handler import register_error_handlers
        register_error_handlers(app)
    """

    # ── Custom VR Cinema Exceptions ─────────────────────────
    @app.exception_handler(VRCinemaException)
    async def vr_cinema_exception_handler(
        request: Request,
        exc: VRCinemaException
    ) -> JSONResponse:
        logger.warning(
            f"[{exc.error_code}] {exc.message} | "
            f"Path: {request.url.path}"
        )
        return build_error_response(
            status_code=exc.status_code,
            error_code=exc.error_code,
            message=exc.message
        )

    # ── Pydantic Validation Errors ───────────────────────────
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError
    ) -> JSONResponse:
        """
        Handle Pydantic request validation errors.
        Returns detailed field-level error messages.
        """
        # Format validation errors for client
        formatted_errors = []
        for error in exc.errors():
            field_path = " → ".join(str(loc) for loc in error["loc"])
            formatted_errors.append({
                "field": field_path,
                "message": error["msg"],
                "type": error["type"]
            })

        logger.warning(
            f"Validation error | Path: {request.url.path} | "
            f"Errors: {formatted_errors}"
        )

        return build_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"validation_errors": formatted_errors}
        )

    # ── JWT Authentication Errors ────────────────────────────
    @app.exception_handler(JWTError)
    async def jwt_exception_handler(
        request: Request,
        exc: JWTError
    ) -> JSONResponse:
        logger.warning(f"JWT error | Path: {request.url.path} | {str(exc)}")
        return build_error_response(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="INVALID_TOKEN",
            message="Invalid or expired authentication token"
        )

    # ── SQLAlchemy Database Errors ───────────────────────────
    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(
        request: Request,
        exc: IntegrityError
    ) -> JSONResponse:
        """Handle database unique constraint violations, FK errors."""
        logger.error(
            f"Database integrity error | "
            f"Path: {request.url.path} | {str(exc.orig)}"
        )

        # Parse common integrity errors
        error_str = str(exc.orig).lower()
        if "unique" in error_str:
            message = "Record already exists (duplicate value)"
            error_code = "DUPLICATE_ENTRY"
        elif "foreign key" in error_str:
            message = "Referenced record does not exist"
            error_code = "FOREIGN_KEY_ERROR"
        else:
            message = "Database constraint violation"
            error_code = "DB_CONSTRAINT_ERROR"

        return build_error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_code=error_code,
            message=message
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_error_handler(
        request: Request,
        exc: SQLAlchemyError
    ) -> JSONResponse:
        """Handle general SQLAlchemy errors."""
        logger.error(
            f"Database error | Path: {request.url.path} | {str(exc)}"
        )
        return build_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            message="A database error occurred"
        )

    # ── File Not Found ───────────────────────────────────────
    @app.exception_handler(FileNotFoundError)
    async def file_not_found_handler(
        request: Request,
        exc: FileNotFoundError
    ) -> JSONResponse:
        logger.error(f"File not found | Path: {request.url.path} | {str(exc)}")
        return build_error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="FILE_NOT_FOUND",
            message="Requested file or resource not found"
        )

    # ── Permission Error ─────────────────────────────────────
    @app.exception_handler(PermissionError)
    async def permission_error_handler(
        request: Request,
        exc: PermissionError
    ) -> JSONResponse:
        logger.error(f"Permission denied | Path: {request.url.path} | {str(exc)}")
        return build_error_response(
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="PERMISSION_DENIED",
            message="Permission denied to access this resource"
        )

    # ── Generic/Unhandled Exceptions ─────────────────────────
    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request,
        exc: Exception
    ) -> JSONResponse:
        """
        Catch-all handler for unexpected exceptions.
        Logs full traceback but returns safe message to client.
        """
        logger.error(
            f"Unhandled exception | "
            f"Path: {request.url.path} | "
            f"Type: {type(exc).__name__} | "
            f"Message: {str(exc)}\n"
            f"Traceback:\n{traceback.format_exc()}"
        )

        return build_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred. Please try again.",
        )

    logger.info("✅ Error handlers registered successfully")


# ─────────────────────────────────────────────────────────────
# REQUEST LOGGING MIDDLEWARE
# ─────────────────────────────────────────────────────────────

async def log_requests_middleware(request: Request, call_next):
    """
    Log all incoming requests and responses.
    Add to server.py with:
        app.middleware("http")(log_requests_middleware)
    """
    start_time = datetime.utcnow()

    # Log request
    logger.info(
        f"→ {request.method} {request.url.path} | "
        f"IP: {request.client.host if request.client else 'unknown'}"
    )

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

    # Log response
    log_fn = logger.info if response.status_code < 400 else logger.warning
    log_fn(
        f"← {response.status_code} {request.url.path} | "
        f"{duration_ms:.1f}ms"
    )

    # Add timing header
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"

    return response