# cql-backend — Decoupled DSL Runtime

FastAPI service that replaces the direct TypeScript imports from
`maskservice/c2004/frontend/src/components/dsl/` with HTTP endpoints under
`/api/cql/*`.

- Runs on port **`8101`** inside its container (host port 8101 by default; port 8100 is reserved for the maskservice frontend dev server).
- Exposed via Traefik at **`api.cql.oqlos.localhost`** (dev) and via the cql
  frontend's nginx proxy at **`cql.oqlos.localhost/api/cql/*`**.
- Packaged as `oqlos-cql-backend` (see `pyproject.toml`).

## Quick start

```bash
# Run locally for development
pip install -e .[dev]
python -m cql_backend      # → http://localhost:8101

# Or with Docker Compose alongside the cql editor
docker compose up --build cql-backend cql

# Run tests
pytest
```

## Endpoint maturity matrix

| Endpoint                       | Status | TS source of truth                        |
|--------------------------------|:------:|-------------------------------------------|
| `GET  /health`                 | ✅     | — |
| `GET  /api/cql/capabilities`   | ✅     | — |
| `POST /api/cql/quote`          | ✅     | `runtime/dsl.quotes.ts` (`quoteDslValue`) |
| `POST /api/cql/format-literal` | ✅     | `runtime/dsl.quotes.ts` (`formatDslLiteral`) |
| `POST /api/cql/unquote`        | ✅     | `runtime/dsl.quotes.ts` (`readQuotedToken`)  |
| `POST /api/cql/canonicalize`   | ✅     | `runtime/dsl.quotes.ts` (`canonicalizeDslQuotes`) |
| `POST /api/cql/normalize`      | ✅     | `runtime/dsl.quotes.ts` (`normalizeDslTextQuotes`) |
| `POST /api/cql/highlight`      | 🟡     | `runtime/dsl.highlight.ts` (basic subset) |
| `POST /api/cql/parse`          | ✅     | `runtime/dsl.parser.ts`                    |
| `POST /api/cql/serialize`      | ✅     | `runtime/dsl.serialize.text.ts`            |
| `POST /api/cql/validate`       | ✅     | `runtime/dsl.validator.ts`                 |
| `POST /api/cql/exec`           | ✅     | `runtime/dsl.exec.ts` + `.engine.ts` + `.runtime.ts` |
| `POST /api/cql/scenario-build` | ✅     | `runtime/dsl-scenario-builders.ts`         |

Clients should call `GET /api/cql/capabilities` at startup to verify
endpoint availability. All runtime endpoints are now fully implemented.
The JS client at `oqlos/cql/src/api/cqlRuntimeApi.js` handles HTTP 501
for any future unimplemented endpoints.

## Migration plan for maskservice callers

Every direct import of `components/dsl/…` in maskservice will be swapped for
a `fetch('/api/cql/…')` call. Callers and their migration state:

| # | File | Symbol used | REST endpoint | Blocker |
|--:|------|-------------|---------------|---------|
| 1 | `pages/connect-operator-parameters.page.ts` | — | (removed, iframe) | ✅ done |
| 2 | `modules/connect-test-protocol/helpers/copy-ops.ts` | `quoteDslValue` | `/api/cql/quote` | **ready** |
| 3 | `modules/connect-test-protocol/helpers/render.ts` | `highlightDsl`, `quoteDslValue` | `/api/cql/highlight`, `/api/cql/quote` | **ready (simple highlight)** |
| 4 | `modules/connect-test-protocol/helpers/scenario-content.ts` | `parseDsl` | `/api/cql/parse` | **ready** |
| 5 | `modules/connect-test/helpers/scenario-view-loaders.ts` | `parseDsl` | `/api/cql/parse` | **ready** |
| 6 | `modules/connect-test/helpers/reports/model.ts` | `dslDataService` (data) | (own REST to maskservice) | keep local |
| 7 | `modules/connect-test-device/helpers/dsl.ts` | `DslScenarioBuilders` | `/api/cql/scenario-build` | **ready** |
| 8 | `modules/connect-template2/connect-template2.service.ts` | `dslDataService` (data) | (own REST) | keep local |
| 9 | `modules/connect-data/cqrs/handlers.ts` | `dslDataService` (data) | (own REST) | keep local |
|10 | `pages/connect-test-connect-xml.page.ts` | `getDslEngine` | `/api/cql/exec` | **ready** |
|11 | `pages/connect-test-protocol-protocol-steps.page.ts` | `dslDataService` + `dsl.highlight.css` | (data own REST + inline css copy) | 🔴 partial |
|12 | `components/goal-execution-modal/…` | `highlightDsl` | `/api/cql/highlight` | **ready** |

**Immediate wins** (can be flipped right now, synchronous to async refactor
allowed): #2, #3, #4, #5, #7, #10, #12.

**Phase-2 port complete** — parser, validator, scenario-builder, and exec
endpoints are now fully implemented and ready for migration.

**Never blocked** (those just fetch DSL *data* — schema tables — they will
stay as plain REST calls straight to the maskservice backend): #6, #8, #9.

## Phase-2 port checklist (COMPLETE)

All Phase-2 endpoints have been implemented:

1. ✅ **Parser** — `cql_backend/parser.py` ports `runtime/dsl.parser.ts`
   producing JSON-friendly AST matching the TS one.
2. ✅ **Serializer** — `cql_backend/serializer.py` ports `dsl.serialize.text.ts`.
3. ✅ **Validator** — `cql_backend/validator.py` ports `dsl.validator.ts`.
4. 🟡 **Highlighter (full)** — Basic highlight working; full rule table from
   `dsl.highlight.ts` (~30 regex rules) is future enhancement.
5. ✅ **Engine / Exec** — `cql_backend/exec_runtime.py` ports `dsl.exec.ts`,
   `dsl.engine.ts`, and `dsl-execution.handlers.ts`. Stateless execution plan
   generation works; runtime context mocking available.
6. ✅ **Scenario builders** — `cql_backend/scenario_builders.py` ports
   `dsl-scenario-builders.ts`.

Reference TypeScript sources live under `oqlos/cql/runtime/` (copied from
maskservice on 2026-04-20 and frozen) so the Python port always has a
canonical reference to diff against.

## Inter-backend communication

Both services can call each other:

```
                ┌─────────────────────────────────────┐
                │   maskservice frontend (browser)    │
                │      /api/v1/cql/*   (proxy)        │
                └──────────────┬──────────────────────┘
                               │
            ┌──────────────────┴───────────────────┐
            │                                      │
            ▼                                      ▼
  ┌──────────────────┐                  ┌──────────────────┐
  │ maskservice      │  /api/v1/cql/*   │   cql-backend    │
  │ backend          │ ───────────────▶ │   (FastAPI)      │
  │ (FastAPI :8080)  │                  │   (:8101)        │
  │                  │ ◀─────────────── │                  │
  └──────────────────┘  /api/v3/data/*  └──────────────────┘
      ▲                scenarios
      │
      │  direct call from the cql editor's nginx
      │  (see /api/cql/* in nginx.conf.template)
      │
      └── cql frontend (browser)
```

### maskservice backend → cql-backend
* Client: `backend/app/clients/cql_backend_client.py` (async httpx)
* Proxy: `backend/api/routes/v1/endpoints/cql_proxy.py`
  mounts `/api/v1/cql/*` forwarding every method/body verbatim.
* Startup hook in `backend/app/main.py` reads `CQL_BACKEND_URL` from
  `Settings` and wires the singleton; shutdown closes pooled
  connections.
* Custom exceptions: `CqlBackendUnavailable` (503), `CqlBackendNotImplemented`
  (passes through as 501), `CqlBackendError` (generic).

### cql-backend → maskservice backend
* Client: `cql_backend/clients/maskservice_client.py`
* Bridge endpoint: `GET /api/cql/scenarios/{id}` fetches from
  `/api/v3/data/test_scenarios/{id}` and wraps 404/503.
* Composite health: `GET /health/full` reports own status + upstream
  maskservice reachability in a single call — useful for dashboards.
* Env var: `MASKSERVICE_API_URL` (defaults to
  `http://host.docker.internal:8080` so docker-compose works out of the
  box on Linux with `extra_hosts: host-gateway`).

### Deployment wiring
* `docker-compose.yml` declares `cql-backend` with both env vars set and
  `extra_hosts` for the host-gateway escape.
* `cql/nginx.conf.template` adds a longest-prefix match for `/api/cql/`
  so browsers calling the cql editor origin don't need to know about a
  separate backend hostname.
* `backend/app/config/settings.py` exposes `CQL_BACKEND_URL`,
  `CQL_BACKEND_TIMEOUT_SECONDS`, `CQL_BACKEND_HEALTH_TIMEOUT_SECONDS`.

## Directory layout

```
backend/
├── Dockerfile
├── pyproject.toml
├── README.md                      ← you are here
├── cql_backend/
│   ├── __init__.py
│   ├── __main__.py                ← `python -m cql_backend`
│   ├── app.py                     ← FastAPI wiring + lifespan + bridge
│   ├── quotes.py                  ← full port of dsl.quotes.ts
│   ├── highlight.py               ← partial highlighter
│   └── clients/
│       └── maskservice_client.py  ← reciprocal HTTP client
└── tests/
    ├── test_quotes.py             ← parity tests vs TS fixtures
    ├── test_api.py                ← HTTP round-trips
    └── test_bridge.py             ← inter-backend bridge (MockTransport)
```
