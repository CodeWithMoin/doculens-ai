from typing import Any, Dict

from app.api.event_schema import EventSchema
from pydantic import BaseModel, Field
from pydantic import ConfigDict

"""
Task Context Module

This module defines the context object that gets passed between pipeline nodes.
It maintains the state and metadata throughout pipeline execution.
"""


class TaskContext(BaseModel):
    """Context container for pipeline task execution.

    TaskContext maintains the state and results of a pipeline's execution,
    tracking the original event, intermediate node results, and additional
    metadata throughout the processing flow.

    Attributes:
        event: The original event that triggered the pipeline
        nodes: Dictionary storing results and state from each node's execution
        metadata: Dictionary storing pipeline-level metadata and configuration
        state: Ephemeral storage for in-flight artifacts that shouldn't be persisted

    Example:
        context = TaskContext(
            event=incoming_event,
            nodes={"AnalyzeNode": {"score": 0.95}},
            metadata={"priority": "high"}
        )
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    event: EventSchema
    nodes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Stores results and state from each node's execution",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Stores pipeline-level metadata and configuration",
    )
    state: Dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Ephemeral working storage for pipeline artifacts. "
            "Excluded from serialization to keep task context persistable."
        ),
        exclude=True,
    )
