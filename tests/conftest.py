import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Provide fallback API keys so Pydantic settings don't fail in CI.
os.environ.setdefault("OPENAI_API_KEY", "ci-test-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "ci-test-key")
os.environ.setdefault("OPEN_ROUTER_API_KEY", "ci-test-key")
os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_PORT", "5432")
os.environ.setdefault("DATABASE_NAME", "doculens")
os.environ.setdefault("DATABASE_USER", "postgres")
os.environ.setdefault("DATABASE_PASSWORD", "ci-password")

from config.settings import get_settings


@pytest.fixture(autouse=True)
def reset_settings_cache():
    """Ensure cached settings don't leak between tests."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
