# OqlOS CQL Editor

Standalone CQL (Cognitive Query Language) editor and scenario visualization tool.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Docker

```bash
# Build Docker image
docker build -t oqlos-cql:latest .

# Run container
docker run -p 8091:80 oqlos-cql:latest
```

## Features

- OQL syntax highlighting
- Visual scenario editor
- Terminal simulation
- Report viewer (data.json)
- Protocol visualization

## Integration

This service is designed to run alongside the OqlOS Portal. When running the www project with Docker Compose, the CQL editor is available at `http://cql.oqlos.localhost`.