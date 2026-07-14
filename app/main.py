"""FastAPI application factory and lifecycle management."""

import logging
from contextlib import asynccontextmanager, contextmanager
from typing import Iterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.router import router as api_router
from app.config.settings import Settings, get_settings
from app.core.observability import configure_logging, request_context_middleware
from app.database import event as _event_model  # noqa: F401
from app.database import user as _user_model  # noqa: F401
from app.database.session import Base, SessionLocal, engine
from app.services.auth_service import AuthService
from app.services.demo_workspace import seed_demo_workspace
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)

DEMO_USERS = [
    {"email": "admin@doculens.ai", "password": "Admin!234", "full_name": "Demo Admin", "persona": "executive", "role": "admin"},
    {"email": "analyst@doculens.ai", "password": "Analyst!234", "full_name": "Demo Analyst", "persona": "analyst", "role": "analyst"},
]


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def initialize_dependencies(settings: Settings) -> None:
    """Initialize local-development resources; migrations own production schema."""
    if not settings.initialize_database:
        return
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo_users:
        with session_scope() as session:
            AuthService(session).ensure_seed_users(DEMO_USERS)
    store = VectorStore()
    store.create_tables()
    store.create_keyword_search_index()
    if settings.seed_demo_workspace:
        with session_scope() as session:
            inserted = seed_demo_workspace(
                session,
                embedding_dimensions=settings.database.vector_store.embedding_dimensions,
            )
        if inserted:
            logger.info("Seeded the synthetic local demo workspace")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build an independently configurable application for runtime and tests."""
    runtime = settings or get_settings()
    runtime.assert_production_safe()
    configure_logging(runtime.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            initialize_dependencies(runtime)
        except Exception:
            logger.exception("Dependency initialization failed; readiness will remain unhealthy")
        yield

    application = FastAPI(
        title=runtime.app_name,
        version="1.0.0",
        description="Asynchronous document intelligence and retrieval API.",
        lifespan=lifespan,
    )
    application.middleware("http")(request_context_middleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=runtime.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", runtime.api_key_header, "X-Request-ID"],
    )
    application.include_router(api_router)
    application.include_router(api_router, prefix="/api/v1")

    @application.get("/health/live", tags=["health"], summary="Process liveness")
    def liveness() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()
