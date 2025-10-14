from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

from app.config.database_config import DatabaseConfig
from app.config.llm_config import LLMConfig

load_dotenv()

"""
Main settings for the application using Pydantic Settings.
"""


class Settings(BaseSettings):
    """Main settings for the application."""

    app_name: str = "Doculens AI"
    llm: LLMConfig = LLMConfig()
    database: DatabaseConfig = DatabaseConfig()
    api_key: Optional[str] = Field(default=None, alias="DOCULENS_API_KEY")
    api_key_header: str = Field(default="X-API-Key", alias="DOCULENS_API_KEY_HEADER")
    summary_chunk_limit: int = Field(default=12, ge=1, alias="DOCULENS_SUMMARY_CHUNK_LIMIT")
    qa_top_k: int = Field(default=5, ge=1, alias="DOCULENS_QA_TOP_K")
    search_result_limit: int = Field(default=10, ge=1, alias="DOCULENS_SEARCH_RESULT_LIMIT")
    search_preview_limit: int = Field(default=5, ge=1, alias="DOCULENS_SEARCH_PREVIEW_LIMIT")
    chunk_preview_limit: int = Field(default=25, ge=1, alias="DOCULENS_CHUNK_PREVIEW_LIMIT")


@lru_cache
def get_settings() -> Settings:
    """
    Get the application settings.

    Returns:
        Settings: The application settings.
    """
    return Settings()
