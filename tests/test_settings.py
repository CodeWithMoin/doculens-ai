import pytest

from app.config.settings import Settings


def test_production_rejects_default_auth_secret():
    settings = Settings(
        DOCULENS_ENVIRONMENT="production",
        DOCULENS_AUTH_SECRET="doculens-dev-secret",
        DOCULENS_INITIALIZE_DATABASE=False,
    )
    with pytest.raises(ValueError, match="DOCULENS_AUTH_SECRET"):
        settings.assert_production_safe()


def test_operational_limits_are_validated():
    with pytest.raises(ValueError):
        Settings(DOCULENS_QA_TOP_K=0)


def test_production_rejects_demo_workspace_seed():
    settings = Settings(
        DOCULENS_ENVIRONMENT="production",
        DOCULENS_AUTH_SECRET="a-production-safe-secret",
        DOCULENS_SEED_DEMO_USERS=False,
        DOCULENS_SEED_DEMO_WORKSPACE=True,
        DOCULENS_INITIALIZE_DATABASE=False,
    )
    with pytest.raises(ValueError, match="DOCULENS_SEED_DEMO_WORKSPACE"):
        settings.assert_production_safe()


def test_production_allows_seeded_read_only_showcase():
    settings = Settings(
        DOCULENS_ENVIRONMENT="production",
        DOCULENS_AUTH_SECRET="a-production-safe-secret",
        DOCULENS_SEED_DEMO_USERS=False,
        DOCULENS_SEED_DEMO_WORKSPACE=True,
        DOCULENS_SHOWCASE_READ_ONLY=True,
        DOCULENS_INITIALIZE_DATABASE=True,
    )

    settings.assert_production_safe()
