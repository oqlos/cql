/**
 * Hardware MAP resolution for DSL/OQL tasks and FUNC implementations.
 * Port of connect-scenario `oql_mapped_task_mapping.py` + oqlos `_resolve_func_steps`.
 */

import type { ExecPlanStep } from './dsl.types';
import { executeDsl } from './dsl.exec';

export type HardwareMap = Record<string, unknown>;

export type MappingResolveContext = {
  environment?: string | null;
  usageMode?: string | null;
};

const MOTOR_OBJECTS = new Set(['motor2', 'motor-tic249', 'tic249']);

const PERIPHERAL_ALIASES: Record<string, string> = {
  dri0050: 'motor-dri0050',
  motor_dri0050: 'motor-dri0050',
  pump: 'motor-dri0050',
  tic249: 'motor-tic249',
  motor_tic249: 'motor-tic249',
  stepper: 'motor-tic249',
};

const TIC249_DIRECT: Record<string, [string, Record<string, unknown>]> = {
  status: ['status', {}],
  position: ['position', {}],
  limits: ['limits', {}],
  stop: ['stop', {}],
  emergency_stop: ['emergency_stop', {}],
  'emergency-stop': ['emergency_stop', {}],
  motor_enable: ['motor_enable', {}],
  'motor-enable': ['motor_enable', {}],
  energize: ['energize', {}],
  motor_disable: ['motor_disable', {}],
  'motor-disable': ['motor_disable', {}],
  deenergize: ['deenergize', {}],
  'de-energize': ['deenergize', {}],
  standby: ['standby', {}],
  home: ['home', {}],
  go_home: ['go_home', {}],
  'go-home': ['go_home', {}],
  home_forward: ['home_forward', {}],
  'home-forward': ['home_forward', {}],
  home_reverse: ['home_reverse', {}],
  'home-reverse': ['home_reverse', {}],
  reciprocating_motion: ['reciprocating_motion', {}],
  'reciprocating-motion': ['reciprocating_motion', {}],
  reciprocate: ['reciprocating_motion', {}],
  lung_stop: ['lung_stop', {}],
  'lung-stop': ['lung_stop', {}],
};

function normToken(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

export function normalizePeripheralId(value: string): string {
  const token = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  return PERIPHERAL_ALIASES[token] ?? token;
}

function flattenProfileVariants(mapping: Record<string, unknown>): Record<string, unknown>[] {
  const profiles = mapping.profiles;
  if (Array.isArray(profiles) && profiles.length) {
    const base = Object.fromEntries(Object.entries(mapping).filter(([k]) => k !== 'profiles'));
    return profiles.filter((p) => p && typeof p === 'object').map((p) => ({ ...base, ...(p as object) }));
  }
  return [mapping];
}

function pickVariant(
  mapping: Record<string, unknown>,
  environment?: string | null,
  usageMode?: string | null,
): Record<string, unknown> | null {
  const requestedEnv = normToken(environment);
  const requestedUsage = normToken(usageMode);
  let best: Record<string, unknown> | null = null;
  let bestScore = -1;
  for (const candidate of flattenProfileVariants(mapping)) {
    const candEnv = normToken(candidate.environment);
    const candUsage = normToken(candidate.usageMode ?? candidate.usage_mode);
    if (requestedEnv && candEnv && candEnv !== requestedEnv) continue;
    if (requestedUsage && candUsage && candUsage !== requestedUsage) continue;
    let score = 0;
    if (requestedEnv) score += candEnv === requestedEnv ? 2 : 1;
    if (requestedUsage) score += candUsage === requestedUsage ? 2 : 1;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function lookupRawMapping(
  hardwareMap: HardwareMap,
  functionName: string,
  objectName: string,
): { objectActions: Record<string, unknown>; rawMapping: Record<string, unknown> | null; error: string } {
  const objectActions = hardwareMap.objectActionMap;
  const actions = hardwareMap.actions;
  if (!objectActions || typeof objectActions !== 'object' || Array.isArray(objectActions)) {
    return { objectActions: {}, rawMapping: null, error: 'hardware_map must contain objectActionMap and actions objects' };
  }
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
    return { objectActions: {}, rawMapping: null, error: 'hardware_map must contain objectActionMap and actions objects' };
  }
  const objMap = objectActions as Record<string, unknown>;
  const actMap = actions as Record<string, unknown>;
  let rawMapping: Record<string, unknown> | null = null;
  if (objectName) {
    const objectCfg = objMap[objectName];
    if (objectCfg && typeof objectCfg === 'object' && !Array.isArray(objectCfg)) {
      rawMapping = (objectCfg as Record<string, unknown>)[functionName] as Record<string, unknown> | undefined ?? null;
    }
  } else {
    rawMapping = actMap[functionName] as Record<string, unknown> | undefined ?? null;
  }
  return { objectActions: objMap, rawMapping, error: '' };
}

function proxyShell(handlerFunction: string, command: string, commandArgs: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: 'api',
    service: 'hardware-proxy',
    environment: 'lab',
    usageMode: 'diagnostic',
    endpoint: '/api/v3/hardware/diagnostic-command',
    url: '/api/v3/hardware/diagnostic-command',
    hardwareAddress: 'usb://rack-a/motor-tic249',
    handlerRuntime: 'python',
    handlerFunction,
    method: 'POST',
    body: { peripheral_id: 'motor-tic249', command },
    args: commandArgs,
  };
}

export function resolveBuiltinMotorTask(
  objectName: string,
  functionName: string,
  task: Record<string, unknown>,
): Record<string, unknown> | null {
  const objectKey = normToken(objectName).replace(/_/g, '-');
  const functionKey = normToken(functionName);
  if (!MOTOR_OBJECTS.has(objectKey)) return null;

  const rawArgs = task.args;
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
    ? (rawArgs as Record<string, unknown>)
    : {};

  if (functionKey in TIC249_DIRECT) {
    const [command, defaults] = TIC249_DIRECT[functionKey];
    return proxyShell(`handle_motor2_${command}`, command, { ...defaults, ...args });
  }

  if (functionKey !== 'left' && functionKey !== 'right') return null;

  const steps = Math.max(1, Number(args.steps ?? 1000) || 1000);
  const offset = functionKey === 'left' ? -steps : steps;
  const commandArgs: Record<string, unknown> = { offset, steps, direction: functionKey };
  if (args.speed !== undefined) commandArgs.speed = Math.max(1, Number(args.speed) || 1);
  if (args.speed_unit !== undefined) commandArgs.speed_unit = String(args.speed_unit);
  if (args.acceleration !== undefined) commandArgs.acceleration = Math.max(0, Math.min(100, Number(args.acceleration) || 0));
  if (args.acceleration_unit !== undefined) commandArgs.acceleration_unit = String(args.acceleration_unit);
  return proxyShell('handle_motor2_move_relative', 'move_relative', commandArgs);
}

function tic249RuntimeArgsFromConfig(runtimeConfig: Record<string, unknown>): Record<string, unknown> {
  let source: Record<string, unknown> | null = null;
  const motor2 = runtimeConfig.motor2;
  if (motor2 && typeof motor2 === 'object' && !Array.isArray(motor2)) {
    source = motor2 as Record<string, unknown>;
  } else {
    for (const alias of MOTOR_OBJECTS) {
      const candidate = runtimeConfig[alias];
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        source = candidate as Record<string, unknown>;
        break;
      }
    }
  }
  if (!source) return {};
  const out: Record<string, unknown> = {};
  if (source.maxStepsPerSecond !== undefined) out.max_steps_per_second = source.maxStepsPerSecond;
  if (source.defaultSpeedStepsPerSecond !== undefined) out.default_speed_steps_per_second = source.defaultSpeedStepsPerSecond;
  if (source.speedUnit !== undefined) out.speed_unit = source.speedUnit;
  if (source.strokeSteps !== undefined) out.steps = source.strokeSteps;
  if (source.cycleVolumeLiters !== undefined) out.cycle_volume_liters = source.cycleVolumeLiters;
  if (source.accelerationPercentPerSecond !== undefined) out.acceleration = source.accelerationPercentPerSecond;
  if (source.accelerationUnit !== undefined) out.acceleration_unit = source.accelerationUnit;
  if (source.limitMode !== undefined) out.limit_mode = source.limitMode;
  if (source.startDirection !== undefined) out.start_direction = source.startDirection;
  return out;
}

function applyRuntimeConfigToMapping(
  hardwareMap: HardwareMap,
  selectedMapping: Record<string, unknown>,
): Record<string, unknown> {
  const body = selectedMapping.body;
  const bodyDict = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const peripheralId = bodyDict.peripheral_id ?? selectedMapping.peripheral_id;
  if (normalizePeripheralId(String(peripheralId || '')) !== 'motor-tic249') return selectedMapping;

  const runtimeConfig = hardwareMap.runtimeConfig;
  const runtimeArgs = runtimeConfig && typeof runtimeConfig === 'object' && !Array.isArray(runtimeConfig)
    ? tic249RuntimeArgsFromConfig(runtimeConfig as Record<string, unknown>)
    : {};
  if (!Object.keys(runtimeArgs).length) return selectedMapping;

  const merged = { ...selectedMapping };
  const args = {
    ...(merged.args && typeof merged.args === 'object' && !Array.isArray(merged.args) ? merged.args as Record<string, unknown> : {}),
  };
  for (const [key, value] of Object.entries(runtimeArgs)) {
    if (args[key] === undefined) args[key] = value;
  }
  merged.args = args;
  return merged;
}

function applyMoveRelativeDirection(
  args: Record<string, unknown>,
  taskArgs: Record<string, unknown>,
  task: Record<string, unknown>,
): Record<string, unknown> {
  if (args.steps === undefined) return args;
  const direction = normToken(args.direction ?? task.function);
  const steps = Math.abs(Number(args.steps) || 0);
  if (steps <= 0) return args;
  const result = { ...args, steps };
  if (taskArgs.offset === undefined) {
    result.offset = ['left', 'reverse', 'backward'].includes(direction) ? -steps : steps;
  }
  return result;
}

function applyTaskArgsToMapping(
  task: Record<string, unknown>,
  selectedMapping: Record<string, unknown>,
): Record<string, unknown> {
  const body = selectedMapping.body;
  const bodyDict = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const peripheralId = bodyDict.peripheral_id ?? selectedMapping.peripheral_id;
  if (normalizePeripheralId(String(peripheralId || '')) !== 'motor-tic249') return selectedMapping;

  const taskArgs = task.args;
  if (!taskArgs || typeof taskArgs !== 'object' || Array.isArray(taskArgs)) return selectedMapping;

  const merged = { ...selectedMapping };
  const args = {
    ...(merged.args && typeof merged.args === 'object' && !Array.isArray(merged.args) ? merged.args as Record<string, unknown> : {}),
    ...(taskArgs as Record<string, unknown>),
  };
  const command = bodyDict.command ?? merged.command;
  if (command === 'move_relative') {
    merged.args = applyMoveRelativeDirection(args, taskArgs as Record<string, unknown>, task);
  } else {
    merged.args = args;
  }
  return merged;
}

export function resolveTaskMapping(
  hardwareMap: HardwareMap,
  task: Record<string, unknown>,
  context: MappingResolveContext = {},
): { ok: boolean; error?: string; mapping?: Record<string, unknown> } {
  const functionName = String(task.function ?? '').trim();
  const objectName = String(task.object ?? '').trim();
  const { objectActions, rawMapping, error } = lookupRawMapping(hardwareMap, functionName, objectName);
  if (error) return { ok: false, error };

  if (rawMapping && typeof rawMapping === 'object') {
    const selected = pickVariant(rawMapping, context.environment, context.usageMode);
    if (!selected) {
      return {
        ok: false,
        error: `No mapping variant for task function='${functionName}' object='${objectName || '*'}' context env='${context.environment || '*'}' usage='${context.usageMode || '*'}'`,
      };
    }
    let mapping = applyRuntimeConfigToMapping(hardwareMap, selected);
    mapping = applyTaskArgsToMapping(task, mapping);
    return { ok: true, mapping };
  }

  const builtin = resolveBuiltinMotorTask(objectName, functionName, task);
  if (builtin) {
    return { ok: true, mapping: applyTaskArgsToMapping(task, builtin) };
  }

  if (objectName) {
    if (!objectActions[objectName] || typeof objectActions[objectName] !== 'object') {
      return { ok: false, error: `Object '${objectName}' not found in objectActionMap` };
    }
    return { ok: false, error: `Action '${functionName}' not found for object '${objectName}'` };
  }
  return { ok: false, error: `Global action '${functionName}' not found in actions map` };
}

export function resolveFuncSteps(
  hardwareMap: HardwareMap,
  funcName: string,
  context: MappingResolveContext = {},
): Record<string, unknown> {
  const funcs = hardwareMap.funcImplementations;
  if (!funcs || typeof funcs !== 'object' || Array.isArray(funcs)) {
    return { ok: false, error: 'hardware_map.funcImplementations must be an object' };
  }
  const func = (funcs as Record<string, unknown>)[funcName];
  if (!func || typeof func !== 'object' || Array.isArray(func)) {
    return { ok: false, error: `FUNC '${funcName}' not found` };
  }

  const objectMap = hardwareMap.objectActionMap && typeof hardwareMap.objectActionMap === 'object' && !Array.isArray(hardwareMap.objectActionMap)
    ? (hardwareMap.objectActionMap as Record<string, unknown>)
    : {};
  const actions = hardwareMap.actions && typeof hardwareMap.actions === 'object' && !Array.isArray(hardwareMap.actions)
    ? (hardwareMap.actions as Record<string, unknown>)
    : {};

  const resolvedSteps: Record<string, unknown>[] = [];
  const steps = (func as Record<string, unknown>).steps;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) continue;
      const stepObj = step as Record<string, unknown>;
      const objectName = stepObj.object;
      const actionName = stepObj.action;
      let binding: Record<string, unknown> | null = null;
      if (objectName && objectMap[objectName] && typeof objectMap[objectName] === 'object') {
        binding = ((objectMap[objectName] as Record<string, unknown>)[String(actionName ?? '')] as Record<string, unknown>) ?? null;
      }
      if (binding === null && actionName) {
        binding = (actions[String(actionName)] as Record<string, unknown>) ?? null;
      }
      resolvedSteps.push({
        step: stepObj,
        binding: binding && typeof binding === 'object' ? binding : null,
        resolved: Boolean(binding && typeof binding === 'object'),
      });
    }
  }

  return {
    ok: true,
    func_name: funcName,
    environment: context.environment ?? null,
    usage_mode: context.usageMode ?? null,
    implementation: func,
    steps: resolvedSteps,
  };
}

export function applyMappingToExecPlan(
  plan: ExecPlanStep[],
  hardwareMap: HardwareMap,
  context: MappingResolveContext = {},
): Array<ExecPlanStep & { mapping?: Record<string, unknown>; mappingError?: string }> {
  return plan.map((step) => {
    if (step.kind !== 'task' || !step.task) return step;
    const task = step.task as Record<string, unknown>;
    const resolved = resolveTaskMapping(hardwareMap, task, context);
    if (!resolved.ok) {
      return { ...step, mappingError: resolved.error };
    }
    return { ...step, mapping: resolved.mapping };
  });
}

export function executeMappedDsl(
  text: string,
  hardwareMap: HardwareMap,
  context: MappingResolveContext & { execContext?: Record<string, unknown> } = {},
) {
  const exec = executeDsl(text, context.execContext as never);
  const mappedPlan = applyMappingToExecPlan(exec.plan ?? [], hardwareMap, context);
  return { ...exec, mappedPlan };
}

export function extractCommandPayload(mapping: Record<string, unknown>): {
  peripheralId: string | null;
  command: string | null;
  args: Record<string, unknown> | null;
} {
  const body = mapping.body;
  const bodyDict = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const peripheralId = (bodyDict.peripheral_id ?? mapping.peripheral_id) as string | undefined;
  const command = (bodyDict.command ?? mapping.command) as string | undefined;
  let args = mapping.args;
  if ((args === undefined || args === null) && Object.keys(bodyDict).length) {
    args = Object.fromEntries(Object.entries(bodyDict).filter(([k]) => k !== 'peripheral_id' && k !== 'command'));
  }
  return {
    peripheralId: peripheralId ? String(peripheralId) : null,
    command: command ? String(command) : null,
    args: args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : null,
  };
}
