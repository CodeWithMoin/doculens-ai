"""remove seeded document labels

Revision ID: 20250215_0004
Revises: 20250208_0003
Create Date: 2025-02-15 00:00:00.000000
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20250215_0004"
down_revision = "20250208_0003"
branch_labels = None
depends_on = None


DEFAULT_LABEL_DOMAINS = {
    "Finance": [
        "Invoice",
        "Receipt",
        "Purchase Order",
        "Expense Report",
    ],
    "Legal": [
        "Contract",
        "NDA",
        "Compliance Notice",
    ],
    "Operations": [
        "Inspection Report",
        "Work Order",
        "Maintenance Log",
    ],
    "HR": [
        "Offer Letter",
        "Resume",
        "Performance Review",
    ],
    "Support": [
        "Ticket Summary",
        "Customer Complaint",
        "Escalation Memo",
    ],
}


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM document_labels"))


def downgrade() -> None:
    document_labels = sa.table(
        "document_labels",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("workspace_id", postgresql.UUID(as_uuid=True)),
        sa.column("label_name", sa.String),
        sa.column("parent_label_id", postgresql.UUID(as_uuid=True)),
        sa.column("description", sa.Text),
        sa.column("label_type", sa.String),
    )

    for domain, labels in DEFAULT_LABEL_DOMAINS.items():
        domain_id = uuid.uuid4()
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
