from pydantic import BaseModel, model_validator
from typing import List, Optional, Union, Dict, Any, Literal

"""
Event Schema Module

This module defines the Pydantic models that FastAPI uses to validate incoming
HTTP requests. It specifies the expected structure and validation rules for
events entering the system through the API endpoints.
"""

class DocumentUploadEvent(BaseModel):
    event_type: Literal["document_upload"]
    filename: str
    file_url: str
    doc_type: Optional[str] = None
    metadata: Dict[str, Any]

class DocumentClassificationEvent(BaseModel):
    event_type: Literal["document_classification"]
    document_id: str
    text: str
    metadata: Dict[str, Any]

class InformationExtractionEvent(BaseModel):
    event_type: Literal["information_extraction"]
    document_id: str
    doc_type: str
    text: str
    fields: List[str]

class SearchQueryEvent(BaseModel):
    event_type: Literal["search_query"]
    query: str
    filters: Optional[Dict[str, Any]] = None
    limit: Optional[int] = None

class DocumentRoutingEvent(BaseModel):
    event_type: Literal["document_routing"]
    document_id: str
    target_department: str
    reason: str


class DocumentSummaryEvent(BaseModel):
    event_type: Literal["document_summary"]
    document_id: Optional[str] = None
    filename: Optional[str] = None
    doc_type: Optional[str] = None
    chunks_limit: Optional[int] = None

    @model_validator(mode="after")
    def validate_identifier(self):
        if not self.document_id and not self.filename:
            raise ValueError("Provide at least document_id or filename for document_summary events.")
        return self


class QAQueryEvent(BaseModel):
    event_type: Literal["qa_query"]
    query: str
    top_k: Optional[int] = None
    filters: Optional[Dict[str, Any]] = None

# Union of all event types for the single endpoint
EventSchema = Union[
    DocumentUploadEvent,
    DocumentClassificationEvent,
    InformationExtractionEvent,
    SearchQueryEvent,
    DocumentRoutingEvent,
    DocumentSummaryEvent,
    QAQueryEvent,
]
