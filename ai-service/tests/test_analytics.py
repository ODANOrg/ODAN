import pytest

from analytics import HourlyBucket, fetch_hourly_ticket_counts, send_hourly_stats_to_carto
from config import Settings


@pytest.mark.asyncio
async def test_fetch_hourly_ticket_counts_fills_missing_hours(monkeypatch):
    class FakeConn:
        async def fetch(self, _query, _tz, _window):
            return [{"hour": 5, "count": 136}, {"hour": 18, "count": 20}]

        async def close(self):
            return None

    async def fake_connect(_url):
        return FakeConn()

    import asyncpg

    monkeypatch.setattr(asyncpg, "connect", fake_connect)

    settings = Settings(
        AI_SERVICE_DATABASE_URL="postgresql://odan:odan_secret_2024@localhost:5432/odan",
        TICKET_STATS_WINDOW_DAYS=30,
        TICKET_STATS_TIMEZONE="UTC",
    )

    buckets = await fetch_hourly_ticket_counts(settings)

    assert len(buckets) == 24
    assert buckets[5] == HourlyBucket(hour=5, count=136)
    assert buckets[18] == HourlyBucket(hour=18, count=20)
    assert buckets[0] == HourlyBucket(hour=0, count=0)


@pytest.mark.asyncio
async def test_send_hourly_stats_to_carto_posts_payload(monkeypatch):
    captured = {}

    class DummyResponse:
        def raise_for_status(self):
            return None

    class DummyClient:
        def __init__(self, *args, **kwargs):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, json, headers):
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            return DummyResponse()

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", DummyClient)

    settings = Settings(
        CARTO_API_URL="https://carto.example/api/ingest",
        CARTO_API_KEY="secret",
        TICKET_STATS_WINDOW_DAYS=7,
        TICKET_STATS_TIMEZONE="UTC",
    )

    buckets = [HourlyBucket(hour=5, count=136), HourlyBucket(hour=18, count=20)]

    await send_hourly_stats_to_carto(settings, buckets)

    assert captured["url"] == "https://carto.example/api/ingest"
    assert captured["headers"]["Authorization"] == "Bearer secret"
    assert captured["json"]["windowDays"] == 7
    assert captured["json"]["timezone"] == "UTC"
    assert captured["json"]["buckets"] == [{"hour": 5, "count": 136}, {"hour": 18, "count": 20}]
