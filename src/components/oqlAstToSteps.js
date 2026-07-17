/**
 * Map @semcod/oqlts parseOql AST → UI step model (connect-scenario renderer).
 * Single source of truth: grammar lives in packages/oqlts only.
 */

export function applyGoalMeta(goal, step) {
  if (step._goalMeta === 'NAME') {
    goal.name = step.value;
    return;
  }
  if (step._goalMeta === 'VAL') {
    goal.val = step.parameter;
    if (step.unit) goal.valUnit = step.unit;
    return;
  }
  if (step._goalMeta === 'MIN') {
    goal.min = step.value;
    if (step.unit) goal.minUnit = step.unit;
    return;
  }
  if (step._goalMeta === 'MAX') {
    goal.max = step.value;
    if (step.unit) goal.maxUnit = step.unit;
  }
}

export function attachVerdictToChecks(goal) {
  const byParam = {};
  for (const step of goal.steps) {
    if (step.type === 'PASS' && step.parameter) {
      byParam[step.parameter] = byParam[step.parameter] || {};
      byParam[step.parameter].correctMsg = step.message;
    }
    if (step.type === 'FAIL' && step.parameter) {
      byParam[step.parameter] = byParam[step.parameter] || {};
      byParam[step.parameter].errorMsg = step.message;
    }
  }
  for (const step of goal.steps) {
    if (step.type !== 'CHECK' || !step.parameter || !byParam[step.parameter]) continue;
    step.correctMsg = step.correctMsg || byParam[step.parameter].correctMsg;
    step.errorMsg = step.errorMsg || byParam[step.parameter].errorMsg;
  }
}

export function foldTaskDialogSteps(steps) {
  const out = [];
  let dialog = null;

  const flushDialog = () => {
    if (!dialog) return;
    out.push({
      type: 'DIALOG',
      raw: dialog.raw,
      title: dialog.title,
      expectedVal: dialog.expectedVal,
      passMsg: dialog.passMsg,
      failMsg: dialog.failMsg,
    });
    dialog = null;
  };

  for (const step of steps) {
    if (step.type === 'TASK_DIALOG_LINE') {
      if (!dialog) dialog = { raw: step.raw, title: '', expectedVal: '', passMsg: '', failMsg: '' };
      dialog.raw = dialog.raw ? `${dialog.raw}\n${step.raw}` : step.raw;
      if (step.field === 'title') dialog.title = step.value;
      if (step.field === 'val') dialog.expectedVal = step.value;
      if (step.field === 'pass') dialog.passMsg = step.value;
      if (step.field === 'fail') dialog.failMsg = step.value;
      continue;
    }
    flushDialog();
    out.push(step);
  }
  flushDialog();
  return out;
}

export function finalizeGoal(goal) {
  goal.steps = foldTaskDialogSteps(goal.steps);
  attachVerdictToChecks(goal);
}

function attachMessageToPrevious(steps, step) {
  const prev = steps[steps.length - 1];
  if (!prev || (prev.type !== 'CHECK' && prev.type !== 'IF')) return false;
  if (step.type === 'CORRECT' || step.type === 'PASS') {
    prev.correctMsg = step.message;
  } else {
    prev.errorMsg = step.message;
  }
  return true;
}

function mapIfStep(cmd) {
  const args = cmd.args || {};
  const step = {
    type: 'CHECK',
    raw: cmd.raw,
    parameter: String(args.param ?? ''),
    condition: String(args.operator ?? ''),
    value: String(args.value ?? ''),
    _legacy: 'IF',
  };
  const elseClause = args.else;
  if (elseClause && typeof elseClause === 'object') {
    if (elseClause.action === 'ERROR') step.errorMsg = String(elseClause.message ?? '');
    else step.correctMsg = String(elseClause.message ?? '');
  }
  if (args.correct_msg) step.correctMsg = String(args.correct_msg);
  if (args.error_msg) step.errorMsg = String(args.error_msg);
  return step;
}

function mapCheckStep(cmd) {
  const args = cmd.args || {};
  return {
    type: 'CHECK',
    raw: cmd.raw,
    parameter: String(args.sensor ?? ''),
    min: args.min != null ? String(args.min) : undefined,
    max: args.max != null ? String(args.max) : undefined,
    unit: args.unit || undefined,
    correctMsg: args.correct_msg ? String(args.correct_msg) : undefined,
    errorMsg: args.error_msg ? String(args.error_msg) : undefined,
  };
}

/** @param {import('@semcod/oqlts').OqlCommand} cmd */
export function cmdToUiStep(cmd) {
  const name = String(cmd.cmd || '').toUpperCase();
  const args = cmd.args || {};
  const raw = cmd.raw;

  switch (name) {
    case 'SET': {
      const target = String(args.target ?? '');
      const upper = target.toUpperCase();
      if (upper === 'NAME') return null;
      if (upper === 'VAL') {
        return { type: 'SET', _goalMeta: 'VAL', parameter: String(args.value ?? ''), unit: args.unit, raw };
      }
      if (upper === 'MIN') {
        return { type: 'SET', _goalMeta: 'MIN', value: String(args.value ?? ''), unit: args.unit, raw };
      }
      if (upper === 'MAX') {
        return { type: 'SET', _goalMeta: 'MAX', value: String(args.value ?? ''), unit: args.unit, raw };
      }
      return {
        type: 'SET',
        parameter: target,
        value: String(args.value ?? ''),
        unit: args.unit,
        raw,
      };
    }
    case 'WAIT':
      return {
        type: 'WAIT',
        value: String(args.value ?? args.raw ?? ''),
        unit: args.unit || 'ms',
        raw,
      };
    case 'MIN':
      return {
        type: 'CHECK',
        parameter: String(args.sensor ?? ''),
        min: String(args.value ?? ''),
        unit: args.unit || undefined,
        raw,
        _legacy: 'MIN',
      };
    case 'MAX':
      return {
        type: 'CHECK',
        parameter: String(args.sensor ?? ''),
        max: String(args.value ?? ''),
        unit: args.unit || undefined,
        raw,
        _legacy: 'MAX',
      };
    case 'RANGE':
    case 'CHECK':
      return mapCheckStep(cmd);
    case 'IF':
      return mapIfStep(cmd);
    case 'PASS': {
      if (args.sensor) {
        return { type: 'PASS', parameter: String(args.sensor), message: String(args.message ?? ''), raw };
      }
      return { type: 'PASS', message: String(args.message ?? ''), raw };
    }
    case 'FAIL': {
      const step = { type: 'FAIL', message: String(args.message ?? ''), raw };
      if (args.sensor) step.parameter = String(args.sensor);
      if (args.goto) step.goto = String(args.goto);
      if (args.retry != null) step.retry = args.retry;
      return step;
    }
    case 'CORRECT':
      return { type: 'CORRECT', message: String(args.message ?? ''), raw };
    case 'ERROR':
      return { type: 'ERROR', message: String(args.message ?? ''), raw };
    case 'TASK':
      return {
        type: 'TASK_DIALOG_LINE',
        field: String(args.field ?? 'title'),
        value: String(args.value ?? ''),
        raw,
      };
    case 'LOG':
      return { type: 'LOG', message: String(args.message ?? ''), raw };
    case 'GET':
    case 'READ':
      return { type: 'SET', parameter: String(args.sensor ?? ''), raw, _read: name };
    case 'VAL':
      return { type: 'SET', parameter: String(args.param ?? ''), unit: args.unit, raw, _read: 'VAL' };
    case 'SAVE':
      return { type: 'SAVE', parameter: String(args.label ?? ''), raw };
    case 'SAMPLE':
      return {
        type: 'SAMPLE',
        parameter: String(args.sensor ?? ''),
        action: String(args.direction ?? ''),
        interval: args.interval_ms != null ? String(args.interval_ms) : undefined,
        raw,
      };
    case 'FUNC':
      return {
        type: 'FUNC_CALL',
        funcName: String(args.name ?? args.fn ?? ''),
        args: Array.isArray(args.args) ? args.args.map(String) : [],
        raw,
      };
    default:
      return { type: 'OTHER', raw, cmd: name };
  }
}

function applyGoalCommand(goal, cmd) {
  const step = cmdToUiStep(cmd);
  if (!step) return;

  if (step.type === 'SET' && step._goalMeta) {
    applyGoalMeta(goal, step);
    return;
  }

  if ((step.type === 'CORRECT' || step.type === 'ERROR') && attachMessageToPrevious(goal.steps, step)) {
    return;
  }
  if ((step.type === 'PASS' || step.type === 'FAIL') && !step.parameter && attachMessageToPrevious(goal.steps, step)) {
    return;
  }

  goal.steps.push(step);
}

/** @param {import('@semcod/oqlts').OqlParseResult} parseResult */
export function astToSteps(parseResult) {
  const { scenario } = parseResult;
  const result = {
    scenarioName: scenario.title || scenario.meta.scenario || '',
    deviceType: scenario.meta.device_type || '',
    deviceModel: scenario.meta.device_model || '',
    manufacturer: scenario.meta.manufacturer || '',
    goals: [],
    funcs: [],
  };

  for (const goal of scenario.goals) {
    const uiGoal = { name: goal.name, steps: [] };
    for (const cmd of goal.steps) {
      applyGoalCommand(uiGoal, cmd);
    }
    finalizeGoal(uiGoal);
    result.goals.push(uiGoal);
  }

  for (const block of scenario.blocks) {
    if (block.type !== 'FUNC') continue;
    const func = { name: block.name, steps: [] };
    for (const cmd of block.cmds) {
      const step = cmdToUiStep(cmd);
      if (step) func.steps.push(step);
    }
    result.funcs.push(func);
  }

  return result;
}
