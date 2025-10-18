"""Document classification service backed by OpenAI Responses API."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import List, Optional, Sequence

from openai import OpenAI
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ClassificationScore(BaseModel):
    label: str
    score: float


class ClassificationResult(BaseModel):
    label: str
    confidence: float
    scores: List[ClassificationScore]
    used_text: str
    candidate_labels: List[str]
    reasoning: Optional[str] = None


class OpenAIClassificationService:
    """Use OpenAI's Responses API to classify a document into one of the provided labels."""

    DEFAULT_MODEL = "gpt-4.1-mini"

    def __init__(self, *, model: str = DEFAULT_MODEL):
        self.model = model
        self.client = OpenAI()

    def classify(
        self,
        *,
        text: str,
        candidate_labels: Sequence[str],
        hypothesis_template: Optional[str] = None,  # kept for signature compatibility
        multi_label: bool = False,  # kept for signature compatibility
    ) -> ClassificationResult:
        if not text.strip():
            raise ValueError("Document text cannot be empty for classification.")
        if not candidate_labels:
            raise ValueError("Candidate labels must be provided for classification.")

        formatted_labels = "\n".join(f"- {label}" for label in candidate_labels)
        prompt = f"""
You are a document router. Select the single best matching label for the document from the list below.
Labels:
{formatted_labels}

Return a JSON object with this schema:
{{
  "label": "label from list",
  "confidence": 0.0,
  "reason": "short explanation"
}}

Document:
{text}
"""

        logger.debug("Classifying document using OpenAI model=%s labels=%d", self.model, len(candidate_labels))
        response = self.client.responses.create(
            model=self.model,
            input=prompt,
        )
        payload = getattr(response, "output_text", None)
        if not payload:
            try:
                payload = response.output[0].content[0].text  # type: ignore[attr-defined]
            except (AttributeError, IndexError, TypeError):
                payload = None

        if not payload:
            raise RuntimeError("OpenAI classification response did not contain any text output.")

        payload = payload.strip()
        if payload.startswith("```"):
            payload_lines = payload.splitlines()
            if payload_lines and payload_lines[0].startswith("```"):
                payload_lines = payload_lines[1:]
            if payload_lines and payload_lines[-1].startswith("```"):
                payload_lines = payload_lines[:-1]
            payload = "\n".join(payload_lines).strip()

        try:
            data = json.loads(payload)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse classification response as JSON: %s", payload)
            raise ValueError("Classification response was not valid JSON.") from exc

        label = data.get("label")
        confidence = float(data.get("confidence", 0.0))
        reason = data.get("reason")

        return ClassificationResult(
            label=label,
            confidence=confidence,
            scores=[ClassificationScore(label=label, score=confidence)],
            used_text=text,
            candidate_labels=list(candidate_labels),
            reasoning=reason,
        )

    @property
    def version(self) -> str:
        return f"openai:{self.model}"


@lru_cache
def get_classification_service(model: str = OpenAIClassificationService.DEFAULT_MODEL) -> OpenAIClassificationService:
    """Return a cached instance of the OpenAI classification service."""
    return OpenAIClassificationService(model=model)
