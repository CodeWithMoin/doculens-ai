"""Chunk preparation and batched embedding persistence."""

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

import pandas as pd
from timescale_vector.client import uuid_from_time

from app.doc_utils.utils.tokenizer import OpenAITokenizerWrapper
from app.services.vector_store import VectorStore

MAX_EMBEDDING_TOKENS = 8191


@lru_cache(maxsize=1)
def _get_tokenizer() -> OpenAITokenizerWrapper:
    """Load tokenizer assets only when an embedding job needs them."""
    return OpenAITokenizerWrapper()


def _prepare_text(text: str) -> str:
    normalized = " ".join(text.split())
    tokenizer = _get_tokenizer()
    token_ids = tokenizer.tokenizer.encode(normalized)
    if len(token_ids) > MAX_EMBEDDING_TOKENS:
        return tokenizer.tokenizer.decode(token_ids[:MAX_EMBEDDING_TOKENS])
    return normalized


def _chunk_text(chunk: Any) -> str:
    for attribute in ("text", "content", "value"):
        value = getattr(chunk, attribute, None)
        if value:
            return str(value)
    return str(chunk)


def _chunk_metadata(
    chunk: Any,
    document_id: Optional[str],
    chunk_index: int,
    token_count: int,
    document_metadata: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    meta = getattr(chunk, "meta", None)
    origin = getattr(meta, "origin", None)
    doc_items = getattr(meta, "doc_items", []) or []
    pages = sorted(
        {
            page
            for item in doc_items
            for provenance in (getattr(item, "prov", []) or [])
            if (page := getattr(provenance, "page_no", None)) is not None
        }
    )
    headings = getattr(meta, "headings", []) or []
    metadata: Dict[str, Any] = {
        "document_id": document_id,
        "filename": getattr(origin, "filename", None),
        "page_numbers": pages or None,
        "title": headings[0] if headings else None,
        "chunk_index": chunk_index,
        "token_count": token_count,
    }
    metadata.update({key: value for key, value in (document_metadata or {}).items() if value is not None})
    return {key: value for key, value in metadata.items() if value is not None}


def embed_and_upsert_chunks(
    chunks: List[Any],
    embedding_model: str | None = None,
    document_id: Optional[str] = None,
    document_metadata: Optional[Dict[str, Any]] = None,
    vector_store: VectorStore | None = None,
) -> List[Dict[str, Any]]:
    """Embed chunks in bounded batches and persist them with citation metadata.

    The optional store is an intentional injection seam: tests and alternative
    vector backends do not need to patch module-level SDK clients.
    """
    prepared = [_prepare_text(_chunk_text(chunk)) for chunk in chunks]
    non_empty = [(chunk, text) for chunk, text in zip(chunks, prepared) if text]
    if not non_empty:
        return []

    store = vector_store or VectorStore()
    tokenizer = _get_tokenizer()
    texts = [text for _, text in non_empty]
    embeddings = store.embed_texts(texts, model=embedding_model)
    base_time = datetime.now(timezone.utc)
    ids = [str(uuid_from_time(base_time + timedelta(microseconds=index))) for index in range(len(texts))]
    metadata = [
        _chunk_metadata(chunk, document_id, index, tokenizer.count_tokens(text), document_metadata)
        for index, ((chunk, text)) in enumerate(non_empty)
    ]
    store.upsert(pd.DataFrame({"id": ids, "metadata": metadata, "contents": texts, "embedding": embeddings}))

    return [
        {
            "id": record_id,
            "preview": text[:160],
            "token_count": meta["token_count"],
            "page_numbers": meta.get("page_numbers"),
            "document_id": meta.get("document_id"),
            "doc_type": meta.get("doc_type"),
            "filename": meta.get("filename"),
        }
        for record_id, text, meta in zip(ids, texts, metadata)
    ]
