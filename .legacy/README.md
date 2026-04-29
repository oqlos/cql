# Legacy DSL Source (Reference Only)

This folder contains the original TypeScript DSL implementation extracted from
`maskservice/c2004/frontend` on 2026-04-20. It is **not** compiled by Vite and
is kept purely as reference while the React-based CQL editor is developed.

## Origin Map

| Legacy path in `cql/legacy/`                 | Original path in maskservice                                      |
|----------------------------------------------|-------------------------------------------------------------------|
| `components/dsl/`                            | `frontend/src/components/dsl/`                                    |
| `components/dsl-console/`                    | `frontend/src/components/dsl-console/`                            |
| `components/dsl-def/`                        | `frontend/src/components/dsl-def/`                                |
| `components/dsl-editor/`                     | `frontend/src/components/dsl-editor/`                             |
| `components/dsl-log/`                        | `frontend/src/components/dsl-log/`                                |
| `components/dsl-sim/`                        | `frontend/src/components/dsl-sim/`                                |
| `components/dsl-table/`                      | `frontend/src/components/dsl-table/`                              |
| `dsl/`                                       | `frontend/dsl/` (standalone Vite DSL playground, no node_modules) |
| `pages/connect-scenario-*`                   | `frontend/src/pages/connect-scenario-*`                           |
| `modules/connect-scenario/`                  | `frontend/src/modules/connect-scenario/`                          |
| `dsl-examples/`                              | `frontend/src/assets/dsl-examples/`                               |

## Why copy, not move?

The originals in maskservice are still imported by other pages
(`dsl-editor`, `library-editor`, `func-editor`, `map-editor`, CQRS handlers,
tests, etc.). Removing them would break the whole maskservice frontend build.

The integration strategy is:
1. `oqlos/cql` runs as an independent React + Vite + nginx container.
2. The route `/connect-scenario/scenarios` in maskservice is swapped from
   rendering `ScenariosPage` directly to rendering an `<iframe>` that loads the
   cql container at the same path, preserving query params
   (`font/theme/role/lang/size/scenario`).
3. cql talks to the maskservice backend directly via REST (`/api/v3/...`)
   and WebSocket (`WS_URL`) — no code duplication of the DSL compiler is
   required in React for the iframe strategy, since cql hosts its own editor.

Once the React rewrite covers enough DSL surface, the originals in maskservice
can be deleted in a follow-up cleanup.
