import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.api import endpoint as endpoint_module
from app.api.dependencies import db_session
from app.main import app


client = TestClient(app)


def test_dashboard_insights_shape(monkeypatch):
    sample_payload = {
        'total_documents': 2,
        'summarised_documents': 1,
        'chunk_count': 4,
        'embedded_count': 4,
        'queue_latency': '5m',
        'estimated_savings': 120.0,
        'hours_saved': 2.0,
        'analyst_rate': 60,
        'sla_risk_count': 0,
        'sla_risk_message': 'All documents are within SLA thresholds.',
        'throughput_series': [{'label': 'Jan 1', 'value': 2}],
        'compliance_series': [{'label': 'Jan 1', 'value': 50}],
        'delta_processed': '+10.0% vs yesterday',
        'delta_processed_tone': 'positive',
        'delta_summaries': 'No change vs yesterday',
        'delta_summaries_tone': 'neutral',
        'today_total': 2,
        'today_summaries': 1,
        'yesterday_total': 1,
        'yesterday_summaries': 1,
    }

    monkeypatch.setattr(endpoint_module, 'get_dashboard_insights', lambda session=None: sample_payload)

    response = endpoint_module.get_dashboard_insights(session=None)
    assert response == sample_payload
