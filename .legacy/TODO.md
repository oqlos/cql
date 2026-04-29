(base) tom@nvidia:~/github/maskservice/c2004$ git status
On branch main
Your branch is up to date with 'origin/main'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        new file:   .redeploy/state/deployment-pi_192.168.188.108-8a829fe5.yaml
        new file:   .redeploy/state/migration-podman-rpi5-pi_192.168.188.108-44de21b4.yaml
        new file:   .redeploy/state/migration.podman-rpi5-resume-pi_192.168.188.108-7738eb44.yaml
        modified:   backend/api/main.py
        new file:   backend/api/routes/v1/endpoints/cql_proxy.py
        modified:   backend/api/routes/v1/router.py
        new file:   backend/app/clients/__init__.py
        new file:   backend/app/clients/cql_backend_client.py
        modified:   backend/app/config/settings.py
        modified:   backend/app/main.py
        modified:   backend/app/streaming/websocket_manager.py
        deleted:    frontend/src/components/dsl/dsl-contract.ts
        deleted:    frontend/src/components/dsl/dsl-dialog.ts
        deleted:    frontend/src/components/dsl/dsl-func.parser.test.ts
        deleted:    frontend/src/components/dsl/dsl-registry.commands.ts
        deleted:    frontend/src/components/dsl/dsl-registry.execution.ts
        deleted:    frontend/src/components/dsl/dsl-registry.parsing.ts
        deleted:    frontend/src/components/dsl/dsl-registry.presets.ts
        deleted:    frontend/src/components/dsl/dsl-registry.ts
        deleted:    frontend/src/components/dsl/dsl-registry.types.ts
        deleted:    frontend/src/components/dsl/dsl-timer.service.ts
        deleted:    frontend/src/components/dsl/dsl.exec.test.ts
        deleted:    frontend/src/components/dsl/dsl.highlight.css
        deleted:    frontend/src/components/dsl/dsl.highlight.refactored.test.ts
        deleted:    frontend/src/components/dsl/dsl.migrate.xml.db.test.ts
        deleted:    frontend/src/components/dsl/dsl.migrate.xml.test.ts
        deleted:    frontend/src/components/dsl/dsl.runtime.helpers.test.ts
        deleted:    frontend/src/components/dsl/dsl.schema.test.ts
        deleted:    frontend/src/components/dsl/dsl.serialize.text.test.ts
        deleted:    frontend/src/components/dsl/dsl.validate.db.test.ts
        deleted:    frontend/src/components/dsl/dsl.xml.test.ts
        modified:   frontend/src/components/dsl/index.ts
        modified:   frontend/src/components/goal-execution-modal/goal-execution-modal.component.ts
        new file:   frontend/src/core/ui/encoder.controller.ts
        new file:   frontend/src/core/ui/size.controller.ts
        new file:   frontend/src/core/ui/top-bar.controller.ts
        modified:   frontend/src/main.ts
        modified:   frontend/src/modules/connect-data/cqrs/handlers.ts
        modified:   frontend/src/modules/connect-scenario/index.ts
        new file:   frontend/src/modules/connect-test-device/helpers/devices-search-cache.controller.ts
        new file:   frontend/src/modules/connect-test-device/helpers/devices-search-data.controller.ts
        new file:   frontend/src/modules/connect-test-device/helpers/devices-search-filter.controller.ts
        new file:   frontend/src/modules/connect-test-device/helpers/devices-search-view.controller.ts
        modified:   frontend/src/modules/connect-test-device/helpers/devices-search.controller.ts
        new file:   frontend/src/modules/connect-test-device/helpers/index.ts
        new file:   frontend/src/modules/connect-test-full/helpers/full-test-activity.handler.ts
        new file:   frontend/src/modules/connect-test-full/helpers/full-test-device.manager.ts
        new file:   frontend/src/modules/connect-test-full/helpers/full-test-navigation.ts
        new file:   frontend/src/modules/connect-test-full/helpers/full-test-state.manager.ts
        new file:   frontend/src/modules/connect-test-full/helpers/index.ts
        new file:   frontend/src/modules/connect-test-protocol/helpers/index.ts
        new file:   frontend/src/modules/connect-test-protocol/helpers/protocol-steps-state.manager.ts
        new file:   frontend/src/modules/connect-test-protocol/helpers/protocol-steps-streaming.manager.ts
        new file:   frontend/src/modules/connect-test/helpers/index.ts
        new file:   frontend/src/modules/connect-test/helpers/scenario-view-data-loader.ts
        new file:   frontend/src/modules/connect-test/helpers/scenario-view-event-handler.ts
        new file:   frontend/src/modules/connect-test/helpers/scenario-view-import-export.handler.ts
        new file:   frontend/src/modules/connect-test/helpers/scenario-view-navigation.handler.ts
        new file:   frontend/src/modules/connect-test/helpers/scenario-view-sgi-state.manager.ts
        new file:   frontend/src/modules/connect-test/helpers/scenario-view-type-assignment.manager.ts
        modified:   frontend/src/modules/connect-test/helpers/scenario-view.controller.ts
        new file:   frontend/src/modules/connect-test/services/index.ts
        modified:   frontend/src/modules/connect-test/services/scenario.service.ts
        new file:   frontend/src/modules/connect-test/services/test-run-device-resolver.service.ts
        new file:   frontend/src/modules/connect-test/services/test-run-orchestrator.service.ts
        new file:   frontend/src/modules/connect-test/services/test-run-protocol-starter.service.ts
        new file:   frontend/src/modules/connect-test/services/test-run-scenario-resolver.service.ts
        modified:   frontend/src/pages/connect-operator-parameters.page.ts
        deleted:    frontend/src/pages/connect-scenario-scenario-editor.page.test.ts
        modified:   frontend/src/pages/connect-test-protocol-protocol-steps.page.ts
        modified:   frontend/src/pages/connect-test-test-run.page.ts
        new file:   frontend/src/pages/helpers/cql-iframe.test.ts
        modified:   frontend/src/pages/helpers/cql-iframe.ts
        deleted:    frontend/src/pages/helpers/dsl-variable-line.ts
        deleted:    frontend/src/shared/dsl-syntax.styles.ts
        deleted:    frontend/src/tests/def-editor.test.ts
        deleted:    frontend/src/tests/dsl-def.test.ts
        deleted:    frontend/src/tests/dsl-editor.test.ts
        deleted:    frontend/src/tests/scenarios-serializer.test.ts
        new file:   frontend/src/utils/cql-runtime.client.ts
        new file:   frontend/src/utils/dsl-engine.remote.ts
        modified:   redeploy/README.md
        modified:   redeploy/native/deployment.yaml
        modified:   redeploy/podman-http/deployment.yaml
        modified:   redeploy/podman-traefik/deployment.yaml
        modified:   redeploy/podman-traefik/traefik/migration.yaml
        new file:   redeploy/traefik-tar/MAPOWANIE.md
        new file:   redeploy/traefik-tar/README.md
        new file:   redeploy/traefik-tar/deployment.yaml
        new file:   redeploy/traefik-tar/migration.yaml

Changes not staged for commit:
  (use "git add/rm <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   .redeploy/state/deployment-pi_192.168.188.108-8a829fe5.yaml
        deleted:    .redeploy/state/migration-podman-rpi5-pi_192.168.188.108-44de21b4.yaml
        deleted:    .redeploy/state/migration.podman-rpi5-resume-pi_192.168.188.108-7738eb44.yaml
        modified:   frontend/package.json
        modified:   frontend/src/components/connect-menu/menu.config.ts
        modified:   frontend/src/components/icon.component.ts
        modified:   frontend/src/components/icon.styles.ts
        modified:   frontend/src/core/app.initializer.ts
        modified:   frontend/src/core/ui/app-shell.ts
        modified:   frontend/src/main.ts
        modified:   frontend/src/modules/connect-test-device/helpers/devices-search-data.controller.ts
        modified:   frontend/src/modules/connect-test-device/helpers/devices-search-view.controller.ts
        modified:   frontend/src/modules/connect-test-device/helpers/devices-search.controller.ts
        modified:   frontend/src/modules/connect-test-device/helpers/index.ts
        modified:   frontend/src/modules/connect-test-full/helpers/full-test-activity.handler.ts
        modified:   frontend/src/modules/connect-test-full/helpers/full-test-device.manager.ts
        modified:   frontend/src/modules/connect-test/services/test-run-orchestrator.service.ts
        modified:   frontend/src/modules/connect-test/services/test-run-protocol-starter.service.ts
        modified:   frontend/src/pages/connect-test-full-full-test.page.ts
        modified:   frontend/src/pages/connect-test-protocol-protocol-steps.page.ts
        modified:   frontend/src/pages/connect-test-test-run.page.ts
        modified:   frontend/src/registry/module.registry.ts
        modified:   frontend/src/registry/route.registry.ts
        modified:   frontend/src/services/icon-theme.service.ts
        modified:   frontend/src/services/navigation-options.service.ts
        modified:   migration-podman-rpi5.yaml
        modified:   quadlet/http/c2004-backend.container
        modified:   redeploy/README.md
        modified:   redeploy/podman-http/deployment.yaml
        modified:   redeploy/podman-traefik/migration.md
        modified:   redeploy/podman-traefik/resume.md
        modified:   redeploy/traefik-tar/migration.yaml

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        .redeploy/state/migration-pi_192.168.188.108-98931e4d.yaml
        frontend/src/data/svg-definitions.ts
        nginx/
        quadlet/http/c2004-reverse-proxy.container







(base) tom@nvidia:~/github/maskservice/c2004$ git status | grep deleted
        deleted:    frontend/src/components/dsl/dsl-contract.ts
        deleted:    frontend/src/components/dsl/dsl-dialog.ts
        deleted:    frontend/src/components/dsl/dsl-func.parser.test.ts
        deleted:    frontend/src/components/dsl/dsl-registry.commands.ts
        deleted:    frontend/src/components/dsl/dsl-registry.execution.ts
        deleted:    frontend/src/components/dsl/dsl-registry.parsing.ts
        deleted:    frontend/src/components/dsl/dsl-registry.presets.ts
        deleted:    frontend/src/components/dsl/dsl-registry.ts
        deleted:    frontend/src/components/dsl/dsl-registry.types.ts
        deleted:    frontend/src/components/dsl/dsl-timer.service.ts
        deleted:    frontend/src/components/dsl/dsl.exec.test.ts
        deleted:    frontend/src/components/dsl/dsl.highlight.css
        deleted:    frontend/src/components/dsl/dsl.highlight.refactored.test.ts
        deleted:    frontend/src/components/dsl/dsl.migrate.xml.db.test.ts
        deleted:    frontend/src/components/dsl/dsl.migrate.xml.test.ts
        deleted:    frontend/src/components/dsl/dsl.runtime.helpers.test.ts
        deleted:    frontend/src/components/dsl/dsl.schema.test.ts
        deleted:    frontend/src/components/dsl/dsl.serialize.text.test.ts
        deleted:    frontend/src/components/dsl/dsl.validate.db.test.ts
        deleted:    frontend/src/components/dsl/dsl.xml.test.ts
        deleted:    frontend/src/pages/connect-scenario-scenario-editor.page.test.ts
        deleted:    frontend/src/pages/helpers/dsl-variable-line.ts
        deleted:    frontend/src/shared/dsl-syntax.styles.ts
        deleted:    frontend/src/tests/def-editor.test.ts
        deleted:    frontend/src/tests/dsl-def.test.ts
        deleted:    frontend/src/tests/dsl-editor.test.ts
        deleted:    frontend/src/tests/scenarios-serializer.test.ts
        deleted:    .redeploy/state/migration-podman-rpi5-pi_192.168.188.108-44de21b4.yaml
        deleted:    .redeploy/state/migration.podman-rpi5-resume-pi_192.168.188.108-7738eb44.yaml
(base) tom@nvidia:~/github/maskservice/c2004$ 