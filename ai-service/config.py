"""
ODAN AI Service - Configuration
"""

import os
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
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
