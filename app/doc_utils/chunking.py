from typing import Any, List

from docling_core.transforms.chunker.hybrid_chunker import HybridChunker

from app.doc_utils.utils.tokenizer import OpenAITokenizerWrapper

# Maximum context length for text-embedding-3-large
MAX_TOKENS: int = 8191


def chunk_document(
    docling_document: Any,
    max_tokens: int = MAX_TOKENS,
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

    tokenizer = OpenAITokenizerWrapper()
    chunker = HybridChunker(
        tokenizer=tokenizer,
        merge_peers=merge_peers,
    )
    chunk_iter = chunker.chunk(docling_document, max_length=max_tokens)
    return list(chunk_iter)
