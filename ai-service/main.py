"""
ODAN AI Service - Main Application
"""

import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import get_settings
from text_moderation import moderate_text
from image_moderation import moderate_image

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

settings = get_settings()


# Request/Response Models
class TextModerationRequest(BaseModel):
    text: str


class ImageModerationRequest(BaseModel):
    imageBase64: str


class ModerationResponse(BaseModel):
    isSafe: bool
    confidence: float
    category: str | None = None
    reason: str | None = None
    details: dict = {}


class HealthResponse(BaseModel):
    status: str
    version: str
    models: dict


# Lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("🚀 Starting ODAN AI Service...")
    logger.info(f"HuggingFace API: {'configured' if settings.huggingface_api_token else 'not configured'}")
    logger.info(f"Local fallback: {'enabled' if settings.use_local_fallback else 'disabled'}")
    
    yield
    
    logger.info("👋 Shutting down ODAN AI Service...")


# Create FastAPI app
app = FastAPI(
    title="ODAN AI Service",
    description="AI-powered content moderation for ODAN platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "isSafe": True,  # Default to safe on error to avoid blocking
            "confidence": 0.0,
            "error": str(exc)
        }
    )


# Routes
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "models": {
            "text_nsfw": settings.text_nsfw_model,
            "text_offensive": settings.text_offensive_model,
            "image_nsfw": settings.image_nsfw_model,
        }
    }


@app.post("/moderate/text", response_model=ModerationResponse)
async def moderate_text_endpoint(request: TextModerationRequest):
    """
    Moderate text content
    
    Checks for:
    - NSFW content
    - Offensive/hateful speech
    """
    try:
        result = await moderate_text(request.text)
        return ModerationResponse(**result)
    except Exception as e:
        logger.error(f"Text moderation failed: {e}")
        # Default to safe on error
        return ModerationResponse(
            isSafe=True,
            confidence=0.0,
            reason=f"Moderation error: {str(e)}"
        )


@app.post("/moderate/image", response_model=ModerationResponse)
async def moderate_image_endpoint(request: ImageModerationRequest):
    """
    Moderate image content
    
    Checks for:
    - NSFW/explicit imagery
    """
    try:
        result = await moderate_image(request.imageBase64)
        return ModerationResponse(**result)
    except Exception as e:
        logger.error(f"Image moderation failed: {e}")
        # Default to safe on error
        return ModerationResponse(
            isSafe=True,
            confidence=0.0,
            reason=f"Moderation error: {str(e)}"
        )


@app.post("/moderate/batch")
async def moderate_batch_endpoint(request: Request):
    """
    Batch moderation for multiple items
    """
    try:
        body = await request.json()
        results = []
        
        for item in body.get("items", []):
            if item.get("type") == "text":
                result = await moderate_text(item.get("content", ""))
            elif item.get("type") == "image":
                result = await moderate_image(item.get("content", ""))
            else:
                result = {"isSafe": True, "confidence": 0.0, "reason": "Unknown type"}
            
            results.append({
                "id": item.get("id"),
                **result
            })
        
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Batch moderation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )
