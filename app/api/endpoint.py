import json
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import db_session
from app.api.event_schema import EventSchema
from app.config.celery_config import celery_app
from app.config.settings import get_settings
from app.database.event import Event
from app.database.repository import GenericRepository
from app.services.vector_store import VectorStore

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


router = APIRouter()
HOURLY_RATE = 65


@router.get("/config")
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
        document_meta = metadata.get("document") or {}

        document_id = document_meta.get("id") or str(row.get("id"))
        created_at = _ensure_utc(row.get("created_at"))

        doc_records[document_id] = {
            "upload_time": created_at,
            "chunk_count": document_meta.get("chunk_count") or 0,
            "embedded_count": document_meta.get("embedded_chunk_count") or 0,
        }

        total_documents += 1
        chunk_count += document_meta.get("chunk_count") or 0
        embedded_count += document_meta.get("embedded_chunk_count") or 0

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

    summarised_documents = len({**summarized_doc_ids})

    # SLA risk: uploads older than threshold without summary
    sla_threshold = timedelta(hours=4)
    sla_risk_count = 0
    for doc_id, record in doc_records.items():
        upload_time = record.get("upload_time")
        if not isinstance(upload_time, datetime):
            continue
        summary_time = summarized_doc_ids.get(doc_id)
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
        upload_meta = document_meta.get("metadata") or {}

        document_id = document_meta.get("id") or str(row.get("id"))
        filename = (
            upload_meta.get("uploaded_filename")
            or document_meta.get("original_filename")
            or document_meta.get("filename")
        )
        if filename and "_" in filename and upload_meta.get("uploaded_filename") is None:
            # Legacy events stored filenames prefixed with random tokens; strip them for display.
            stripped = filename.partition("_")[2]
            if stripped:
                filename = stripped

        summary_payload = summary_by_doc.get(document_id)
        if not summary_payload and filename:
            summary_payload = summary_by_filename.get(Path(filename).name)

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
