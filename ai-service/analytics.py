"""
ODAN AI Service - Ticket analytics aggregation and CARTO export.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx

from config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HourlyBucket:
    hour: int
    count: int


async def fetch_hourly_ticket_counts(settings: Settings) -> list[HourlyBucket]:
    if not settings.database_url:
        raise RuntimeError("Database URL not configured for analytics")

    import asyncpg

    tz = ZoneInfo(settings.ticket_stats_timezone)

    query = """
        SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE $1))::int AS hour,
               COUNT(*)::int AS count
        FROM "Ticket"
        WHERE "createdAt" >= NOW() - ($2 || ' days')::interval
        GROUP BY hour
        ORDER BY hour
    """

    conn = await asyncpg.connect(settings.database_url)
    try:
        rows = await conn.fetch(query, str(tz), settings.ticket_stats_window_days)
    finally:
        await conn.close()

    counts_by_hour = {row["hour"]: row["count"] for row in rows}
    return [HourlyBucket(hour=hour, count=counts_by_hour.get(hour, 0)) for hour in range(24)]


async def send_hourly_stats_to_carto(settings: Settings, buckets: list[HourlyBucket]) -> None:
    if not settings.carto_api_url:
        logger.info("CARTO API URL not configured; skipping export.")
        return

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windowDays": settings.ticket_stats_window_days,
        "timezone": settings.ticket_stats_timezone,
        "buckets": [{"hour": bucket.hour, "count": bucket.count} for bucket in buckets],
    }

    headers = {"Content-Type": "application/json"}
    if settings.carto_api_key:
        headers["Authorization"] = f"Bearer {settings.carto_api_key}"

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(settings.carto_api_url, json=payload, headers=headers)
        response.raise_for_status()
        logger.info("Sent hourly ticket stats to CARTO.")
