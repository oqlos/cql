"""Async client for calling back into the maskservice backend.

Used by cql-backend endpoints that need domain data (scenarios, devices,
protocols) which live only in maskservice's databases. The v3 unified API
at ``/api/v3/data/<table>`` is the canonical read surface.

Design notes
------------
* Lazily-constructed ``httpx.AsyncClient`` with connection pooling, closed
  on shutdown via :func:`close_maskservice_client`.
* Errors surface as :class:`MaskserviceUnavailable` (network) /
  :class:`MaskserviceError` (non-2xx) so caller code never needs to import
  httpx directly.
* The default base URL is read from the ``MASKSERVICE_API_URL`` env var
  and matches the docker-compose service name of maskservice backend.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

_log = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_BASE_URL = os.environ.get(
    "MASKSERVICE_API_URL", "http://host.docker.internal:8080"
).rstrip("/")


class MaskserviceError(RuntimeError):
    def __init__(self, message: str, *, status: int | None = None, detail: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.detail = detail


class MaskserviceUnavailable(MaskserviceError):
    """Network / timeout failure when talking to maskservice backend."""


_client: httpx.AsyncClient | None = None
_base_url: str = DEFAULT_BASE_URL


def configure_maskservice_client(base_url: str | None = None) -> None:
    """Reconfigure the singleton before any request is made."""
    global _base_url, _client
    if base_url:
        _base_url = base_url.rstrip("/") or DEFAULT_BASE_URL
    if _client is not None:
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if not loop.is_closed():
                loop.create_task(_client.aclose())
        except RuntimeError:
            pass
        _client = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=_base_url,
            timeout=DEFAULT_TIMEOUT_SECONDS,
            headers={"User-Agent": "cql-backend/maskservice-client"},
        )
    return _client


async def close_maskservice_client() -> None:
    global _client
    if _client is not None:
        try:
            await _client.aclose()
        finally:
            _client = None


def get_maskservice_base_url() -> str:
    return _base_url


async def _request(method: str, path: str, *, json_body: Any = None, params: dict | None = None) -> Any:
    client = _get_client()
    try:
        response = await client.request(method, path, json=json_body, params=params)
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.NetworkError) as exc:
        raise MaskserviceUnavailable(f"maskservice backend unreachable at {_base_url}{path}") from exc

    if response.is_success:
        if response.status_code == 204:
            return None
        try:
            return response.json()
        except ValueError:
            return response.text

    try:
        detail = response.json()
    except ValueError:
        detail = response.text
    raise MaskserviceError(
        f"maskservice {response.status_code} {response.reason_phrase} — {path}",
        status=response.status_code,
        detail=detail,
    )


# ── Public API ──────────────────────────────────────────────────────────


async def health() -> dict:
    return await _request("GET", "/api/v1/health")


async def fetch_scenario(scenario_id: int | str) -> dict | None:
    """Return the scenario record from ``/api/v3/data/test_scenarios/<id>`` or ``None`` if 404."""
    try:
        return await _request("GET", f"/api/v3/data/test_scenarios/{scenario_id}")
    except MaskserviceError as exc:
        if exc.status == 404:
            return None
        raise


async def list_scenarios(limit: int = 100) -> list[dict]:
    data = await _request("GET", "/api/v3/data/test_scenarios", params={"limit": limit})
    if isinstance(data, dict):
        return data.get("items") or data.get("data") or []
    return data or []
