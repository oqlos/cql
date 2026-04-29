// frontend/src/modules/connect-scenario/cqrs/helpers.ts
import { getScenarioCQRS } from './singleton';

export async function loadScenario(params: { id?: string; title?: string }): Promise<null | { id: string; title: string; content?: any; dsl?: string; def?: string; obj?: string; map?: string }> {
  const { id, title } = params || ({} as any);
  const bus: any = getScenarioCQRS();
  try {
    if (id) {
      await bus.dispatch({ type: 'LoadScenarioById', id });
    } else if (title) {
      await bus.dispatch({ type: 'LoadScenarioByTitle', title });
    } else {
      return null;
    }
    const st = (bus.getState?.() || bus.readModel?.getState?.()) as any;
    const cur = st?.currentScenario;
    if (cur && cur.id) return cur as any;
    return null;
  } catch {
    return null;
  }
}
