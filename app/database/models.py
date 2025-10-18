from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import relationship

from app.database.session import Base


class DocumentLabel(Base):
    __tablename__ = "document_labels"

    id = Column(postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(postgresql.UUID(as_uuid=True), nullable=True)
    label_name = Column(String(255), nullable=False)
    parent_label_id = Column(postgresql.UUID(as_uuid=True), ForeignKey("document_labels.id", ondelete="CASCADE"), nullable=True)
    description = Column(Text, nullable=True)
    created_by = Column(postgresql.UUID(as_uuid=True), nullable=True)
    label_type = Column(String(32), nullable=False, default="label")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    parent = relationship("DocumentLabel", remote_side=[id], backref="children", lazy="joined")


class DocumentClassificationHistory(Base):
    __tablename__ = "document_classification_history"

    id = Column(postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(String(255), nullable=False, index=True)
    label_name = Column(String(255), nullable=False)
    confidence = Column(Float, nullable=True)
    source = Column(String(20), nullable=False, default="ai")
    user_id = Column(postgresql.UUID(as_uuid=True), nullable=True)
    classifier_version = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    classification_metadata = Column(postgresql.JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
