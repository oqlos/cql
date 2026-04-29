// frontend/src/modules/connect-test/pages/device-testing.dsl.ts
// DEPRECATED: Functions moved to components/dsl/dsl-scenario-builders.ts
// Use DslScenarioBuilders instead

import type { TestScenario } from '../../connect-test/models/test-config';
import { DslScenarioBuilders } from '../../../components/dsl';

export const DeviceTestingDsl = {
  buildDslFromScenario(sc: TestScenario): string {
    return DslScenarioBuilders.buildDslFromTestScenario(sc);
  },

  buildGoalsFromScenario(sc: TestScenario): any[] {
    return DslScenarioBuilders.buildGoalsFromTestScenario(sc);
  }
};
