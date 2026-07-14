"""Idempotent synthetic workspace data for local demos and screenshots.

The seed is deliberately opt-in and contains no customer or maintainer data. It
exercises the same event, classification, and vector tables used by the product
so the local experience stays representative of the real application.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Sequence
from uuid import NAMESPACE_URL, UUID, uuid1, uuid5

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.event import Event
from app.database.models import DocumentClassificationHistory, DocumentLabel

DEMO_SEED_VERSION = "workspace-v1"


@dataclass(frozen=True)
class DemoDocument:
    slug: str
    filename: str
    doc_type: str
    role: str
    label: str
    status: str
    uploaded_hours_ago: int
    due_hours_from_now: int | None
    summary: str | None
    bullet_points: tuple[str, ...]
    chunks: tuple[str, ...]


@dataclass(frozen=True)
class DemoQuestion:
    slug: str
    question: str
    answer: str
    reasoning: str
    confidence: float
    chunk_indexes: tuple[int, ...]
    minutes_ago: int


DEMO_DOCUMENTS: tuple[DemoDocument, ...] = (
    DemoDocument(
        slug="acme-msa",
        filename="Acme Cloud — Master Services Agreement.pdf",
        doc_type="Master Services Agreement",
        role="Legal",
        label="Commercial Agreement",
        status="Ready",
        uploaded_hours_ago=2,
        due_hours_from_now=120,
        summary="A two-year cloud services agreement with a 60-day renewal notice, annual price protection, and a negotiated liability cap.",
        bullet_points=(
            "Initial term ends September 30, 2026 and renews automatically for one year.",
            "Written non-renewal notice is required at least 60 days before the term ends.",
            "Aggregate liability is capped at fees paid during the preceding 12 months.",
        ),
        chunks=(
            "The initial service term continues through September 30, 2026. The agreement renews automatically for successive one-year periods unless either party gives written notice at least 60 days before the current term ends.",
            "Subscription fees may increase only once per renewal term and any increase may not exceed three percent. Acme must provide written notice of a proposed increase with the renewal notice.",
            "Except for confidentiality, data protection, and indemnification obligations, each party's aggregate liability is limited to fees paid or payable during the twelve months preceding the event giving rise to the claim.",
            "Customer data remains the exclusive property of Northstar Labs. Acme must return or securely delete customer data within thirty days after termination and provide written confirmation on request.",
        ),
    ),
    DemoDocument(
        slug="vendor-risk",
        filename="Q3 Vendor Risk Review — Atlas Payments.pdf",
        doc_type="Compliance Review",
        role="Compliance",
        label="Vendor Risk",
        status="Needs review",
        uploaded_hours_ago=5,
        due_hours_from_now=-1,
        summary=None,
        bullet_points=(),
        chunks=(
            "Atlas Payments completed its SOC 2 Type II audit in May 2026. Two low-severity exceptions concerned delayed access recertification for contractor accounts.",
            "The vendor processes payment metadata in the United States and Ireland. No primary account numbers are stored in the analytics environment.",
            "Open action: obtain evidence that quarterly contractor access reviews were completed by July 10. Compliance owner: Maya Chen.",
            "Residual risk is rated medium until the access-review evidence is accepted. No critical availability, privacy, or financial-control gaps were identified.",
        ),
    ),
    DemoDocument(
        slug="northstar-invoice",
        filename="Northstar Cloud Invoice — June 2026.pdf",
        doc_type="Invoice",
        role="Finance",
        label="Accounts Payable",
        status="Ready",
        uploaded_hours_ago=27,
        due_hours_from_now=72,
        summary="June cloud infrastructure invoice totaling $18,420, including a material increase in GPU compute and a one-time reserved-capacity credit.",
        bullet_points=(
            "Amount due is $18,420 by July 21, 2026.",
            "GPU compute increased 24% month over month.",
            "A $1,250 reserved-capacity credit was applied.",
        ),
        chunks=(
            "Invoice NS-2026-0617 covers the billing period June 1 through June 30, 2026. Total charges are $19,670 before credits and $18,420 after credits.",
            "GPU compute usage was 8,240 accelerator-hours at a blended cost of $1.42 per hour, an increase of twenty-four percent compared with May.",
            "Reserved-capacity commitment credit: $1,250. Payment terms are net 15 and the payment due date is July 21, 2026.",
            "Cost center allocation: AI Platform 62%, Document Operations 23%, Shared Infrastructure 15%.",
        ),
    ),
    DemoDocument(
        slug="security-handbook",
        filename="Employee Security Handbook — 2026.pdf",
        doc_type="Employee Policy",
        role="HR",
        label="Security Policy",
        status="Ready",
        uploaded_hours_ago=52,
        due_hours_from_now=None,
        summary="Company-wide security expectations covering device management, data handling, access reviews, and incident reporting.",
        bullet_points=(
            "Managed devices and phishing-resistant MFA are required for production access.",
            "Suspected incidents must be reported within 30 minutes.",
            "Restricted data may not be copied to personal storage or consumer AI tools.",
        ),
        chunks=(
            "All employees and contractors must use a company-managed device and phishing-resistant multi-factor authentication before accessing production systems.",
            "Suspected security incidents, including accidental disclosure or lost devices, must be reported to the security channel within thirty minutes of discovery.",
            "Restricted customer data must not be copied to personal storage, public paste services, or consumer AI tools. Approved enterprise services must enforce retention controls.",
            "Managers review privileged access quarterly. Access that is no longer required must be removed within one business day of the review decision.",
        ),
    ),
    DemoDocument(
        slug="incident-runbook",
        filename="Production Incident Response Runbook.pdf",
        doc_type="Operations Runbook",
        role="Operations",
        label="Incident Response",
        status="Ready",
        uploaded_hours_ago=126,
        due_hours_from_now=None,
        summary="Operational playbook for severity assessment, incident command, customer communications, mitigation, and post-incident review.",
        bullet_points=(
            "SEV-1 incidents require an incident commander and communications lead within 10 minutes.",
            "Customer updates are published at least every 30 minutes.",
            "A blameless review is due within five business days.",
        ),
        chunks=(
            "For a SEV-1 incident, assign an incident commander, operations lead, and communications lead within ten minutes of declaration.",
            "Publish the first customer-facing status update within fifteen minutes. Continue updates at least every thirty minutes until service is restored.",
            "Prefer reversible mitigations such as traffic shaping, feature rollback, or queue isolation. Preserve logs and a timestamped decision record throughout the incident.",
            "The incident commander owns a blameless post-incident review within five business days, including contributing factors, detection gaps, and tracked corrective actions.",
        ),
    ),
    DemoDocument(
        slug="ai-governance",
        filename="AI Governance Research Brief.pdf",
        doc_type="Research Brief",
        role="Compliance",
        label="AI Governance",
        status="Ready",
        uploaded_hours_ago=242,
        due_hours_from_now=None,
        summary="A practical control framework for evaluating model risk, grounding quality, human review, and auditability in document AI systems.",
        bullet_points=(
            "High-impact workflows require human approval and traceable source evidence.",
            "Retrieval quality should be evaluated independently from answer quality.",
            "Model, prompt, and index versions belong in the audit record.",
        ),
        chunks=(
            "Document AI controls should be proportional to impact. High-impact decisions require human approval, visible source evidence, and a documented appeal path.",
            "Teams should evaluate retrieval recall independently from answer faithfulness. A fluent answer cannot compensate for missing or irrelevant evidence.",
            "Audit records should include model version, prompt version, index version, retrieved chunk identifiers, reviewer action, and final disposition.",
            "Monitoring should cover citation validity, abstention behavior, latency, cost, drift in document mix, and the rate of human overrides.",
        ),
    ),
)

DEMO_QUESTIONS: tuple[DemoQuestion, ...] = (
    DemoQuestion(
        slug="vendor-risk",
        question="What evidence is still required before Atlas Payments can be approved?",
        answer="Obtain evidence that the quarterly contractor access reviews were completed by July 10. Until Compliance accepts that evidence, the residual vendor risk remains medium.",
        reasoning="The open action requests contractor access-review evidence, and the risk section makes acceptance of that evidence the condition for closing the medium residual risk.",
        confidence=0.94,
        chunk_indexes=(3, 4),
        minutes_ago=35,
    ),
    DemoQuestion(
        slug="northstar-invoice",
        question="How much is due, when is it due, and what explains the change?",
        answer="Northstar owes $18,420 by July 21, 2026. GPU compute increased 24% month over month, while a $1,250 reserved-capacity credit reduced the final amount.",
        reasoning="The usage section explains the GPU increase, and the payment section gives the applied credit and due date.",
        confidence=0.97,
        chunk_indexes=(2, 3),
        minutes_ago=44,
    ),
    DemoQuestion(
        slug="security-handbook",
        question="What should an employee do after discovering a suspected security incident?",
        answer="Report it to the security channel within 30 minutes of discovery. The rule covers suspected incidents, accidental disclosure, and lost devices.",
        reasoning="The incident-reporting policy specifies both the reporting destination and the 30-minute deadline.",
        confidence=0.98,
        chunk_indexes=(2,),
        minutes_ago=55,
    ),
    DemoQuestion(
        slug="incident-runbook",
        question="What are the first coordination and communication steps for a SEV-1?",
        answer="Assign an incident commander, operations lead, and communications lead within 10 minutes. Publish the first customer update within 15 minutes, then update at least every 30 minutes until recovery.",
        reasoning="The opening runbook steps define the response roles and the customer-communication cadence.",
        confidence=0.95,
        chunk_indexes=(1, 2),
        minutes_ago=63,
    ),
    DemoQuestion(
        slug="ai-governance",
        question="What evidence should be retained to audit an AI-assisted document decision?",
        answer="Retain the model, prompt, and index versions; the retrieved chunk identifiers; the reviewer action; and the final disposition.",
        reasoning="The auditability section lists the technical versions, retrieved evidence, and human decision record that make a result reproducible.",
        confidence=0.96,
        chunk_indexes=(3,),
        minutes_ago=70,
    ),
    DemoQuestion(
        slug="acme-msa",
        question="When do we need to give notice if we do not want the Acme agreement to renew?",
        answer="Send written non-renewal notice no later than August 1, 2026. The agreement requires at least 60 days' notice before the September 30 term end.",
        reasoning="The renewal clause states both the term end date and the 60-day notice requirement.",
        confidence=0.96,
        chunk_indexes=(1,),
        minutes_ago=78,
    ),
)


def _stable_uuid(*parts: object) -> UUID:
    return uuid5(NAMESPACE_URL, "/".join(("doculens", DEMO_SEED_VERSION, *(str(part) for part in parts))))


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def seed_demo_workspace(session: Session, *, embedding_dimensions: int = 1536) -> bool:
    """Seed the synthetic workspace once and return whether rows were inserted."""
    marker_id = _stable_uuid("event", "upload", DEMO_DOCUMENTS[0].slug)
    if session.get(Event, marker_id) is not None:
        # Content additions are backfilled independently so existing showcase
        # databases gain new curated examples without duplicating documents.
        _seed_qa_history(session, _utc_now_naive())
        session.flush()
        return False

    now = _utc_now_naive()
    _seed_labels(session, now)

    chunk_ids_by_slug: dict[str, list[UUID]] = {}
    for document in DEMO_DOCUMENTS:
        chunk_ids_by_slug[document.slug] = _seed_document(session, document, now, embedding_dimensions)

    _seed_qa_history(session, now)
    _seed_search_history(session, now, chunk_ids_by_slug)
    session.flush()
    return True


def _seed_labels(session: Session, now: datetime) -> None:
    parents: dict[str, UUID] = {}
    for role in sorted({document.role for document in DEMO_DOCUMENTS}):
        role_id = _stable_uuid("label", "domain", role)
        parents[role] = role_id
        session.add(
            DocumentLabel(
                id=role_id,
                label_name=role,
                label_type="domain",
                description=f"Demo {role.lower()} workspace",
                created_at=now,
                updated_at=now,
            )
        )

    for document in DEMO_DOCUMENTS:
        session.add(
            DocumentLabel(
                id=_stable_uuid("label", document.label),
                label_name=document.label,
                label_type="label",
                parent_label_id=parents[document.role],
                description=f"Synthetic demo label for {document.doc_type.lower()} documents",
                created_at=now,
                updated_at=now,
            )
        )


def _seed_document(
    session: Session,
    document: DemoDocument,
    now: datetime,
    embedding_dimensions: int,
) -> list[UUID]:
    document_id = f"demo-{document.slug}"
    uploaded_at = now - timedelta(hours=document.uploaded_hours_ago)
    due_at = (
        now + timedelta(hours=document.due_hours_from_now)
        if document.due_hours_from_now is not None
        else None
    )
    # Timescale's time-partitioned vector table extracts timestamps from UUIDv1
    # keys, so vector records intentionally use uuid1 rather than stable ids.
    chunk_ids = [uuid1() for _ in document.chunks]
    metadata = {
        "assigned_role": document.role,
        "status": document.status,
        "due_at": due_at.isoformat() if due_at else None,
        "owner": _owner_for_role(document.role),
        "page_count": max(2, len(document.chunks)),
        "demo_content": True,
        "demo_seed": DEMO_SEED_VERSION,
    }
    upload_data = {
        "event_type": "document_upload",
        "filename": f"data/demo/{document.filename}",
        "doc_type": document.doc_type,
        "metadata": {
            "uploaded_filename": document.filename,
            "status": document.status,
            "demo_seed": DEMO_SEED_VERSION,
        },
    }
    document_context = {
        "id": document_id,
        "filename": document.filename,
        "original_filename": document.filename,
        "doc_type": document.doc_type,
        "chunk_count": len(document.chunks),
        "embedded_chunk_count": len(document.chunks),
        "vector_ids": [str(chunk_id) for chunk_id in chunk_ids],
        "status": document.status,
        "metadata": metadata,
    }
    session.add(
        Event(
            id=_stable_uuid("event", "upload", document.slug),
            data=upload_data,
            task_context={
                "event": upload_data,
                "metadata": {"document": document_context},
                "nodes": {
                    "DocumentIngestionNode": {"status": "completed", "chunk_count": len(document.chunks)}
                },
            },
            created_at=uploaded_at,
            updated_at=uploaded_at + timedelta(minutes=6),
        )
    )

    if document.summary:
        summary_time = uploaded_at + timedelta(minutes=8)
        summary_payload = {
            "summary": document.summary,
            "bullet_points": list(document.bullet_points),
            "next_steps": _next_steps(document),
            "source_chunk_count": len(document.chunks),
            "doc_type": document.doc_type,
            "filename": document.filename,
            "document_id": document_id,
            "generated_at": summary_time.isoformat(),
        }
        session.add(
            Event(
                id=_stable_uuid("event", "summary", document.slug),
                data={"event_type": "document_summary", "document_ids": [document_id]},
                task_context={"metadata": {"document_summaries": {document_id: summary_payload}}},
                created_at=summary_time,
                updated_at=summary_time,
            )
        )

    session.add(
        DocumentClassificationHistory(
            id=_stable_uuid("classification", document.slug),
            document_id=document_id,
            label_name=document.label,
            confidence=0.91,
            source="ai",
            classifier_version="demo-fixture-v1",
            notes="Synthetic classification included with the local demo workspace.",
            classification_metadata={"demo_seed": DEMO_SEED_VERSION, "role": document.role},
            created_at=uploaded_at + timedelta(minutes=7),
        )
    )

    for index, (chunk_id, contents) in enumerate(zip(chunk_ids, document.chunks), start=1):
        chunk_metadata = {
            "document_id": document_id,
            "filename": document.filename,
            "original_filename": document.filename,
            "doc_type": document.doc_type,
            "assigned_role": document.role,
            "chunk_index": index,
            "page_number": index,
            "demo_seed": DEMO_SEED_VERSION,
        }
        session.execute(
            text(
                f"""
                INSERT INTO embeddings (id, metadata, contents, embedding)
                VALUES (
                    :id,
                    CAST(:metadata AS jsonb),
                    :contents,
                    array_fill(0.0::real, ARRAY[{embedding_dimensions}])::vector
                )
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {"id": str(chunk_id), "metadata": json.dumps(chunk_metadata), "contents": contents},
        )
    return chunk_ids


def _seed_qa_history(session: Session, now: datetime) -> None:
    documents = {document.slug: document for document in DEMO_DOCUMENTS}
    for question in DEMO_QUESTIONS:
        event_key = "acme-renewal" if question.slug == "acme-msa" else question.slug
        event_id = _stable_uuid("event", "qa", event_key)
        if session.get(Event, event_id) is not None:
            continue

        document = documents[question.slug]
        document_id = f"demo-{document.slug}"
        created_at = now - timedelta(minutes=question.minutes_ago)
        references = [
            {
                "reference": f"{document.filename} · page {chunk_index} · chunk {chunk_index}",
                "document_id": document_id,
                "filename": document.filename,
                "chunk_index": chunk_index,
            }
            for chunk_index in question.chunk_indexes
        ]
        session.add(
            Event(
                id=event_id,
                data={
                    "event_type": "qa_query",
                    "query": question.question,
                    "filters": {"document_id": document_id},
                },
                task_context={
                    "event": {"event_type": "qa_query", "query": question.question},
                    "metadata": {
                        "qa": {
                            "answer": question.answer,
                            "reasoning": question.reasoning,
                            "confidence": question.confidence,
                            "citations": [reference["reference"] for reference in references],
                        }
                    },
                    "nodes": {"QAQueryNode": {"chunk_references": references}},
                },
                created_at=created_at,
                updated_at=created_at + timedelta(seconds=3),
            )
        )


def _seed_search_history(session: Session, now: datetime, chunk_ids_by_slug: dict[str, list[UUID]]) -> None:
    query = "documents with upcoming renewal or payment deadlines"
    results = []
    for document in (DEMO_DOCUMENTS[0], DEMO_DOCUMENTS[2]):
        results.append(
            {
                "id": str(chunk_ids_by_slug[document.slug][0]),
                "contents": document.chunks[0],
                "distance": 0.12 if document.slug == "acme-msa" else 0.19,
                "metadata": {
                    "document_id": f"demo-{document.slug}",
                    "filename": document.filename,
                    "doc_type": document.doc_type,
                    "chunk_index": 1,
                },
            }
        )
    created_at = now - timedelta(minutes=42)
    session.add(
        Event(
            id=_stable_uuid("event", "search", "upcoming-deadlines"),
            data={"event_type": "search_query", "query": query, "filters": {}},
            task_context={
                "metadata": {"search": {"query": query, "filters": {}, "limit": 5, "results": results}},
                "nodes": {
                    "SemanticSearchNode": {
                        "limit": 5,
                        "result_count": len(results),
                        "preview": results,
                        "results_truncated": False,
                    }
                },
            },
            created_at=created_at,
            updated_at=created_at + timedelta(seconds=1),
        )
    )


def _owner_for_role(role: str) -> str:
    return {
        "Compliance": "Maya Chen",
        "Finance": "Jordan Ellis",
        "HR": "Priya Shah",
        "Legal": "Elena Torres",
        "Operations": "Noah Williams",
    }.get(role, "Demo Analyst")


def _next_steps(document: DemoDocument) -> Sequence[str]:
    if document.role == "Legal":
        return ("Confirm renewal intent with the service owner.", "Calendar the August 1 notice deadline.")
    if document.role == "Finance":
        return ("Validate the GPU usage increase.", "Route invoice NS-2026-0617 for approval.")
    return ("Share the summary with the document owner.",)
