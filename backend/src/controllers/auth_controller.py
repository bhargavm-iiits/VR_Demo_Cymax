"""
Authentication Controller
Handles all HTTP request/response logic for authentication
Equivalent to TypeScript's authController.ts

Endpoints:
  POST /api/auth/register   → Register new user
  POST /api/auth/login      → Login user
  POST /api/auth/logout     → Logout user
  GET  /api/auth/me         → Get current user profile
  POST /api/auth/refresh    → Refresh JWT token
  POST /api/auth/verify     → Verify email (optional)
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from src.config.database import get_db
from src.models.user import User, SubscriptionTier
from src.services.auth_service import auth_service
from src.middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS (Request / Response Models)
# ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 50:
            raise ValueError("Username must be under 50 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, _ and -")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        v = v.strip().lower()
        if "@" not in v or "." not in v:
            raise ValueError("Invalid email format")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def strip_username(cls, v):
        return v.strip()


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    email: Optional[str] = None
    vr_device_id: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_valid(cls, v):
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    subscription_tier: str
    is_device_paired: bool
    created_at: str

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: dict


# ─────────────────────────────────────────────────────────────
# ROUTER SETUP
# ─────────────────────────────────────────────────────────────

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
    responses={
        401: {"description": "Unauthorized"},
        422: {"description": "Validation Error"},
    }
)


# ─────────────────────────────────────────────────────────────
# ENDPOINT: REGISTER
# ─────────────────────────────────────────────────────────────

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    response_description="User created and JWT token returned"
)
async def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
) -> AuthResponse:
    """
    Register a new VR Cinema user.

    - Validates username, email, password
    - Hashes password with bcrypt
    - Creates user record in database
    - Returns JWT access token immediately
    """
    logger.info(f"📝 Registration attempt: username='{request.username}'")

    try:
        # Create user via auth service
        user = auth_service.register_user(
            db=db,
            username=request.username,
            email=request.email,
            password=request.password
        )

        # Generate access token
        access_token = auth_service.create_access_token(
            user_id=user.id,
            username=user.username
        )

        logger.info(f"✅ Registration successful: user_id={user.id}")

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "access_token": access_token,
                "token_type": "bearer",
                "expires_in": 86400,  # 24 hours in seconds
                "user": user.to_dict(),
                "message": "Registration successful"
            }
        )

    except ValueError as e:
        logger.warning(f"⚠️ Registration failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to server error"
        )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: LOGIN
# ─────────────────────────────────────────────────────────────

@router.post(
    "/login",
    summary="Login with username and password",
    response_description="JWT access token returned on success"
)
async def login(
    request: LoginRequest,
    req: Request,
    db: Session = Depends(get_db)
) -> AuthResponse:
    """
    Authenticate user credentials and return JWT token.

    - Verifies username exists
    - Verifies bcrypt password hash
    - Updates last_login timestamp
    - Returns JWT access token for API requests
    """
    # Get client IP for logging
    client_ip = req.client.host if req.client else "unknown"
    logger.info(
        f"🔑 Login attempt: username='{request.username}' | IP={client_ip}"
    )

    # Authenticate via auth service
    user = auth_service.authenticate_user(
        db=db,
        username=request.username,
        password=request.password
    )

    if not user:
        logger.warning(
            f"⚠️ Failed login: username='{request.username}' | IP={client_ip}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact support."
        )

    # Generate token
    access_token = auth_service.create_access_token(
        user_id=user.id,
        username=user.username
    )

    logger.info(f"✅ Login successful: user_id={user.id} | IP={client_ip}")

    return JSONResponse(
        content={
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": 86400,
            "user": user.to_dict(),
            "message": "Login successful"
        }
    )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: LOGOUT
# ─────────────────────────────────────────────────────────────

@router.post(
    "/logout",
    summary="Logout current user",
    response_description="Logout confirmation"
)
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout the current authenticated user.

    - Invalidates active sessions in database
    - Clears device pairing (optional)
    - Client should discard the JWT token
    """
    logger.info(f"🚪 Logout: user_id={current_user.id}")

    try:
        # Deactivate all active sessions for this user
        from src.models.session import Session as UserSession
        db.query(UserSession).filter(
            UserSession.user_id == current_user.id,
            UserSession.is_active == True
        ).update({"is_active": False})
        db.commit()

        logger.info(f"✅ Logout complete: user_id={current_user.id}")

        return JSONResponse(content={
            "message": "Logged out successfully",
            "user_id": current_user.id
        })

    except Exception as e:
        logger.error(f"❌ Logout error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


# ─────────────────────────────────────────────────────────────
# ENDPOINT: GET CURRENT USER PROFILE
# ─────────────────────────────────────────────────────────────

@router.get(
    "/me",
    summary="Get current user profile",
    response_description="Current authenticated user data"
)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Return profile of the currently authenticated user.
    Requires valid JWT token in Authorization header.
    """
    logger.info(f"👤 Profile request: user_id={current_user.id}")

    return JSONResponse(content={
        "user": current_user.to_dict(),
        "subscription": {
            "tier": current_user.subscription_tier,
            "expires": (
                current_user.subscription_expires.isoformat()
                if current_user.subscription_expires else None
            )
        },
        "device": {
            "is_paired": current_user.is_device_paired,
            "device_id": current_user.vr_device_id
        }
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: UPDATE PROFILE
# ─────────────────────────────────────────────────────────────

@router.put(
    "/me",
    summary="Update user profile",
    response_description="Updated user data"
)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile information."""
    logger.info(f"✏️ Profile update: user_id={current_user.id}")

    try:
        if request.email:
            # Check email not taken
            existing = db.query(User).filter(
                User.email == request.email,
                User.id != current_user.id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="Email already in use"
                )
            current_user.email = request.email

        if request.vr_device_id is not None:
            current_user.vr_device_id = request.vr_device_id
            current_user.is_device_paired = bool(request.vr_device_id)

        current_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)

        return JSONResponse(content={
            "message": "Profile updated successfully",
            "user": current_user.to_dict()
        })

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Profile update error: {str(e)}")
        raise HTTPException(status_code=500, detail="Profile update failed")


# ─────────────────────────────────────────────────────────────
# ENDPOINT: CHANGE PASSWORD
# ─────────────────────────────────────────────────────────────

@router.post(
    "/change-password",
    summary="Change user password",
    response_description="Password change confirmation"
)
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change password for authenticated user.
    Requires current password verification before updating.
    """
    logger.info(f"🔑 Password change: user_id={current_user.id}")

    # Verify current password
    if not auth_service.verify_password(
        request.current_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )

    # Hash and save new password
    current_user.password_hash = auth_service.hash_password(request.new_password)
    current_user.updated_at = datetime.utcnow()

    # Invalidate all existing sessions (force re-login)
    from src.models.session import Session as UserSession
    db.query(UserSession).filter(
        UserSession.user_id == current_user.id
    ).update({"is_active": False})

    db.commit()

    logger.info(f"✅ Password changed: user_id={current_user.id}")

    return JSONResponse(content={
        "message": "Password changed successfully. Please login again."
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: VERIFY TOKEN (Health check for clients)
# ─────────────────────────────────────────────────────────────

@router.get(
    "/verify",
    summary="Verify if current token is valid",
    response_description="Token validity status"
)
async def verify_token(
    current_user: User = Depends(get_current_user)
):
    """
    Quick endpoint to verify token validity.
    VR headset calls this on startup to check stored token.
    """
    return JSONResponse(content={
        "valid": True,
        "user_id": current_user.id,
        "username": current_user.username,
        "subscription": current_user.subscription_tier
    })