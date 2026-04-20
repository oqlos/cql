# OqlOS CQL Editor - Makefile
#
# The docker-compose stack at ./docker-compose.yml contains three services:
#   - traefik      (reverse proxy, dashboard on :$VITE_CQL_TRAEFIK_PORT)
#   - cql-backend  (FastAPI DSL runtime, :$CQL_BACKEND_HTTP_PORT)
#   - cql          (React + nginx editor, :$CQL_DIRECT_PORT)
# `make up` builds + starts all three in one shot so nothing has to be
# started separately.
.PHONY: help up down restart logs ps status health \
        dev dev-docker dev-open build install clean stop

COMPOSE := docker compose --env-file .env
ENV     := .env

# Default target
help:
	@echo "OqlOS CQL Editor - Available commands:"
	@echo ""
	@echo "  === Docker stack (cql + cql-backend + traefik) ==="
	@echo "  make up           - Build and start the full stack (cql + cql-backend + traefik)"
	@echo "  make down         - Stop and remove all containers"
	@echo "  make restart      - down + up"
	@echo "  make logs         - Tail logs from all services (Ctrl-C to exit)"
	@echo "  make ps           - Show running containers + health"
	@echo "  make status       - Alias for 'make ps'"
	@echo "  make health       - Probe /health on cql-backend + HTTP 200 on cql editor"
	@echo ""
	@echo "  === Frontend dev (no Docker) ==="
	@echo "  make dev          - Start Vite dev server (npm)"
	@echo "  make build        - Build production bundle"
	@echo "  make install      - Install npm dependencies"
	@echo "  make clean        - Clean dist/"
	@echo ""
	@echo "  === Legacy aliases ==="
	@echo "  make dev-docker   - Alias for 'make restart'"
	@echo "  make dev-open     - Alias for 'make up' (with URL summary + hosts hint)"
	@echo "  make stop         - Alias for 'make down'"

# ── Docker stack ──────────────────────────────────────────────────────

up:
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  CQL stack — building and starting all services"
	@echo "══════════════════════════════════════════════════════════════"
	@test -f $(ENV) || { echo "❌ .env file missing. Copy .env.example → .env first."; exit 1; }
	@$(COMPOSE) up -d --build
	@echo ""
	@$(MAKE) --no-print-directory _print-urls

down:
	@echo "Stopping CQL stack..."
	@$(COMPOSE) down 2>/dev/null || true
	@echo "✓ Stopped"

restart: down up

logs:
	@$(COMPOSE) logs -f --tail=100

ps status:
	@$(COMPOSE) ps

health:
	@echo "── cql-backend ────────────────────────────────────────────────"
	@port=$$(grep '^CQL_BACKEND_HTTP_PORT=' $(ENV) 2>/dev/null | cut -d= -f2); \
	 port=$${port:-8101}; \
	 curl -fsS "http://localhost:$$port/health" && echo "" || echo "✗ backend unreachable on :$$port"
	@echo ""
	@echo "── cql frontend ───────────────────────────────────────────────"
	@port=$$(grep '^CQL_DIRECT_PORT=' $(ENV) 2>/dev/null | cut -d= -f2); \
	 port=$${port:-8091}; \
	 code=$$(curl -fsSo /dev/null -w "%{http_code}" "http://localhost:$$port/" || echo "---"); \
	 [ "$$code" = "200" ] && echo "✓ HTTP 200 on :$$port" || echo "✗ got $$code on :$$port"

# Internal: nice URL summary after 'up'
_print-urls:
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Services available at:"
	@echo "══════════════════════════════════════════════════════════════"
	@domain=$$(grep '^DOCKER_DOMAIN_CQL=' $(ENV) 2>/dev/null | cut -d= -f2); domain=$${domain:-cql.oqlos.localhost}; \
	 traefik=$$(grep '^DOCKER_DOMAIN_TRAEFIK_CQL=' $(ENV) 2>/dev/null | cut -d= -f2); traefik=$${traefik:-traefik.cql.oqlos.localhost}; \
	 http_port=$$(grep '^VITE_CQL_HTTP_PORT=' $(ENV) 2>/dev/null | cut -d= -f2); http_port=$${http_port:-8092}; \
	 traefik_port=$$(grep '^VITE_CQL_TRAEFIK_PORT=' $(ENV) 2>/dev/null | cut -d= -f2); traefik_port=$${traefik_port:-8093}; \
	 direct=$$(grep '^CQL_DIRECT_PORT=' $(ENV) 2>/dev/null | cut -d= -f2); direct=$${direct:-8091}; \
	 backend=$$(grep '^CQL_BACKEND_HTTP_PORT=' $(ENV) 2>/dev/null | cut -d= -f2); backend=$${backend:-8101}; \
	 echo "  ⚙️  CQL editor       : http://$$domain:$$http_port (via Traefik)"; \
	 echo "                      : http://localhost:$$direct           (direct)"; \
	 echo "  🐍 CQL backend (API): http://localhost:$$backend/docs"; \
	 echo "  📊 Traefik dashboard: http://$$traefik:$$traefik_port"
	@echo "══════════════════════════════════════════════════════════════"
	@domain=$$(grep '^DOCKER_DOMAIN_CQL=' $(ENV) 2>/dev/null | cut -d= -f2); domain=$${domain:-cql.oqlos.localhost}; \
	 traefik=$$(grep '^DOCKER_DOMAIN_TRAEFIK_CQL=' $(ENV) 2>/dev/null | cut -d= -f2); traefik=$${traefik:-traefik.cql.oqlos.localhost}; \
	 grep -qE "\b$$domain\b" /etc/hosts 2>/dev/null \
	    && echo "✓ /etc/hosts has $$domain" \
	    || echo "⚠  Run: echo '127.0.0.1 $$domain $$traefik' | sudo tee -a /etc/hosts"

# Development (npm)
dev:
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Starting CQL Editor Dev Server"
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Port: $$(grep VITE_CQL_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '3001')"
	@echo "══════════════════════════════════════════════════════════════"
	npm run dev

# Legacy aliases kept for muscle-memory / scripts that already use them.
dev-docker: restart
dev-open:   up
stop:       down

# Build
build:
	npm run build

# Dependencies
install:
	npm install

# Cleanup
clean:
	rm -rf dist/
