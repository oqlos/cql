// frontend/src/components/dsl/dsl.types.ts

export type DslTaskAnd = { function: string; object?: string };
export type DslTask = { function: string; object?: string; ands?: DslTaskAnd[] };

export type DslIfCondition = {
  type: 'if';
  parameter: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  value: string;
  unit?: string;
  connector?: 'AND' | 'OR' | 'ELSE';
  incomingConnector?: 'AND' | 'OR' | 'ELSE';
};
export type DslElseCondition = {
  type: 'else';
  actionType?: 'ERROR' | 'WARNING' | 'INFO' | 'GOAL';
  actionMessage?: string;
};
export type DslCondition = DslIfCondition | DslElseCondition;

// Step union to preserve authoring order when available
export type DslStepTask = DslTask & { type: 'task' };
export type DslStepPump = { type: 'pump'; value: string; unit?: string; raw: string };
export type DslStepFuncCall = { type: 'func_call'; name: string; arguments?: string[] };
export type DslStepGet = { type: 'get'; parameter: string; unit?: string };
export type DslStepSet = { type: 'set'; parameter: string; value: string; unit?: string };
export type DslStepMax = { type: 'max'; parameter: string; value: string; unit?: string };
export type DslStepMin = { type: 'min'; parameter: string; value: string; unit?: string };
export type DslStepDeltaMax = { type: 'delta_max'; parameter: string; value: string; unit?: string; per?: string };
export type DslStepDeltaMin = { type: 'delta_min'; parameter: string; value: string; unit?: string; per?: string };
export type DslStepVal = { type: 'val'; parameter: string; unit?: string };
export type DslStepWait = { type: 'wait'; duration: string; unit?: string };
export type DslStepSample = { type: 'sample'; parameter: string; state: 'START' | 'STOP'; interval?: string };
export type DslStepCalc = { type: 'calc'; result: string; function: 'AVG' | 'SUM' | 'MIN' | 'MAX' | 'COUNT' | 'STDDEV'; input: string };
export type DslStepFun = { type: 'fun'; result: string; expression: string; variables: string[] };
export type DslStepLog = { type: 'log'; message: string };
export type DslStepAlarm = { type: 'alarm'; message: string };
export type DslStepError = { type: 'error'; message: string };
export type DslStepSave = { type: 'save'; parameter: string };
export type DslStepUser = { type: 'user'; action: string; message: string };
export type DslStepResult = { type: 'result'; status: string };
export type DslStepOpt = { type: 'opt'; parameter: string; description: string };
export type DslStepEnd = { type: 'end' };
export type DslStepOut = { type: 'out'; outType: string; value: string };
export type DslStepDialog = { type: 'dialog'; parameter: string; message: string };
export type DslStepInfo = { type: 'info'; level: string; message: string };
export type DslStepRepeat = { type: 'repeat' };
export type DslStep =
  | DslStepTask
  | DslStepPump
  | DslStepFuncCall
  | DslIfCondition
  | DslElseCondition
  | DslStepGet
  | DslStepSet
  | DslStepMax
  | DslStepMin
  | DslStepDeltaMax
  | DslStepDeltaMin
  | DslStepVal
  | DslStepWait
  | DslStepSample
  | DslStepCalc
  | DslStepFun
  | DslStepLog
  | DslStepAlarm
  | DslStepError
  | DslStepSave
  | DslStepUser
  | DslStepResult
  | DslStepOpt
  | DslStepInfo
  | DslStepRepeat
  | DslStepEnd
  | DslStepOut
  | DslStepDialog;

export type DslGoal = { name: string; tasks: DslTask[]; conditions: DslCondition[]; steps?: DslStep[] };

export type DslFunc = { name: string; tasks: DslTask[]; steps?: DslStep[] };

export type DslAst = { scenario: string; goals: DslGoal[]; funcs?: DslFunc[] };

export type ParseResult = { ok: boolean; errors: string[]; ast: DslAst };

export type ExecContext = {
  // Provide current value for a parameter (e.g., Ciśnienie, Przepływ). Return numeric if possible or string.
  getParamValue?: (name: string) => number | string | null | undefined;
  // Execute a single task mapped in DEF (e.g., API call / firmware action)
  runTask?: (fn: string, object?: string) => Promise<void> | void;
  // If true, DSL executor may trigger runTask side-effects when iterating tasks
  executeTasks?: boolean;
};

export type ExecPlanGoal = { kind: 'goal'; name: string };
export type ExecPlanCondition = { kind: 'condition'; condition: DslIfCondition; passed: boolean | null } | { kind: 'else'; else: DslElseCondition };
export type ExecPlanTask = { kind: 'task'; task: DslTask };
export type ExecPlanPump = { kind: 'pump'; value: string; unit?: string; raw?: string };
export type ExecPlanFuncCall = { kind: 'func_call'; name: string; arguments?: string[] };
export type ExecPlanVar = {
  kind: 'var';
  action: 'GET' | 'SET' | 'MAX' | 'MIN' | 'VAL' | 'DELTA_MAX' | 'DELTA_MIN';
  parameter: string;
  value?: string | number;
  unit?: string;
  per?: string;
};
export type ExecPlanWait = { kind: 'wait'; duration: string; unit?: string };
export type ExecPlanMessage = { kind: 'message'; level: 'LOG' | 'ALARM' | 'ERROR'; message: string };
export type ExecPlanSave = { kind: 'save'; parameter: string };
export type ExecPlanUser = { kind: 'user'; action: string; message: string };
export type ExecPlanResult = { kind: 'result'; status: string };
export type ExecPlanOpt = { kind: 'opt'; parameter: string; description: string };
export type ExecPlanRepeat = { kind: 'repeat' };
export type ExecPlanSample = { kind: 'sample'; parameter: string; state: 'START' | 'STOP'; interval?: string };
export type ExecPlanCalc = { kind: 'calc'; result: string; function: string; input: string; value: number | null };
export type ExecPlanFun = { kind: 'fun'; result: string; expression: string; value: number | null };
export type ExecPlanEnd = { kind: 'end' };
export type ExecPlanOut = { kind: 'out'; outType: string; value: string };
export type ExecPlanDialog = { kind: 'dialog'; parameter: string; message: string };
export type ExecPlanInfo = { kind: 'info'; level: string; message: string };
export type ExecPlanStep =
  | ExecPlanGoal
  | ExecPlanCondition
  | ExecPlanTask
  | ExecPlanPump
  | ExecPlanFuncCall
  | ExecPlanVar
  | ExecPlanWait
  | ExecPlanMessage
  | ExecPlanSave
  | ExecPlanUser
  | ExecPlanResult
  | ExecPlanOpt
  | ExecPlanRepeat
  | ExecPlanSample
  | ExecPlanCalc
  | ExecPlanFun
  | ExecPlanEnd
  | ExecPlanOut
  | ExecPlanDialog
  | ExecPlanInfo;

export type ExecResult = { ok: boolean; errors: string[]; ast: DslAst; plan: ExecPlanStep[] };
