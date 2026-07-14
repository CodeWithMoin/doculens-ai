from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional, Union, Dict, Any, Literal

"""
Event Schema Module

This module defines the Pydantic models that FastAPI uses to validate incoming
HTTP requests. It specifies the expected structure and validation rules for
events entering the system through the API endpoints.
"""

class StrictEvent(BaseModel):
    """Base contract that rejects misspelled or unsupported event fields."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DocumentUploadEvent(StrictEvent):
    event_type: Literal["document_upload"]
    filename: str
    file_url: str
    doc_type: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DocumentClassificationEvent(StrictEvent):
    event_type: Literal["document_classification"]
    document_id: str
    text: str
    metadata: Dict[str, Any]

class InformationExtractionEvent(StrictEvent):
    event_type: Literal["information_extraction"]
    document_id: str
    doc_type: str
    text: str
    fields: List[str] = Field(min_length=1, max_length=100)

class SearchQueryEvent(StrictEvent):
    event_type: Literal["search_query"]
    query: str
    filters: Optional[Dict[str, Any]] = None
    limit: Optional[int] = Field(default=None, ge=1, le=100)

class DocumentRoutingEvent(StrictEvent):
    event_type: Literal["document_routing"]
    document_id: str
    target_department: str
    reason: str


class DocumentSummaryEvent(StrictEvent):
    event_type: Literal["document_summary"]
    document_id: Optional[str] = None
    filename: Optional[str] = None
    doc_type: Optional[str] = None
    chunks_limit: Optional[int] = Field(default=None, ge=1, le=100)

    @model_validator(mode="after")
    def validate_identifier(self):
        if not self.document_id and not self.filename:
            raise ValueError("Provide at least document_id or filename for document_summary events.")
        return self


class QAQueryEvent(StrictEvent):
    event_type: Literal["qa_query"]
    query: str
    top_k: Optional[int] = Field(default=None, ge=1, le=50)
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
