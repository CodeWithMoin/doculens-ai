import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config.settings import get_settings


@pytest.fixture(autouse=True)
def reset_settings_cache():
    """Ensure cached settings don't leak between tests."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
