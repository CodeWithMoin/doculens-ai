from typing import Any, Dict, List, Optional

from app.services.vector_store import VectorStore


def semantic_search_docling(
    query: str,
    limit: int = 5,
    metadata_filter: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Perform semantic search over the Docling chunks stored in the vector store.

    Args:
        query: The search query string.
        limit: The maximum number of results to return.
        metadata_filter: Optional metadata filters applied at search time.

    Returns:
        List of result dictionaries (safe for JSON serialization).
    """
    vector_store = VectorStore()
    results = vector_store.semantic_search(
        query=query,
        limit=limit,
        metadata_filter=metadata_filter,
        return_dataframe=True,
    )

    normalized_records: List[Dict[str, Any]] = []

    if hasattr(results, "to_dict"):
        for row in results.to_dict(orient="records"):
            metadata = {
                key: value
                for key, value in row.items()
                if key not in {"id", "contents", "embedding", "distance"}
            }
            normalized_records.append(
                {
                    "id": str(row.get("id")),
                    "metadata": metadata,
                    "contents": row.get("contents"),
                    "distance": row.get("distance"),
                }
            )
    else:
        for row in results:
            normalized_records.append(
                {
                    "id": str(row[0]),
                    "metadata": row[1] or {},
                    "contents": row[2],
                    "distance": row[4] if len(row) > 4 else None,
                }
            )

    return normalized_records
