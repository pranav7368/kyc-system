"""
Basic API tests — run with: pytest tests/test_api.py -v
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_stats_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/kyc/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_verifications" in data


@pytest.mark.asyncio
async def test_history_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/kyc/history")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total_count" in data


@pytest.mark.asyncio
async def test_get_nonexistent_verification():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/kyc/nonexistent-id")
    assert r.status_code == 404
