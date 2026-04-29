// frontend/src/modules/connect-scenario/cqrs/engine.ts
import { CommandBus, EventBus } from '../../../core/cqrs/bus';
import { RemoteMirroringEventStore } from '../../../core/cqrs/event-store';
import { registerHandlersOnBus } from '../../../core/cqrs/module-factory';
import { connectScenarioHandlers } from './handlers';
import { ScenarioReadModel } from './read-model';
import type { ScenarioCommand, ScenarioEvent, ScenarioState } from './types';

export class ScenarioCQRS {
  readonly commandBus: CommandBus;
  readonly eventBus: EventBus<ScenarioEvent>;
  readonly eventStore: RemoteMirroringEventStore<ScenarioEvent>;
  readonly readModel: ScenarioReadModel;

  constructor(initial?: Partial<ScenarioState>) {
    this.commandBus = new CommandBus();
    this.eventBus = new EventBus<ScenarioEvent>();
    this.eventStore = new RemoteMirroringEventStore<ScenarioEvent>('connect-scenario');
    this.readModel = new ScenarioReadModel(initial);

    registerHandlersOnBus(connectScenarioHandlers, this.commandBus, this.eventBus, this.eventStore, () => this.getState());

    try {
      for (const ev of this.eventStore.getAll()) {
        this.readModel.apply({ type: ev.type as any, payload: ev.payload as any });
      }
    } catch { /* silent */ }

    // Project scenario domain events into the read model
    this.eventBus.subscribe('ScenarioNameUpdated', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('GoalAdded', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('GoalDeleted', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('TaskAdded', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('TaskDeleted', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('ScenarioSaved', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('GoalsReordered', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('TasksReordered', (ev: any) => this.readModel.apply(ev));
    // Loading lifecycle
    this.eventBus.subscribe('ScenarioRequested', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('ScenarioLoaded', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('ScenarioLoadFailed', (ev: any) => this.readModel.apply(ev));
    // Projection updates
    this.eventBus.subscribe('ScenarioDSLUpdated', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('ScenarioDEFUpdated', (ev: any) => this.readModel.apply(ev));
    this.eventBus.subscribe('ScenarioContentUpdated', (ev: any) => this.readModel.apply(ev));
  }

  async dispatch(cmd: ScenarioCommand | any): Promise<void> {
    try {
      await this.commandBus.dispatch(cmd as any);
    } catch {
      // Unknown command for scenario domain — ignored gracefully
    }
  }

  getState(): ScenarioState {
    return this.readModel.getState();
  }
}
