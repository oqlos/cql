// frontend/src/components/dsl-editor/renderers.types.ts
// Extracted interfaces for DSL block renderers

export interface TaskData {
  function?: string;
  object?: string;
  ands?: Array<{ function?: string; object?: string }>;
}

export interface RenderOptions {
  paramOptions: string[];
  unitOptions: string[];
  operatorOptions: string[];
  functionOptions: string[];
  objectOptions: string[];
  goalOptions: string[];
  logOptions?: string[];
  alarmOptions?: string[];
  errorOptions?: string[];
  variableOptions?: string[];
}

export interface ConditionData {
  parameter?: string;
  operator?: string;
  value?: any;
  unit?: string;
  connector?: string;
  incomingConnector?: string;
}

export interface ElseData {
  actionType?: string;
  actionMessage?: string;
}

export interface VariableData {
  parameter?: string;
  value?: any;
  unit?: string;
  action?: 'GET' | 'SET' | 'MAX' | 'MIN' | 'VAL';
}
