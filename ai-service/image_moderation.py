"""
ODAN AI Service - Image Moderation
"""

import logging
import base64
import io
from typing import Optional
import httpx
from PIL import Image
from transformers import pipeline
import torch

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Cache for loaded model
_image_nsfw_pipeline = None


async def moderate_image_api(image_base64: str) -> dict | None:
    """
    Call HuggingFace API for image moderation
    Returns None if API call fails
    """
    if not settings.huggingface_api_token:
        return None
    
    try:
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_base64)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.huggingface_api_url}/{settings.image_nsfw_model}",
                headers={"Authorization": f"Bearer {settings.huggingface_api_token}"},
                content=image_bytes,
                timeout=60.0
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 503:
                logger.warning("Image model is loading, falling back to local")
                return None
            else:
                logger.error(f"API error for image moderation: {response.status_code}")
                return None
                
    except Exception as e:
        logger.error(f"API call failed for image moderation: {e}")
        return None


def load_image_nsfw_model():
    """Load local NSFW image classifier"""
    global _image_nsfw_pipeline
    
    if _image_nsfw_pipeline is None:
        logger.info(f"Loading image NSFW model: {settings.image_nsfw_model}")
        try:
            _image_nsfw_pipeline = pipeline(
                "image-classification",
                model=settings.image_nsfw_model,
                device=0 if torch.cuda.is_available() else -1
            )
        except Exception as e:
            logger.error(f"Failed to load image NSFW model: {e}")
            _image_nsfw_pipeline = None
    
    return _image_nsfw_pipeline


def preprocess_image(image_base64: str) -> Image.Image | None:
    """
    Decode and preprocess image from base64
    """
    try:
        # Decode base64
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        # Resize if too large (save memory)
        max_size = 1024
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        return image
        
    except Exception as e:
        logger.error(f"Failed to preprocess image: {e}")
        return None


def moderate_image_local(image: Image.Image) -> dict:
    """
    Run local image moderation
    """
    model = load_image_nsfw_model()
    
    if model is None:
        logger.warning("Image moderation model not available")
        return {"label": "UNKNOWN", "score": 0.0}
    
    try:
        results = model(image)
        
        # Results is a list of predictions
        if results:
            # Find NSFW label
            for result in results:
                label = result.get("label", "").lower()
                score = result.get("score", 0.0)
                
                if label in ["nsfw", "porn", "sexy", "hentai", "unsafe"]:
                    return {"label": "NSFW", "score": score}
            
            # Return highest confidence result
            top_result = max(results, key=lambda x: x.get("score", 0))
            return {
                "label": top_result.get("label", "UNKNOWN").upper(),
                "score": top_result.get("score", 0.0)
            }
        
        return {"label": "SAFE", "score": 1.0}
        
    except Exception as e:
        logger.error(f"Image classification failed: {e}")
        return {"label": "ERROR", "score": 0.0}


async def moderate_image(image_base64: str) -> dict:
    """
    Main image moderation function
    Tries API first, falls back to local
    
    Args:
        image_base64: Base64 encoded image string
    
    Returns:
        {
            "isSafe": bool,
            "confidence": float,
            "category": str | None,
            "reason": str | None,
            "details": dict
        }
    """
    if not image_base64:
        return {
            "isSafe": True,
            "confidence": 1.0,
            "category": None,
            "reason": None,
            "details": {}
        }
    
    # Try API first
    api_result = await moderate_image_api(image_base64)
    
    if api_result:
        # API returned results
        if isinstance(api_result, list):
            results = api_result
        else:
            results = [api_result]
    elif settings.use_local_fallback:
        # Fall back to local
        logger.info("Using local model for image moderation")
        image = preprocess_image(image_base64)
        
        if image is None:
            return {
                "isSafe": False,
                "confidence": 0.0,
                "category": "invalid",
                "reason": "Failed to process image",
                "details": {}
            }
        
        local_result = moderate_image_local(image)
        results = [local_result]
    else:
        # No moderation available
        logger.warning("No image moderation available, allowing content")
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
    
    for result in results:
        label = result.get("label", "").lower()
        score = result.get("score", 0.0)
        
        # Check for NSFW labels
        if label in ["nsfw", "porn", "sexy", "hentai", "unsafe", "explicit"]:
            if score >= settings.nsfw_threshold:
                is_safe = False
                confidence = score
                category = "nsfw"
                reason = f"Image flagged as {label}"
                break
    
    return {
        "isSafe": is_safe,
        "confidence": confidence,
        "category": category,
        "reason": reason,
        "details": {"results": results}
    }
