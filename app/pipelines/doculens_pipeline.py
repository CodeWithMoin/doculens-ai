import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

import requests
from pydantic import BaseModel, Field

from app.api.event_schema import (
    DocumentClassificationEvent,
    DocumentRoutingEvent,
    DocumentSummaryEvent,
    DocumentUploadEvent,
    EventSchema,
    InformationExtractionEvent,
    QAQueryEvent,
    SearchQueryEvent,
)
from app.config.settings import get_settings
from app.core.base import Node
from app.core.llm import LLMNode
from app.core.pipeline import Pipeline
from app.core.schema import NodeConfig, PipelineSchema
from app.doc_utils.chunking import chunk_document
from app.doc_utils.embedding import embed_and_upsert_chunks
from app.doc_utils.extraction import extract_docling_document
from app.doc_utils.search import semantic_search_docling
from app.services.llm_factory import LLMFactory
from app.services.prompt_loader import PromptManager
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)

INGESTION_DIR = Path(__file__).resolve().parents[1] / "data" / "ingestion"


def _ensure_ingestion_dir() -> Path:
    INGESTION_DIR.mkdir(parents=True, exist_ok=True)
    return INGESTION_DIR


def _require_document_upload_event(event: EventSchema) -> DocumentUploadEvent:
    if not isinstance(event, DocumentUploadEvent) or event.event_type != "document_upload":
        raise ValueError(
            "DoculensDocumentPipeline expects a DocumentUploadEvent with event_type='document_upload'."
        )
    return event


def _require_document_classification_event(event: EventSchema) -> DocumentClassificationEvent:
    if not isinstance(event, DocumentClassificationEvent) or event.event_type != "document_classification":
        raise ValueError(
            "DoculensClassificationPipeline expects a DocumentClassificationEvent with event_type='document_classification'."
        )
    return event


def _require_information_extraction_event(event: EventSchema) -> InformationExtractionEvent:
    if not isinstance(event, InformationExtractionEvent) or event.event_type != "information_extraction":
        raise ValueError(
            "DoculensExtractionPipeline expects an InformationExtractionEvent with event_type='information_extraction'."
        )
    return event


def _require_document_routing_event(event: EventSchema) -> DocumentRoutingEvent:
    if not isinstance(event, DocumentRoutingEvent) or event.event_type != "document_routing":
        raise ValueError(
            "DoculensRoutingPipeline expects a DocumentRoutingEvent with event_type='document_routing'."
        )
    return event


def _require_search_query_event(event: EventSchema) -> SearchQueryEvent:
    if not isinstance(event, SearchQueryEvent) or event.event_type != "search_query":
        raise ValueError(
            "DoculensSearchPipeline expects a SearchQueryEvent with event_type='search_query'."
        )
    return event


def _require_document_summary_event(event: EventSchema) -> DocumentSummaryEvent:
    if not isinstance(event, DocumentSummaryEvent) or event.event_type != "document_summary":
        raise ValueError(
            "DoculensSummaryPipeline expects a DocumentSummaryEvent with event_type='document_summary'."
        )
    return event


def _require_qa_query_event(event: EventSchema) -> QAQueryEvent:
    if not isinstance(event, QAQueryEvent) or event.event_type != "qa_query":
        raise ValueError("DoculensQAPipeline expects a QAQueryEvent with event_type='qa_query'.")
    return event


class DoculensLLMNode(LLMNode):
    """Base class for DocuLens LLM-powered nodes."""

    provider: str = "openai"
    model: Optional[str] = None
    prompt_template: Optional[str] = None

    def __init__(self):
        self._llm = LLMFactory(self.provider)

    def build_messages(self, context: BaseModel) -> List[Dict[str, str]]:
        if not self.prompt_template:
            raise ValueError("prompt_template must be defined for DoculensLLMNode subclasses.")
        prompt = PromptManager.get_prompt(self.prompt_template)
        return [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": context.model_dump_json(indent=2),
            },
        ]

    def create_completion(self, context: BaseModel):
        response_model, raw_completion = self._llm.create_completion(
            response_model=self.ResponseModel,
            messages=self.build_messages(context),
            model=self.model or self._llm.settings.default_model,
        )
        return response_model, raw_completion

    def process(self, task_context):
        context = self.get_context(task_context)
        response_model, raw_completion = self.create_completion(context)

        node_result: Dict[str, Any] = {
            "result": response_model.model_dump(),
            "model": getattr(raw_completion, "model", None),
        }
        usage = getattr(raw_completion, "usage", None)
        if usage is not None:
            if hasattr(usage, "model_dump"):
                node_result["usage"] = usage.model_dump()
            else:
                node_result["usage"] = getattr(usage, "__dict__", usage)

        task_context.nodes[self.node_name] = node_result
        updated_context = self.after_completion(task_context, response_model)
        return updated_context if updated_context is not None else task_context

    def after_completion(self, task_context, response_model):
        """Hook for subclasses to persist additional metadata."""
        return task_context


class ExtractionNode(Node):
    """Download (if needed) and convert the document into Docling format."""

    def process(self, task_context):
        event = _require_document_upload_event(task_context.event)
        document_id = task_context.metadata.get("document", {}).get("id", uuid4().hex)

        ingestion_dir = _ensure_ingestion_dir()
        filename = Path(event.filename or f"{document_id}.bin").name
        local_path = ingestion_dir / f"{document_id}_{filename}"

        if event.file_url:
            logger.info("Downloading document for ingestion: %s", event.file_url)
            response = requests.get(event.file_url, timeout=30)
            response.raise_for_status()
            local_path.write_bytes(response.content)
        else:
            source_path = Path(event.filename)
            if not source_path.exists():
                raise FileNotFoundError(
                    f"DocumentUploadEvent filename '{event.filename}' not found and no file_url provided."
                )
            local_path = source_path.resolve()

        docling_doc = extract_docling_document(str(local_path))
        if docling_doc is None:
            raise ValueError("Docling conversion failed to produce a document.")

        page_count = len(getattr(docling_doc, "pages", [])) if hasattr(docling_doc, "pages") else None

        task_context.state["docling_doc"] = docling_doc
        task_context.state["local_path"] = str(local_path)
        task_context.metadata["document"] = {
            "id": document_id,
            "original_filename": filename,
            "source_url": event.file_url,
            "local_path": str(local_path),
            "ingest_source": event.filename,
            "page_count": page_count,
            "metadata": event.metadata,
            "doc_type": event.doc_type,
        }
        task_context.nodes[self.node_name] = {
            "document_id": document_id,
            "local_path": str(local_path),
            "page_count": page_count,
        }
        return task_context


class ChunkingNode(Node):
    """Split the Docling document into embedding-friendly chunks."""

    SAMPLE_PREVIEWS = 5

    @staticmethod
    def _render_preview(chunk: Any) -> str:
        text = getattr(chunk, "text", None) or getattr(chunk, "content", None) or str(chunk)
        preview = " ".join(text.split())
        return preview[:200]

    def process(self, task_context):
        docling_doc = task_context.state.get("docling_doc")
        chunks = chunk_document(docling_doc)
        task_context.state["chunks"] = chunks

        chunk_count = len(chunks)
        previews: List[Dict[str, Any]] = [
            {"index": idx, "preview": self._render_preview(chunk)}
            for idx, chunk in enumerate(chunks[: self.SAMPLE_PREVIEWS])
        ]

        document_meta = task_context.metadata.get("document", {})
        document_meta["chunk_count"] = chunk_count

        task_context.nodes[self.node_name] = {
            "chunk_count": chunk_count,
            "sample_previews": previews,
        }
        return task_context


class EmbeddingNode(Node):
    """Generate embeddings for chunks and upsert them into the vector store."""

    def process(self, task_context):
        chunks = task_context.state.get("chunks", [])
        document_meta = task_context.metadata.setdefault("document", {})
        document_id = document_meta.get("id") or uuid4().hex
        document_meta["id"] = document_id

        summaries = embed_and_upsert_chunks(
            chunks,
            document_id=document_id,
            document_metadata={
                "doc_type": document_meta.get("doc_type"),
                "original_filename": document_meta.get("original_filename"),
            },
        )
        chunk_ids = [summary["id"] for summary in summaries]
        vector_id_preview = chunk_ids[:20]

        document_meta["vector_ids"] = chunk_ids
        document_meta["embedded_chunk_count"] = len(chunk_ids)

        task_context.nodes[self.node_name] = {
            "embedded_chunks": len(chunk_ids),
            "vector_ids": vector_id_preview,
            "vector_ids_truncated": len(vector_id_preview) < len(chunk_ids),
        }

        # Cleanup heavy artifacts
        task_context.state.pop("chunks", None)
        task_context.state.pop("docling_doc", None)

        return task_context


class DocumentClassificationNode(DoculensLLMNode):
    """LLM node that classifies a document into a business-ready label."""

    prompt_template = "document_classification"

    class ContextModel(LLMNode.ContextModel):
        document_id: str
        text: str
        metadata: Optional[Dict[str, Any]] = None

    class ResponseModel(LLMNode.ResponseModel):
        document_type: str = Field(description="Predicted document type label")
        confidence: float = Field(ge=0.0, le=1.0)
        reasoning: str
        tags: List[str] = Field(default_factory=list)

    def get_context(self, task_context):
        event = _require_document_classification_event(task_context.event)
        return self.ContextModel(
            document_id=event.document_id,
            text=event.text,
            metadata=event.metadata,
        )

    def after_completion(self, task_context, response_model: ResponseModel):
        task_context.metadata["classification"] = response_model.model_dump()
        return task_context


class InformationExtractionNode(DoculensLLMNode):
    """LLM node that extracts structured fields from a document."""

    prompt_template = "information_extraction"

    class ContextModel(LLMNode.ContextModel):
        document_id: str
        doc_type: str
        text: str
        fields: List[str]

    class FieldValue(BaseModel):
        name: str
        value: str
        confidence: float = Field(ge=0.0, le=1.0)

    class ResponseModel(LLMNode.ResponseModel):
        fields: List["InformationExtractionNode.FieldValue"] = Field(default_factory=list)
        reasoning: Optional[str] = None

    def get_context(self, task_context):
        event = _require_information_extraction_event(task_context.event)
        return self.ContextModel(
            document_id=event.document_id,
            doc_type=event.doc_type,
            text=event.text,
            fields=event.fields,
        )

    def after_completion(self, task_context, response_model: ResponseModel):
        task_context.metadata["extraction"] = response_model.model_dump()
        return task_context


class DocumentRoutingNode(DoculensLLMNode):
    """LLM node that determines the appropriate department or workflow."""

    prompt_template = "document_routing"

    class ContextModel(LLMNode.ContextModel):
        document_id: str
        candidate_department: str
        reason: str
        metadata: Optional[Dict[str, Any]] = None

    class ResponseModel(LLMNode.ResponseModel):
        assigned_department: str
        confidence: float = Field(ge=0.0, le=1.0)
        reasoning: str
        escalate: bool = False

    def get_context(self, task_context):
        event = _require_document_routing_event(task_context.event)
        additional_metadata = task_context.metadata.get("document") or getattr(event, "metadata", None)
        return self.ContextModel(
            document_id=event.document_id,
            candidate_department=event.target_department,
            reason=event.reason,
            metadata=additional_metadata,
        )

    def after_completion(self, task_context, response_model: ResponseModel):
        task_context.metadata["routing"] = response_model.model_dump()
        return task_context


class DocumentSummaryNode(DoculensLLMNode):
    """LLM node that summarizes a document based on stored chunks."""

    prompt_template = "document_summary"

    class ContextModel(LLMNode.ContextModel):
        document_id: str
        doc_type: Optional[str] = None
        filename: Optional[str] = None
        chunk_texts: List[str]

    class ResponseModel(LLMNode.ResponseModel):
        summary: str
        bullet_points: List[str] = Field(default_factory=list)
        next_steps: Optional[List[str]] = None

    def get_context(self, task_context):
        event = _require_document_summary_event(task_context.event)
        vector_store = VectorStore()
        settings = get_settings()
        chunk_limit = event.chunks_limit or settings.summary_chunk_limit
        chunks = vector_store.fetch_document_chunks(
            document_id=event.document_id,
            filename=event.filename,
            limit=chunk_limit,
        )
        if not chunks:
            raise ValueError("No chunks found for requested document; run ingestion first.")

        resolved_document_id = event.document_id or chunks[0]["metadata"].get("document_id")
        chunk_meta = chunks[0]["metadata"] if chunks else {}
        resolved_doc_type = event.doc_type or chunk_meta.get("doc_type")
        resolved_filename = (
            event.filename
            or chunk_meta.get("original_filename")
            or chunk_meta.get("filename")
        )

        context = self.ContextModel(
            document_id=resolved_document_id,
            doc_type=resolved_doc_type,
            filename=resolved_filename,
            chunk_texts=[entry["contents"] for entry in chunks],
        )
        task_context.state["summary_chunks"] = chunks  # keep references for after_completion
        task_context.state["summary_context"] = context
        return context

    def after_completion(self, task_context, response_model: ResponseModel):
        chunks = task_context.state.pop("summary_chunks", [])
        context: Optional[DocumentSummaryNode.ContextModel] = task_context.state.pop("summary_context", None)
        document_id = task_context.event.document_id if isinstance(task_context.event, DocumentSummaryEvent) else None
        if not document_id and chunks:
            document_id = chunks[0]["metadata"].get("document_id")

        summary_payload = response_model.model_dump()
        summary_payload["source_chunk_count"] = len(chunks)
        if context:
            summary_payload.setdefault("doc_type", context.doc_type)
            summary_payload.setdefault("filename", context.filename)
            summary_payload.setdefault("document_id", context.document_id)

        summaries = task_context.metadata.setdefault("document_summaries", {})
        if document_id:
            summaries[document_id] = summary_payload
        else:
            summaries["latest"] = summary_payload

        task_context.nodes[self.node_name] = {
            "summary": response_model.summary,
            "bullet_points": response_model.bullet_points,
            "next_steps": response_model.next_steps,
            "source_chunks": [
                {
                    "id": chunk["id"],
                    "document_id": chunk["metadata"].get("document_id"),
                    "chunk_index": (
                        int(chunk["metadata"]["chunk_index"])
                        if str(chunk["metadata"].get("chunk_index", "")).isdigit()
                        else chunk["metadata"].get("chunk_index")
                    ),
                }
                for chunk in chunks[:5]
            ],
        }
        return task_context


class QAQueryNode(DoculensLLMNode):
    """LLM node that performs retrieval-augmented QA over stored chunks."""

    prompt_template = "qa_answering"

    class RetrievedChunk(BaseModel):
        reference: str
        document_id: Optional[str] = None
        filename: Optional[str] = None
        chunk_index: Optional[int] = None
        text: str

    class ContextModel(LLMNode.ContextModel):
        query: str
        chunks: List["QAQueryNode.RetrievedChunk"]

    class ResponseModel(LLMNode.ResponseModel):
        answer: str
        reasoning: Optional[str] = None
        confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
        citations: List[str] = Field(default_factory=list, description="List of chunk references supporting the answer.")

    def get_context(self, task_context):
        event = _require_qa_query_event(task_context.event)
        settings = get_settings()
        top_k = event.top_k or settings.qa_top_k
        results = semantic_search_docling(
            query=event.query,
            limit=top_k,
            metadata_filter=event.filters,
        )
        if not results:
            raise ValueError("No semantic matches found for the supplied question. Ensure embeddings exist.")

        chunks: List[QAQueryNode.RetrievedChunk] = []
        for idx, record in enumerate(results):
            metadata = record.get("metadata") or {}
            chunk_index = metadata.get("chunk_index")
            if isinstance(chunk_index, str) and chunk_index.isdigit():
                chunk_index_int = int(chunk_index)
            elif isinstance(chunk_index, int):
                chunk_index_int = chunk_index
            else:
                chunk_index_int = idx
            reference = metadata.get("reference") or f"{metadata.get('document_id', 'doc')}#chunk-{chunk_index_int}"
            chunks.append(
                self.RetrievedChunk(
                    reference=str(reference),
                    document_id=metadata.get("document_id"),
                    filename=metadata.get("filename"),
                    chunk_index=chunk_index_int,
                    text=record.get("contents", ""),
                )
            )
        context = self.ContextModel(query=event.query, chunks=chunks)
        task_context.state["qa_chunks"] = chunks
        return context

    def build_messages(self, context: ContextModel) -> List[Dict[str, str]]:
        prompt = PromptManager.get_prompt(self.prompt_template)
        context_blocks = []
        for idx, chunk in enumerate(context.chunks, start=1):
            header = f"[{idx}] ref={chunk.reference}"
            if chunk.document_id:
                header += f" | document_id={chunk.document_id}"
            if chunk.filename:
                header += f" | filename={chunk.filename}"
            context_blocks.append(f"{header}\n{chunk.text}")
        user_content = (
            f"Question:\n{context.query}\n\n"
            "Context passages:\n"
            + "\n\n".join(context_blocks)
        )
        return [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content},
        ]

    def after_completion(self, task_context, response_model: ResponseModel):
        chunks: List[QAQueryNode.RetrievedChunk] = task_context.state.pop("qa_chunks", [])
        task_context.metadata["qa"] = response_model.model_dump()
        task_context.metadata["qa"]["used_chunks"] = [chunk.reference for chunk in chunks]

        task_context.nodes[self.node_name] = {
            "answer": response_model.answer,
            "reasoning": response_model.reasoning,
            "citations": response_model.citations,
            "confidence": response_model.confidence,
            "chunk_references": [
                {
                    "reference": chunk.reference,
                    "document_id": chunk.document_id,
                    "filename": chunk.filename,
                    "chunk_index": chunk.chunk_index,
                }
                for chunk in chunks
            ],
        }
        return task_context


class SemanticSearchNode(Node):
    """Perform semantic search against the vector store."""

    def process(self, task_context):
        event = _require_search_query_event(task_context.event)
        settings = get_settings()
        search_limit = event.limit or settings.search_result_limit
        results = semantic_search_docling(
            query=event.query,
            limit=search_limit,
            metadata_filter=event.filters,
        )

        preview = results[: settings.search_preview_limit]
        task_context.metadata["search"] = {
            "query": event.query,
            "filters": event.filters,
            "limit": search_limit,
            "results": results,
        }
        task_context.nodes[self.node_name] = {
            "query": event.query,
            "filters": event.filters,
            "result_count": len(results),
            "preview": preview,
            "results_truncated": len(preview) < len(results),
            "limit": search_limit,
        }
        return task_context


class DoculensDocumentPipeline(Pipeline):
    pipeline_schema = PipelineSchema(
        start=ExtractionNode,
        nodes=[
            NodeConfig(node=ExtractionNode, connections=[ChunkingNode]),
            NodeConfig(node=ChunkingNode, connections=[EmbeddingNode]),
            NodeConfig(node=EmbeddingNode, connections=[]),
        ],
    )


class DoculensClassificationPipeline(Pipeline):
    pipeline_schema = PipelineSchema(
        start=DocumentClassificationNode,
        nodes=[
            NodeConfig(node=DocumentClassificationNode, connections=[]),
        ],
    )


class DoculensExtractionPipeline(Pipeline):
    pipeline_schema = PipelineSchema(
        start=InformationExtractionNode,
        nodes=[
            NodeConfig(node=InformationExtractionNode, connections=[]),
        ],
    )


class DoculensRoutingPipeline(Pipeline):
    pipeline_schema = PipelineSchema(
        start=DocumentRoutingNode,
        nodes=[
            NodeConfig(node=DocumentRoutingNode, connections=[]),
        ],
    )


class DoculensSearchPipeline(Pipeline):
    pipeline_schema = PipelineSchema(
        start=SemanticSearchNode,
        nodes=[
            NodeConfig(node=SemanticSearchNode, connections=[]),
        ],
    )


class DoculensSummaryPipeline(Pipeline):
    pipeline_schema = PipelineSchema(
        start=DocumentSummaryNode,
        nodes=[
            NodeConfig(node=DocumentSummaryNode, connections=[]),
        ],
    )


class DoculensQAPipeline(Pipeline):
    pipeline_schema = PipelineSchema(
        start=QAQueryNode,
        nodes=[
            NodeConfig(node=QAQueryNode, connections=[]),
        ],
    )
