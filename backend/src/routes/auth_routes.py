"""
Authentication Routes
Equivalent to TypeScript's authRoutes.ts
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.services.auth_service import auth_service
from src.middleware.auth_middleware import get_current_user
from src.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register new user account"""
    try:
        user = auth_service.register_user(
            db, request.username, request.email, request.password
        )
        token = auth_service.create_access_token(user.id, user.username)
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": user.to_dict()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with username and password"""
    user = auth_service.authenticate_user(db, request.username, request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    token = auth_service.create_access_token(user.id, user.username)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict()
    }


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile"""
    return {"user": current_user.to_dict()}


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Frontend token is stateless JWT, so logout is client-side only."""
    return {"success": True, "message": f"Logged out {current_user.username}"}
