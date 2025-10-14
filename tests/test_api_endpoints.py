import json
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api import endpoint as endpoint_module
from app.api.dependencies import db_session
from app.main import app
from app.config.settings import get_settings


@pytest.fixture
def client():
    return TestClient(app)


def test_get_runtime_config_reflects_settings(monkeypatch, client):
    monkeypatch.setenv("DOCULENS_SUMMARY_CHUNK_LIMIT", "15")
    monkeypatch.setenv("DOCULENS_QA_TOP_K", "7")
    monkeypatch.setenv("DOCULENS_SEARCH_RESULT_LIMIT", "9")
    monkeypatch.setenv("DOCULENS_API_KEY_HEADER", "X-Test-Key")
    get_settings.cache_clear()

    response = client.get("/events/config")
    assert response.status_code == 200
    payload = response.json()

    assert payload["summary_chunk_limit"] == 15
    assert payload["qa_top_k"] == 7
    assert payload["search_result_limit"] == 9
    assert payload["api_key_header"] == "X-Test-Key"
    assert "auth_required" in payload


def test_upload_document_persists_file_and_dispatches(monkeypatch, tmp_path, client):
    stored_payload: Dict[str, Any] = {}

    class DummyEvent:
        def __init__(self, event_id: Optional[str] = None):
            self.id = event_id or uuid4()

    def fake_store_event(session, payload):
        stored_payload.update(payload)
        return DummyEvent(), "task-123"

    def fake_session():
        yield None

    monkeypatch.setattr(endpoint_module, "_ensure_ingestion_dir", lambda: tmp_path)
    monkeypatch.setattr(endpoint_module, "_store_event_and_dispatch", fake_store_event)
    app.dependency_overrides[db_session] = fake_session

    try:
        files = {"file": ("example.txt", b"content", "text/plain")}
        data = {"doc_type": "invoice", "metadata": json.dumps({"source": "tests"})}

        response = client.post("/events/documents/upload", files=files, data=data)
        assert response.status_code == 202
        payload = response.json()

        assert payload["original_filename"] == "example.txt"
        assert payload["message"].startswith("Document upload accepted")
        assert "event_id" in payload

        stored_path = Path(stored_payload["filename"])
        assert stored_path.exists()
        assert stored_payload["metadata"]["uploaded_filename"] == "example.txt"
        assert stored_payload["metadata"]["source"] == "tests"
    finally:
        app.dependency_overrides.pop(db_session, None)


def test_upload_document_rejects_invalid_metadata(monkeypatch, tmp_path, client):
    called = False

    def fake_store_event(session, payload):
        nonlocal called
        called = True
        return None, ""

    def fake_session():
        yield None

    monkeypatch.setattr(endpoint_module, "_ensure_ingestion_dir", lambda: tmp_path)
    monkeypatch.setattr(endpoint_module, "_store_event_and_dispatch", fake_store_event)
    app.dependency_overrides[db_session] = fake_session

    try:
        files = {"file": ("example.txt", b"content", "text/plain")}
        data = {"metadata": "this-is-not-json"}

        response = client.post("/events/documents/upload", files=files, data=data)
        assert response.status_code == 400
        assert b"metadata must be valid JSON" in response.content
        assert called is False
    finally:
        app.dependency_overrides.pop(db_session, None)
