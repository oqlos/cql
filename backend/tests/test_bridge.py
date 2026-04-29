"""Tests for the cql-backend ↔ maskservice bridge endpoints.

Uses ``httpx.MockTransport`` to stub the upstream maskservice backend so
these tests run hermetically — no real network hop, no docker-compose.
"""
from __future__ import annotations

import json
from typing import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from cql_backend.app import app
from cql_backend.clients import maskservice_client


@pytest.fixture(autouse=True)
def _reset_maskservice_client() -> Iterator[None]:
    """Ensure each test starts with a fresh singleton."""
    import asyncio

    maskservice_client._client = None  # type: ignore[attr-defined]
    maskservice_client._base_url = maskservice_client.DEFAULT_BASE_URL  # type: ignore[attr-defined]
    yield
    try:
        asyncio.new_event_loop().run_until_complete(
            maskservice_client.close_maskservice_client()
        )
    except Exception:
        pass


def _install_mock_transport(handler) -> None:
    """Install a MockTransport on the maskservice client singleton."""
    maskservice_client._client = httpx.AsyncClient(  # type: ignore[attr-defined]
        base_url=maskservice_client.DEFAULT_BASE_URL,
        transport=httpx.MockTransport(handler),
    )


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_full_reports_unreachable_when_maskservice_down(client: TestClient) -> None:
    def _raise(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    _install_mock_transport(_raise)
    resp = client.get("/health/full")
    assert resp.status_code == 200
    body = resp.json()
    assert body["self"]["status"] == "ok"
    assert body["maskservice"]["status"] == "unreachable"


def test_health_full_reports_ok_when_maskservice_returns_200(client: TestClient) -> None:
    def _handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/health"
        return httpx.Response(200, json={"status": "ok", "service": "maskservice"})

    _install_mock_transport(_handler)
    resp = client.get("/health/full")
    assert resp.status_code == 200
    body = resp.json()
    assert body["maskservice"]["status"] == "ok"
    assert body["maskservice"]["payload"]["service"] == "maskservice"


def test_bridge_scenario_returns_upstream_record(client: TestClient) -> None:
    def _handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v3/data/test_scenarios/42"
        return httpx.Response(200, json={"id": 42, "name": "Demo scenario"})

    _install_mock_transport(_handler)
    resp = client.get("/api/cql/scenarios/42")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "maskservice"
    assert body["scenario"]["id"] == 42


def test_bridge_scenario_returns_404_when_upstream_404(client: TestClient) -> None:
    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "not found"})

    _install_mock_transport(_handler)
    resp = client.get("/api/cql/scenarios/999")
    assert resp.status_code == 404


def test_bridge_scenario_returns_503_when_upstream_unreachable(client: TestClient) -> None:
    def _raise(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    _install_mock_transport(_raise)
    resp = client.get("/api/cql/scenarios/1")
    assert resp.status_code == 503
