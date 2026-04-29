# cql-backend ↔ c2004 DslEngine parity migration

Goal: enable removal of `maskservice/c2004/frontend/src/components/dsl/` by
porting the full `DslEngine` surface (currently used in
`pages/connect-test-connect-xml.page.ts`) to `cql-backend` REST endpoints.

## Why this exists

`@maskservice/c2004/frontend/src/pages/connect-test-connect-xml.page.ts:108`
calls `getDslEngine()` and uses **synchronous** methods that have no REST
counterpart in `cql-backend`. Until those endpoints exist, deleting
`components/dsl/` would break the c2004 frontend build.

The implemented endpoints today are tracked in
`@/home/tom/github/oqlos/cql/backend/README.md:26-47`. This file tracks the
*missing* endpoints needed to retire the local TS engine.

## Reference TS sources (frozen copies)

All under `@/home/tom/github/oqlos/cql/runtime/`:

- `dsl.engine.ts` — facade (160 LOC)
- `dsl.xsd.ts` — static XSD string (103 LOC)
- `dsl.schema.ts` — JSON Schema export + Zod AST validator (485 LOC)
- `dsl.xml.ts` — DSL ↔ XML codec (522 LOC)
- `dsl.migrate.xml.ts` — legacy XML → DSL migration (312 LOC)
- `dsl.validate.db.ts` — composite validate + DB scenario validation (172 LOC)
- `singleton.ts` — `getDslEngine()` provider (41 LOC)

## Endpoint port checklist

### Phase A: backend ports (cql-backend Python)

| Endpoint                           | TS source                | Status | Notes |
|------------------------------------|--------------------------|:------:|-------|
| `GET  /api/cql/xsd`                | `dsl.xsd.ts`             | ✅     | `cql_backend/xsd.py` — static string. |
| `GET  /api/cql/json-schema`        | `dsl.schema.ts:445-481`  | ✅     | `cql_backend/schema.py` — static dict. |
| `POST /api/cql/validate-ast`       | `dsl.schema.ts:229-236`  | ✅     | `cql_backend/schema.py:validate_ast` via `jsonschema.Draft7Validator`. |
| `POST /api/cql/dsl-to-xml`         | `dsl.xml.ts:dslToXml`    | ⬜     | parse + AST→XML compose. |
| `POST /api/cql/ast-to-xml`         | `dsl.xml.ts:astToXml`    | ⬜     | Direct AST→XML render via `xml.etree`. |
| `POST /api/cql/xml-to-ast`         | `dsl.xml.ts:xmlToAst`    | ⬜     | Parse XML, build AST dict. |
| `POST /api/cql/xml-migrate`        | `dsl.migrate.xml.ts:migrateLegacyXmlToDsl` | ⬜ | Legacy XML → DSL text + AST. |
| `POST /api/cql/xml-split`          | `dsl.migrate.xml.ts:splitLegacyXmlToScenarios` | ⬜ | Multi-scenario split. |
| `POST /api/cql/validate-dsl-text`  | `dsl.validate.db.ts:validateDslText` | ⬜ | Composite parse+schema+xml. |

**Out of scope (stay in c2004 frontend):**

- `dslDataService.loadAll()` — fetches DSL data (objects/functions/params)
  from maskservice backend; no DSL logic.
- `postScenarioToDb`, `migrateFilesToDb`, `validateAllTestScenarios` —
  thin HTTP wrappers around `/api/v3/data/test_scenarios` in maskservice
  backend; no DSL logic. Keep as plain `fetchWithAuth` calls.

### Phase B: frontend client extension (c2004)

- `@/home/tom/github/maskservice/c2004/frontend/src/utils/cql-runtime.client.ts`
  needs new exported async functions:
  `getXsdRemote`, `getJsonSchemaRemote`, `validateAstRemote`,
  `dslToXmlRemote`, `astToXmlRemote`, `xmlToAstRemote`,
  `xmlMigrateRemote`, `xmlSplitRemote`, `validateDslTextRemote`.
- New file `@/home/tom/github/maskservice/c2004/frontend/src/utils/dsl-engine.remote.ts`
  exposes a `DslEngineRemote` class implementing the same method names as
  `DslEngine` but **all async**, calling the remote endpoints.
- `getDslEngine()` is replaced with `getDslEngineRemote()`.

### Phase C: caller migrations (c2004)

| File | Symbol | Strategy |
|------|--------|----------|
| `modules/connect-test-protocol/helpers/copy-ops.ts` | `quoteDslValue` | Move trivial helper to `src/utils/dsl-quote.ts` (sync). |
| `modules/connect-test-protocol/helpers/render.ts` | `quoteDslValue`, `highlightDsl` | Quote: same as above. Highlight: render plain `esc()` synchronously, then async post-replace with `highlightDslRemote`. |
| `modules/connect-test-protocol/helpers/scenario-content.ts` | `parseDsl` | `await parseDslRemote(text)` (caller already async). |
| `modules/connect-test/helpers/scenario-view-loaders.ts` | `parseDsl` | `await parseDslRemote(text)` (caller already async). |
| `modules/connect-test-device/helpers/dsl.ts` | `DslScenarioBuilders.buildDslFromTestScenario` etc. | Convert to async, use `scenarioBuildRemote` (source='test'). |
| `pages/connect-test-connect-xml.page.ts` | `getDslEngine` | Replace with `DslEngineRemote`; all `dsl.X(...)` calls become `await dsl.X(...)`. |
| `tests/dsl-content-helpers.test.ts` | `dslFromScenarioContent`, `renderLegacyTaskAsDslLines` | These helpers aren't on the engine; either inline a port into the test or delete (parity covered by cql-backend tests). |
| `tests/dsl-single-quote.test.ts` | `parseDsl`, `astToDslText`, `validateDslFormat` | Delete — parity covered by `cql-backend/tests/test_quotes.py` and `test_api.py`. |

### Phase D: deletion

1. Run `npm run test` and `npm run build` in c2004 frontend.
2. Run `pytest` in cql-backend.
3. Verify no `import.*components/dsl` remains:
   `grep -rE "components/dsl" maskservice/c2004/frontend/src` must be empty.
4. `rm -rf maskservice/c2004/frontend/src/components/dsl/`.
5. Re-run frontend test+build to confirm.

## Architectural decision log

- **Why keep `quoteDslValue` local?** It's a 4-line pure-string helper used
  thousands of times in synchronous HTML assembly (e.g. `copy-ops.ts`,
  `render.ts`). Round-tripping HTTP per call is unacceptable. Documented
  in `cql-runtime.client.ts:4-12`.
- **Why async highlight with sync fallback?** `renderGoalStepsHtml` is
  invoked synchronously inside DOM rendering paths. We render plain
  escaped text synchronously and replace with highlighted HTML once the
  async call resolves. Behaviour is identical except for a one-frame
  flicker on first paint.
- **Why frontend-side `DslEngineRemote` wrapper?** Minimises the diff in
  `connect-xml.page.ts` — only the line `const dsl = getDslEngine()`
  changes to `const dsl = getDslEngineRemote()` and call sites add `await`.

## Progress

- 2026-04-20 Plan created. Phase A starting.
- 2026-04-20 Phase A2 done — `cql_backend/xsd.py` + `GET /api/cql/xsd` + 1 test.
- 2026-04-20 Phase A3 done — `cql_backend/schema.py` (`get_json_schema`,
  `validate_ast`) + `GET /api/cql/json-schema` + `POST /api/cql/validate-ast`
  + 4 tests. `jsonschema>=4.21` added to runtime deps.
- 2026-04-20 Phase B1 partial — `cql-runtime.client.ts` extended with
  `parseDslRemote/validateDslRemote/execDslRemote/scenarioBuildRemote`
  (now typed against the implemented endpoints), plus
  `serializeAstRemote/getXsdRemote/getJsonSchemaRemote/validateAstRemote`
  and stubbed `dslToXmlRemote/astToXmlRemote/xmlToAstRemote/
  xmlMigrateRemote/xmlSplitRemote/validateDslTextRemote` for Phase A4-A6.
  Verified with `tsc --noEmit` (no errors). 55 cql-backend tests pass.
