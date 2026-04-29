import { z } from 'zod';
import type { DslAst } from './dsl.types';

const NonEmptyString = z.string().min(1);
const OperatorEnum = z.enum(['>', '<', '=', '>=', '<=', '!=']);
const ConnectorEnum = z.enum(['AND', 'OR', 'ELSE']);
const ElseActionEnum = z.enum(['ERROR', 'WARNING', 'INFO', 'GOAL']);
const SampleStateEnum = z.enum(['START', 'STOP']);
const CalcFunctionEnum = z.enum(['AVG', 'SUM', 'MIN', 'MAX', 'COUNT', 'STDDEV']);

export const DslTaskAndSchema = z.object({
  function: NonEmptyString,
  object: z.string().optional(),
});

export const DslTaskSchema = z.object({
  function: NonEmptyString,
  object: z.string().optional(),
  ands: z.array(DslTaskAndSchema).optional(),
});

export const DslIfConditionSchema = z.object({
  type: z.literal('if'),
  parameter: NonEmptyString,
  operator: OperatorEnum,
  value: NonEmptyString,
  unit: z.string().optional(),
  connector: ConnectorEnum.optional(),
  incomingConnector: ConnectorEnum.optional(),
});

export const DslElseConditionSchema = z.object({
  type: z.literal('else'),
  actionType: ElseActionEnum.optional(),
  actionMessage: z.string().optional(),
});

export const DslConditionSchema = z.discriminatedUnion('type', [
  DslIfConditionSchema,
  DslElseConditionSchema,
]);

export const DslStepTaskSchema = DslTaskSchema.extend({ type: z.literal('task') });
export const DslStepPumpSchema = z.object({
  type: z.literal('pump'),
  value: NonEmptyString,
  unit: z.string().optional(),
  raw: NonEmptyString,
});
export const DslStepFuncCallSchema = z.object({
  type: z.literal('func_call'),
  name: NonEmptyString,
  arguments: z.array(NonEmptyString).optional(),
});
export const DslStepGetSchema = z.object({
  type: z.literal('get'),
  parameter: NonEmptyString,
  unit: z.string().optional(),
});
export const DslStepSetSchema = z.object({
  type: z.literal('set'),
  parameter: NonEmptyString,
  value: NonEmptyString,
  unit: z.string().optional(),
});
export const DslStepMaxSchema = z.object({
  type: z.literal('max'),
  parameter: NonEmptyString,
  value: NonEmptyString,
  unit: z.string().optional(),
});
export const DslStepMinSchema = z.object({
  type: z.literal('min'),
  parameter: NonEmptyString,
  value: NonEmptyString,
  unit: z.string().optional(),
});
export const DslStepDeltaMaxSchema = z.object({
  type: z.literal('delta_max'),
  parameter: NonEmptyString,
  value: NonEmptyString,
  unit: z.string().optional(),
  per: z.string().optional(),
});
export const DslStepDeltaMinSchema = z.object({
  type: z.literal('delta_min'),
  parameter: NonEmptyString,
  value: NonEmptyString,
  unit: z.string().optional(),
  per: z.string().optional(),
});
export const DslStepValSchema = z.object({
  type: z.literal('val'),
  parameter: NonEmptyString,
  unit: z.string().optional(),
});
export const DslStepWaitSchema = z.object({
  type: z.literal('wait'),
  duration: NonEmptyString,
  unit: z.string().optional(),
});
export const DslStepSampleSchema = z.object({
  type: z.literal('sample'),
  parameter: NonEmptyString,
  state: SampleStateEnum,
  interval: z.string().optional(),
});
export const DslStepCalcSchema = z.object({
  type: z.literal('calc'),
  result: NonEmptyString,
  function: CalcFunctionEnum,
  input: NonEmptyString,
});
export const DslStepFunSchema = z.object({
  type: z.literal('fun'),
  result: NonEmptyString,
  expression: NonEmptyString,
  variables: z.array(NonEmptyString).optional(),
});
export const DslStepLogSchema = z.object({
  type: z.literal('log'),
  message: z.string(),
});
export const DslStepAlarmSchema = z.object({
  type: z.literal('alarm'),
  message: z.string(),
});
export const DslStepErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});
export const DslStepSaveSchema = z.object({
  type: z.literal('save'),
  parameter: NonEmptyString,
});
export const DslStepUserSchema = z.object({
  type: z.literal('user'),
  action: NonEmptyString,
  message: z.string(),
});
export const DslStepResultSchema = z.object({
  type: z.literal('result'),
  status: NonEmptyString,
});
export const DslStepOptSchema = z.object({
  type: z.literal('opt'),
  parameter: NonEmptyString,
  description: z.string(),
});
export const DslStepInfoSchema = z.object({
  type: z.literal('info'),
  level: NonEmptyString,
  message: z.string(),
});
export const DslStepRepeatSchema = z.object({
  type: z.literal('repeat'),
});
export const DslStepEndSchema = z.object({
  type: z.literal('end'),
});
export const DslStepOutSchema = z.object({
  type: z.literal('out'),
  outType: NonEmptyString,
  value: z.string(),
});
export const DslStepDialogSchema = z.object({
  type: z.literal('dialog'),
  parameter: NonEmptyString,
  message: z.string(),
});

export const DslStepSchema = z.discriminatedUnion('type', [
  DslStepTaskSchema,
  DslStepPumpSchema,
  DslStepFuncCallSchema,
  DslIfConditionSchema,
  DslElseConditionSchema,
  DslStepGetSchema,
  DslStepSetSchema,
  DslStepMaxSchema,
  DslStepMinSchema,
  DslStepDeltaMaxSchema,
  DslStepDeltaMinSchema,
  DslStepValSchema,
  DslStepWaitSchema,
  DslStepSampleSchema,
  DslStepCalcSchema,
  DslStepFunSchema,
  DslStepLogSchema,
  DslStepAlarmSchema,
  DslStepErrorSchema,
  DslStepSaveSchema,
  DslStepUserSchema,
  DslStepResultSchema,
  DslStepOptSchema,
  DslStepInfoSchema,
  DslStepRepeatSchema,
  DslStepEndSchema,
  DslStepOutSchema,
  DslStepDialogSchema,
]);

export const DslGoalSchema = z.object({
  name: NonEmptyString,
  tasks: z.array(DslTaskSchema),
  conditions: z.array(DslConditionSchema),
  steps: z.array(DslStepSchema).optional(),
});

export const DslFuncSchema = z.object({
  name: NonEmptyString,
  tasks: z.array(DslTaskSchema),
  steps: z.array(DslStepSchema).optional(),
});

export const DslAstSchema = z.object({
  scenario: NonEmptyString,
  goals: z.array(DslGoalSchema),
  funcs: z.array(DslFuncSchema).optional(),
}).superRefine((value, ctx) => {
  if (value.goals.length > 0 || (value.funcs?.length ?? 0) > 0) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'At least one goal or func is required',
    path: ['goals'],
  });
});

export function validateAst(ast: unknown) {
  const parsed = DslAstSchema.safeParse(ast);
  return {
    ok: parsed.success,
    errors: parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    ast: parsed.success ? (parsed.data as DslAst) : null,
  };
}

const STRING_JSON_SCHEMA = { type: 'string' } as const;
const NON_EMPTY_STRING_JSON_SCHEMA = { type: 'string', minLength: 1 } as const;
const OPERATOR_JSON_SCHEMA = { enum: ['>', '<', '=', '>=', '<=', '!='] } as const;
const CONNECTOR_JSON_SCHEMA = { enum: ['AND', 'OR', 'ELSE'] } as const;
const ELSE_ACTION_JSON_SCHEMA = { enum: ['ERROR', 'WARNING', 'INFO', 'GOAL'] } as const;
const SAMPLE_STATE_JSON_SCHEMA = { enum: ['START', 'STOP'] } as const;
const CALC_FUNCTION_JSON_SCHEMA = { enum: ['AVG', 'SUM', 'MIN', 'MAX', 'COUNT', 'STDDEV'] } as const;

function createJsonObjectSchema(required: string[], properties: Record<string, unknown>) {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  };
}

function createTypedJsonSchema(type: string, required: string[], properties: Record<string, unknown>) {
  return createJsonObjectSchema(['type', ...required], {
    type: { const: type },
    ...properties,
  });
}

const DslTaskAndJsonSchema = createJsonObjectSchema(['function'], {
  function: NON_EMPTY_STRING_JSON_SCHEMA,
  object: STRING_JSON_SCHEMA,
});

const DslTaskJsonSchema = createJsonObjectSchema(['function'], {
  function: NON_EMPTY_STRING_JSON_SCHEMA,
  object: STRING_JSON_SCHEMA,
  ands: {
    type: 'array',
    items: DslTaskAndJsonSchema,
  },
});

const DslIfConditionJsonSchema = createTypedJsonSchema('if', ['parameter', 'operator', 'value'], {
  parameter: NON_EMPTY_STRING_JSON_SCHEMA,
  operator: OPERATOR_JSON_SCHEMA,
  value: NON_EMPTY_STRING_JSON_SCHEMA,
  unit: STRING_JSON_SCHEMA,
  connector: CONNECTOR_JSON_SCHEMA,
  incomingConnector: CONNECTOR_JSON_SCHEMA,
});

const DslElseConditionJsonSchema = createTypedJsonSchema('else', [], {
  actionType: ELSE_ACTION_JSON_SCHEMA,
  actionMessage: STRING_JSON_SCHEMA,
});

const DslStepTaskJsonSchema = createTypedJsonSchema('task', ['function'], {
  function: NON_EMPTY_STRING_JSON_SCHEMA,
  object: STRING_JSON_SCHEMA,
  ands: {
    type: 'array',
    items: DslTaskAndJsonSchema,
  },
});

const DslStepJsonSchemas = [
  DslStepTaskJsonSchema,
  createTypedJsonSchema('pump', ['value', 'raw'], {
    value: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
    raw: NON_EMPTY_STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('func_call', ['name'], {
    name: NON_EMPTY_STRING_JSON_SCHEMA,
    arguments: {
      type: 'array',
      items: NON_EMPTY_STRING_JSON_SCHEMA,
    },
  }),
  DslIfConditionJsonSchema,
  DslElseConditionJsonSchema,
  createTypedJsonSchema('get', ['parameter'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('set', ['parameter', 'value'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    value: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('max', ['parameter', 'value'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    value: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('min', ['parameter', 'value'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    value: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('delta_max', ['parameter', 'value'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    value: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
    per: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('delta_min', ['parameter', 'value'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    value: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
    per: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('val', ['parameter'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('wait', ['duration'], {
    duration: NON_EMPTY_STRING_JSON_SCHEMA,
    unit: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('sample', ['parameter', 'state'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    state: SAMPLE_STATE_JSON_SCHEMA,
    interval: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('calc', ['result', 'function', 'input'], {
    result: NON_EMPTY_STRING_JSON_SCHEMA,
    function: CALC_FUNCTION_JSON_SCHEMA,
    input: NON_EMPTY_STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('fun', ['result', 'expression'], {
    result: NON_EMPTY_STRING_JSON_SCHEMA,
    expression: NON_EMPTY_STRING_JSON_SCHEMA,
    variables: {
      type: 'array',
      items: NON_EMPTY_STRING_JSON_SCHEMA,
    },
  }),
  createTypedJsonSchema('log', ['message'], {
    message: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('alarm', ['message'], {
    message: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('error', ['message'], {
    message: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('save', ['parameter'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('user', ['action', 'message'], {
    action: NON_EMPTY_STRING_JSON_SCHEMA,
    message: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('result', ['status'], {
    status: NON_EMPTY_STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('opt', ['parameter', 'description'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    description: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('info', ['level', 'message'], {
    level: NON_EMPTY_STRING_JSON_SCHEMA,
    message: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('repeat', [], {}),
  createTypedJsonSchema('end', [], {}),
  createTypedJsonSchema('out', ['outType', 'value'], {
    outType: NON_EMPTY_STRING_JSON_SCHEMA,
    value: STRING_JSON_SCHEMA,
  }),
  createTypedJsonSchema('dialog', ['parameter', 'message'], {
    parameter: NON_EMPTY_STRING_JSON_SCHEMA,
    message: STRING_JSON_SCHEMA,
  }),
];

const DslGoalJsonSchema = createJsonObjectSchema(['name', 'tasks', 'conditions'], {
  name: NON_EMPTY_STRING_JSON_SCHEMA,
  tasks: {
    type: 'array',
    items: DslTaskJsonSchema,
  },
  conditions: {
    type: 'array',
    items: {
      anyOf: [DslIfConditionJsonSchema, DslElseConditionJsonSchema],
    },
  },
  steps: {
    type: 'array',
    items: {
      anyOf: DslStepJsonSchemas,
    },
  },
});

const DslFuncJsonSchema = createJsonObjectSchema(['name', 'tasks'], {
  name: NON_EMPTY_STRING_JSON_SCHEMA,
  tasks: {
    type: 'array',
    items: DslTaskJsonSchema,
  },
  steps: {
    type: 'array',
    items: {
      anyOf: DslStepJsonSchemas,
    },
  },
});

export const dslJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://example.com/dsl.schema.json',
  type: 'object',
  required: ['scenario', 'goals'],
  properties: {
    scenario: NON_EMPTY_STRING_JSON_SCHEMA,
    goals: {
      type: 'array',
      items: DslGoalJsonSchema,
    },
    funcs: {
      type: 'array',
      items: DslFuncJsonSchema,
    },
  },
  anyOf: [
    {
      properties: {
        goals: {
          type: 'array',
          minItems: 1,
        },
      },
    },
    {
      required: ['funcs'],
      properties: {
        funcs: {
          type: 'array',
          minItems: 1,
        },
      },
    },
  ],
  additionalProperties: false,
};

export function getJsonSchema() {
  return dslJsonSchema;
}
