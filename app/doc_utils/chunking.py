from typing import Any, List

from docling_core.transforms.chunker.hybrid_chunker import HybridChunker

from app.config.settings import get_settings
from app.doc_utils.utils.tokenizer import OpenAITokenizerWrapper

# Deliberately much smaller than the embedding model limit. Retrieval quality is
# generally better with focused chunks than with page-sized 8k token passages.
DEFAULT_MAX_TOKENS: int = 800


def chunk_document(
    docling_document: Any,
    max_tokens: int | None = None,
    merge_peers: bool = True,
) -> List[Any]:
    """Chunk a Docling document using the HybridChunker.

    Args:
        docling_document: The Docling document object to chunk.
        max_tokens: Maximum tokens per chunk.
        merge_peers: Whether to merge peer nodes (paragraph + table, etc.).

    Returns:
        List of chunk objects.

    Raises:
        ValueError: If the provided document is None.
    """
    if docling_document is None:
        raise ValueError("Cannot chunk a null document. Ensure extraction succeeded.")

    effective_max_tokens = max_tokens or get_settings().chunk_max_tokens
    tokenizer = OpenAITokenizerWrapper()
    chunker = HybridChunker(
        tokenizer=tokenizer,
        merge_peers=merge_peers,
    )
    chunk_iter = chunker.chunk(docling_document, max_length=effective_max_tokens)
    return list(chunk_iter)
