import logging
from contextlib import contextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as process_router
from app.database.session import Base, SessionLocal, engine
from app.services.auth_service import AuthService
from app.services.vector_store import VectorStore

# ensure model metadata is imported before creating tables
from app.database import event as _event_model  # noqa: F401
from app.database import user as _user_model  # noqa: F401

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router)

DEFAULT_USER_SEED = [
    {
        "email": "admin@doculens.ai",
        "password": "Admin!234",
        "full_name": "Avery Quinn",
        "persona": "executive",
        "role": "admin",
        "access_level": "full",
    },
    {
        "email": "analyst@doculens.ai",
        "password": "Analyst!234",
        "full_name": "Jordan Patel",
        "persona": "analyst",
        "role": "analyst",
    },
    {
        "email": "reviewer@doculens.ai",
        "password": "Reviewer!234",
        "full_name": "Morgan Lee",
        "persona": "reviewer",
        "role": "reviewer",
    },
    {
        "email": "manager@doculens.ai",
        "password": "Manager!234",
        "full_name": "Taylor Brooks",
        "persona": "manager",
        "role": "manager",
    },
    {
        "email": "developer@doculens.ai",
        "password": "Developer!234",
        "full_name": "Riley Chen",
        "persona": "developer",
        "role": "developer",
    },
    {
        "email": "viewer@doculens.ai",
        "password": "Viewer!234",
        "full_name": "Skyler James",
        "persona": "executive",
        "role": "viewer",
        "access_level": "minimal",
    },
]


@contextmanager
def _session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@app.on_event("startup")
def ensure_vector_store_ready() -> None:
    """Initialize database requirements and ensure supporting services are warm."""
    Base.metadata.create_all(bind=engine)

    with _session_scope() as session:
        AuthService(session).ensure_seed_users(DEFAULT_USER_SEED)

    try:
        vector_store = VectorStore()
        vector_store.create_tables()
        vector_store.create_keyword_search_index()
    except Exception as exc:
        logging.getLogger(__name__).warning("Unable to initialize vector store: %s", exc)
