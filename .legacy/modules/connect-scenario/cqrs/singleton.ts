// frontend/src/modules/connect-scenario/cqrs/singleton.ts
import { createCQRSSingleton } from '../../../core/cqrs/module-factory';
import { ScenarioCQRS } from './engine';

export const [getScenarioCQRS, resetScenarioCQRS] = createCQRSSingleton(() => new ScenarioCQRS());
