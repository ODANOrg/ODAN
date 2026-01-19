import importlib
import sys

import pytest
from fastapi.testclient import TestClient


def load_main(monkeypatch, env):
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    if "config" in sys.modules:
        import config
        config.get_settings.cache_clear()
        importlib.reload(config)
    if "main" in sys.modules:
        del sys.modules["main"]
    import main
    return main


def build_buckets(main_module):
    return [main_module.HourlyTicketBucket(hour=hour, count=hour) for hour in range(24)]


@pytest.mark.anyio
async def test_hourly_stats_requires_api_key(monkeypatch):
    main = load_main(
        monkeypatch,
        {
            "ANALYTICS_API_KEY": "secret",
            "AI_SERVICE_DATABASE_URL": "postgresql://odan:odan_secret_2024@localhost:5432/odan",
        },
    )

    async def fake_fetch(_settings):
        return build_buckets(main)

    monkeypatch.setattr(main, "fetch_hourly_ticket_counts", fake_fetch)

    client = TestClient(main.app)
    response = client.get("/analytics/tickets/hourly")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_hourly_stats_returns_buckets(monkeypatch):
    main = load_main(
        monkeypatch,
        {
            "ANALYTICS_API_KEY": "secret",
            "AI_SERVICE_DATABASE_URL": "postgresql://odan:odan_secret_2024@localhost:5432/odan",
        },
    )

    async def fake_fetch(_settings):
        return build_buckets(main)

    monkeypatch.setattr(main, "fetch_hourly_ticket_counts", fake_fetch)

    client = TestClient(main.app)
    response = client.get("/analytics/tickets/hourly", headers={"X-Analytics-Key": "secret"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["windowDays"] == main.settings.ticket_stats_window_days
    assert payload["timezone"] == main.settings.ticket_stats_timezone
    assert len(payload["buckets"]) == 24
