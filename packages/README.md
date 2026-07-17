# CQL runtime packages

| Layer | Package | Role |
|-------|---------|------|
| **Flat OQL v5** | `@semcod/oqlts` | Canonical parser/validator/simulator (`maskservice/c2004/packages/oqlts`) |
| **Legacy block DSL** | `../runtime/` | SCENARIO/GOAL/FUNC block grammar (being phased out) |
| **Facade** | `@oqlos/cql-runtime` | Re-exports oqlts + legacy runtime for browser/Node |
| **HTTP** | `@oqlos/cql-runtime-server` | Drop-in replacement for Python `cql-backend` on `:8101` |

## Sync oqlts vendor (oqlos/cql standalone)

```bash
cd oqlos/cql
npm run sync:oqlts   # rsync from maskservice/c2004/packages/oqlts → vendor/oqlts
```

## Quick start

```bash
cd packages/cql-runtime-server
npm install
npm test
npm run dev    # → http://localhost:8101/health
```

## Swap docker-compose backend

In `docker-compose.yml`, replace `cql-backend` build context:

```yaml
cql-backend:
  build:
    context: .
    dockerfile: packages/cql-runtime-server/Dockerfile
```

Same port `8101`, same `/api/cql/*` contract — clients (`cqlRuntimeApi.js`, `cql-runtime.client.ts`) unchanged.

## Migration checklist

1. ✅ Node server + contract tests (`packages/cql-runtime-server/tests/`)
2. ✅ Golden fixtures + `npm run parity:python` (8 shared cases)
3. ⬜ **CQL-RT-002**: motor2 backport to `oqlos/cql/runtime`
4. ⬜ Wire `docker-compose.yml` behind `CQL_BACKEND_RUNTIME=node|python` flag
5. ⬜ Frontend: `import from '@oqlos/cql-runtime'` instead of `components/dsl/*`
6. ⬜ Extract `DslGoalRuntime` into `runtime/goal-runtime.ts`
7. ⬜ Deprecate Python port in `backend/cql_backend/` after motor2 parity

### Parity commands

```bash
cd oqlos/cql/packages/cql-runtime-server
npm test
npm run parity:python   # uses CQL_BACKEND_SRC → c2004/connect-scenario/cql-backend
```
