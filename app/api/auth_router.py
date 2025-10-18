from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.dependencies import db_session
from app.database.user import User
from app.services.auth_service import (
    AuthService,
    PERSONA_OPTIONS,
    ROLE_DEFINITIONS,
    create_access_token,
    get_current_user,
)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    persona: str
    role: str
    access_level: str

    @classmethod
    def from_orm(cls, user: User) -> "UserProfile":
        return cls(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            persona=user.persona,
            role=user.role,
            access_level=user.access_level,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
    personas: list[str]
    roles: dict[str, dict[str, str]]


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, session: Session = Depends(db_session)) -> TokenResponse:
    service = AuthService(session)
    user = service.authenticate_user(email=request.email, password=request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    token = create_access_token(user=user)
    return TokenResponse(
        access_token=token,
        user=UserProfile.from_orm(user),
        personas=PERSONA_OPTIONS,
        roles=ROLE_DEFINITIONS,
    )


@router.get("/me", response_model=UserProfile)
def get_profile(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile.from_orm(current_user)
