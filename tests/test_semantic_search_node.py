from typing import Any, Dict, List

import pytest

from app.api.event_schema import SearchQueryEvent
from app.core.task import TaskContext
from app.pipelines.doculens_pipeline import SemanticSearchNode


@pytest.fixture
def sample_results() -> List[Dict[str, Any]]:
    return [
        {"id": "1", "metadata": {"reference": "ref-1"}, "contents": "A", "distance": 0.1},
        {"id": "2", "metadata": {"reference": "ref-2"}, "contents": "B", "distance": 0.2},
        {"id": "3", "metadata": {"reference": "ref-3"}, "contents": "C", "distance": 0.3},
    ]


def test_semantic_search_respects_explicit_limit(monkeypatch, sample_results):
    captured = {}

    def fake_search(query: str, limit: int, metadata_filter=None):
        captured["limit"] = limit
        return sample_results

    monkeypatch.setattr(
        "app.pipelines.doculens_pipeline.semantic_search_docling",
        fake_search,
    )

    event = SearchQueryEvent(event_type="search_query", query="hello", limit=3)
    context = TaskContext.model_construct(event=event)

    node = SemanticSearchNode()
    node.process(context)

    assert captured["limit"] == 3
    assert context.metadata["search"]["limit"] == 3
    assert context.nodes["SemanticSearchNode"]["limit"] == 3


def test_semantic_search_uses_settings_default(monkeypatch, sample_results):
    captured = {}

    def fake_search(query: str, limit: int, metadata_filter=None):
        captured["limit"] = limit
        return sample_results

    monkeypatch.setenv("DOCULENS_SEARCH_RESULT_LIMIT", "6")
    from app.config.settings import get_settings

    get_settings.cache_clear()

    monkeypatch.setattr(
        "app.pipelines.doculens_pipeline.semantic_search_docling",
        fake_search,
    )

    event = SearchQueryEvent(event_type="search_query", query="hello")
    context = TaskContext.model_construct(event=event)

    node = SemanticSearchNode()
    node.process(context)
