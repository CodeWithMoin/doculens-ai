"""Validated application configuration.

Environment variables are the public configuration API.  Keeping them in one
model makes startup failures explicit and prevents infrastructure clients from
silently inventing their own defaults.
"""

from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config.database_config import DatabaseConfig
from app.config.llm_config import LLMConfig


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables and an optional .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "DocuLens AI"
    environment: Literal["development", "test", "staging", "production"] = Field(
        default="development", alias="DOCULENS_ENVIRONMENT"
    )
    log_level: str = Field(default="INFO", alias="DOCULENS_LOG_LEVEL")
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"], alias="DOCULENS_CORS_ORIGINS"
    )
    initialize_database: bool = Field(default=True, alias="DOCULENS_INITIALIZE_DATABASE")
    seed_demo_users: bool = Field(default=False, alias="DOCULENS_SEED_DEMO_USERS")
    seed_demo_workspace: bool = Field(default=False, alias="DOCULENS_SEED_DEMO_WORKSPACE")
    showcase_read_only: bool = Field(default=False, alias="DOCULENS_SHOWCASE_READ_ONLY")

    llm: LLMConfig = Field(default_factory=LLMConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    api_key: Optional[str] = Field(default=None, alias="DOCULENS_API_KEY")
    api_key_header: str = Field(default="X-API-Key", alias="DOCULENS_API_KEY_HEADER")
    summary_chunk_limit: int = Field(default=12, ge=1, le=100, alias="DOCULENS_SUMMARY_CHUNK_LIMIT")
    qa_top_k: int = Field(default=5, ge=1, le=50, alias="DOCULENS_QA_TOP_K")
    search_result_limit: int = Field(default=10, ge=1, le=100, alias="DOCULENS_SEARCH_RESULT_LIMIT")
    search_preview_limit: int = Field(default=5, ge=1, le=50, alias="DOCULENS_SEARCH_PREVIEW_LIMIT")
    chunk_preview_limit: int = Field(default=25, ge=1, le=100, alias="DOCULENS_CHUNK_PREVIEW_LIMIT")
    chunk_max_tokens: int = Field(default=800, ge=128, le=4000, alias="DOCULENS_CHUNK_MAX_TOKENS")
    embedding_batch_size: int = Field(default=64, ge=1, le=256, alias="DOCULENS_EMBEDDING_BATCH_SIZE")
    embedding_cache_size: int = Field(default=1024, ge=0, le=10000, alias="DOCULENS_EMBEDDING_CACHE_SIZE")
    provider_timeout_seconds: float = Field(default=30.0, ge=1, le=300, alias="DOCULENS_PROVIDER_TIMEOUT_SECONDS")
    max_upload_bytes: int = Field(default=25 * 1024 * 1024, ge=1024, alias="DOCULENS_MAX_UPLOAD_BYTES")
    auth_secret_key: str = Field(default="doculens-dev-secret", alias="DOCULENS_AUTH_SECRET")
    auth_algorithm: str = Field(default="HS256", alias="DOCULENS_AUTH_ALGORITHM")
    auth_token_exp_minutes: int = Field(default=120, ge=5, alias="DOCULENS_AUTH_TOKEN_EXP_MINUTES")

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("DOCULENS_LOG_LEVEL must be a standard Python log level")
        return normalized

    def assert_production_safe(self) -> None:
        """Reject development credentials that must never reach production."""
        if self.environment == "production" and self.auth_secret_key == "doculens-dev-secret":
            raise ValueError("DOCULENS_AUTH_SECRET must be set in production")
        if self.environment == "production" and self.seed_demo_users:
            raise ValueError("DOCULENS_SEED_DEMO_USERS must be false in production")
        if (
            self.environment == "production"
            and self.seed_demo_workspace
            and not self.showcase_read_only
        ):
            raise ValueError(
                "DOCULENS_SEED_DEMO_WORKSPACE requires DOCULENS_SHOWCASE_READ_ONLY=true in production"
            )


@lru_cache
def get_settings() -> Settings:
    """Return the immutable-by-convention process configuration singleton."""
    return Settings()
