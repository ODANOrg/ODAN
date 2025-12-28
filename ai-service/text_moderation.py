"""
ODAN AI Service - Text Moderation
"""

import logging
from typing import Optional
import httpx
from transformers import pipeline, AutoModelForSequenceClassification, AutoTokenizer
import torch

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Cache for loaded models
_text_nsfw_pipeline = None
_text_offensive_pipeline = None


async def moderate_text_api(text: str, model: str) -> dict | None:
    """
    Call HuggingFace API for text moderation
    Returns None if API call fails
    """
    if not settings.huggingface_api_token:
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.huggingface_api_url}/{model}",
                headers={"Authorization": f"Bearer {settings.huggingface_api_token}"},
                json={"inputs": text},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 503:
                # Model is loading
                logger.warning(f"Model {model} is loading, falling back to local")
                return None
            else:
                logger.error(f"API error for {model}: {response.status_code}")
                return None
                
    except Exception as e:
        logger.error(f"API call failed for {model}: {e}")
        return None


def load_text_nsfw_model():
    """Load local NSFW text classifier"""
    global _text_nsfw_pipeline
    
    if _text_nsfw_pipeline is None:
        logger.info(f"Loading text NSFW model: {settings.text_nsfw_model}")
        try:
            _text_nsfw_pipeline = pipeline(
                "text-classification",
                model=settings.text_nsfw_model,
                device=0 if torch.cuda.is_available() else -1
            )
        except Exception as e:
            logger.error(f"Failed to load text NSFW model: {e}")
            # Try with smaller model
            _text_nsfw_pipeline = pipeline(
                "text-classification",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=-1
            )
    
    return _text_nsfw_pipeline


def load_text_offensive_model():
    """Load local offensive speech classifier"""
    global _text_offensive_pipeline
    
    if _text_offensive_pipeline is None:
        logger.info(f"Loading text offensive model: {settings.text_offensive_model}")
        try:
            _text_offensive_pipeline = pipeline(
                "text-classification",
                model=settings.text_offensive_model,
                device=0 if torch.cuda.is_available() else -1
            )
        except Exception as e:
            logger.error(f"Failed to load offensive model: {e}")
            _text_offensive_pipeline = None
    
    return _text_offensive_pipeline


def moderate_text_local(text: str) -> dict:
    """
    Run local text moderation
    """
    results = {
        "nsfw": {"label": "SAFE", "score": 0.0},
        "offensive": {"label": "NOT_OFFENSIVE", "score": 0.0}
    }
    
    # NSFW check
    nsfw_model = load_text_nsfw_model()
    if nsfw_model:
        try:
            nsfw_result = nsfw_model(text[:512])[0]  # Limit text length
            results["nsfw"] = {
                "label": nsfw_result["label"],
                "score": nsfw_result["score"]
            }
        except Exception as e:
            logger.error(f"NSFW classification failed: {e}")
    
    # Offensive check
    offensive_model = load_text_offensive_model()
    if offensive_model:
        try:
            offensive_result = offensive_model(text[:512])[0]
            results["offensive"] = {
                "label": offensive_result["label"],
                "score": offensive_result["score"]
            }
        except Exception as e:
            logger.error(f"Offensive classification failed: {e}")
    
    return results


async def moderate_text(text: str) -> dict:
    """
    Main text moderation function
    Tries API first, falls back to local
    
    Returns:
        {
            "isSafe": bool,
            "confidence": float,
            "category": str | None,
            "reason": str | None,
            "details": dict
        }
    """
    if not text or len(text.strip()) == 0:
        return {
            "isSafe": True,
            "confidence": 1.0,
            "category": None,
            "reason": None,
            "details": {}
        }
    
    # Clean text
    text = text.strip()[:2000]  # Limit to 2000 chars
    
    # Try API first
    api_nsfw = await moderate_text_api(text, settings.text_nsfw_model)
    api_offensive = await moderate_text_api(text, settings.text_offensive_model)
    
    # If both API calls succeeded, use them
    if api_nsfw and api_offensive:
        nsfw_result = api_nsfw[0] if isinstance(api_nsfw, list) else api_nsfw
        offensive_result = api_offensive[0] if isinstance(api_offensive, list) else api_offensive
        
        results = {
            "nsfw": nsfw_result,
            "offensive": offensive_result
        }
    elif settings.use_local_fallback:
        # Fall back to local
        logger.info("Using local models for text moderation")
        results = moderate_text_local(text)
    else:
        # No moderation available, allow content
        logger.warning("No moderation available, allowing content")
        return {
            "isSafe": True,
            "confidence": 0.5,
            "category": None,
            "reason": "Moderation unavailable",
            "details": {}
        }
    
    # Analyze results
    is_safe = True
    confidence = 1.0
    category = None
    reason = None
    
    # Check NSFW
    nsfw = results.get("nsfw", {})
    nsfw_label = nsfw.get("label", "").upper()
    nsfw_score = nsfw.get("score", 0.0)
    
    if nsfw_label in ["NSFW", "UNSAFE", "1", "LABEL_1"] and nsfw_score >= settings.nsfw_threshold:
        is_safe = False
        confidence = nsfw_score
        category = "nsfw"
        reason = "Content flagged as NSFW/inappropriate"
    
    # Check offensive
    offensive = results.get("offensive", {})
    offensive_label = offensive.get("label", "").upper()
    offensive_score = offensive.get("score", 0.0)
    
    if offensive_label in ["OFFENSIVE", "HATE", "TOXIC", "1", "LABEL_1"] and offensive_score >= settings.offensive_threshold:
        is_safe = False
        confidence = max(confidence, offensive_score) if not is_safe else offensive_score
        category = category or "offensive"
        reason = reason or "Content flagged as offensive/hateful"
    
    return {
        "isSafe": is_safe,
        "confidence": confidence,
        "category": category,
        "reason": reason,
        "details": results
    }
