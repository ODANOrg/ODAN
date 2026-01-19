"""
ODAN AI Service - Main Application
"""

import asyncio
import contextlib
import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from analytics import fetch_hourly_ticket_counts, send_hourly_stats_to_carto
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
    analytics: dict


class HourlyTicketBucket(BaseModel):
    hour: int
    count: int


class HourlyTicketStatsResponse(BaseModel):
    windowDays: int
    timezone: str
    buckets: list[HourlyTicketBucket]


# Lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("🚀 Starting ODAN AI Service...")
    logger.info(f"HuggingFace API: {'configured' if settings.huggingface_api_token else 'not configured'}")
    logger.info(f"Local fallback: {'enabled' if settings.use_local_fallback else 'disabled'}")

    analytics_task = None
    if settings.carto_api_url:
        analytics_task = asyncio.create_task(schedule_carto_exports())
    
    yield

    if analytics_task:
        analytics_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await analytics_task
    
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
        },
        "analytics": {
            "ticket_stats_window_days": settings.ticket_stats_window_days,
            "ticket_stats_timezone": settings.ticket_stats_timezone,
            "carto_enabled": bool(settings.carto_api_url),
        },
    }


async def schedule_carto_exports() -> None:
    while True:
        try:
            buckets = await fetch_hourly_ticket_counts(settings)
            await send_hourly_stats_to_carto(settings, buckets)
        except Exception as exc:
            logger.error("Failed to export hourly ticket stats to CARTO", exc_info=exc)
        await asyncio.sleep(settings.carto_send_interval_minutes * 60)


@app.get("/analytics/tickets/hourly", response_model=HourlyTicketStatsResponse)
async def hourly_ticket_stats():
    if not settings.database_url:
        raise HTTPException(status_code=503, detail="Analytics database not configured")

    buckets = await fetch_hourly_ticket_counts(settings)
    return {
        "windowDays": settings.ticket_stats_window_days,
        "timezone": settings.ticket_stats_timezone,
        "buckets": [{"hour": bucket.hour, "count": bucket.count} for bucket in buckets],
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
