# OqlOS CQL Editor - Makefile
.PHONY: help dev dev-docker dev-open build install clean

# Default target
help:
	@echo "OqlOS CQL Editor - Available commands:"
	@echo "  make dev          - Start development server (npm)"
	@echo "  make dev-docker   - Restart Docker stack (down + up)"
	@echo "  make dev-open     - Start dev containers and show URLs"
	@echo "  make build        - Build for production"
	@echo "  make install      - Install dependencies"
	@echo "  make clean        - Clean build artifacts"

# Development (npm)
dev:
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Starting CQL Editor Dev Server"
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Port: $$(grep VITE_CQL_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '3001')"
	@echo "══════════════════════════════════════════════════════════════"
	npm run dev

# Docker restart (down + up)
dev-docker:
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  CQL Editor - Restarting Docker Stack"
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Domain: $$(grep DOCKER_DOMAIN_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'cql.localhost')"
	@echo "  Traefik Dashboard: $$(grep DOCKER_DOMAIN_TRAEFIK_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'traefik.cql.localhost')"
	@echo ""
	@echo "  Port Mappings:"
	@echo "    HTTP:      $$(grep VITE_CQL_HTTP_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '8092') → 80 (container)"
	@echo "    Traefik:   $$(grep VITE_CQL_TRAEFIK_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '8093') → 8080 (container)"
	@echo "══════════════════════════════════════════════════════════════"
	@echo ""
	@echo "Stopping existing containers..."
	@docker compose --env-file .env down 2>/dev/null || true
	@echo "Starting CQL Docker stack..."
	@docker compose --env-file .env up -d --build
	@echo ""
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Services available at:"
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  ⚙️  CQL Editor: http://$$(grep DOCKER_DOMAIN_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'cql.localhost') (port $$(grep VITE_CQL_HTTP_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '8092'))"
	@echo "  📊 Traefik:    http://$$(grep DOCKER_DOMAIN_TRAEFIK_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'traefik.cql.localhost'):$$(grep VITE_CQL_TRAEFIK_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '8093')"
	@echo "══════════════════════════════════════════════════════════════"

# Start and open
dev-open:
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  CQL Editor - Development Environment"
	@echo "══════════════════════════════════════════════════════════════"
	@echo ""
	@echo "  Domain Configuration (from .env)"
	@echo "  ─────────────────────────────────────────────────────────"
	@echo "  DOCKER_DOMAIN_CQL:        $$(grep DOCKER_DOMAIN_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'cql.localhost')"
	@echo "  DOCKER_DOMAIN_TRAEFIK_CQL:  $$(grep DOCKER_DOMAIN_TRAEFIK_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'traefik.cql.localhost')"
	@echo ""
	@echo "  Starting Docker containers..."
	@docker compose --env-file .env up -d --build
	@echo ""
	@echo "Checking /etc/hosts..."
	@grep -q "$$(grep DOCKER_DOMAIN_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'cql.localhost')" /etc/hosts && echo "✓ Domains already configured" || echo "⚠ Run: echo '127.0.0.1 $$(grep DOCKER_DOMAIN_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'cql.localhost') $$(grep DOCKER_DOMAIN_TRAEFIK_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'traefik.cql.localhost')' | sudo tee -a /etc/hosts"
	@echo ""
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  Services available at:"
	@echo "══════════════════════════════════════════════════════════════"
	@echo "  ⚙️  CQL Editor: http://$$(grep DOCKER_DOMAIN_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'cql.localhost') (port $$(grep VITE_CQL_HTTP_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '8092'))"
	@echo "  📊 Traefik:    http://$$(grep DOCKER_DOMAIN_TRAEFIK_CQL .env 2>/dev/null | cut -d'=' -f2 || echo 'traefik.cql.localhost'):$$(grep VITE_CQL_TRAEFIK_PORT .env 2>/dev/null | cut -d'=' -f2 || echo '8093')"
	@echo "══════════════════════════════════════════════════════════════"

# Build
build:
	npm run build

# Dependencies
install:
	npm install

# Cleanup
clean:
	rm -rf dist/
