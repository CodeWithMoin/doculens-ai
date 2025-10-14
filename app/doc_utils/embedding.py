from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import pandas as pd
from openai import OpenAI

from app.doc_utils.utils.tokenizer import OpenAITokenizerWrapper
from app.services.vector_store import VectorStore
from timescale_vector.client import uuid_from_time

# Constants
MAX_TOKENS = 8191  # text-embedding-3-large's maximum context length

# Initialize OpenAI client (make sure you have OPENAI_API_KEY in your environment variables)
client = OpenAI()
tokenizer = OpenAITokenizerWrapper()


def _normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return text.strip()


def _prepare_text_for_embedding(text: str) -> str:
    token_ids = tokenizer.tokenizer.encode(text)
    if len(token_ids) <= MAX_TOKENS:
        return text
    trimmed = token_ids[:MAX_TOKENS]
    return tokenizer.tokenizer.decode(trimmed)


def _extract_chunk_text(chunk: Any) -> str:
    for attr in ("text", "content", "value"):
        value = getattr(chunk, attr, None)
        if value:
            return str(value)
    return str(chunk)


def _extract_metadata(
    chunk: Any,
    document_id: Optional[str],
    chunk_index: int,
    token_count: int,
    document_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    meta = getattr(chunk, "meta", None)
    origin = getattr(meta, "origin", None)
    filename = getattr(origin, "filename", None)
    doc_items = getattr(meta, "doc_items", []) or []
    page_numbers = sorted([
        getattr(prov, "page_no")
        for item in doc_items
        for prov in getattr(item, "prov", []) or []
        if getattr(prov, "page_no", None) is not None
    ])
    headings = getattr(meta, "headings", []) or []

    metadata: Dict[str, Any] = {
        "filename": filename,
        "page_numbers": page_numbers or None,
        "title": headings[0] if headings else None,
        "chunk_index": chunk_index,
        "token_count": token_count,
    }
    if document_id:
        metadata["document_id"] = document_id
    if document_metadata:
        for key, value in document_metadata.items():
            if value is not None:
                metadata[key] = value
    return metadata


def embed_and_upsert_chunks(
    chunks: List[Any],
    embedding_model: str = "text-embedding-3-small",
    document_id: Optional[str] = None,
    document_metadata: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Generate embeddings for Docling chunks and upsert them into the vector store.

    Args:
        chunks: List of Docling chunk objects.
        embedding_model: Name of the embedding model to use.
        document_id: Optional identifier associated with the source document.

    Returns:
        List of dictionaries summarising the inserted chunks (safe for serialization).
    """
    if not chunks:
        return []

    raw_texts = [_extract_chunk_text(chunk) for chunk in chunks]
    prepared_texts = [_prepare_text_for_embedding(_normalize_text(text)) for text in raw_texts]
    token_counts = [tokenizer.count_tokens(text) for text in prepared_texts]

    response = client.embeddings.create(input=prepared_texts, model=embedding_model)
    embeddings = [item.embedding for item in response.data]

    base_time = datetime.now(timezone.utc)
    record_ids: List[str] = [
        str(uuid_from_time(base_time + timedelta(microseconds=index)))
        for index in range(len(chunks))
    ]
    metadata_list = [
        _extract_metadata(
            chunk,
            document_id,
            index,
            token_counts[index],
            document_metadata=document_metadata,
        )
        for index, chunk in enumerate(chunks)
    ]

    df = pd.DataFrame(
        {
            "id": record_ids,
            "metadata": metadata_list,
            "contents": prepared_texts,
            "embedding": embeddings,
        }
    )

    vector_store = VectorStore()
    vector_store.upsert(df)

    chunk_summaries: List[Dict[str, Any]] = []
    for record_id, text, metadata in zip(record_ids, prepared_texts, metadata_list):
        chunk_summaries.append(
            {
                "id": record_id,
                "preview": text[:160],
                "token_count": metadata.get("token_count"),
                "page_numbers": metadata.get("page_numbers"),
                "document_id": metadata.get("document_id"),
                "doc_type": metadata.get("doc_type"),
                "filename": metadata.get("filename"),
            }
        )

    return chunk_summaries
