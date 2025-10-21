from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.api.dependencies import db_session
from app.config.settings import get_settings
from app.database.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


ROLE_DEFINITIONS: Dict[str, Dict[str, str]] = {
    "admin": {
        "label": "Admin",
        "access_level": "full",
        "description": "Manages users, roles, settings, and integrations.",
        "permissions": "Manage all documents, users, system config, API keys.",
    },
    "analyst": {
        "label": "Analyst",
        "access_level": "standard",
        "description": "Uploads, processes, validates, and queries documents.",
        "permissions": "Upload, view, run QA, approve summaries, export results.",
    },
    "reviewer": {
        "label": "Reviewer",
        "access_level": "limited",
        "description": "Verifies, comments, and audits existing documents.",
        "permissions": "Read-only access, approve/reject AI outputs, add notes.",
    },
    "manager": {
        "label": "Manager",
        "access_level": "read-heavy",
        "description": "Views dashboards and KPIs, but no write access.",
        "permissions": "View metrics, summaries, and team performance data.",
    },
    "developer": {
        "label": "Developer",
        "access_level": "technical",
        "description": "Integrates APIs, monitors pipelines, tests embeddings.",
        "permissions": "Access API keys, logs, technical diagnostics.",
    },
    "viewer": {
        "label": "Viewer / Guest",
        "access_level": "minimal",
        "description": "Can view demo dashboards or public summaries.",
        "permissions": "Read-only access to approved data.",
    },
}

PERSONA_OPTIONS = ["analyst", "manager", "reviewer", "developer", "executive"]


class AuthService:
    """Service wrapper for user and token operations."""

    def __init__(self, session: Session):
        self.session = session

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        return pwd_context.verify(password, hashed)

    def get_user_by_email(self, email: str) -> Optional[User]:
        return (
            self.session.query(User)
            .filter(User.email == email.lower())
            .first()
        )

    def authenticate_user(self, *, email: str, password: str) -> Optional[User]:
        user = self.get_user_by_email(email=email)
        if not user or not user.is_active:
            return None
        if not self.verify_password(password, user.hashed_password):
            return None
        return user

    def create_user(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        persona: str,
        role: str,
        access_level: Optional[str] = None,
    ) -> User:
        existing = self.get_user_by_email(email=email)

        role_key = role.lower()
        persona_value = persona.lower()
        if persona_value not in PERSONA_OPTIONS:
            persona_value = PERSONA_OPTIONS[0]
        derived_access = ROLE_DEFINITIONS.get(role_key, {}).get("access_level", "standard")
        desired_access = access_level or derived_access

        if existing:
            updated = False
            if not self.verify_password(password, existing.hashed_password):
                existing.hashed_password = self.hash_password(password)
                updated = True
            if existing.full_name != full_name:
                existing.full_name = full_name
                updated = True
            if existing.persona != persona_value:
                existing.persona = persona_value
                updated = True
            if existing.role != role_key:
                existing.role = role_key
                updated = True
            if existing.access_level != desired_access:
                existing.access_level = desired_access
                updated = True

            if updated:
                self.session.add(existing)
                self.session.commit()
                self.session.refresh(existing)
            return existing

        user = User(
            email=email.lower(),
            hashed_password=self.hash_password(password),
            full_name=full_name,
            persona=persona_value,
            role=role_key,
            access_level=desired_access,
        )
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def ensure_seed_users(self, seeds: Iterable[Dict[str, str]]) -> None:
        for seed in seeds:
            self.create_user(**seed)


def create_access_token(*, user: User) -> str:
    settings = get_settings()
    expire_minutes = settings.auth_token_exp_minutes
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "persona": user.persona,
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm=settings.auth_algorithm)


def decode_access_token(token: str, session: Session) -> User:
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.auth_secret_key, algorithms=[settings.auth_algorithm])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise credentials_exception from exc

    if not user_id:
        raise credentials_exception

    user = session.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise credentials_exception
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    session: Session = Depends(db_session),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_access_token(credentials.credentials, session)
