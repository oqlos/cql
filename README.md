# OqlOS CQL Editor


## AI Cost Tracking

![PyPI](https://img.shields.io/badge/pypi-costs-blue) ![Version](https://img.shields.io/badge/version-0.1.3-blue) ![Python](https://img.shields.io/badge/python-3.9+-blue) ![License](https://img.shields.io/badge/license-Apache--2.0-green)
![AI Cost](https://img.shields.io/badge/AI%20Cost-$1.50-orange) ![Human Time](https://img.shields.io/badge/Human%20Time-11.9h-blue) ![Model](https://img.shields.io/badge/Model-openrouter%2Fqwen%2Fqwen3--coder--next-lightgrey)

- 🤖 **LLM usage:** $1.5000 (10 commits)
- 👤 **Human dev:** ~$1191 (11.9h @ $100/h, 30min dedup)

Generated on 2026-05-13 using [openrouter/qwen/qwen3-coder-next](https://openrouter.ai/qwen/qwen3-coder-next)

---

Standalone CQL (Cognitive Query Language) editor and scenario visualization
tool. Designed to be embedded inside the maskservice frontend at
`/connect-scenario/scenarios` via an `<iframe>`, while remaining independently
runnable at `http://cql.localhost/connect-scenario/scenarios`.

## URL contract (iframe embed)

```
/connect-scenario/scenarios?font=default&theme=dark&role=admin&lang=pl&size=1280&scenario=ts-c20
```

| Param     | Allowed values                                 | Effect                                                              |
|-----------|------------------------------------------------|---------------------------------------------------------------------|
| `font`    | `default`, `mono`, `dyslexic`, `large`         | Swaps `--font-display` / `--font-base-size` on `:root`              |
| `theme`   | `dark`, `light`, `high-contrast`               | Swaps the palette via `:root[data-theme=…]` CSS                     |
| `role`    | `admin`, `operator`, `viewer`, `guest`         | `viewer`/`guest` are read-only — buttons/tabs are disabled          |
| `lang`    | `pl`, `en`, `de`                               | Forces the i18n dictionary (overrides `localStorage` / `navigator`) |
| `size`    | 320…4096                                       | Sets `.dash-content` `max-width` via `--viewport-size`              |
| `scenario`| any scenario id (e.g. `ts-c20`)                | Triggers `ScenariosApi.get(id)` + WS `ScenarioUpdated` subscription |

Additional tracking params (`goal`, `step`, `status`) are preserved by the
Scenarios page so the parent frame can observe execution state.

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker + Docker Compose (for containerized deployment)

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:3001/connect-scenario/scenarios?scenario=ts-c20
```

### Build

```bash
# Production build (outputs to dist/)
npm run build

# Or use Makefile
make build
```

## Available Commands (Makefile)

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make install` | Install npm dependencies |
| `make dev` | Start Vite dev server on port 3001 |
| `make dev-docker` | Restart Docker stack (down + up + build) |
| `make dev-open` | Start Docker containers and show URLs |
| `make build` | Build production bundle |
| `make clean` | Remove dist/ directory |

## Docker

The image uses `nginx:alpine` with `envsubst` rendering `nginx.conf.template`
at container start. The template proxies `/api/*` → `BACKEND_API_URL` and
`/ws` → `BACKEND_WS_URL`, so the React app can simply call `fetch('/api/…')`
and `new WebSocket('/ws')` regardless of where maskservice runs.

```bash
# Full docker-compose stack with Traefik on cql.localhost
make dev-docker

# Or standalone
docker build -t oqlos-cql:latest .
docker run -p 8091:80 \
  -e BACKEND_API_URL=http://host.docker.internal:8080 \
  -e BACKEND_WS_URL=http://host.docker.internal:8080 \
  -e FRAME_ANCESTORS="'self' http://*.localhost" \
  oqlos-cql:latest
```

## Environment Variables

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| **Development** |||
| `VITE_CQL_PORT` | `3001` | Vite dev server port |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | Backend API proxy target (dev) |
| `VITE_WS_PROXY_TARGET` | `ws://localhost:8080` | WebSocket proxy target (dev) |
| **Docker** |||
| `DOCKER_DOMAIN_CQL` | `cql.localhost` | Main domain for CQL editor |
| `DOCKER_DOMAIN_TRAEFIK_CQL` | `traefik.cql.localhost` | Traefik dashboard domain |
| `VITE_CQL_HTTP_PORT` | `8092` | Host port for HTTP (maps to container 80) |
| `VITE_CQL_TRAEFIK_PORT` | `8093` | Host port for Traefik dashboard (maps to 8080) |
| **Runtime** |||
| `BACKEND_API_URL` | `http://host.docker.internal:8080` | Where nginx proxies `/api/*` |
| `BACKEND_WS_URL` | `http://host.docker.internal:8080` | Where nginx proxies `/ws` |
| `FRAME_ANCESTORS` | `'self' http://*.localhost` | CSP frame-ancestors for iframe embed |

## Integration with maskservice

1. `maskservice/c2004/frontend/src/pages/connect-scenario-scenarios.page.ts`
   has been simplified to render an `<iframe src="…cql.localhost…">` and
   forward the current querystring. Its previous implementation is archived
   next to it as `.bak`.
2. Every other maskservice route that touches the DSL (`dsl-editor`,
   `library-editor`, `func-editor`, `map-editor`, CQRS handlers) is untouched
   so the rest of the system keeps compiling.
3. The TypeScript DSL source from maskservice was copied verbatim into
   `legacy/` in this repo as reference material — see `legacy/README.md` for
   the origin map. It is not part of the Vite build (`vite.config.js` denies
   the path and `.dockerignore` excludes it from the image context).

## Architecture

```
┌────────────────────────────┐        HTTP /api/v3/data/test_scenarios
│ maskservice frontend       │ ─────────────────────────────────────────┐
│ /connect-scenario/scenarios│                                          │
│  <iframe>                  │                                          ▼
└────────────────────────────┘   ┌──────────────────────────────────────────┐
              │ iframe src        │ cql container (React + Vite → nginx)     │
              └─────────────────► │   /connect-scenario/scenarios            │
                                  │   ├─ fetch('/api/…') → proxy → backend   │
                                  │   └─ WebSocket('/ws') → proxy → backend  │
                                  └──────────────────────────────────────────┘
                                                    │
                                        HTTP + WS   │
                                                    ▼
                                  ┌──────────────────────────────────────────┐
                                  │ maskservice backend (host or container)  │
                                  └──────────────────────────────────────────┘
```

## Features

- OQL / iQL syntax highlighting
- Visual scenario editor (`OqlStepRenderer`)
- Terminal simulation
- Report viewer (`data.json`)
- Real-time WS connection indicator
- Role-based read-only mode
- Themeable (`dark` / `light` / `high-contrast`)
- Polish / English / German i18n

## Troubleshooting

### Port already in use

```bash
# Find process using port 3001
lsof -i :3001
# Kill it
kill -9 <PID>
```

### Docker: Cannot resolve cql.localhost

Add to `/etc/hosts`:
```bash
echo '127.0.0.1 cql.localhost traefik.cql.localhost' | sudo tee -a /etc/hosts
```

### API requests failing in Docker

Check `BACKEND_API_URL` points to reachable backend:
- Backend on host: `http://host.docker.internal:8080`
- Backend in container: `http://maskservice-api:8080` (same network)

### iframe refuses to load

Verify `FRAME_ANCESTORS` includes parent domain:
```env
FRAME_ANCESTORS='self' http://*.localhost https://*.localhost
```

### WebSocket connection fails

Ensure `VITE_WS_PROXY_TARGET` uses `ws://` or `wss://` protocol, not `http://`.

## License

Licensed under Apache-2.0.
