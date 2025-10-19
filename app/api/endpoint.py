import json
import string
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from pathlib import Path
import uuid
from datetime import datetime

from typing import Any, Dict, Iterable, List, Literal, Optional, Sequence, Tuple
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.dependencies import db_session
from app.api.event_schema import EventSchema
from app.config.celery_config import celery_app
from app.config.settings import get_settings
from app.database.event import Event
from app.database.repository import GenericRepository
from app.services.vector_store import VectorStore
from app.services.classification_service import (
    ClassificationResult,
    ClassificationScore,
    get_classification_service,
)
from app.services.classification_audit import record_classification_result
from app.services.document_lifecycle import (
    archive_document as archive_document_service,
    delete_document as delete_document_service,
    restore_document as restore_document_service,
)
from app.services.label_service import LabelConflictError, LabelService
from app.database.models import DocumentClassificationHistory, DocumentLabel
from app.services.auth_service import PERSONA_OPTIONS, ROLE_DEFINITIONS

"""
Event Submission Endpoint Module

This module defines the primary FastAPI endpoint for event ingestion.
It implements the initial handling of incoming events by:
1. Validating the incoming event data
2. Persisting the event to the database
3. Queuing an asynchronous processing task
4. Returning an acceptance response

The endpoint follows the "accept-and-delegate" pattern where:
- Events are immediately accepted if valid
- Processing is handled asynchronously via Celery
- A 202 Accepted response indicates successful queueing

This pattern ensures high availability and responsiveness of the API
while allowing for potentially long-running processing operations.
"""


INGESTION_DIR = Path(__file__).resolve().parents[2] / "data" / "ingestion"


def _ensure_ingestion_dir() -> Path:
    INGESTION_DIR.mkdir(parents=True, exist_ok=True)
    return INGESTION_DIR


def _strip_ingestion_prefix(filename: str) -> str:
    """Remove the UUID prefix we add during ingestion when building display names."""
    candidate = Path(filename).name
    prefix, sep, remainder = candidate.partition("_")
    if sep and remainder and len(prefix) >= 32 and all(ch in string.hexdigits for ch in prefix):
        return remainder
    return candidate


def _store_event_and_dispatch(session: Session, payload: Dict[str, Any]) -> Tuple[Event, str]:
    """Persist an event and enqueue the Celery worker."""
    repository = GenericRepository(session=session, model=Event)
    event = Event(data=payload)
    repository.create(obj=event)
    task_result = celery_app.send_task(
        "process_incoming_event",
        args=[str(event.id)],
    )
    task_id = getattr(task_result, "id", str(task_result))
    return event, task_id


public_router = APIRouter()
router = APIRouter()
HOURLY_RATE = 65


class ClassificationExample(BaseModel):
    label: str
    text: str


class ClassificationRequest(BaseModel):
    candidate_labels: Optional[List[str]] = None
    examples: Optional[List[ClassificationExample]] = None
    hypothesis_template: Optional[str] = None
    multi_label: bool = False
    text_override: Optional[str] = None


class ClassificationResponse(BaseModel):
    document_id: str
    predicted_label: str
    confidence: float
    scores: List[ClassificationScore]
    candidate_labels: List[str]
    used_text_preview: str
    reasoning: Optional[str] = None


class LabelTreeNode(BaseModel):
    id: Optional[str]
    name: str
    type: Literal["domain", "label"]
    description: Optional[str] = None
    parent_id: Optional[str] = None
    workspace_id: Optional[str] = None
    children: List["LabelTreeNode"] = []


LabelTreeNode.model_rebuild()


class LabelsResponse(BaseModel):
    tree: List[LabelTreeNode]
    candidate_labels: List[str]


class LabelCreateRequest(BaseModel):
    label_name: str
    description: Optional[str] = None
    parent_label_id: Optional[str] = None
    label_type: Literal["domain", "label"] = "label"


class LabelUpdateRequest(BaseModel):
    label_name: Optional[str] = None
    description: Optional[str] = None
    parent_label_id: Optional[str] = None


class LabelResponse(BaseModel):
    id: str
    label_name: str
    label_type: str
    description: Optional[str]
    parent_label_id: Optional[str]
    workspace_id: Optional[str]


class ClassificationHistoryEntry(BaseModel):
    id: str
    document_id: str
    label_name: str
    confidence: Optional[float]
    source: str
    classifier_version: Optional[str]
    user_id: Optional[str]
    notes: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime


class DocumentLifecycleResponse(BaseModel):
    document_id: str
    status: str
    archived_at: Optional[str] = None
    deleted_at: Optional[str] = None
    restored_at: Optional[str] = None
    message: Optional[str] = None


class DocumentArchiveRequest(BaseModel):
    reason: Optional[str] = None


def _truncate_text(text: str, max_chars: int = 4000) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def _find_document_summary_text(session: Session, document_id: str, search_limit: int = 200) -> Optional[str]:
    summary_rows = session.execute(
        text(
            """
            SELECT task_context
            FROM events
            WHERE data->>'event_type' = 'document_summary'
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {"limit": search_limit},
    ).mappings()

    for row in summary_rows:
        task_context = row.get("task_context") or {}
        metadata = task_context.get("metadata") or {}
        document_summaries = metadata.get("document_summaries") or {}
        summary_payload = document_summaries.get(document_id)
        if isinstance(summary_payload, dict):
            summary_text = summary_payload.get("summary")
            if isinstance(summary_text, str) and summary_text.strip():
                return summary_text
    return None


def _build_document_text(session: Session, document_id: str, chunk_limit: int = 5) -> str:
    summary_text = _find_document_summary_text(session, document_id)
    if summary_text:
        return _truncate_text(summary_text)

    vector_store = VectorStore()
    try:
        chunks = vector_store.fetch_document_chunks(document_id=document_id, limit=chunk_limit)
    except ValueError:
        chunks = []

    texts: List[str] = []
    for chunk in chunks:
        chunk_text = (
            (chunk.get("contents") if isinstance(chunk, dict) else None)
            or (chunk.get("text") if isinstance(chunk, dict) else None)
        )
        if isinstance(chunk_text, str) and chunk_text.strip():
            texts.append(chunk_text.strip())

    combined = "\n\n".join(texts).strip()
    if combined:
        return _truncate_text(combined)
    raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Unable to locate document text for classification.")


def _stitch_examples_and_text(examples: Optional[Sequence[ClassificationExample]], text: str) -> str:
    if not examples:
        return text
    rendered_examples = [
        f"Example ({example.label}):\n{example.text.strip()}"
        for example in examples
        if isinstance(example.text, str) and example.text.strip()
    ]
    if not rendered_examples:
        return text
    rendered_examples.append(f"Document:\n{text.strip()}")
    return _truncate_text("\n\n".join(rendered_examples))


def _serialize_label(label: DocumentLabel) -> LabelResponse:
    return LabelResponse(
        id=str(label.id),
        label_name=label.label_name,
        label_type=label.label_type,
        description=label.description,
        parent_label_id=str(label.parent_label_id) if label.parent_label_id else None,
        workspace_id=str(label.workspace_id) if label.workspace_id else None,
    )


def _convert_tree_nodes(nodes: List[Dict[str, Any]]) -> List[LabelTreeNode]:
    tree: List[LabelTreeNode] = []
    for node in nodes:
        children = _convert_tree_nodes(node.get("children", [])) if node.get("children") else []
        tree.append(
            LabelTreeNode(
                id=node.get("id"),
                name=node.get("name"),
                type=node.get("type", "label"),
                description=node.get("description"),
                parent_id=node.get("parent_id"),
                workspace_id=node.get("workspace_id"),
                children=children,
            )
        )
    return tree




@public_router.get("/config")
def get_runtime_config() -> Dict[str, Any]:
    """Expose runtime configuration defaults for frontend clients."""
    settings = get_settings()
    return {
        "app_name": settings.app_name,
        "summary_chunk_limit": settings.summary_chunk_limit,
        "qa_top_k": settings.qa_top_k,
        "search_result_limit": settings.search_result_limit,
        "search_preview_limit": settings.search_preview_limit,
        "chunk_preview_limit": settings.chunk_preview_limit,
        "auth_required": bool(settings.api_key),
        "api_key_header": settings.api_key_header,
        "persona_options": PERSONA_OPTIONS,
        "role_definitions": ROLE_DEFINITIONS,
    }


def _ensure_utc(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        try:
            cleaned = value.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    return None


def _estimate_due_at(
    upload_time: Optional[datetime],
    doc_type: Optional[str],
    priority: Optional[str] = None,
) -> Optional[datetime]:
    if upload_time is None:
        return None

    hours = 48

    if priority:
        priority_lower = str(priority).strip().lower()
        if priority_lower in {"critical", "urgent", "high"}:
            hours = 24
        elif priority_lower in {"low", "backlog", "non-urgent"}:
            hours = 72

    if doc_type:
        doc_type_lower = doc_type.lower()
        invoice_keywords = ("invoice", "receipt", "billing", "tax", "finance")
        hr_keywords = ("resume", "offer", "onboard", "training", "background", "hr", "employee", "leave")
        legal_keywords = ("agreement", "contract", "legal", "nda")

        if any(keyword in doc_type_lower for keyword in invoice_keywords):
            hours = min(hours, 36)
        elif any(keyword in doc_type_lower for keyword in hr_keywords):
            hours = max(hours, 72)
        elif any(keyword in doc_type_lower for keyword in legal_keywords):
            hours = max(hours, 96)

    return upload_time + timedelta(hours=hours)


def _resolve_due_at(
    upload_time: Optional[datetime],
    doc_type: Optional[str],
    metadata_sources: Iterable[Dict[str, Any]],
) -> Optional[datetime]:
    candidate_keys = (
        "due_at",
        "due_date",
        "due",
        "deadline",
        "sla_due",
        "sla_due_at",
        "expected_at",
        "expected_by",
        "expected_completion",
    )

    priority_value: Optional[str] = None

    for source in metadata_sources:
        if not isinstance(source, dict):
            continue
        if priority_value is None:
            priority_value = source.get("priority") or source.get("urgency")
        for key in candidate_keys:
            value = source.get(key)
            if value is None:
                continue
            if isinstance(value, (int, float)) and upload_time is not None:
                try:
                    hours = float(value)
                except (TypeError, ValueError):
                    hours = 0.0
                if hours > 0:
                    return upload_time + timedelta(hours=hours)
            dt_value = _ensure_utc(value)
            if dt_value is not None:
                return dt_value

    return _estimate_due_at(upload_time, doc_type, priority_value)


@router.get("/insights/dashboard")
def get_dashboard_insights(
    session: Session = Depends(db_session),
) -> Dict[str, Any]:
    """Return aggregate metrics for the operations dashboard."""

    now = datetime.now(timezone.utc)
    fourteen_days_ago = now - timedelta(days=13)
    thirty_days_ago = now - timedelta(days=30)

    uploads_rows = session.execute(
        text(
            """
            SELECT id, data, task_context, created_at
            FROM events
            WHERE data->>'event_type' = 'document_upload'
            """
        )
    ).mappings()

    summaries_rows = session.execute(
        text(
            """
            SELECT id, data, task_context, created_at
            FROM events
            WHERE data->>'event_type' = 'document_summary'
            """
        )
    ).mappings()

    doc_records: Dict[str, Dict[str, Any]] = {}

    total_documents = 0
    chunk_count = 0
    embedded_count = 0

    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)

    for row in uploads_rows:
        task_context = row.get("task_context") or {}
        metadata = task_context.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}
        document_meta = metadata.get("document") or {}
        if not isinstance(document_meta, dict):
            document_meta = {}
        doc_metadata_inner = document_meta.get("metadata") or {}
        if not isinstance(doc_metadata_inner, dict):
            doc_metadata_inner = {}

        upload_data = row.get("data") or {}
        upload_meta_raw = upload_data.get("metadata")
        upload_meta = upload_meta_raw if isinstance(upload_meta_raw, dict) else {}

        status_value = (
            document_meta.get("status")
            or doc_metadata_inner.get("status")
            or upload_meta.get("status")
        )
        status_lower = status_value.lower() if isinstance(status_value, str) else ""
        deleted_flag = (
            document_meta.get("deleted")
            or doc_metadata_inner.get("deleted")
            or upload_meta.get("deleted")
        )
        deleted_at = (
            document_meta.get("deleted_at")
            or doc_metadata_inner.get("deleted_at")
            or upload_meta.get("deleted_at")
        )
        if status_lower == "deleted" or deleted_flag or deleted_at:
            continue

        document_id = document_meta.get("id") or str(row.get("id"))
        created_at = _ensure_utc(row.get("created_at"))

        chunk_total = document_meta.get("chunk_count") or 0
        embedded_total = document_meta.get("embedded_chunk_count") or 0

        due_at_dt = _resolve_due_at(
            created_at,
            document_meta.get("doc_type"),
            (
                document_meta,
                doc_metadata_inner,
                upload_meta,
            ),
        )

        doc_records[document_id] = {
            "upload_time": created_at,
            "chunk_count": chunk_total,
            "embedded_count": embedded_total,
            "due_at": due_at_dt,
        }

        total_documents += 1
        chunk_count += chunk_total
        embedded_count += embedded_total

    summarized_doc_ids: Dict[str, datetime] = {}
    summaries_count = 0
    latencies: List[float] = []

    for row in summaries_rows:
        task_context = row.get("task_context") or {}
        metadata = task_context.get("metadata") or {}
        document_summaries = metadata.get("document_summaries") or {}
        created_at = _ensure_utc(row.get("created_at"))

        for doc_id, summary_value in document_summaries.items():
            doc_id_str = str(doc_id)
            summaries_count += 1
            summarized_doc_ids[doc_id_str] = created_at

            upload_record = doc_records.get(doc_id_str)
            if upload_record and upload_record.get("upload_time"):
                latency = (created_at - upload_record["upload_time"]).total_seconds()
                if latency > 0:
                    latencies.append(latency)

    active_summarised_ids = {doc_id for doc_id in summarized_doc_ids if doc_id in doc_records}
    summarised_documents = len(active_summarised_ids)

    # SLA risk: uploads older than threshold without summary
    sla_threshold = timedelta(hours=4)
    sla_risk_count = 0
    for doc_id, record in doc_records.items():
        upload_time = record.get("upload_time")
        if not isinstance(upload_time, datetime):
            continue
        summary_time = summarized_doc_ids.get(doc_id)
        due_at_candidate = record.get("due_at")
        if isinstance(due_at_candidate, datetime):
            if summary_time is None and now > due_at_candidate:
                sla_risk_count += 1
        else:
            sla_threshold = timedelta(hours=4)
            if summary_time is None and now - upload_time > sla_threshold:
                sla_risk_count += 1

    def humanize_duration(seconds: float) -> str:
        total_minutes = int(round(seconds / 60))
        if total_minutes >= 120:
            hours = total_minutes / 60
            return f"{hours:.1f}h"
        if total_minutes >= 60:
            hours = total_minutes // 60
            minutes = total_minutes % 60
            return f"{hours}h {minutes}m"
        if total_minutes >= 1:
            return f"{total_minutes}m"
        return f"{max(1, int(round(seconds)))}s"

    avg_latency = humanize_duration(sum(latencies) / len(latencies)) if latencies else "—"

    estimated_hours_saved = summarised_documents * 0.75
    estimated_savings = estimated_hours_saved * 65

    sla_risk_message = (
        "All documents are within SLA thresholds."
        if sla_risk_count == 0
        else f"{sla_risk_count} documents require attention (over 4h)."
    )

    def build_day_buckets(start: datetime, days: int) -> Dict[str, Dict[str, int]]:
        buckets: Dict[str, Dict[str, int]] = {}
        for i in range(days):
            day = start + timedelta(days=i)
            buckets[day.strftime("%Y-%m-%d")] = {"total": 0, "summarised": 0}
        return buckets

    throughput_buckets = build_day_buckets(fourteen_days_ago.replace(hour=0, minute=0, second=0, microsecond=0), 14)

    for doc_id, record in doc_records.items():
        upload_time = record.get("upload_time")
        if not isinstance(upload_time, datetime):
            continue
        day_key = upload_time.strftime("%Y-%m-%d")
        if day_key in throughput_buckets:
            throughput_buckets[day_key]["total"] += 1

    for doc_id, summary_time in summarized_doc_ids.items():
        if doc_id not in doc_records:
            continue
        day_key = summary_time.strftime("%Y-%m-%d")
        if day_key in throughput_buckets:
            throughput_buckets[day_key]["summarised"] += 1

    throughput_series = [
        {
            "label": datetime.strptime(day_key, "%Y-%m-%d").strftime("%b %d"),
            "value": counts["total"],
        }
        for day_key, counts in throughput_buckets.items()
    ]

    compliance_series = [
        {
            "label": datetime.strptime(day_key, "%Y-%m-%d").strftime("%b %d"),
            "value": (
                int(round((counts["summarised"] / counts["total"]) * 100))
                if counts["total"] > 0
                else 0
            ),
        }
        for day_key, counts in throughput_buckets.items()
    ]

    today_key = today.strftime("%Y-%m-%d")
    yesterday_key = yesterday.strftime("%Y-%m-%d")
    today_counts = throughput_buckets.get(today_key, {"total": 0, "summarised": 0})
    yesterday_counts = throughput_buckets.get(yesterday_key, {"total": 0, "summarised": 0})

    def compute_delta_label(current: int, previous: int) -> Tuple[str, str]:
        if previous == 0:
            if current == 0:
                return "No change vs yesterday", "neutral"
            return "New activity today", "positive"
        delta_percent = ((current - previous) / previous) * 100
        tone = "positive" if delta_percent > 0 else "negative" if delta_percent < 0 else "neutral"
        sign = "+" if delta_percent > 0 else ""
        return f"{sign}{delta_percent:.1f}% vs yesterday", tone

    processed_delta_label, processed_delta_tone = compute_delta_label(today_counts["total"], yesterday_counts["total"])
    summaries_delta_label, summaries_delta_tone = compute_delta_label(today_counts["summarised"], yesterday_counts["summarised"])

    return {
        "total_documents": total_documents,
        "summarised_documents": summarised_documents,
        "chunk_count": chunk_count,
        "embedded_count": embedded_count,
        "queue_latency": avg_latency,
        "estimated_savings": round(estimated_savings, 2),
        "hours_saved": round(estimated_hours_saved, 2),
        "analyst_rate": HOURLY_RATE,
        "sla_risk_count": sla_risk_count,
        "sla_risk_message": sla_risk_message,
        "throughput_series": throughput_series,
        "compliance_series": compliance_series,
        "delta_processed": processed_delta_label,
        "delta_processed_tone": processed_delta_tone,
        "delta_summaries": summaries_delta_label,
        "delta_summaries_tone": summaries_delta_tone,
        "today_total": today_counts["total"],
        "today_summaries": today_counts["summarised"],
        "yesterday_total": yesterday_counts["total"],
        "yesterday_summaries": yesterday_counts["summarised"],
    }


@router.get("/")
def list_events(
    limit: int = Query(default=20, ge=1, le=200),
    session: Session = Depends(db_session),
):
    """Return the most recent events and their processing context."""
    repository = GenericRepository(session=session, model=Event)
    events = repository.get_latest(limit)
    return [
        {
            "id": str(event.id),
            "created_at": event.created_at,
            "updated_at": event.updated_at,
            "data": event.data,
            "task_context": event.task_context,
        }
        for event in events
    ]


@router.get("/documents")
def list_documents(
    limit: int = Query(default=20, ge=1, le=200),
    session: Session = Depends(db_session),
):
    """Return recent ingested documents with metadata and latest summary."""

    upload_rows = session.execute(
        text(
            """
            SELECT id, data, task_context, created_at
            FROM events
            WHERE data->>'event_type' = 'document_upload'
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).mappings()

    summary_rows = session.execute(
        text(
            """
            SELECT task_context, created_at
            FROM events
            WHERE data->>'event_type' = 'document_summary'
            ORDER BY created_at DESC
            """
        )
    ).mappings()

    summary_by_doc: Dict[str, Dict[str, Any]] = {}
    summary_by_filename: Dict[str, Dict[str, Any]] = {}
    for row in summary_rows:
        task_context = row.get("task_context") or {}
        metadata = task_context.get("metadata") or {}
        document_summaries = metadata.get("document_summaries") or {}
        for doc_id, summary in document_summaries.items():
            if not isinstance(doc_id, str):
                continue
            summary_copy = dict(summary)
            summary_copy.setdefault("generated_at", row.get("created_at"))
            filename = summary_copy.get("filename")
            if filename:
                summary_by_filename.setdefault(Path(filename).name, summary_copy)
            summary_by_doc.setdefault(doc_id, summary_copy)

    documents: List[Dict[str, Any]] = []
    for row in upload_rows:
        task_context = row.get("task_context") or {}
        metadata = task_context.get("metadata") or {}
        document_meta = metadata.get("document") or {}
        doc_metadata_inner = document_meta.get("metadata") or {}
        upload_data = row.get("data") or {}
        upload_meta = upload_data.get("metadata") or {}
        if not isinstance(upload_meta, dict):
            upload_meta = {}

        document_id = document_meta.get("id") or str(row.get("id"))
        uploaded_name = upload_meta.get("uploaded_filename")
        filename = (
            uploaded_name
            or document_meta.get("original_filename")
            or document_meta.get("filename")
        )

        if not filename:
            ingest_path = upload_meta.get("ingest_path") or upload_data.get("filename")
            if ingest_path:
                filename = Path(ingest_path).name

        if filename:
            filename = Path(filename).name
            if not uploaded_name:
                filename = _strip_ingestion_prefix(filename)

        summary_payload = summary_by_doc.get(document_id)
        if not summary_payload and filename:
            summary_payload = summary_by_filename.get(Path(filename).name)

        status_value = document_meta.get("status") or doc_metadata_inner.get("status") or upload_meta.get("status")
        status_lower = status_value.lower() if isinstance(status_value, str) else None
        if status_lower == "deleted":
            continue

        due_at_value = _resolve_due_at(
            _ensure_utc(row.get("created_at")),
            document_meta.get("doc_type"),
            (
                document_meta,
                doc_metadata_inner,
                upload_meta,
            ),
        )

        documents.append(
            {
                "event_id": str(row.get("id")),
                "document_id": document_id,
                "uploaded_at": row.get("created_at"),
                "filename": filename,
                "doc_type": document_meta.get("doc_type"),
                "chunk_count": document_meta.get("chunk_count"),
                "embedded_chunk_count": document_meta.get("embedded_chunk_count"),
                "vector_ids": document_meta.get("vector_ids"),
                "metadata": document_meta.get("metadata"),
                "status": status_value,
                "due_at": due_at_value.isoformat() if isinstance(due_at_value, datetime) else None,
                "archived_at": document_meta.get("archived_at")
                or doc_metadata_inner.get("archived_at")
                or upload_meta.get("archived_at"),
                "deleted_at": document_meta.get("deleted_at")
                or doc_metadata_inner.get("deleted_at")
                or upload_meta.get("deleted_at"),
                "restored_at": document_meta.get("restored_at")
                or doc_metadata_inner.get("restored_at")
                or upload_meta.get("restored_at"),
                "summary": summary_payload,
            }
        )

    return documents


@router.get("/documents/{document_id}/chunks")
def get_document_chunks(
    document_id: str,
    limit: Optional[int] = Query(default=None, ge=1, le=500),
    filename: Optional[str] = Query(default=None),
):
    """Return chunk previews for a given document."""
    vector_store = VectorStore()
    settings = get_settings()
    chunk_limit = limit or settings.chunk_preview_limit
    try:
        chunks = vector_store.fetch_document_chunks(
            document_id=document_id,
            filename=filename,
            limit=chunk_limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(exc)) from exc

    if not chunks:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="No chunks found for document")

    return chunks


@router.post("/documents/{document_id}/classify", response_model=ClassificationResponse)
def classify_document(
    document_id: str,
    payload: ClassificationRequest = Body(default_factory=ClassificationRequest),
    session: Session = Depends(db_session),
):
    """Classify a document using a local zero-shot transformer."""
    text_source = payload.text_override or _build_document_text(session, document_id)
    combined_text = _stitch_examples_and_text(payload.examples, text_source)

    label_service = LabelService(session=session)
    candidate_labels = payload.candidate_labels or label_service.get_candidate_labels()
    if not candidate_labels:
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="No candidate labels available for classification.")

    classifier = get_classification_service()
    result = classifier.classify(
        text=combined_text,
        candidate_labels=candidate_labels,
        hypothesis_template=payload.hypothesis_template,
        multi_label=payload.multi_label,
    )

    # Persist the classification event for audit/history.
    record_classification_result(
        session,
        document_id,
        result,
        source="ai",
        classifier_version=getattr(classifier, "version", None),
        metadata_extra={"reasoning": result.reasoning} if result.reasoning else None,
    )

    used_preview = result.used_text[:500]
    return ClassificationResponse(
        document_id=document_id,
        predicted_label=result.label,
        confidence=result.confidence,
        scores=result.scores,
        candidate_labels=result.candidate_labels,
        used_text_preview=used_preview,
        reasoning=result.reasoning,
    )


@router.post("/documents/{document_id}/archive", response_model=DocumentLifecycleResponse)
def archive_document_endpoint(
    document_id: str,
    payload: Optional[DocumentArchiveRequest] = Body(default=None),
    session: Session = Depends(db_session),
) -> DocumentLifecycleResponse:
    try:
        result = archive_document_service(
            session,
            document_id,
            reason=payload.reason if payload else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=str(exc)) from exc
    return DocumentLifecycleResponse(**result, message="Document archived.")


@router.delete("/documents/{document_id}", response_model=DocumentLifecycleResponse)
def delete_document_endpoint(
    document_id: str,
    reason: Optional[str] = Query(default=None),
    purge_vectors: bool = Query(default=True),
    session: Session = Depends(db_session),
) -> DocumentLifecycleResponse:
    try:
        result = delete_document_service(
            session,
            document_id,
            reason=reason,
            purge_vectors=purge_vectors,
        )
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=str(exc)) from exc
    return DocumentLifecycleResponse(**result, message="Document deleted.")


@router.post("/documents/{document_id}/restore", response_model=DocumentLifecycleResponse)
def restore_document_endpoint(
    document_id: str,
    payload: Optional[DocumentArchiveRequest] = Body(default=None),
    session: Session = Depends(db_session),
) -> DocumentLifecycleResponse:
    try:
        result = restore_document_service(
            session,
            document_id,
            reason=payload.reason if payload else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=str(exc)) from exc
    return DocumentLifecycleResponse(**result, message="Document restored.")


@router.get("/labels", response_model=LabelsResponse)
def list_labels(session: Session = Depends(db_session)) -> LabelsResponse:
    label_service = LabelService(session=session)
    tree = _convert_tree_nodes(label_service.get_label_tree())
    candidate_labels = label_service.get_candidate_labels()
    return LabelsResponse(tree=tree, candidate_labels=candidate_labels)


@router.post("/labels", response_model=LabelResponse, status_code=HTTPStatus.CREATED)
def create_label(payload: LabelCreateRequest, session: Session = Depends(db_session)) -> LabelResponse:
    parent_id = uuid.UUID(payload.parent_label_id) if payload.parent_label_id else None
    label_service = LabelService(session=session)
    try:
        label = label_service.create_label(
            label_name=payload.label_name,
            description=payload.description,
            parent_label_id=parent_id,
            label_type=payload.label_type,
        )
    except LabelConflictError as exc:
        raise HTTPException(status_code=HTTPStatus.CONFLICT, detail=str(exc)) from exc
    return _serialize_label(label)


@router.patch("/labels/{label_id}", response_model=LabelResponse)
def update_label(label_id: str, payload: LabelUpdateRequest, session: Session = Depends(db_session)) -> LabelResponse:
    label_service = LabelService(session=session)
    try:
        label = label_service.update_label(
            uuid.UUID(label_id),
            label_name=payload.label_name,
            description=payload.description,
            parent_label_id=uuid.UUID(payload.parent_label_id) if payload.parent_label_id else None,
        )
    except LabelConflictError as exc:
        raise HTTPException(status_code=HTTPStatus.CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=str(exc)) from exc
    return _serialize_label(label)


@router.delete("/labels/{label_id}", status_code=HTTPStatus.NO_CONTENT)
def delete_label(label_id: str, force: bool = Query(default=False), session: Session = Depends(db_session)) -> Response:
    label_service = LabelService(session=session)
    try:
        label_service.delete_label(uuid.UUID(label_id), force=force)
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=str(exc)) from exc
    return Response(status_code=HTTPStatus.NO_CONTENT)


@router.get(
    "/documents/{document_id}/classification-history",
    response_model=List[ClassificationHistoryEntry],
)
def get_classification_history(document_id: str, session: Session = Depends(db_session)) -> List[ClassificationHistoryEntry]:
    query = (
        select(DocumentClassificationHistory)
        .where(DocumentClassificationHistory.document_id == document_id)
        .order_by(DocumentClassificationHistory.created_at.desc())
    )
    rows = session.execute(query).scalars().all()
    return [
        ClassificationHistoryEntry(
            id=str(row.id),
            document_id=row.document_id,
            label_name=row.label_name,
            confidence=row.confidence,
            source=row.source,
            classifier_version=row.classifier_version,
            user_id=str(row.user_id) if row.user_id else None,
            notes=row.notes,
            metadata=row.metadata or {},
            created_at=row.created_at,
        )
        for row in rows
    ]


class ClassificationOverrideRequest(BaseModel):
    label_name: str
    confidence: Optional[float] = None
    notes: Optional[str] = None


@router.post(
    "/documents/{document_id}/classification-history",
    response_model=ClassificationHistoryEntry,
)
def override_classification(
    document_id: str,
    payload: ClassificationOverrideRequest,
    session: Session = Depends(db_session),
) -> ClassificationHistoryEntry:
    confidence = payload.confidence if payload.confidence is not None else 1.0
    manual_result = ClassificationResult(
        label=payload.label_name,
        confidence=confidence,
        scores=[ClassificationScore(label=payload.label_name, score=confidence)],
        used_text="",
        candidate_labels=[payload.label_name],
    )
    history = record_classification_result(
        session,
        document_id,
        manual_result,
        source="user",
        classifier_version=None,
        user_id=None,
        metadata_extra={"notes": payload.notes} if payload.notes else None,
        notes=payload.notes,
    )
    return ClassificationHistoryEntry(
        id=str(history.id),
        document_id=history.document_id,
        label_name=history.label_name,
        confidence=history.confidence,
        source=history.source,
        classifier_version=history.classifier_version,
        user_id=str(history.user_id) if history.user_id else None,
        notes=history.notes,
        metadata=history.metadata or {},
        created_at=history.created_at,
    )


@router.post("/documents/upload", status_code=HTTPStatus.ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    doc_type: Optional[str] = Form(default=None),
    metadata: Optional[str] = Form(default=None),
    session: Session = Depends(db_session),
) -> Dict[str, Any]:
    """Accept a document file upload and queue ingestion."""
    if not file.filename:
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Uploaded file must have a filename.")

    ingestion_dir = _ensure_ingestion_dir()
    original_name = Path(file.filename).name
    stored_filename = f"{uuid4().hex}_{original_name}"
    stored_path = ingestion_dir / stored_filename

    try:
        with stored_path.open("wb") as buffer:
            while True:
                chunk = await file.read(1 << 20)
                if not chunk:
                    break
                buffer.write(chunk)
    finally:
        await file.close()

    metadata_dict: Dict[str, Any] = {}
    if metadata:
        try:
            decoded = json.loads(metadata)
        except json.JSONDecodeError as exc:
            stored_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="metadata must be valid JSON.",
            ) from exc

        if not isinstance(decoded, dict):
            stored_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="metadata must be a JSON object.",
            )
        metadata_dict = decoded

    metadata_dict.setdefault("uploaded_filename", original_name)
    metadata_dict.setdefault("ingest_path", str(stored_path))

    event_payload: Dict[str, Any] = {
        "event_type": "document_upload",
        "filename": str(stored_path),
        "file_url": "",
        "doc_type": doc_type or None,
        "metadata": metadata_dict,
    }

    event, task_id = _store_event_and_dispatch(session, event_payload)
    return {
        "message": "Document upload accepted",
        "event_id": str(event.id),
        "task_id": task_id,
        "original_filename": original_name,
        "stored_path": str(stored_path),
    }


@router.get("/qa/history")
def list_qa_history(
    limit: int = Query(default=20, ge=1, le=200),
    session: Session = Depends(db_session),
):
    """Return the latest QA query results with answers and citations."""

    rows = session.execute(
        text(
            """
            SELECT id, data, task_context, created_at
            FROM events
            WHERE data->>'event_type' = 'qa_query'
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).mappings()

    history: List[Dict[str, Any]] = []
    for row in rows:
        data = row.get("data") or {}
        task_context = row.get("task_context") or {}
        metadata = task_context.get("metadata") or {}
        qa_meta = metadata.get("qa") or {}
        nodes = task_context.get("nodes") or {}
        qa_node = nodes.get("QAQueryNode", {})
        event_payload = task_context.get("event") or data

        history.append(
            {
                "event_id": str(row.get("id")),
                "created_at": row.get("created_at"),
                "query": event_payload.get("query"),
                "answer": qa_meta.get("answer"),
                "reasoning": qa_meta.get("reasoning"),
                "confidence": qa_meta.get("confidence"),
                "citations": qa_meta.get("citations") or [],
                "chunk_references": qa_node.get("chunk_references", []),
            }
        )

    return history


@router.get("/search/history")
def list_search_history(
    limit: int = Query(default=20, ge=1, le=200),
    session: Session = Depends(db_session),
):
    """Return prior semantic search requests with preview results."""
    settings = get_settings()
    rows = session.execute(
        text(
            """
            SELECT id, data, task_context, created_at
            FROM events
            WHERE data->>'event_type' = 'search_query'
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).mappings()

    history: List[Dict[str, Any]] = []
    for row in rows:
        data = row.get("data") or {}
        task_context = row.get("task_context") or {}
        metadata = task_context.get("metadata") or {}
        nodes = task_context.get("nodes") or {}
        search_meta = metadata.get("search") or {}
        node_meta = nodes.get("SemanticSearchNode") or {}

        all_results = search_meta.get("results") or []
        preview = node_meta.get("preview") or all_results[: settings.search_preview_limit]

        history.append(
            {
                "event_id": str(row.get("id")),
                "created_at": row.get("created_at"),
                "query": search_meta.get("query") or data.get("query"),
                "filters": search_meta.get("filters") or data.get("filters") or {},
                "limit": node_meta.get("limit") or search_meta.get("limit") or settings.search_result_limit,
                "result_count": node_meta.get("result_count") or len(all_results),
                "results": preview,
                "results_truncated": node_meta.get("results_truncated")
                if node_meta.get("results_truncated") is not None
                else len(preview) < len(all_results),
            }
        )

    return history


@router.get("/{event_id}")
def get_event(
    event_id: UUID,
    session: Session = Depends(db_session),
):
    """Fetch a single event and its stored task context."""
    repository = GenericRepository(session=session, model=Event)
    event = repository.get(id=str(event_id))
    if event is None:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Event not found")
    return {
        "id": str(event.id),
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "data": event.data,
        "task_context": event.task_context,
    }


@router.post("/", dependencies=[], status_code=HTTPStatus.ACCEPTED)
def handle_event(
    data: EventSchema,
    session: Session = Depends(db_session),
) -> Dict[str, Any]:
    """Handles incoming event submissions.

    This endpoint receives events, stores them in the database,
    and queues them for asynchronous processing. It implements
    a non-blocking pattern to ensure API responsiveness.

    Args:
        data: The event data, validated against EventSchema
        session: Database session injected by FastAPI dependency

    Returns:
        Response: 202 Accepted response with task ID

    Note:
        The endpoint returns immediately after queueing the task.
        Use the task ID in the response to check processing status.
    """
    event_payload = data.model_dump(mode="json")
    event, task_id = _store_event_and_dispatch(session, event_payload)

    return {
        "message": "process_incoming_event started",
        "event_id": str(event.id),
        "task_id": task_id,
        "event_type": event_payload.get("event_type"),
    }
