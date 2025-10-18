from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database.event import Event
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)


def get_upload_event_for_document(session: Session, document_id: str) -> Optional[Event]:
    """Locate the originating upload event for a document."""
    upload_event = (
        session.query(Event)
        .filter(
            and_(
                Event.data["event_type"].astext == "document_upload",
                Event.task_context["metadata"]["document"]["id"].astext == document_id,
            )
        )
        .order_by(Event.created_at.desc())
        .first()
    )

    if upload_event:
        return upload_event

    # Fallback: some pipelines reuse the upload event UUID as the document identifier.
    try:
        event_id = uuid.UUID(document_id)
    except ValueError:
        event_id = None

    if event_id:
        upload_event = session.get(Event, event_id)

    return upload_event


def archive_document(
    session: Session,
    document_id: str,
    *,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Soft-archive a document without removing underlying data."""
    upload_event = get_upload_event_for_document(session, document_id)
    if not upload_event:
        raise ValueError("Document not found.")

    timestamp = datetime.now(timezone.utc).isoformat()
    _apply_status_to_upload_event(
        upload_event,
        status="archived",
        timestamp=timestamp,
        flags={"archived": True},
    )

    archive_event = Event(
        data={
            "event_type": "document_archived",
            "document_id": document_id,
            "archived_at": timestamp,
            "reason": reason,
        }
    )
    session.add(archive_event)
    session.add(upload_event)
    session.commit()

    return {
        "document_id": document_id,
        "status": "archived",
        "archived_at": timestamp,
    }


def delete_document(
    session: Session,
    document_id: str,
    *,
    reason: Optional[str] = None,
    purge_vectors: bool = True,
) -> Dict[str, Any]:
    """Soft-delete a document and optionally purge its vector embeddings."""
    upload_event = get_upload_event_for_document(session, document_id)
    if not upload_event:
        raise ValueError("Document not found.")

    timestamp = datetime.now(timezone.utc).isoformat()
    _apply_status_to_upload_event(
        upload_event,
        status="deleted",
        timestamp=timestamp,
        flags={"deleted": True},
    )

    delete_event = Event(
        data={
            "event_type": "document_deleted",
            "document_id": document_id,
            "deleted_at": timestamp,
            "reason": reason,
        }
    )
    session.add(delete_event)
    session.add(upload_event)
    session.commit()

    if purge_vectors:
        try:
            VectorStore().delete(metadata_filter={"document_id": document_id})
        except Exception as exc:  # pragma: no cover - best effort cleanup
            logger.warning("Vector purge failed for document %s: %s", document_id, exc)

    return {
        "document_id": document_id,
        "status": "deleted",
        "deleted_at": timestamp,
    }


def restore_document(
    session: Session,
    document_id: str,
    *,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Restore a previously archived document to active processing."""
    upload_event = get_upload_event_for_document(session, document_id)
    if not upload_event:
        raise ValueError("Document not found.")

    timestamp = datetime.now(timezone.utc).isoformat()
    _apply_status_to_upload_event(
        upload_event,
        status="processing",
        timestamp=timestamp,
        clear_keys={"archived", "archived_at"},
        flags={"restored_at": timestamp},
    )

    restore_event = Event(
        data={
            "event_type": "document_restored",
            "document_id": document_id,
            "restored_at": timestamp,
            "reason": reason,
        }
    )
    session.add(restore_event)
    session.add(upload_event)
    session.commit()

    return {
        "document_id": document_id,
        "status": "processing",
        "restored_at": timestamp,
    }


def _ensure_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    return {}


def _apply_status_to_upload_event(
    upload_event: Event,
    *,
    status: str,
    timestamp: str,
    flags: Optional[Dict[str, Any]] = None,
    clear_keys: Optional[Iterable[str]] = None,
) -> None:
    """Mutate an upload event so downstream listings pick up the new lifecycle state."""
    task_context = _ensure_dict(upload_event.task_context)
    metadata_block = _ensure_dict(task_context.get("metadata"))
    document_meta = _ensure_dict(metadata_block.get("document"))
    nested_metadata = _ensure_dict(document_meta.get("metadata"))

    clear_set = set(clear_keys or {})
    for key in clear_set:
        document_meta.pop(key, None)
        nested_metadata.pop(key, None)
        metadata_block.pop(key, None)

    document_meta.update(
        {
            "status": status,
            f"{status}_at": timestamp,
        }
    )
    nested_metadata.update(
        {
            "status": status,
            f"{status}_at": timestamp,
        }
    )
    if flags:
        document_meta.update(flags)
        nested_metadata.update(flags)

    document_meta["metadata"] = nested_metadata
    metadata_block["document"] = document_meta
    metadata_block["status"] = status
    metadata_block[f"{status}_at"] = timestamp

    task_context["metadata"] = metadata_block
    upload_event.task_context = task_context

    upload_data = _ensure_dict(upload_event.data)
    upload_meta = _ensure_dict(upload_data.get("metadata"))
    for key in clear_set:
        upload_meta.pop(key, None)
    upload_meta.update(
        {
            "status": status,
            f"{status}_at": timestamp,
        }
    )
    if flags:
        upload_meta.update(flags)
    upload_data["metadata"] = upload_meta
    upload_event.data = upload_data
