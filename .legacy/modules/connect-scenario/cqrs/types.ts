// frontend/src/modules/connect-scenario/cqrs/types.ts

export interface ScenarioContent {
  goals?: Array<{ id: string; name: string; tasks?: Array<{ func?: string; object?: string }> }>;
  dsl?: string;
  def?: string;
  obj?: string;
  map?: string;
  library?: string;
  config?: string;
}

export type ScenarioCommand =
  | { type: 'AddGoal'; scenarioId?: string; goalId: string; name: string }
  | { type: 'DeleteGoal'; scenarioId?: string; goalId: string }
  | { type: 'AddTask'; scenarioId?: string; goalId: string; taskId: string; func?: string; object?: string }
  | { type: 'DeleteTask'; scenarioId?: string; goalId: string; taskId: string }
  | { type: 'UpdateScenarioName'; scenarioId?: string; name: string }
  | { type: 'SaveScenario'; scenarioId: string; data: ScenarioContent }
  | { type: 'ReorderGoals'; scenarioId?: string; order: string[] }
  | { type: 'ReorderTasks'; scenarioId?: string; goalId: string; order: string[] }
  // Load commands
  | { type: 'LoadScenarioById'; id: string }
  | { type: 'LoadScenarioByTitle'; title: string }
  // Update projections
  | { type: 'UpdateScenarioDSL'; scenarioId: string; dsl: string }
  | { type: 'UpdateScenarioDEF'; scenarioId: string; def: string }
  | { type: 'UpdateScenarioContent'; scenarioId: string; content: ScenarioContent };

export type ScenarioEvent =
  | { type: 'GoalAdded'; payload: { scenarioId?: string; goalId: string; name: string } }
  | { type: 'GoalDeleted'; payload: { scenarioId?: string; goalId: string } }
  | { type: 'TaskAdded'; payload: { scenarioId?: string; goalId: string; taskId: string; func?: string; object?: string } }
  | { type: 'TaskDeleted'; payload: { scenarioId?: string; goalId: string; taskId: string } }
  | { type: 'ScenarioNameUpdated'; payload: { scenarioId?: string; name: string } }
  | { type: 'ScenarioSaved'; payload: { scenarioId: string; data: ScenarioContent } }
  | { type: 'GoalsReordered'; payload: { scenarioId?: string; order: string[] } }
  | { type: 'TasksReordered'; payload: { scenarioId?: string; goalId: string; order: string[] } }
  // Load events
  | { type: 'ScenarioRequested'; payload: { by: 'id' | 'title'; value: string } }
  | { type: 'ScenarioLoaded'; payload: { scenarioId: string; title: string; content?: ScenarioContent; dsl?: string; def?: string; obj?: string; map?: string; library?: string; config?: string } }
  | { type: 'ScenarioLoadFailed'; payload: { by: 'id' | 'title'; value: string; error?: string } }
  | { type: 'ScenarioDSLUpdated'; payload: { scenarioId: string; dsl: string } }
  | { type: 'ScenarioDEFUpdated'; payload: { scenarioId: string; def: string } }
  | { type: 'ScenarioContentUpdated'; payload: { scenarioId: string; content: ScenarioContent } };

export interface ScenarioGoalState {
  name: string;
  tasks: Record<string, { func?: string; object?: string }>;
  taskOrder: string[];
}

export interface ScenarioStateItem {
  name?: string;
  goals: Record<string, ScenarioGoalState>;
  goalOrder: string[];
  data?: ScenarioContent;
}

export interface CurrentScenario {
  id: string;
  title: string;
  content?: ScenarioContent;
  dsl?: string;
  def?: string;
  obj?: string;
  map?: string;
  library?: string;
  config?: string;
}

export interface ScenarioState {
  scenarios: Record<string, ScenarioStateItem>;
  currentScenarioId?: string;
  currentScenario?: CurrentScenario | null;
}
