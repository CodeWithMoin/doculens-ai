from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import and_, asc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.models import DocumentLabel

logger = logging.getLogger(__name__)


class LabelConflictError(ValueError):
    """Raised when attempting to create a duplicate label within a workspace."""


class LabelService:
    """Manage global and workspace-specific document labels."""

    def __init__(self, session: Session, workspace_id: Optional[uuid.UUID] = None):
        self.session = session
        self.workspace_id = workspace_id

    # --------------------------------------------------------------------- #
    # Query helpers
    # --------------------------------------------------------------------- #
    def _base_query(self):
        return select(DocumentLabel).order_by(asc(DocumentLabel.label_name))

    def _workspace_filter(self):
        return or_(DocumentLabel.workspace_id.is_(None), DocumentLabel.workspace_id == self.workspace_id)

    # --------------------------------------------------------------------- #
    # Public API
    # --------------------------------------------------------------------- #
    def list_flat_labels(self) -> List[DocumentLabel]:
        """Return all labels (domains and child labels) visible to this workspace."""
        query = self._base_query().where(self._workspace_filter())
        results = self.session.execute(query).scalars().all()
        return results

    def get_candidate_labels(self) -> List[str]:
        """Return just the label names that are eligible for classification (non-domain)."""
        query = (
            select(DocumentLabel.label_name)
            .where(
                and_(
                    DocumentLabel.label_type == "label",
                    self._workspace_filter(),
                )
            )
            .order_by(asc(DocumentLabel.label_name))
        )
        return [row[0] for row in self.session.execute(query)]

    def get_label_tree(self) -> List[Dict[str, object]]:
        """Return label hierarchy grouped by domain."""
        rows = self.list_flat_labels()
        domain_map: Dict[Optional[uuid.UUID], Dict[str, object]] = {}
        children_map: Dict[Optional[uuid.UUID], List[Dict[str, object]]] = defaultdict(list)

        for label in rows:
            node = {
                "id": str(label.id),
                "name": label.label_name,
                "type": label.label_type,
                "description": label.description,
                "workspace_id": str(label.workspace_id) if label.workspace_id else None,
                "parent_id": str(label.parent_label_id) if label.parent_label_id else None,
            }
            if label.label_type == "domain" or label.parent_label_id is None:
                domain_map[label.id] = {**node, "children": []}
            else:
                children_map[label.parent_label_id].append(node)

        # Attach children to domains; orphan labels (no domain) go under None bucket.
        tree: List[Dict[str, object]] = []
        for domain_id, domain_node in domain_map.items():
            domain_node["children"] = children_map.get(domain_id, [])
            tree.append(domain_node)

        # Handle orphan labels (no parent and not registered as domain)
        orphans = [
            node
            for parent_id, nodes in children_map.items()
            if parent_id not in domain_map
            for node in nodes
        ]
        if orphans:
            tree.append(
                {
                    "id": None,
                    "name": "Ungrouped",
                    "type": "domain",
                    "description": "Labels without a parent domain",
                    "workspace_id": None,
                    "parent_id": None,
                    "children": orphans,
                }
            )
        return tree

    # --------------------------------------------------------------------- #
    # Mutations
    # --------------------------------------------------------------------- #
    def create_label(
        self,
        *,
        label_name: str,
        description: Optional[str] = None,
        parent_label_id: Optional[uuid.UUID] = None,
        label_type: str = "label",
        created_by: Optional[uuid.UUID] = None,
    ) -> DocumentLabel:
        label = DocumentLabel(
            id=uuid.uuid4(),
            workspace_id=self.workspace_id,
            label_name=label_name.strip(),
            description=description,
            parent_label_id=parent_label_id,
            label_type=label_type,
            created_by=created_by,
        )
        self.session.add(label)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            logger.warning("Duplicate label attempted: %s", label_name)
            raise LabelConflictError(f"Label '{label_name}' already exists for this workspace.") from exc
        self.session.refresh(label)
        return label

    def update_label(
        self,
        label_id: uuid.UUID,
        *,
        label_name: Optional[str] = None,
        description: Optional[str] = None,
        parent_label_id: Optional[uuid.UUID] = None,
    ) -> DocumentLabel:
        label = self.session.get(DocumentLabel, label_id)
        if not label:
            raise ValueError("Label not found.")
        if label.workspace_id != self.workspace_id and label.workspace_id is not None:
            raise PermissionError("Cannot modify a label from another workspace.")

        if label_name:
            label.label_name = label_name.strip()
        if description is not None:
            label.description = description
        if parent_label_id is not None:
            label.parent_label_id = parent_label_id

        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise LabelConflictError(f"Label '{label_name}' already exists for this workspace.") from exc
        self.session.refresh(label)
        return label

    def delete_label(self, label_id: uuid.UUID, *, force: bool = False) -> None:
        label = self.session.get(DocumentLabel, label_id)
        if not label:
            return
        if label.workspace_id != self.workspace_id and label.workspace_id is not None:
            raise PermissionError("Cannot delete a label from another workspace.")
        if label.children and not force:
            raise ValueError("Cannot delete a label that has child labels. Use force=True to cascade.")

        self.session.delete(label)
        self.session.commit()
