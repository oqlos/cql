import { ModuleMetadata } from '../module.interface';
import { BaseModule } from '../base.module';
import { RELEASE_VERSION } from '../../config/release-version';

export class ConnectScenarioModule extends BaseModule {
  readonly metadata: ModuleMetadata = {
    name: 'connect-scenario',
    version: RELEASE_VERSION,
    dependencies: [],
    routes: [
      { path: '/connect-scenario', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/scenarios', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/scenario-editor', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/library-editor', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/func-editor', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/map-editor', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/dsl-editor', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/operator-parameters', component: 'ConnectScenarioView' },
      { path: '/connect-scenario/templates', component: 'ConnectScenarioView' },
      { path: '/connect-operator-parameters', component: 'ConnectScenarioView' }
    ]
  };

  getDisplayName() { return '🧩 Scenario'; }

  protected async viewImport() {
    const { ConnectScenarioView } = await import('./connect-scenario.view');
    return { ViewClass: ConnectScenarioView as any };
  }
}

export default ConnectScenarioModule;
