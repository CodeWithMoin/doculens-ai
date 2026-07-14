"""Dependency-free retrieval metrics suitable for CI regression tests."""

from dataclasses import dataclass
from statistics import mean
from typing import Iterable, Sequence


@dataclass(frozen=True)
class RetrievalExample:
    """A ranked retrieval result paired with known relevant chunk identifiers."""

    query: str
    retrieved_ids: Sequence[str]
    relevant_ids: frozenset[str]


def recall_at_k(example: RetrievalExample, k: int) -> float:
    """Return the fraction of known relevant chunks retrieved in the top k."""
    if not example.relevant_ids:
        return 1.0
    found = set(example.retrieved_ids[:k]) & example.relevant_ids
    return len(found) / len(example.relevant_ids)


def reciprocal_rank(example: RetrievalExample) -> float:
    """Return inverse rank of the first relevant result, or zero."""
    for rank, chunk_id in enumerate(example.retrieved_ids, start=1):
        if chunk_id in example.relevant_ids:
            return 1.0 / rank
    return 0.0


def evaluate(examples: Iterable[RetrievalExample], k: int = 5) -> dict[str, float]:
    """Aggregate metrics for a versioned, human-labelled retrieval fixture."""
    cases = list(examples)
    if not cases:
        return {f"recall@{k}": 0.0, "mrr": 0.0, "examples": 0.0}
    return {
        f"recall@{k}": mean(recall_at_k(case, k) for case in cases),
        "mrr": mean(reciprocal_rank(case) for case in cases),
        "examples": float(len(cases)),
    }
