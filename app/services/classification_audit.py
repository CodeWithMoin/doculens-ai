from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.database.event import Event
from app.database.models import DocumentClassificationHistory
from app.database.repository import GenericRepository
from app.services.classification_service import ClassificationResult
from app.services.document_lifecycle import get_upload_event_for_document

logger = logging.getLogger(__name__)


def _update_document_metadata_from_classification(
    session: Session,
    document_id: str,
    result: ClassificationResult,
    *,
    source: str,
) -> None:
    """Ensure the primary document metadata reflects the latest classification."""
    if not result.label:
        return

    upload_event = get_upload_event_for_document(session, document_id)

    if not upload_event:
        logger.warning("Unable to locate upload event for document_id=%s to persist classification.", document_id)
        return

    timestamp = datetime.now(timezone.utc).isoformat()

    task_context = dict(upload_event.task_context or {})
    metadata_block = dict(task_context.get("metadata") or {})
    document_meta = dict(metadata_block.get("document") or {})

    # Preserve nested metadata bag if present.
    nested_metadata = document_meta.get("metadata")

    document_meta["doc_type"] = result.label
    document_meta["candidate_labels"] = list(result.candidate_labels)
    document_meta["classification"] = {
        "label": result.label,
        "confidence": result.confidence,
        "scores": [score.model_dump() for score in result.scores],
        "reasoning": result.reasoning,
        "source": source,
        "updated_at": timestamp,
    }
    if nested_metadata is not None:
        document_meta["metadata"] = nested_metadata

    metadata_block["document"] = document_meta
    metadata_block["classification"] = {
        "label": result.label,
        "confidence": result.confidence,
        "scores": [score.model_dump() for score in result.scores],
        "reasoning": result.reasoning,
        "source": source,
        "updated_at": timestamp,
    }

    task_context["metadata"] = metadata_block
    upload_event.task_context = task_context
    upload_event.data = {
        **(upload_event.data or {}),
        "doc_type": result.label,
    }
    session.add(upload_event)


def record_classification_result(
    session: Session,
    document_id: str,
    result: ClassificationResult,
    *,
    source: str,
    classifier_version: Optional[str],
    user_id: Optional[uuid.UUID] = None,
    metadata_extra: Optional[Dict[str, object]] = None,
    notes: Optional[str] = None,
) -> DocumentClassificationHistory:
    repository = GenericRepository(session=session, model=Event)
    repository.create(
        obj=Event(
            data={
                "event_type": "document_classification_local",
                "document_id": document_id,
                "prediction": result.label,
                "confidence": result.confidence,
                "candidate_labels": result.candidate_labels,
                "source": source,
                "reasoning": result.reasoning,
            },
            task_context={
                "metadata": {
                    "classification": {
                        "label": result.label,
                        "confidence": result.confidence,
                        "scores": [score.model_dump() for score in result.scores],
                        "classifier_version": classifier_version,
                        "reasoning": result.reasoning,
                    }
                }
            },
        )
    )

    metadata_payload: Dict[str, object] = {
        "candidate_labels": result.candidate_labels,
        "scores": [score.model_dump() for score in result.scores],
    }
    if metadata_extra:
        metadata_payload.update(metadata_extra)
    if result.reasoning:
        metadata_payload.setdefault("reasoning", result.reasoning)

    history_entry = DocumentClassificationHistory(
        id=uuid.uuid4(),
        document_id=document_id,
        label_name=result.label,
        confidence=result.confidence,
        source=source,
        user_id=user_id,
        classifier_version=classifier_version,
        notes=notes,
        metadata=metadata_payload,
    )
    session.add(history_entry)
    _update_document_metadata_from_classification(
        session,
        document_id,
        result,
        source=source,
    )
    session.commit()
    session.refresh(history_entry)
    return history_entry
