"""
ODAN AI Service - Configuration
"""

import os
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Service
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # HuggingFace
    huggingface_api_token: str | None = None
    huggingface_api_url: str = "https://api-inference.huggingface.co/models"
    
    # Local Fallback
    use_local_fallback: bool = True
    models_dir: str = "./models"
    
    # Model Names
    text_nsfw_model: str = "eliasalbouzidi/distilbert-nsfw-text-classifier"
    text_offensive_model: str = "Falconsai/offensive_speech_detection"
    image_nsfw_model: str = "Falconsai/nsfw_image_detection"
    
    # Thresholds
    nsfw_threshold: float = 0.7
    offensive_threshold: float = 0.6
    
    # Rate Limiting
    api_rate_limit_per_minute: int = 60

    # Analytics (Tickets)
    database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AI_SERVICE_DATABASE_URL", "DATABASE_URL")
    )
    ticket_stats_window_days: int = Field(
        default=30,
        validation_alias=AliasChoices("TICKET_STATS_WINDOW_DAYS")
    )
    ticket_stats_timezone: str = Field(
        default="UTC",
        validation_alias=AliasChoices("TICKET_STATS_TIMEZONE")
    )

    # CARTO Export
    carto_api_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CARTO_API_URL")
    )
    carto_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CARTO_API_KEY")
    )
    carto_send_interval_minutes: int = Field(
        default=60,
        validation_alias=AliasChoices("CARTO_SEND_INTERVAL_MINUTES")
    )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
