import logging
from typing import Dict, Type

from app.api.event_schema import EventSchema
from app.core.pipeline import Pipeline
from app.pipelines.doculens_pipeline import (
    DoculensClassificationPipeline,
    DoculensDocumentPipeline,
    DoculensExtractionPipeline,
    DoculensQAPipeline,
    DoculensRoutingPipeline,
    DoculensSearchPipeline,
    DoculensSummaryPipeline,
)

"""
Pipeline Registry Module

This module provides a registry system for managing different pipeline types
and their mappings. It determines which pipeline to use based on event attributes,
currently using email addresses as the routing mechanism.
"""

class PipelineRegistry:
    """Registry for managing and routing to different pipeline implementations.

    This class maintains a mapping of pipeline types to their implementations and
    provides logic for determining which pipeline to use based on event attributes.
    It implements a simple factory pattern for pipeline instantiation.

    Attributes:
        pipelines: Dictionary mapping pipeline type strings to pipeline classes
    Example:
        pipelines: Dict[str, Type[Pipeline]] = {
            "support": CustomerSupportPipeline,
            "helpdesk": InternalHelpdeskPipeline,
        }
    """

    pipelines: Dict[str, Type[Pipeline]] = {
        "default": DoculensDocumentPipeline,
        "document_upload": DoculensDocumentPipeline,
        "document_classification": DoculensClassificationPipeline,
        "information_extraction": DoculensExtractionPipeline,
        "document_routing": DoculensRoutingPipeline,
        "search_query": DoculensSearchPipeline,
        "document_summary": DoculensSummaryPipeline,
        "qa_query": DoculensQAPipeline,
    }

    @staticmethod
    def get_pipeline_type(event: EventSchema) -> str:
        """Determines the appropriate pipeline type based on event attributes.

        Args:
            event: Event schema containing routing information

        Returns:
            String representing the pipeline type
        """
        event_type = getattr(event, "event_type", None)
        if event_type in PipelineRegistry.pipelines:
            return event_type
        logging.warning("Unknown event_type '%s'; falling back to default pipeline.", event_type)
        return "default"

    @staticmethod
    def get_pipeline(event: EventSchema) -> Pipeline:
        """Creates and returns the appropriate pipeline instance for the event.

        Args:
            event: Event schema containing routing information

        Returns:
            Instantiated pipeline object for processing the event
        """
        pipeline_type = PipelineRegistry.get_pipeline_type(event)
        pipeline = PipelineRegistry.pipelines.get(pipeline_type)
        if pipeline:
            logging.info(f"Using pipeline: {pipeline.__name__}")
            return pipeline()
        raise ValueError(f"Unknown pipeline type: {pipeline_type}")
