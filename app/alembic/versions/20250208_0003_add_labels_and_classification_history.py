"""add document labels and classification history

Revision ID: 20250208_0003
Revises: 20250208_0002
Create Date: 2025-02-14 20:30:00.000000
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20250208_0003"
down_revision = "20250208_0002"
branch_labels = None
depends_on = None


DEFAULT_LABEL_DOMAINS: dict[str, list[str]] = {}


def upgrade() -> None:
    op.create_table(
        "document_labels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("label_name", sa.String(length=255), nullable=False),
        sa.Column("parent_label_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "label_type",
            sa.String(length=32),
            nullable=False,
            server_default="label",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["parent_label_id"],
            ["document_labels.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_document_labels_workspace_label",
        "document_labels",
        ["workspace_id", "label_name"],
        unique=True,
    )

    op.create_table(
        "document_classification_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("document_id", sa.String(length=255), nullable=False),
        sa.Column("label_name", sa.String(length=255), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="ai"),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("classifier_version", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_document_classification_history_doc_created_at",
        "document_classification_history",
        ["document_id", "created_at"],
        unique=False,
    )

    # Seed default labels (global workspace)
    document_labels = sa.table(
        "document_labels",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("workspace_id", postgresql.UUID(as_uuid=True)),
        sa.column("label_name", sa.String),
        sa.column("parent_label_id", postgresql.UUID(as_uuid=True)),
        sa.column("description", sa.Text),
        sa.column("label_type", sa.String),
    )

    domain_id_map: dict[str, uuid.UUID] = {}
    for domain, labels in DEFAULT_LABEL_DOMAINS.items():
        domain_id = uuid.uuid4()
        domain_id_map[domain] = domain_id
        op.bulk_insert(
            document_labels,
            [
                {
                    "id": domain_id,
                    "workspace_id": None,
                    "label_name": domain,
                    "parent_label_id": None,
                    "description": f"Domain: {domain}",
                    "label_type": "domain",
                }
            ],
        )
        child_rows = [
            {
                "id": uuid.uuid4(),
                "workspace_id": None,
                "label_name": label,
                "parent_label_id": domain_id,
                "description": None,
                "label_type": "label",
            }
            for label in labels
        ]
        if child_rows:
            op.bulk_insert(document_labels, child_rows)


def downgrade() -> None:
    op.drop_index(
        "ix_document_classification_history_doc_created_at",
        table_name="document_classification_history",
    )
    op.drop_table("document_classification_history")
    op.drop_index("ix_document_labels_workspace_label", table_name="document_labels")
    op.drop_table("document_labels")
