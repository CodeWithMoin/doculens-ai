import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as process_router
from app.services.vector_store import VectorStore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router)


@app.on_event("startup")
def ensure_vector_store_ready() -> None:
    """Ensure the embeddings table and supporting indexes exist before serving traffic."""
    try:
        vector_store = VectorStore()
        vector_store.create_tables()
        vector_store.create_keyword_search_index()
    except Exception as exc:
        logging.getLogger(__name__).warning("Unable to initialize vector store: %s", exc)
