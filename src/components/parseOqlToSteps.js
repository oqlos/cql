/**
 * parseOqlToSteps.js
 * Parses OQL scenario code into structured goals/steps for the graphical renderer.
 */

/**
 * Parse an OQL scenario string into a structured object.
 * @param {string} code - Raw OQL scenario code
 * @returns {{ scenarioName: string, deviceType: string, deviceModel: string, manufacturer: string, goals: Array<Goal> }}
 */
export function parseOqlToSteps(code) {
  const lines = (code || '').split('\n');
  const result = {
    scenarioName: '',
    deviceType: '',
    deviceModel: '',
    manufacturer: '',
    goals: [],
    funcs: [],
  };

  let currentGoal = null;
  let currentFunc = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Comments become comment steps inside a goal/func
    if (line.startsWith('#')) {
      if (currentGoal) {
        currentGoal.steps.push({ type: 'COMMENT', raw: line, text: line.replace(/^#\s*/, '') });
      } else if (currentFunc) {
        currentFunc.steps.push({ type: 'COMMENT', raw: line, text: line.replace(/^#\s*/, '') });
      }
      continue;
    }

    // Header fields
    const scenarioMatch = line.match(/^SCENARIO:\s*"([^"]+)"/);
    if (scenarioMatch) { result.scenarioName = scenarioMatch[1]; continue; }

    const dtMatch = line.match(/^DEVICE_TYPE:\s*"([^"]+)"/);
    if (dtMatch) { result.deviceType = dtMatch[1]; continue; }

    const dmMatch = line.match(/^DEVICE_MODEL:\s*"([^"]+)"/);
    if (dmMatch) { result.deviceModel = dmMatch[1]; continue; }

    const mfMatch = line.match(/^MANUFACTURER:\s*"([^"]+)"/);
    if (mfMatch) { result.manufacturer = mfMatch[1]; continue; }

    // FUNC: (function definition block)
    const funcDefMatch = line.match(/^FUNC:\s*(.*)/);
    if (funcDefMatch) {
      currentGoal = null;
      currentFunc = { name: (funcDefMatch[1] || '').trim(), steps: [] };
      result.funcs.push(currentFunc);
      continue;
    }

    // GOAL: (with optional inline name for backward compat)
    const goalMatch = line.match(/^GOAL:\s*(.*)/);
    if (goalMatch) {
      currentFunc = null;
      currentGoal = { name: (goalMatch[1] || '').trim(), steps: [] };
      result.goals.push(currentGoal);
      continue;
    }

    // Inside a FUNC definition — parse step commands (same as goal, plus SET NAME)
    if (currentFunc) {
      const step = parseStep(line);
      if (step) {
        if (step.type === 'SET' && step._goalMeta === 'NAME') {
          currentFunc.name = step.value;
          continue;
        }
        currentFunc.steps.push(step);
      }
      continue;
    }

    // Inside a goal — parse step commands
    if (currentGoal) {
      const step = parseStep(line);
      if (step) {
        // SET NAME / SET VAL / SET MIN / SET MAX → goal metadata
        if (step.type === 'SET' && step._goalMeta) {
          if (step._goalMeta === 'NAME') currentGoal.name = step.value;
          if (step._goalMeta === 'VAL') {
            currentGoal.val = step.parameter;
            if (step.unit) currentGoal.valUnit = step.unit;
          }
          if (step._goalMeta === 'MIN') {
            currentGoal.min = step.value;
            if (step.unit) currentGoal.minUnit = step.unit;
          }
          if (step._goalMeta === 'MAX') {
            currentGoal.max = step.value;
            if (step.unit) currentGoal.maxUnit = step.unit;
          }
          continue; // goal metadata, not a visible step
        }

        // Attach CORRECT/ERROR to previous CHECK step
        if ((step.type === 'CORRECT' || step.type === 'ERROR') && currentGoal.steps.length > 0) {
          const prev = currentGoal.steps[currentGoal.steps.length - 1];
          if (prev.type === 'CHECK' || prev.type === 'IF') {
            if (step.type === 'CORRECT') prev.correctMsg = step.message;
            else prev.errorMsg = step.message;
            continue;
          }
        }
        currentGoal.steps.push(step);
      }
    }
  }

  return result;
}

function parseStep(line) {
  // SET NAME 'Goal Name' — goal metadata
  const setNameMatch = line.match(/^SET\s+NAME\s+'([^']+)'/);
  if (setNameMatch) {
    return { type: 'SET', raw: line, _goalMeta: 'NAME', value: setNameMatch[1] };
  }

  // SET VAL 'param' or SET VAL param
  const setValMatch = line.match(/^SET\s+VAL\s+'([^']+)'/) || line.match(/^SET\s+VAL\s+(\S+)/);
  if (setValMatch) {
    return { type: 'SET', raw: line, _goalMeta: 'VAL', parameter: setValMatch[1] };
  }

  // SET MIN 'value [unit]' or SET MIN value [unit]
  const setMinMatch = line.match(/^SET\s+MIN\s+'([^']+)'/) || line.match(/^SET\s+MIN\s+(.+)/);
  if (setMinMatch) {
    const { value, unit } = splitValueUnit(setMinMatch[1].trim());
    return { type: 'SET', raw: line, _goalMeta: 'MIN', value, unit };
  }

  // SET MAX 'value [unit]' or SET MAX value [unit]
  const setMaxMatch = line.match(/^SET\s+MAX\s+'([^']+)'/) || line.match(/^SET\s+MAX\s+(.+)/);
  if (setMaxMatch) {
    const { value, unit } = splitValueUnit(setMaxMatch[1].trim());
    return { type: 'SET', raw: line, _goalMeta: 'MAX', value, unit };
  }

  // SET 'param' 'value [unit]' — quoted form (supports spaces)
  const setQuotedMatch = line.match(/^SET\s+'([^']+)'\s+'([^']+)'/);
  if (setQuotedMatch) {
    const { value, unit } = splitValueUnit(setQuotedMatch[2]);
    return { type: 'SET', raw: line, parameter: setQuotedMatch[1], value, unit };
  }

  // SET "param" "value" — double-quoted form
  const setDblMatch = line.match(/^SET\s+"([^"]+)"\s+"([^"]+)"/);
  if (setDblMatch) {
    const { value, unit } = splitValueUnit(setDblMatch[2]);
    return { type: 'SET', raw: line, parameter: setDblMatch[1], value, unit };
  }

  // WAIT <duration>
  const waitMatch = line.match(/^WAIT\s+(\d+)\s*(ms|s)?/);
  if (waitMatch) {
    return { type: 'WAIT', raw: line, value: waitMatch[1], unit: waitMatch[2] || 'ms' };
  }

  // FUNC "name" ["arg1"] ["arg2"] — function call
  const funcCallMatch = line.match(/^FUNC\s+"([^"]+)"(.*)/) || line.match(/^FUNC\s+'([^']+)'(.*)/);
  if (funcCallMatch) {
    const funcName = funcCallMatch[1];
    const argsRaw = funcCallMatch[2] || '';
    const args = [];
    const argRe = /["']([^"']+)["']/g;
    let m;
    while ((m = argRe.exec(argsRaw)) !== null) {
      args.push(m[1]);
    }
    return { type: 'FUNC_CALL', raw: line, funcName, args };
  }

  // IF param min .. max [unit]  (canonical range check)
  const ifRangeMatch = line.match(/^IF\s+(\w+)\s+([\-\d.]+)\s*\.\.\s*([\-\d.]+)\s*(.*)/);
  if (ifRangeMatch) {
    return {
      type: 'CHECK', raw: line, parameter: ifRangeMatch[1],
      min: ifRangeMatch[2], max: ifRangeMatch[3],
      unit: (ifRangeMatch[4] || '').trim() || undefined,
    };
  }

  // Legacy CHECK min <= param <= max [unit]
  const checkMatch = line.match(/^CHECK\s+([\-\d.]+)\s*<=\s*(\w+)\s*<=\s*([\-\d.]+)\s*(.*)/);
  if (checkMatch) {
    return {
      type: 'CHECK', raw: line, parameter: checkMatch[2],
      min: checkMatch[1], max: checkMatch[3],
      unit: (checkMatch[4] || '').trim() || undefined,
    };
  }

  // Legacy MIN 'param' 'value [unit]' → convert to CHECK-like step
  const minMatch = line.match(/^MIN\s+'([^']+)'\s+'([^']+)'/);
  if (minMatch) {
    const { value, unit } = splitValueUnit(minMatch[2]);
    return { type: 'CHECK', raw: line, parameter: minMatch[1], min: value, unit, _legacy: 'MIN' };
  }

  // Legacy MAX 'param' 'value [unit]' → convert to CHECK-like step
  const maxMatch = line.match(/^MAX\s+'([^']+)'\s+'([^']+)'/);
  if (maxMatch) {
    const { value, unit } = splitValueUnit(maxMatch[2]);
    return { type: 'CHECK', raw: line, parameter: maxMatch[1], max: value, unit, _legacy: 'MAX' };
  }

  // Legacy VAL 'param' 'unit' → ignored (now uses SET VAL)
  const valMatch = line.match(/^VAL\s+'([^']+)'\s+'([^']+)'/);
  if (valMatch) {
    return { type: 'SET', raw: line, _goalMeta: 'VAL', parameter: valMatch[1], unit: valMatch[2] };
  }

  // Legacy IF 'param' <op> 'threshold' ELSE ERROR|CORRECT 'msg'
  const ifMatch = line.match(/^IF\s+'([^']+)'\s*([<>=!]+)\s*'([^']+)'\s+ELSE\s+(ERROR|CORRECT)\s+'([^']+)'/);
  if (ifMatch) {
    return {
      type: 'CHECK', raw: line, parameter: ifMatch[1],
      condition: ifMatch[2], value: ifMatch[3],
      errorMsg: ifMatch[4] === 'ERROR' ? ifMatch[5] : undefined,
      correctMsg: ifMatch[4] === 'CORRECT' ? ifMatch[5] : undefined,
      _legacy: 'IF',
    };
  }

  // SAVE 'param'
  const saveMatch = line.match(/^SAVE\s+'([^']+)'/);
  if (saveMatch) {
    return { type: 'SAVE', raw: line, parameter: saveMatch[1] };
  }

  // LOG "message"
  const logMatch = line.match(/^LOG\s+"([^"]+)"/)  || line.match(/^LOG\s+'([^']+)'/);
  if (logMatch) {
    return { type: 'LOG', raw: line, message: logMatch[1] };
  }

  // CORRECT 'msg'
  const correctMatch = line.match(/^CORRECT\s+'([^']+)'/) || line.match(/^CORRECT\s+"([^"]+)"/);
  if (correctMatch) {
    return { type: 'CORRECT', raw: line, message: correctMatch[1] };
  }

  // ERROR 'msg'
  const errorMatch = line.match(/^ERROR\s+'([^']+)'/) || line.match(/^ERROR\s+"([^"]+)"/);
  if (errorMatch) {
    return { type: 'ERROR', raw: line, message: errorMatch[1] };
  }

  // EXPECT_DEVICE, EXPECT_I2C_BUS, EXPECT_I2C_CHIP
  if (line.startsWith('EXPECT_')) {
    return { type: 'EXPECT', raw: line };
  }

  // API_GET / API_POST / API GET / API POST
  const apiMatch = line.match(/^API[_ ](GET|POST|PUT|DELETE)\s+"([^"]+)"/) || line.match(/^API[_ ](GET|POST|PUT|DELETE)\s+'([^']+)'/);
  if (apiMatch) {
    return { type: 'API', raw: line, method: apiMatch[1], url: apiMatch[2] };
  }

  // ASSERT_STATUS
  const asMatch = line.match(/^ASSERT_STATUS\s+(\d+)/);
  if (asMatch) {
    return { type: 'ASSERT', raw: line, assertType: 'STATUS', statusCode: asMatch[1] };
  }

  // ASSERT_JSON
  const ajMatch = line.match(/^ASSERT_JSON\s+"([^"]+)"\s+"([^"]+)"/);
  if (ajMatch) {
    return { type: 'ASSERT', raw: line, assertType: 'JSON', jsonPath: ajMatch[1], jsonExpected: ajMatch[2] };
  }

  // ASSERT_JSON with operator
  const ajOpMatch = line.match(/^ASSERT_JSON\s+(\S+)\s*([<>=!]+)\s*(\S+)/);
  if (ajOpMatch) {
    return { type: 'ASSERT', raw: line, assertType: 'JSON', jsonPath: ajOpMatch[1], jsonOp: ajOpMatch[2], jsonExpected: ajOpMatch[3] };
  }

  // ASSERT_SENSOR
  const asSensor = line.match(/^ASSERT_SENSOR\s+"([^"]+)"\s+"([<>=!]+)"\s+"([^"]+)"\s+"([^"]+)"/);
  if (asSensor) {
    return { type: 'ASSERT', raw: line, assertType: 'SENSOR', parameter: asSensor[1], condition: asSensor[2], value: asSensor[3], unit: asSensor[4] };
  }

  // ASSERT_VALVE, ASSERT_CONTAINS, ASSERT_VISIBLE, ASSERT_TEXT
  if (line.startsWith('ASSERT_')) {
    return { type: 'ASSERT', raw: line };
  }

  // NAVIGATE
  const navMatch = line.match(/^NAVIGATE\s+"([^"]+)"/) || line.match(/^NAVIGATE\s+'([^']+)'/);
  if (navMatch) {
    return { type: 'NAVIGATE', raw: line, url: navMatch[1] };
  }

  // CLICK, INPUT, SELECT_DEVICE, SELECT_INTERVAL, RECORD_START
  for (const kw of ['CLICK', 'INPUT', 'SELECT_DEVICE', 'SELECT_INTERVAL', 'RECORD_START']) {
    if (line.startsWith(kw)) {
      return { type: kw, raw: line };
    }
  }

  // Fallback
  return { type: 'OTHER', raw: line };
}

function splitValueUnit(s) {
  const m = s.match(/^([\-\d.]+)\s*(.*)$/);
  if (m) return { value: m[1], unit: m[2] || undefined };
  return { value: s, unit: undefined };
}

/**
 * Collect threshold data from a goal's metadata and CHECK steps.
 */
export function collectThresholds(goal) {
  const map = {};

  // 1. Goal-level metadata (SET VAL / SET MIN / SET MAX)
  if (goal.val) {
    const key = goal.val;
    if (!map[key]) map[key] = { parameter: key };
    if (goal.min) { map[key].min = goal.min; }
    if (goal.max) { map[key].max = goal.max; }
    map[key].unit = goal.minUnit || goal.maxUnit || goal.valUnit || map[key].unit;
  }

  // 2. CHECK steps
  for (const step of goal.steps) {
    if (step.type !== 'CHECK' || !step.parameter) continue;
    const key = step.parameter;
    if (!map[key]) map[key] = { parameter: key };
    if (step.min) map[key].min = map[key].min || step.min;
    if (step.max) map[key].max = map[key].max || step.max;
    if (step.unit) map[key].unit = map[key].unit || step.unit;
  }

  return Object.values(map);
}

/**
 * Convert parsed OQL structure to oqlos-report-v1 data.json format.
 */
export function toReportJson(parsed) {
  const goals = parsed.goals.map(g => {
    const thresholds = collectThresholds(g);
    const steps = g.steps
      .filter(s => s.type !== 'COMMENT')
      .map(s => {
        const step = {
          name: s.type === 'CHECK' ? s.raw : (s.parameter || s.raw),
          status: 'pending',
          duration_ms: 0,
        };
        if (s.parameter) step.parameter = s.parameter;
        if (s.value != null) step.value = s.value;
        if (s.unit) step.unit = s.unit;
        if (s.min) step.min = s.min;
        if (s.max) step.max = s.max;
        if (s.correctMsg) step.pass_message = s.correctMsg;
        if (s.errorMsg) step.fail_message = s.errorMsg;
        return step;
      });

    const goalObj = { name: g.name, steps, thresholds };
    if (g.val) goalObj.val = g.val;
    if (g.min) goalObj.min = g.min;
    if (g.max) goalObj.max = g.max;
    if (g.minUnit) goalObj.min_unit = g.minUnit;
    if (g.maxUnit) goalObj.max_unit = g.maxUnit;
    return goalObj;
  });

  return {
    $schema: 'oqlos-report-v1',
    generated_at: new Date().toISOString(),
    scenario: {
      source: parsed.scenarioName || 'editor',
      ok: true,
      duration_ms: 0,
      passed: 0,
      failed: 0,
      total: goals.reduce((sum, g) => sum + g.steps.length, 0),
    },
    metadata: {
      device_type: parsed.deviceType || '',
      device_model: parsed.deviceModel || '',
      manufacturer: parsed.manufacturer || '',
    },
    goals,
    variables: {},
    errors: [],
    warnings: [],
  };
}
