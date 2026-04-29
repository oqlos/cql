// frontend/src/modules/connect-scenario/cqrs/read-model.ts
import type { ScenarioEvent, ScenarioState, ScenarioStateItem, CurrentScenario } from './types';

const emptyItem = (): ScenarioStateItem => ({ goals: {}, goalOrder: [] });

export class ScenarioReadModel {
  private state: ScenarioState;

  constructor(initial?: Partial<ScenarioState>) {
    this.state = {
      scenarios: initial?.scenarios || {},
      currentScenarioId: initial?.currentScenarioId,
      currentScenario: initial?.currentScenario ?? null,
    };
  }

  apply(event: ScenarioEvent): void {
    switch (event.type) {
      case 'ScenarioRequested': {
        const { by, value } = event.payload;
        if (by === 'id') this.state.currentScenarioId = String(value || '');
        this.state.currentScenario = null;
        break;
      }
      case 'ScenarioLoaded': {
        const p = event.payload;
        this.state.currentScenarioId = String(p.scenarioId || '');
        const cur: CurrentScenario = {
          id: String(p.scenarioId || ''),
          title: String(p.title || ''),
          content: p.content,
          dsl: p.dsl,
          def: p.def,
          obj: p.obj,
          map: p.map,
          library: p.library,
          config: p.config,
        };
        this.state.currentScenario = cur;
        const scn = this.state.scenarios[this.state.currentScenarioId] || emptyItem();
        this.state.scenarios[this.state.currentScenarioId] = { ...scn, name: String(p.title || scn.name || ''), data: p.content };
        break;
      }
      case 'ScenarioLoadFailed': {
        this.state.currentScenario = null;
        break;
      }
      case 'ScenarioDSLUpdated': {
        const { scenarioId, dsl } = event.payload;
        if (this.state.currentScenario && this.state.currentScenario.id === scenarioId) {
          this.state.currentScenario.dsl = dsl;
          const content = this.state.currentScenario.content || {};
          this.state.currentScenario.content = { ...content, dsl };
        }
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        this.state.scenarios[scenarioId] = { ...scn, data: { ...(scn.data || {}), dsl } };
        break;
      }
      case 'ScenarioDEFUpdated': {
        const { scenarioId, def } = event.payload;
        if (this.state.currentScenario && this.state.currentScenario.id === scenarioId) {
          this.state.currentScenario.def = def;
          const content = this.state.currentScenario.content || {};
          this.state.currentScenario.content = { ...content, def };
        }
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        this.state.scenarios[scenarioId] = { ...scn, data: { ...(scn.data || {}), def } };
        break;
      }
      case 'ScenarioContentUpdated': {
        const { scenarioId, content } = event.payload;
        if (this.state.currentScenario && this.state.currentScenario.id === scenarioId) {
          this.state.currentScenario.content = content;
          try { if (content && content.dsl) this.state.currentScenario.dsl = content.dsl; } catch { /* silent */ }
        }
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        this.state.scenarios[scenarioId] = { ...scn, data: content };
        break;
      }
      case 'ScenarioNameUpdated': {
        const id = event.payload.scenarioId || '__unspecified__';
        const current = this.state.scenarios[id] || emptyItem();
        this.state.scenarios[id] = { ...current, name: event.payload.name };
        break;
      }
      case 'GoalAdded': {
        const { scenarioId = '__unspecified__', goalId, name } = event.payload;
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        const goals = { ...scn.goals, [goalId]: { name, tasks: {}, taskOrder: [] } };
        const goalOrder: string[] = Array.isArray(scn.goalOrder) ? scn.goalOrder.slice() : [];
        if (!goalOrder.includes(goalId)) goalOrder.push(goalId);
        this.state.scenarios[scenarioId] = { ...scn, goals, goalOrder };
        break;
      }
      case 'GoalDeleted': {
        const { scenarioId = '__unspecified__', goalId } = event.payload;
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        const goals = { ...scn.goals };
        delete goals[goalId];
        const goalOrder: string[] = Array.isArray(scn.goalOrder) ? scn.goalOrder.filter((g: string) => g !== goalId) : [];
        this.state.scenarios[scenarioId] = { ...scn, goals, goalOrder };
        break;
      }
      case 'TaskAdded': {
        const { scenarioId = '__unspecified__', goalId, taskId, func, object } = event.payload;
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        const goal = scn.goals?.[goalId] || { name: '', tasks: {}, taskOrder: [] };
        const tasks = { ...goal.tasks, [taskId]: { func, object } };
        const taskOrder: string[] = Array.isArray(goal.taskOrder) ? goal.taskOrder.slice() : [];
        if (!taskOrder.includes(taskId)) taskOrder.push(taskId);
        const goals = { ...scn.goals, [goalId]: { ...goal, tasks, taskOrder } };
        this.state.scenarios[scenarioId] = { ...scn, goals };
        break;
      }
      case 'TaskDeleted': {
        const { scenarioId = '__unspecified__', goalId, taskId } = event.payload;
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        const goal = scn.goals?.[goalId] || { name: '', tasks: {}, taskOrder: [] };
        const tasks = { ...goal.tasks };
        delete tasks[taskId];
        const taskOrder: string[] = Array.isArray(goal.taskOrder) ? goal.taskOrder.filter((t: string) => t !== taskId) : [];
        const goals = { ...scn.goals, [goalId]: { ...goal, tasks, taskOrder } };
        this.state.scenarios[scenarioId] = { ...scn, goals };
        break;
      }
      case 'GoalsReordered': {
        const { scenarioId = '__unspecified__', order } = event.payload;
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        this.state.scenarios[scenarioId] = { ...scn, goalOrder: Array.isArray(order) ? order.slice() : [] };
        break;
      }
      case 'TasksReordered': {
        const { scenarioId = '__unspecified__', goalId, order } = event.payload;
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        const goal = scn.goals?.[goalId] || { name: '', tasks: {}, taskOrder: [] };
        const goals = { ...scn.goals, [goalId]: { ...goal, taskOrder: Array.isArray(order) ? order.slice() : [] } };
        this.state.scenarios[scenarioId] = { ...scn, goals };
        break;
      }
      case 'ScenarioSaved': {
        const { scenarioId, data } = event.payload;
        const scn = this.state.scenarios[scenarioId] || emptyItem();
        this.state.scenarios[scenarioId] = { ...scn, data };
        break;
      }
      default:
        break;
    }
  }

  getState(): ScenarioState {
    return { ...this.state };
  }
}
