"""cql_backend — FastAPI service exposing the CQL/DSL runtime as REST endpoints.

Mounted under `/api/cql` so maskservice callers can swap
``import { quoteDslValue } from '../components/dsl'`` for
``fetch('/api/cql/quote', { body: value })``.
"""
from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("oqlos-cql-backend")
except PackageNotFoundError:  # pragma: no cover - editable install fallback
    __version__ = "0.1.0"
