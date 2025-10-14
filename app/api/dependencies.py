import logging
from typing import Generator

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.database.session import SessionLocal


def db_session() -> Generator:
    """Database Session Dependency.

    This function provides a database session for each request.
    It ensures that the session is committed after successful operations.
    """
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as ex:
        session.rollback()
        logging.error(ex)
        raise ex
    finally:
        session.close()


def require_api_key(request: Request) -> None:
    """Verify that the request carries the expected API key if configured."""
    settings = get_settings()
    expected_key = settings.api_key
    if not expected_key:
        return

    provided_key = request.headers.get(settings.api_key_header)
    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key.",
        )

    if provided_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )
