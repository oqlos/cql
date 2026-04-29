// frontend/src/modules/connect-scenario/helpers/scenarios.builder.ts
import { escapeHtml } from '../../../modules/shared/generic-grid/utils';
import { ScenariosLibrary } from './scenarios.library';
import { blockRenderers, RenderOptions, renderGoalActionsButtons } from '../../../components/dsl-editor';
import { LabelsService } from '../../../services/labels.service';

export function loadActivityNames(): string[] { return ScenariosLibrary.loadActivityNames(); }
export function getUnitsForParam(paramName: string): string[] { return ScenariosLibrary.getUnitsForParam(paramName); }

export function createRenderOptions(): RenderOptions {
  return {
    functionOptions: ScenariosLibrary.load('functions'),
    objectOptions: ScenariosLibrary.load('objects'),
    paramOptions: ScenariosLibrary.load('params'),
    unitOptions: ScenariosLibrary.load('units'),
    operatorOptions: ScenariosLibrary.load('operators'),
    goalOptions: loadActivityNames(),
    logOptions: ScenariosLibrary.load('logs'),
    alarmOptions: ScenariosLibrary.load('alarms'),
    errorOptions: ScenariosLibrary.load('errors')
  };
}

export function renderGoalSelect(selected?: string): string {
  const opts = loadActivityNames();
  if (!Array.isArray(opts) || opts.length === 0) {
    const lang = (typeof LabelsService?.getLanguage === 'function' ? LabelsService.getLanguage() : 'pl') || 'pl';
    const text = lang === 'pl' ? '➕ Dodaj aktywność w Connect Data' : '➕ Add activity in Connect Data';
    return `
      <a class="btn btn-outline-primary dsl-add-link" href="/connect-data/activities/add-new">${escapeHtml(text)}</a>
      <button type="button" class="btn btn-outline-success btn-add-goal" title="Dodaj czynność">+</button>
    `;
  }
  const val = (selected || '').trim();
  const present = val ? (opts.indexOf(val) !== -1) : true;
  const list = present ? opts : [val, ...opts];
  return `
    <select class="goal-select rounded-4">${list.map(o => `<option${o === val ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>
    <button type="button" class="btn btn-outline-success btn-add-goal" title="Dodaj czynność">+</button>
    <button type="button" class="btn btn-outline-danger btn-remove-goal" title="Usuń czynność z listy">-</button>
  `;
}

export function refreshBuilderOptions(): void {
  const funcOptions = ScenariosLibrary.load('functions');
  const objOptions = ScenariosLibrary.load('objects');
  const paramOptions = ScenariosLibrary.load('params');
  const unitOptionsL = ScenariosLibrary.load('units');
  const operatorOptionsL = ScenariosLibrary.load('operators');
  const goalOptions = loadActivityNames();
  const logOptions = ScenariosLibrary.load('logs');
  const alarmOptions = ScenariosLibrary.load('alarms');
  const errorOptions = ScenariosLibrary.load('errors');
  const resultOptions = ScenariosLibrary.load('results');

  const refresh = (selector: string, options: string[]) => {
    document.querySelectorAll<HTMLSelectElement>(selector).forEach(sel => {
      // Treat placeholder as no selection so we pick a valid default when options appear
      const curRaw = String(sel.value || '').trim();
      const current = (curRaw === 'niezdefiniowany') ? '' : curRaw;
      let base = Array.isArray(options) ? options.slice(0) : [];
      // Respect per-select exclusions for local '-' removals
      try {
        const raw = (sel as any).dataset?.excludedOptions || '';
        if (raw) {
          const exc = (() => { try { return JSON.parse(raw); } catch { return String(raw).split(','); } })();
          if (Array.isArray(exc) && exc.length) {
            const excludes = new Set(exc.map((s: any) => String(s || '').trim()).filter(Boolean));
            base = base.filter(o => !excludes.has(String(o || '').trim()));
            // If current is excluded, do not re-add it below
            const isExcludedCurrent = excludes.has(String(current || '').trim());
            // Build list without re-adding excluded current
            let list = base;
            if (current && base.indexOf(current) === -1 && !isExcludedCurrent) {
              list = [current, ...base];
            }
            // If list empty, inject placeholder
            if (!Array.isArray(list) || list.length === 0) {
              sel.innerHTML = `<option selected>niezdefiniowany</option>`;
              sel.value = 'niezdefiniowany';
              return;
            }
            const selected = (current && list.indexOf(current) !== -1 && !isExcludedCurrent) ? current : list[0];
            sel.innerHTML = list.map(o => `<option${o === selected ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('');
            sel.value = selected;
            return;
          }
        }
      } catch { /* silent */ }
      // Default path (no exclusions)
      let list = (current && base.indexOf(current) === -1) ? [current, ...base] : base;
      if (!Array.isArray(list) || list.length === 0) {
        sel.innerHTML = `<option selected>niezdefiniowany</option>`;
        sel.value = 'niezdefiniowany';
        return;
      }
      const selected = (current && list.indexOf(current) !== -1) ? current : list[0];
      sel.innerHTML = list.map(o => `<option${o === selected ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('');
      sel.value = selected;
    });
  };

  refresh('.object-select', objOptions);
  refresh('.function-select', funcOptions);
  refresh('.param-select', paramOptions);
  // Base units list as fallback; will override per-parameter below
  refresh('.unit-select', unitOptionsL);
  refresh('.operator-select', operatorOptionsL);
  refresh('.goal-select', goalOptions);
  refresh('.log-select', logOptions);
  refresh('.alarm-select', alarmOptions);
  refresh('.error-select', errorOptions);
  // Result status options with default fallback
  const defaultResults = ['OK', 'ERROR', 'WARNING', 'PASS', 'FAIL'];
  refresh('.result-select', resultOptions.length > 0 ? resultOptions : defaultResults);

  // Override unit options per parameter within each condition-builder
  try {
    document.querySelectorAll<HTMLElement>('.condition-builder').forEach(builder => {
      // New behavior: IF uses variable-select instead of value + unit; skip unit logic when present
      const vsel = builder.querySelector('.variable-select') as HTMLSelectElement | null;
      if (vsel) return;
      const psel = builder.querySelector('.param-select') as HTMLSelectElement | null;
      const usel = builder.querySelector('.unit-select') as HTMLSelectElement | null;
      const cta = builder.querySelector('a.dsl-add-link.unit-select-cta') as HTMLAnchorElement | null;
      const p = (psel?.value || '').trim();
      const units = getUnitsForParam(p);
      // When units exist, ensure we render a select (replace CTA if present)
      if (Array.isArray(units) && units.length > 0) {
        const ensureSelect = (): HTMLSelectElement => {
          if (usel) return usel;
          // Replace CTA with a fresh select
          const sel = document.createElement('select');
          sel.className = 'unit-select rounded-4';
          if (cta && cta.parentElement) { try { cta.parentElement.replaceChild(sel, cta); } catch { /* silent */ } }
          return sel as HTMLSelectElement;
        };
        const targetSel = ensureSelect();
        const current = targetSel.value;
        const list = units;
        targetSel.innerHTML = list.map(u => `<option${u === current ? ' selected' : ''}>${escapeHtml(u)}</option>`).join('');
        return;
      }
      const lang = (typeof LabelsService?.getLanguage === 'function' ? LabelsService.getLanguage() : 'pl') || 'pl';
      const textAdd = lang === 'pl' ? '➕ Dodaj jednostkę w DEF' : '➕ Add unit in DEF';
      const host: HTMLElement = (usel && usel.parentElement) ? (usel.parentElement as HTMLElement) : builder;
      if (usel) { try { usel.remove(); } catch { /* silent */ } }
      let addBtn = host.querySelector('button.btn-add-to-def.unit-add-cta') as HTMLButtonElement | null;
      if (!addBtn) {
        addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-outline-primary btn-add-to-def unit-add-cta';
        addBtn.dataset.defKey = 'units';
        addBtn.dataset.selectClass = 'unit-select';
        addBtn.textContent = textAdd;
        try { host.appendChild(addBtn); } catch { /* silent */ }
      } else { addBtn.textContent = textAdd; }
    });
  } catch { /* silent */ }

  // Update variable-select options in IF conditions per goal based on declared variables (GET/SET/MAX/MIN)
  try {
    document.querySelectorAll<HTMLElement>('.goal-section').forEach(goal => {
      const params = Array.from(goal.querySelectorAll<HTMLSelectElement>('.variable-container .var-row .param-select'))
        .map(sel => (sel?.value || '').trim()).filter(Boolean);
      const uniq = Array.from(new Set(params));
      const update = (sel: HTMLSelectElement) => {
        const current = sel.value || '*';
        const base = ['*', ...uniq];
        const list = (current && base.indexOf(current) === -1) ? [current, ...base] : base;
        sel.innerHTML = list.map(o => `<option${o === current ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('');
      };
      goal.querySelectorAll<HTMLSelectElement>('.condition-group .variable-select').forEach(update);
    });
  } catch { /* silent */ }

  // Override unit options per parameter within each variable row
  try {
    document.querySelectorAll<HTMLElement>('.variable-container .var-row').forEach(row => {
      const psel = row.querySelector('.param-select') as HTMLSelectElement | null;
      const usel = row.querySelector('.unit-select') as HTMLSelectElement | null;
      const cta = row.querySelector('a.dsl-add-link.unit-select-cta') as HTMLAnchorElement | null;
      const addDefBtn = row.querySelector('button.btn-add-to-def.unit-add-cta') as HTMLButtonElement | null;
      const p = (psel?.value || '').trim();
      const units = getUnitsForParam(p);
      if (Array.isArray(units) && units.length > 0) {
        const ensureSelect = (): HTMLSelectElement => {
          if (usel) return usel;
          const sel = document.createElement('select');
          sel.className = 'unit-select rounded-4';
          if (cta && cta.parentElement) { try { cta.parentElement.replaceChild(sel, cta); } catch { /* silent */ } }
          if (addDefBtn && addDefBtn.parentElement) { try { addDefBtn.parentElement.replaceChild(sel, addDefBtn); } catch { /* silent */ } }
          return sel as HTMLSelectElement;
        };
        const targetSel = ensureSelect();
        const current = targetSel.value;
        const list = units;
        targetSel.innerHTML = list.map(u => `<option${u === current ? ' selected' : ''}>${escapeHtml(u)}</option>`).join('');
        return;
      }
      const lang = (typeof LabelsService?.getLanguage === 'function' ? LabelsService.getLanguage() : 'pl') || 'pl';
      const textAdd = lang === 'pl' ? '➕ Dodaj jednostkę w DEF' : '➕ Add unit in DEF';
      const host: HTMLElement = (usel && usel.parentElement) ? (usel.parentElement as HTMLElement) : row;
      if (usel) { try { usel.remove(); } catch { /* silent */ } }
      if (cta) { try { cta.remove(); } catch { /* silent */ } }
      let addBtn = host.querySelector('button.btn-add-to-def.unit-add-cta') as HTMLButtonElement | null;
      if (!addBtn) {
        addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-outline-primary btn-add-to-def unit-add-cta';
        addBtn.dataset.defKey = 'units';
        addBtn.dataset.selectClass = 'unit-select';
        addBtn.textContent = textAdd;
        try { host.appendChild(addBtn); } catch { /* silent */ }
      } else { addBtn.textContent = textAdd; }
    });
  } catch { /* silent */ }

  // Limit funkcji do tych dozwolonych dla wybranego obiektu; nasłuchuj zmian obiektu
  const applyFunctionFilter = (container: HTMLElement, changed = false) => {
    try {
      const objSel = container.querySelector('.object-select') as HTMLSelectElement | null;
      const fnSel = container.querySelector('.function-select') as HTMLSelectElement | null;
      if (!objSel || !fnSel) return;
      const objName = (objSel.value || '').trim();
      const allowedRaw = ScenariosLibrary.getFunctionsForObject(objName);
      let allowed = Array.isArray(allowedRaw) ? allowedRaw : funcOptions;
      const current = (fnSel.value || '').trim();
      // Respect per-select local exclusions (set by '-' button handler)
      try {
        const raw = (fnSel as any).dataset?.excludedOptions || '';
        if (raw) {
          const exc = (() => { try { return JSON.parse(raw); } catch { return String(raw).split(','); } })();
          if (Array.isArray(exc) && exc.length) {
            const excludes = new Set(exc.map((s: any) => String(s || '').trim()).filter(Boolean));
            allowed = (allowed || []).filter(o => !excludes.has(String(o || '').trim())) as any;
          }
        }
      } catch { /* silent */ }
      const def = (changed ? ScenariosLibrary.getDefaultFunctionForObject(objName) : '') || '';
      // Determine next selection strictly from allowed list
      let next = (allowed as any).includes(current) ? current : '';
      if (!next && changed && def && (allowed as any).includes(def)) {
        next = def;
      }
      if (!next) {
        next = (allowed as any)[0] || '';
      }
      // Build options strictly from allowed; if empty, use placeholder
      let list: string[] = Array.isArray(allowed) && allowed.length ? (allowed as any) : ['niezdefiniowany'];
      if (list.length === 1 && list[0] === 'niezdefiniowany') {
        next = 'niezdefiniowany';
      }
      fnSel.innerHTML = list.map(o => `<option${o === next ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('');
      if ((objSel as any).dataset.fnFiltered !== '1') {
        objSel.addEventListener('change', () => applyFunctionFilter(container, true), { passive: true });
        (objSel as any).dataset.fnFiltered = '1';
      }
    } catch { /* silent */ }
  };
  try {
    document.querySelectorAll<HTMLElement>('.task-container .sentence-part').forEach(part => applyFunctionFilter(part));
    document.querySelectorAll<HTMLElement>('.task-container .and-row').forEach(row => applyFunctionFilter(row));
    // Robust pass: iterate each function-select and pair with nearest object-select
    document.querySelectorAll<HTMLSelectElement>('select.function-select').forEach(fnSel => {
      const host = (fnSel.closest('.sentence-part') as HTMLElement) || (fnSel.closest('.task-container') as HTMLElement) || document.body as any;
      const objSel = (host.querySelector && host.querySelector('select.object-select')) as HTMLSelectElement | null
        || (fnSel.closest('.task-container')?.querySelector('select.object-select') as HTMLSelectElement | null);
      if (!objSel) return;
      applyFunctionFilter(host as HTMLElement);
    });
  } catch { /* silent */ }
}

export function renderBuilderFromData(data: { name?: string; goals?: any[]; funcs?: any[] }): void {
  const goalsContainer = document.getElementById('goals-container');
  if (!goalsContainer) return;
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const funcs = Array.isArray(data?.funcs) ? data.funcs : [];
  if (!goals.length && !funcs.length) {
    goalsContainer.innerHTML = '';
    return;
  }
  const goalOptions = loadActivityNames();
  // Create render options once for all goals
  const renderOptions = createRenderOptions();
  
  // Extract available FUNC definitions from DEF library (primary) or from scenario data (fallback)
  const defFuncs = ScenariosLibrary.load('funcs');
  const dataFuncs = Array.isArray(funcs) ? funcs.map((f: any) => String(f?.name || '').trim()).filter(Boolean) : [];
  const availableFuncs = defFuncs.length > 0 ? defFuncs : dataFuncs;

  const html = goals.map((g: any, gi: number) => {
    const goalId = `goal-${gi+1}`;
    const goalName = g?.name || goalOptions[0];
    const tasks = Array.isArray(g?.tasks) ? g.tasks : [];
    const conditions = Array.isArray(g?.conditions) ? g.conditions : [];

    // Build step HTML preserving order when g.steps is present
    const stepsArr = Array.isArray(g?.steps) && g.steps.length ? g.steps : null;
    const buildTaskHtml = (t: any, ti: number) => {
      // Use new renderTaskActionBlock for TASK [action] [object] format
      const actionOptions = ScenariosLibrary.load('actions');
      return blockRenderers.renderTaskActionBlock(
        { action: t?.function, object: t?.object },
        `task-${gi+1}-${ti+1}`,
        actionOptions,
        renderOptions.objectOptions
      );
    };
    const collectVariableOptions = (stepsNormLocal: any[] | null): string[] => {
      const set = new Set<string>();
      try {
        // From grouped variables
        const gv = Array.isArray(g?.variables) ? g.variables : [];
        for (const grp of gv) {
          const arr = Array.isArray(grp?.variables) ? grp.variables : [];
          for (const it of arr) {
            const p = String(it?.parameter || '').trim();
            if (p) set.add(p);
          }
        }
        // From step list (normalized)
        if (Array.isArray(stepsNormLocal)) {
          for (const s of stepsNormLocal) {
            const t = String(s?.type || '').toLowerCase();
            if (t === 'get' || t === 'set' || t === 'max' || t === 'min') {
              const p = String(s?.parameter || '').trim();
              if (p) set.add(p);
            }
          }
        }
      } catch { /* silent */ }
      return Array.from(set);
    };

    const buildIfHtml = (c: any, variableOptions: string[]) => {
      let val = String(c?.value ?? '').trim();
      let unit = String(c?.unit ?? '').trim();
      
      // Fix malformed compound conditions: "górna_granica_3] OR [NC] < [dolna_granica_3" -> "górna_granica_3"
      // These occur when DSL parser incorrectly captures OR/AND conditions as single value
      if (val.includes('] OR [') || val.includes('] AND [')) {
        // Extract just the first variable before the closing bracket that precedes OR/AND
        const match = val.match(/^([^\]]+)/);
        if (match) {
          val = match[1].trim();
        }
      }
      // Also handle case where value starts with bracket content from malformed parse
      if (val.startsWith('[')) {
        val = val.replace(/^\[/, '').replace(/\].*$/, '').trim();
      }
      
      if (!unit && val) {
        const m = val.match(/^(-?\d+(?:[.,]\d+)?)\s+(.+)$/);
        if (m) { val = m[1].replace(',', '.'); unit = m[2].trim(); }
      }
      return blockRenderers.renderConditionBlock(
        { parameter: c?.parameter, operator: c?.operator, value: val, unit, connector: c?.connector, incomingConnector: c?.incomingConnector },
        { ...renderOptions, variableOptions },
        'if'
      );
    };
    const buildElseHtml = (c: any) => {
      return blockRenderers.renderConditionBlock(
        { actionType: c?.actionType, actionMessage: c?.actionMessage } as any,
        renderOptions,
        'else'
      );
    };
    const buildVarStepHtml = (kind: 'GET' | 'SET' | 'MAX' | 'MIN' | 'VAL', varItem?: any) => {
      const unitVal = (() => { const u = String(varItem?.unit || '').trim(); return (u === '[]' || /^\[\s*\]$/.test(u)) ? '' : u; })();
      return blockRenderers.renderVariableBlock(
        { parameter: varItem?.parameter, value: varItem?.value, unit: unitVal, action: kind },
        renderOptions,
        kind,
        `var-${gi+1}-${(viCounter++)}`
      );
    };

    let viCounter = 1;
    const variables = Array.isArray(g?.variables) ? g.variables : [];
    const stepsNorm = stepsArr
      ? (() => {
          const out: any[] = [];
          for (const s of stepsArr) {
            const t = String(s?.type || '').toLowerCase();
            if (t === 'variable') {
              const vars = Array.isArray(s?.variables) ? s.variables : [];
              for (const v of vars) {
                const act = String(v?.action || 'GET').toUpperCase();
                if (act === 'GET') out.push({ type: 'get', parameter: v?.parameter || '', unit: v?.unit || '' });
                else if (act === 'SET') out.push({ type: 'set', parameter: v?.parameter || '', value: v?.value ?? '', unit: v?.unit || '' });
                else if (act === 'MAX') out.push({ type: 'max', parameter: v?.parameter || '', value: v?.value ?? '', unit: v?.unit || '' });
                else if (act === 'MIN') out.push({ type: 'min', parameter: v?.parameter || '', value: v?.value ?? '', unit: v?.unit || '' });
                else if (act === 'VAL') out.push({ type: 'val', parameter: v?.parameter || '', unit: v?.unit || '' });
              }
            } else {
              out.push(s);
            }
          }
          return out;
        })()
      : null;
    const stepsHtml = stepsNorm
      ? (() => {
        let lastConn: '' | 'AND' | 'OR' | 'ELSE' = '';
        let out = '';
        let idx = 0;
        let indentNext = false;
        const varOpts = collectVariableOptions(stepsNorm || []);
        
        const render = (html: string) => {
          if (indentNext) {
            indentNext = false;
            return html.replace('class="', 'class="step-nested ');
          }
          return html;
        };

        for (const s of stepsNorm as any[]) {
          const t = String(s?.type || 'task').toLowerCase();
          
          if (t === 'task') { out += render(buildTaskHtml(s, idx++)); lastConn = ''; continue; }
          if (t === 'get') { out += render(buildVarStepHtml('GET', s)); lastConn = ''; continue; }
          if (t === 'set') {
            const timingParam = String(s?.parameter || '').trim().toLowerCase();
            if (['wait', 'delay', 'pause', 'timeout'].includes(timingParam)) {
              const duration = [s?.value, s?.unit].filter(Boolean).join(' ').trim();
              out += render(blockRenderers.renderWaitBlock({ duration, action: timingParam }, `wait-${gi+1}-${idx++}`));
            } else {
              out += render(buildVarStepHtml('SET', s));
            }
            lastConn = '';
            continue;
          }
          if (t === 'max') { out += render(buildVarStepHtml('MAX', s)); lastConn = ''; continue; }
          if (t === 'min') { out += render(buildVarStepHtml('MIN', s)); lastConn = ''; continue; }
          if (t === 'val') { out += render(buildVarStepHtml('VAL', s)); lastConn = ''; continue; }
          if (t === 'wait') { out += render(blockRenderers.renderWaitBlock({ duration: s?.duration, unit: s?.unit }, `wait-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'log') { out += render(blockRenderers.renderLogBlock({ message: s?.message }, renderOptions, `log-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'alarm') { out += render(blockRenderers.renderAlarmBlock({ message: s?.message }, renderOptions, `alarm-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'error') { out += render(blockRenderers.renderErrorBlock({ message: s?.message }, renderOptions, `error-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'save') { out += render(blockRenderers.renderSaveBlock({ parameter: s?.parameter }, renderOptions, `save-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'func_call') { out += render(blockRenderers.renderFuncCallBlock(s?.name, availableFuncs, s?.arguments || [], `func-call-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'user') { out += render(blockRenderers.renderUserBlock({ action: s?.action, message: s?.message }, `user-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'result') { out += render(blockRenderers.renderResultBlock({ status: s?.status }, `result-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'opt') { 
            // Get optDefaults from DEF library if available
            const defLib = (globalThis as any).__scenarioDefLibrary;
            const optDefaults = defLib?.optDefaults || {};
            out += render(blockRenderers.renderOptBlock({ parameter: s?.parameter, description: s?.description }, `opt-${gi+1}-${idx++}`, varOpts, optDefaults)); 
            lastConn = ''; continue; 
          }
          if (t === 'info') { out += render(blockRenderers.renderInfoBlock({ level: s?.level, message: s?.message }, `info-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'repeat') { out += render(blockRenderers.renderRepeatBlock(`repeat-${gi+1}-${idx++}`)); lastConn = ''; continue; }
          if (t === 'out') { out += render(blockRenderers.renderOutBlock({ outType: s?.outType, value: s?.value }, `out-${gi+1}-${idx++}`, varOpts)); lastConn = ''; continue; }
          if (t === 'dialog') { out += render(blockRenderers.renderDialogBlock({ parameter: s?.parameter, message: s?.message }, `dialog-${gi+1}-${idx++}`, varOpts)); lastConn = ''; continue; }
          if (t === 'else') { 
            // ELSE itself aligns with IF, but its body should be nested
            out += buildElseHtml(s); 
            lastConn = ''; 
            indentNext = true; 
            continue; 
          }
          // IF condition
          out += buildIfHtml({ ...s, incomingConnector: lastConn }, varOpts);
          const next = String(s?.connector || '').toUpperCase();
          lastConn = (next === 'AND' || next === 'OR' || next === 'ELSE') ? (next as any) : '';
          
          // If IF has no connector, the next step is implicitly the body
          if (!lastConn) {
            indentNext = true;
          }
        }
        return out;
      })()
      : (() => {
          const legacyVarsHtml = variables.map((v: any) => {
            const vars = Array.isArray(v?.variables) ? v.variables : [];
            let block = '';
            for (const vv of vars) {
              const act = String(vv?.action || 'GET').toUpperCase();
              if (act === 'GET') block += buildVarStepHtml('GET', vv);
              else if (act === 'SET') block += buildVarStepHtml('SET', vv);
              else if (act === 'MAX') block += buildVarStepHtml('MAX', vv);
              else if (act === 'MIN') block += buildVarStepHtml('MIN', vv);
              else if (act === 'VAL') block += buildVarStepHtml('VAL', vv);
            }
            return block;
          }).join('');
          let condHtml = '';
          let inConn: '' | 'AND' | 'OR' = '';
          const varOpts = collectVariableOptions(null);
        for (const c of conditions as any[]) {
          const t = String(c?.type || '').toLowerCase();
          if (t === 'else') { condHtml += buildElseHtml(c); inConn = ''; continue; }
          condHtml += buildIfHtml({ ...c, incomingConnector: inConn }, varOpts);
          const next = String(c?.connector || '').toUpperCase();
          inConn = (next === 'AND' || next === 'OR') ? (next as any) : '';
        }
        return [
          ...tasks.map((t: any, ti: number) => buildTaskHtml(t, ti)),
            legacyVarsHtml,
            condHtml
          ].join('');
        })();
    return `
      <div class="goal-section" data-goal-id="${goalId}">
        <div class="goal-header">
          <span class="goal-label rounded-4">GOAL</span>
          ${renderGoalSelect(goalName)}
          <button class="btn btn-secondary btn-move-up" data-action="goal-up">⬆️</button>
          <button class="btn btn-secondary btn-move-down" data-action="goal-down">⬇️</button>
          <button class="btn btn-secondary btn-clone" data-action="clone-goal">⧉</button>
          <button class="btn btn-danger btn-delete" data-action="delete-goal">🗑️</button>
        </div>
        <div class="steps-container">${stepsHtml}</div>
        <div class="goal-actions">
          ${renderGoalActionsButtons({ includeRun: true })}
        </div>
      </div>`;
  }).join('');
  
  // Render FUNC blocks
  const funcsHtml = funcs.map((f: any, fi: number) => {
    const funcId = `func-${fi+1}`;
    const funcName = f?.name || 'Procedura';
    const tasks = Array.isArray(f?.tasks) ? f.tasks : [];
    const stepsArr = Array.isArray(f?.steps) && f.steps.length ? f.steps : null;
    
    const buildTaskHtml = (t: any, ti: number) => {
      // Use new renderTaskActionBlock for TASK [action] [object] format
      const actionOptions = ScenariosLibrary.load('actions');
      return blockRenderers.renderTaskActionBlock(
        { action: t?.function, object: t?.object },
        `func-task-${fi+1}-${ti+1}`,
        actionOptions,
        renderOptions.objectOptions
      );
    };
    
    const stepsHtml = stepsArr
      ? stepsArr.map((s: any, si: number) => {
          const t = String(s?.type || '').toLowerCase();
          if (t === 'task') return buildTaskHtml(s, si);
          if (t === 'set') {
            const timingParam = String(s?.parameter || '').trim().toLowerCase();
            if (['wait', 'delay', 'pause', 'timeout'].includes(timingParam)) {
              const duration = [s?.value, s?.unit].filter(Boolean).join(' ').trim();
              return blockRenderers.renderWaitBlock({ duration, action: timingParam }, `func-wait-${fi+1}-${si+1}`);
            }
            return blockRenderers.renderVariableBlock({ parameter: s?.parameter, value: s?.value, unit: s?.unit }, renderOptions, 'SET', `func-var-${fi+1}-${si+1}`);
          }
          if (t === 'get') return blockRenderers.renderVariableBlock({ parameter: s?.parameter, unit: s?.unit }, renderOptions, 'GET', `func-var-${fi+1}-${si+1}`);
          if (t === 'max') return blockRenderers.renderVariableBlock({ parameter: s?.parameter, value: s?.value, unit: s?.unit }, renderOptions, 'MAX', `func-var-${fi+1}-${si+1}`);
          if (t === 'min') return blockRenderers.renderVariableBlock({ parameter: s?.parameter, value: s?.value, unit: s?.unit }, renderOptions, 'MIN', `func-var-${fi+1}-${si+1}`);
          if (t === 'val') return blockRenderers.renderVariableBlock({ parameter: s?.parameter, unit: s?.unit }, renderOptions, 'VAL', `func-var-${fi+1}-${si+1}`);
          if (t === 'wait') return blockRenderers.renderWaitBlock({ duration: s?.duration, unit: s?.unit }, `func-wait-${fi+1}-${si+1}`);
          if (t === 'log') return blockRenderers.renderLogBlock({ message: s?.message }, renderOptions, `func-log-${fi+1}-${si+1}`);
          if (t === 'alarm') return blockRenderers.renderAlarmBlock({ message: s?.message }, renderOptions, `func-alarm-${fi+1}-${si+1}`);
          if (t === 'error') return blockRenderers.renderErrorBlock({ message: s?.message }, renderOptions, `func-error-${fi+1}-${si+1}`);
          if (t === 'save') return blockRenderers.renderSaveBlock({ parameter: s?.parameter }, renderOptions, `func-save-${fi+1}-${si+1}`);
          if (t === 'if') return blockRenderers.renderConditionBlock({ parameter: s?.parameter, operator: s?.operator, value: s?.value }, renderOptions, 'if');
          if (t === 'else') return blockRenderers.renderConditionBlock({ actionType: s?.actionType, actionMessage: s?.actionMessage } as any, renderOptions, 'else');
          return '';
        }).join('')
      : tasks.map((t: any, ti: number) => buildTaskHtml(t, ti)).join('');
    
    return blockRenderers.renderFuncBlock(funcName, funcId, stepsHtml);
  }).join('');
  
  (goalsContainer as HTMLElement).innerHTML = html + funcsHtml;
}

// Legacy preview/data helpers removed (use serializer in scenarios.serializer.ts)
