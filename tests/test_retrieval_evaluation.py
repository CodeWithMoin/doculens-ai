from app.evaluation.retrieval import RetrievalExample, evaluate, recall_at_k, reciprocal_rank


def test_retrieval_metrics_are_deterministic():
    example = RetrievalExample("invoice total", ["noise", "total", "date"], frozenset({"total", "date"}))
    assert recall_at_k(example, 2) == 0.5
    assert reciprocal_rank(example) == 0.5
    assert evaluate([example], k=3) == {"recall@3": 1.0, "mrr": 0.5, "examples": 1.0}
