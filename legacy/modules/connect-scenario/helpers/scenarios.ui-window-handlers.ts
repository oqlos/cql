import { notifyBottomLine } from '../../../modules/shared/generic-grid/utils';
import { ScenariosService } from './scenarios.service';
import { buildGoalContentFromSection } from './dsl.serialize';
import { collectGoalsFromDOM, collectFuncsFromDOM, scenarioToDsl, funcsToDsl } from './scenarios.serializer';
import { FirmwareCQRS } from '../../../services/firmware-cqrs.service';
import { DslTools, createExecContextFromDef } from '../../../components/dsl';
import { ScenariosLibrary } from './scenarios.library';
import { blockRenderers } from '../../../components/dsl-editor';
import { moveConditionUpWithConnectors, moveConditionDownWithConnectors } from './conditions';
import { buildVariableContainer, cloneVariableContainer, addVariableRow } from './variables.ui';
import { promptText } from './scenario-dialogs';
import { buildFuncEditorTemplate, getFuncEditorDefaultTemplateName } from './cql-editor-content';
import { getScenarioCQRS } from '../cqrs/singleton';
import type { ScenariosControllerCtx } from './scenarios.ui-types';

export type UiActionHandler = (
    d: Record<string, any>,
    ctx: ScenariosControllerCtx,
    runtime: any
) => void | Promise<void>;

// ─── MAP EDITOR ──────────────────────────────────────────────────────────────

function _tryParseMapSrc(src: string): any {
    try { return JSON.parse(src); } catch { /* silent */ }
    try {
        const exportsObj: any = {}; const moduleObj: any = { exports: exportsObj };
        const f = new Function('module','exports',`'use strict';\n${src}\n;return (typeof module!=='undefined'&&module.exports)||exports;`);
        return f(moduleObj, exportsObj);
    } catch { return null; }
}

const handleMapValidate: UiActionHandler = (_d, _ctx, _runtime) => {
    const ta = document.getElementById('scenario-map-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    if (!src) { notifyBottomLine('❌ Brak treści MAP do walidacji', 'error', 2500); return; }
    const map = _tryParseMapSrc(src);
    if (map && typeof map === 'object') {
        const keys = Object.keys(map || {});
        notifyBottomLine(`✅ MAP poprawny. Sekcje: ${keys.join(', ') || '—'}`, 'success', 2500);
    } else {
        notifyBottomLine('❌ Błąd MAP: niepoprawny JSON/JS', 'error', 3500);
    }
};

const handleRunGoalMap: UiActionHandler = async (d, ctx, runtime) => {
    let goalSection = d.goalSection as HTMLElement | null;
    if (!goalSection) { try { goalSection = document.querySelector('.goal-section') as HTMLElement | null; } catch { goalSection = null; } }
    try {
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
        if (!scenarioId) { notifyBottomLine('❌ Brak scenariusza do uruchomienia (MAP)', 'error', 3000); return; }
        const sel = goalSection?.querySelector('.goal-select') as HTMLSelectElement | null;
        const goalName = (sel?.value || '').trim();
        runtime.setContext(goalSection, scenarioId, goalName);
        runtime.openModal(goalName, scenarioId, goalSection);
        runtime.appendLog(`▶️ MAP: start scenariusz=${scenarioId} goal="${goalName || '—'}"`);
        const gc = buildGoalContentFromSection(goalSection || null, goalName);
        if (!gc || !gc.dsl) { runtime.appendLog('❌ MAP: brak DSL dla tego celu'); return; }
        const singleDsl = `SCENARIO: temp\n\n${gc.dsl}`;
        const baseCtx = (globalThis as any).__currentExecCtx || undefined;
        const execCtx = Object.assign({}, baseCtx || {}, { executeTasks: true });
        const html = DslTools.runDsl(singleDsl, execCtx);
        try { const codePre = document.getElementById('goal-run-code-pre'); if (codePre) { codePre.textContent = gc.dsl; const codeWrap = document.getElementById('goal-run-code'); if (codeWrap) codeWrap.classList.remove('hidden'); } } catch { /* silent */ }
        runtime.appendLog('ℹ️ MAP: wykonano plan DSL (zobacz API logi w konsoli/rzeczywistych endpointach).');
        try { const term = document.getElementById('goal-run-terminal'); if (term) term.innerHTML = html; } catch { /* silent */ }
        notifyBottomLine(`▶️ Uruchomiono (MAP) ${goalName || 'cel'}`, 'success', 2500);
    } catch { notifyBottomLine('❌ Nie udało się uruchomić (MAP)', 'error', 3000); }
};

const handleMapReload: UiActionHandler = (_d, ctx, _runtime) => {
    const ta = document.getElementById('scenario-map-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    if (!src) { notifyBottomLine('❌ Brak treści MAP do przeładowania', 'error', 2500); return; }
    const map = _tryParseMapSrc(src);
    if (map && typeof map === 'object') {
        try { (globalThis as any).__scenarioMap = map; } catch { /* silent */ }
        try { const defTa = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null; const defSrc = (defTa?.value || '').trim(); if (defSrc) createExecContextFromDef(defSrc); } catch { /* silent */ }
        try { ctx.updatePreview(); } catch { /* silent */ }
        notifyBottomLine('🔄 Przeładowano MAP i runtime', 'success', 2000);
    } else {
        notifyBottomLine('❌ Nie udało się przeładować MAP', 'error', 3000);
    }
};

const handleMapSave: UiActionHandler = async (_d, ctx, _runtime) => {
    const ta = document.getElementById('scenario-map-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    if (!scenarioId) { notifyBottomLine('❌ Brak wybranego scenariusza do zapisu MAP', 'error', 2500); return; }
    const map = _tryParseMapSrc(src);
    try { (globalThis as any).__scenarioMap = map ?? {}; } catch { /* silent */ }
    try { await ScenariosService.updateScenario(scenarioId, { map: src }); } catch { /* silent */ }
    try { const defTa = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null; const defSrc = (defTa?.value || '').trim(); if (defSrc) createExecContextFromDef(defSrc); } catch { /* silent */ }
    try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
    notifyBottomLine('💾 Zapisano MAP', 'success', 2000);
};

// ─── DEF / DSL NAVIGATION ────────────────────────────────────────────────────

const handleDefVisualEditor: UiActionHandler = (_d, ctx, _runtime) => {
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    if (scenarioId) { globalThis.history.pushState({}, '', `/connect-scenario/library-editor?scenario=${scenarioId}`); globalThis.dispatchEvent(new PopStateEvent('popstate')); }
    else notifyBottomLine('⚠️ Najpierw wybierz scenariusz', 'warning', 2500);
};

const handleDslVisualEditor: UiActionHandler = (_d, ctx, _runtime) => {
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    if (scenarioId) { globalThis.history.pushState({}, '', `/connect-scenario/dsl-editor?scenario=${scenarioId}`); globalThis.dispatchEvent(new PopStateEvent('popstate')); }
    else notifyBottomLine('⚠️ Najpierw wybierz scenariusz', 'warning', 2500);
};

// ─── DEF EDITOR ──────────────────────────────────────────────────────────────

const handleDefValidate: UiActionHandler = (_d, _ctx, _runtime) => {
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    if (!src) { notifyBottomLine('❌ Brak treści DEF do walidacji', 'error', 2500); return; }
    try { new Function('exports','module','console','globalThis','window', `'use strict';\n` + src + `\n;return true;`); notifyBottomLine('✅ DEF poprawny składniowo', 'success', 2000); }
    catch (err: any) { notifyBottomLine(`❌ Błąd DEF: ${String(err?.message || err)}`, 'error', 3500); }
};

const handleDefImport: UiActionHandler = async (_d, ctx, _runtime) => {
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    try {
        const { dslDataService } = await import('../../../components/dsl');
        const data = await dslDataService.loadAll();
        const uniq = (arr: string[]) => Array.from(new Set(arr.map(s => String(s || '').trim()).filter(Boolean)));
        const lib = {
            objects: uniq((data.objects || []).map(o => o.name)),
            functions: uniq((data.functions || []).map(f => f.name)),
            params: uniq((data.params || []).map(p => p.name)),
            units: uniq((data.units || []).map(u => (u.code || u.name)) as string[]),
        };
        let src = String(ta?.value || '');
        src += `\n(function(){var __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));__m.library=${JSON.stringify(lib)};module.exports=__m;})();\n`;
        if (ta) ta.value = src;
        try { createExecContextFromDef(src); } catch { /* silent */ }
        const badge = document.getElementById('def-source-badge') as HTMLElement | null;
        if (badge) badge.textContent = 'Źródło: DEF';
        try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
        try { ctx.updatePreview(); } catch { /* silent */ }
        if (scenarioId) {
            try { await ScenariosService.updateScenario(scenarioId, { def: src }); } catch { /* silent */ }
            try { await ScenariosLibrary.persistLibraryToDB(); } catch { /* silent */ }
        }
        notifyBottomLine('📥 Zaimportowano bibliotekę z DB do DEF', 'success', 2500);
    } catch { notifyBottomLine('❌ Import z DB nie powiódł się', 'error', 3000); }
};

const handleDefReload: UiActionHandler = (_d, ctx, _runtime) => {
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    if (!src) { notifyBottomLine('❌ Brak treści DEF do przeładowania', 'error', 2500); return; }
    try { createExecContextFromDef(src); try { ctx.refreshBuilderOptions(); } catch { /* silent */ } try { ctx.updatePreview(); } catch { /* silent */ } notifyBottomLine('🔄 Przeładowano runtime DEF', 'success', 2000); }
    catch { notifyBottomLine('❌ Nie udało się przeładować runtime', 'error', 3000); }
};

const handleDefSave: UiActionHandler = async (_d, ctx, _runtime) => {
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    if (!scenarioId) { notifyBottomLine('❌ Brak wybranego scenariusza do zapisu DEF', 'error', 2500); return; }
    try {
        await ScenariosService.updateScenario(scenarioId, { def: src });
        try { await ScenariosLibrary.persistLibraryToDB(); } catch { /* silent */ }
        try { if (src) createExecContextFromDef(src); } catch { /* silent */ }
        const badge = document.getElementById('def-source-badge') as HTMLElement | null;
        if (badge) badge.textContent = src ? 'Źródło: DEF' : 'Źródło: —';
        try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
        try { ctx.updatePreview(); } catch { /* silent */ }
        notifyBottomLine('💾 Zapisano DEF', 'success', 2000);
    } catch { notifyBottomLine('❌ Nie udało się zapisać DEF', 'error', 3000); }
};

// ─── FUNC EDITOR ─────────────────────────────────────────────────────────────

const handleFuncVisualEditor: UiActionHandler = (_d, ctx, _runtime) => {
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    window.location.href = scenarioId ? `/connect-scenario/func-editor?scenario=${encodeURIComponent(scenarioId)}` : '/connect-scenario/func-editor';
};

const handleFuncValidate: UiActionHandler = (_d, _ctx, _runtime) => {
    const ta = document.getElementById('scenario-func-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    if (!src) { notifyBottomLine('ℹ️ Brak treści FUNC do walidacji', 'info', 2000); return; }
    const lines = src.split('\n');
    const funcs: string[] = [];
    const errors: string[] = [];
    let currentFunc = '';
    let lineNum = 0;
    for (const line of lines) {
        lineNum++;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const funcMatch = trimmed.match(/^FUNC:\s*(.+)$/i);
        if (funcMatch) { currentFunc = funcMatch[1].trim(); funcs.push(currentFunc); continue; }
        if (!currentFunc && trimmed) errors.push(`Linia ${lineNum}: Instrukcja poza blokiem FUNC`);
        const validStep = /^(TASK|SET |VAL |MIN |MAX |IF |WAIT |SAVE |LOG |ALARM |ERROR |STOP|PAUSE)/i.test(trimmed);
        if (currentFunc && !validStep) errors.push(`Linia ${lineNum}: Nieznana składnia`);
    }
    if (errors.length === 0) notifyBottomLine(`✅ FUNC OK: ${funcs.length} procedur`, 'success', 3000);
    else notifyBottomLine(`❌ FUNC: ${errors.length} błędów`, 'error', 3000);
};

const handleFuncAddTemplate: UiActionHandler = async (_d, _ctx, _runtime) => {
    const ta = document.getElementById('scenario-func-editor') as HTMLTextAreaElement | null;
    if (!ta) return;
    const defaultName = getFuncEditorDefaultTemplateName();
    const name = await promptText('Nazwa nowej procedury FUNC:', defaultName, { title: 'Dodaj szablon FUNC' }) || defaultName;
    ta.value += buildFuncEditorTemplate(name);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    notifyBottomLine(`➕ Dodano szablon FUNC: ${name}`, 'success', 2000);
};

const handleFuncSave: UiActionHandler = async (_d, ctx, _runtime) => {
    const ta = document.getElementById('scenario-func-editor') as HTMLTextAreaElement | null;
    const src = (ta?.value || '').trim();
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    if (!scenarioId) { notifyBottomLine('❌ Brak wybranego scenariusza do zapisu FUNC', 'error', 2500); return; }
    try { await ScenariosService.updateScenario(scenarioId, { func: src }); notifyBottomLine('💾 Zapisano FUNC', 'success', 2000); }
    catch { notifyBottomLine('❌ Nie udało się zapisać FUNC', 'error', 3000); }
};

// ─── MAP VISUAL EDITOR ───────────────────────────────────────────────────────

const handleMapVisualEditor: UiActionHandler = (_d, ctx, _runtime) => {
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    window.location.href = scenarioId ? `/connect-scenario/map-editor?scenario=${encodeURIComponent(scenarioId)}` : '/connect-scenario/map-editor';
};

// ─── GOAL / TASK OPERATIONS ──────────────────────────────────────────────────

const handleDeleteGoal: UiActionHandler = (d, ctx, _runtime) => {
    const goalSection = d.goalSection as HTMLElement | null;
    if (!goalSection) return;
    const doDelete = () => {
        const cqrs = getScenarioCQRS();
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
        const goalId = goalSection.dataset.goalId || '';
        if (goalId) { try { cqrs?.dispatch({ type: 'DeleteGoal', scenarioId, goalId }); } catch { /* silent */ } }
        try { goalSection.remove(); } catch { /* silent */ }
        ctx.updatePreview();
        notifyBottomLine('🗑️ Usunięto cel', 'info', 3000);
    };
    doDelete();
};

const handleDeleteTask: UiActionHandler = (d, ctx, _runtime) => {
    const taskContainer = d.taskContainer as HTMLElement | null;
    if (!taskContainer) return;
    const doDelete = () => {
        const goalSection = taskContainer.closest('.goal-section') as HTMLElement | null;
        ctx.updatePreview();
        try { taskContainer.remove(); } catch { /* silent */ }
        const cqrs = getScenarioCQRS();
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
        const goalId = goalSection?.dataset.goalId || '';
        const taskId = taskContainer.dataset.taskId || '';
        if (goalId && taskId) { try { cqrs?.dispatch({ type: 'DeleteTask', scenarioId, goalId, taskId }); } catch { /* silent */ } }
        notifyBottomLine('🗑️ Usunięto zadanie', 'info', 3000);
    };
    doDelete();
};

const handleAddCondition: UiActionHandler = (d, ctx, _runtime) => {
    try { const now = Date.now(); const last = Number((globalThis as any).__suiAddConditionTs || 0); if (now - last < 200) return; (globalThis as any).__suiAddConditionTs = now; } catch { /* silent */ }
    if (d.goalSection) { ctx.addNewCondition(d.goalSection as HTMLElement); ctx.refreshBuilderOptions(); }
};

const handleAddConditionAfter: UiActionHandler = (d, ctx, _runtime) => {
    const goalSection = d.goalSection as HTMLElement | null;
    const condition = d.condition as HTMLElement | null;
    const connector = String(d.connector || '').toUpperCase() as 'AND'|'OR';
    try { const now = Date.now(); const last = Number((globalThis as any).__suiAddConditionAfterTs || 0); if (now - last < 200) return; (globalThis as any).__suiAddConditionAfterTs = now; } catch { /* silent */ }
    if (goalSection && condition && (connector === 'AND' || connector === 'OR')) {
        try { (condition as any).dataset.connector = connector; } catch { /* silent */ }
        ctx.addNewCondition(goalSection, condition);
        ctx.updatePreview();
        ctx.refreshBuilderOptions();
    }
};

const handleAddFuncCall: UiActionHandler = async (d, ctx, _runtime) => {
    const goalSection = d.goalSection as HTMLElement | null;
    if (goalSection) { await ctx.addFuncCall(goalSection); ctx.updatePreview(); }
};

// ─── BLOCK ADD OPERATIONS ─────────────────────────────────────────────────────

function _insertBlock(goalSection: HTMLElement | null, html: string, ctx: ScenariosControllerCtx): void {
    if (!goalSection) return;
    const stepsContainer = goalSection.querySelector('.steps-container');
    if (!stepsContainer || !html) return;
    stepsContainer.insertAdjacentHTML('beforeend', html);
    ctx.updatePreview();
}

const handleAddOut: UiActionHandler = (d, ctx, _r) => {
    const varOpts = ScenariosLibrary.load('params');
    _insertBlock(d.goalSection as HTMLElement | null, blockRenderers.renderOutBlock({ outType: 'RESULT', value: 'OK' }, `out-${Date.now()}`, varOpts), ctx);
};
const handleAddDialog: UiActionHandler = (d, ctx, _r) => {
    const varOpts = ScenariosLibrary.load('params');
    _insertBlock(d.goalSection as HTMLElement | null, blockRenderers.renderDialogBlock({ parameter: '', message: '' }, `dialog-${Date.now()}`, varOpts), ctx);
};
const handleAddInfo: UiActionHandler = (d, ctx, _r) => {
    _insertBlock(d.goalSection as HTMLElement | null, blockRenderers.renderInfoBlock({ level: 'INFO', message: '' }, `info-${Date.now()}`), ctx);
};
const handleAddOpt: UiActionHandler = (d, ctx, _r) => {
    const varOpts = ScenariosLibrary.load('params');
    _insertBlock(d.goalSection as HTMLElement | null, blockRenderers.renderOptBlock({ parameter: '', description: '' }, `opt-${Date.now()}`, varOpts), ctx);
};
const handleAddElse: UiActionHandler = (d, ctx, _r) => {
    _insertBlock(d.goalSection as HTMLElement | null, blockRenderers.renderConditionBlock({ actionType: 'ERROR', actionMessage: '' } as any, { paramOptions: [], unitOptions: [], operatorOptions: [], functionOptions: [], objectOptions: [], goalOptions: [] }, 'else'), ctx);
};
const handleAddRepeat: UiActionHandler = (d, ctx, _r) => {
    _insertBlock(d.goalSection as HTMLElement | null, blockRenderers.renderRepeatBlock(`repeat-${Date.now()}`), ctx);
};
const handleAddEnd: UiActionHandler = (d, ctx, _r) => {
    _insertBlock(d.goalSection as HTMLElement | null, blockRenderers.renderEndBlock(`end-${Date.now()}`), ctx);
};

// ─── ELEMENT REORDER / DELETE ────────────────────────────────────────────────

const handleTaskMove: UiActionHandler = (d, ctx, _r) => {
    const up = String(d.action || '') === 'TaskUp';
    const taskEl = d.taskEl as HTMLElement | null;
    const goalSection = d.goalSection as HTMLElement | null;
    const listEl = goalSection?.querySelector('.steps-container') as HTMLElement | null;
    if (!taskEl || !listEl) return;
    const sib = up ? taskEl.previousElementSibling : taskEl.nextElementSibling;
    if (sib) {
        if (up) listEl.insertBefore(taskEl, sib); else listEl.insertBefore(taskEl, sib.nextSibling);
        const cqrs = getScenarioCQRS();
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
        const goalId = goalSection?.dataset.goalId || '';
        const order = Array.prototype.slice.call(listEl.querySelectorAll('.task-container')).map((el: HTMLElement) => el.dataset.taskId || '').filter(Boolean);
        if (goalId) { try { cqrs?.dispatch({ type: 'ReorderTasks', scenarioId, goalId, order }); } catch { /* silent */ } }
    }
    ctx.updatePreview();
};

const handleStepMove: UiActionHandler = (d, ctx, _r) => {
    const up = String(d.action || '') === 'StepUp';
    const stepEl = d.stepEl as HTMLElement | null;
    const stepsContainer = stepEl?.closest('.steps-container') as HTMLElement | null;
    if (!stepEl || !stepsContainer) return;
    const sib = up ? stepEl.previousElementSibling : stepEl.nextElementSibling;
    if (sib) { if (up) stepsContainer.insertBefore(stepEl, sib); else stepsContainer.insertBefore(stepEl, sib.nextSibling); ctx.updatePreview(); }
};

const handleVariableMove: UiActionHandler = (d, ctx, _r) => {
    const up = String(d.action || '') === 'VariableUp';
    const variableEl = d.variableEl as HTMLElement | null;
    const goalSection = d.goalSection as HTMLElement | null;
    const listEl = goalSection?.querySelector('.steps-container') as HTMLElement | null;
    if (!variableEl || !listEl) return;
    const sib = up ? variableEl.previousElementSibling : variableEl.nextElementSibling;
    if (sib) { if (up) listEl.insertBefore(variableEl, sib); else listEl.insertBefore(variableEl, sib.nextSibling); ctx.updatePreview(); }
};

const handleGoalMove: UiActionHandler = (d, ctx, _r) => {
    const up = String(d.action || '') === 'GoalUp';
    const goalSection = d.goalSection as HTMLElement | null;
    const containerEl = document.getElementById('goals-container') as HTMLElement | null;
    if (!goalSection || !containerEl) return;
    const sib = up ? goalSection.previousElementSibling : goalSection.nextElementSibling;
    if (sib && sib.classList.contains('goal-section')) {
        if (up) containerEl.insertBefore(goalSection, sib); else containerEl.insertBefore(goalSection, sib.nextSibling);
        const cqrs = getScenarioCQRS();
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || undefined;
        const order = Array.prototype.slice.call(containerEl.querySelectorAll('.goal-section')).map((el: HTMLElement) => el.dataset.goalId || '').filter(Boolean);
        try { cqrs?.dispatch({ type: 'ReorderGoals', scenarioId, order }); } catch { /* silent */ }
    }
    ctx.updatePreview();
};

const handleCloneStep: UiActionHandler = (d, ctx, _r) => {
    const stepEl = d.stepEl as HTMLElement | null;
    if (!stepEl) return;
    const clone = stepEl.cloneNode(true) as HTMLElement;
    stepEl.parentElement?.insertBefore(clone, stepEl.nextSibling);
    ctx.updatePreview();
    notifyBottomLine('⧉ Sklonowano krok', 'info', 2000);
};

const handleDeleteStep: UiActionHandler = (d, ctx, _r) => {
    const stepEl = d.stepEl as HTMLElement | null;
    if (!stepEl) return;
    const doDelete = () => { try { stepEl.remove(); } catch { /* silent */ } ctx.updatePreview(); notifyBottomLine('🗑️ Usunięto krok', 'info', 3000); };
    doDelete();
};

const handleDeleteCondition: UiActionHandler = (d, ctx, _r) => {
    const cond = d.cond as HTMLElement | null;
    if (!cond) return;
    const doDelete = () => { try { cond.remove(); } catch { /* silent */ } ctx.updatePreview(); notifyBottomLine('🗑️ Usunięto warunek', 'info', 3000); };
    doDelete();
};

// ─── VARIABLE OPERATIONS ─────────────────────────────────────────────────────

const handleAddVariable: UiActionHandler = (d, ctx, _r) => {
    const goalSection = d.goalSection as HTMLElement | null;
    if (!goalSection) return;
    const stepsContainer = goalSection.querySelector('.steps-container');
    if (!stepsContainer) return;
    stepsContainer.appendChild(buildVariableContainer(null));
    ctx.updatePreview();
    ctx.refreshBuilderOptions();
};

const handleAddTypedVar: UiActionHandler = (d, ctx, _r) => {
    const action = String(d.action || '');
    const goalSection = d.goalSection as HTMLElement | null;
    if (!goalSection) return;
    const stepsContainer = goalSection.querySelector('.steps-container');
    if (!stepsContainer) return;
    const kind = action === 'AddGet' ? 'GET' : action === 'AddSet' ? 'SET' : action === 'AddMax' ? 'MAX' : action === 'AddMin' ? 'MIN' : 'VAL';
    stepsContainer.appendChild(buildVariableContainer(kind as 'GET'|'SET'|'MAX'|'MIN'|'VAL'));
    ctx.updatePreview();
    ctx.refreshBuilderOptions();
};

const handleCloneVariable: UiActionHandler = (d, _ctx, _r) => {
    const variableContainer = d.variableContainer as HTMLElement | null;
    if (!variableContainer) return;
    const cloned = cloneVariableContainer(variableContainer);
    if (variableContainer.nextSibling) variableContainer.parentElement?.insertBefore(cloned, variableContainer.nextSibling);
    else variableContainer.parentElement?.appendChild(cloned);
};

const handleDeleteVariable: UiActionHandler = (d, ctx, _r) => {
    const variableContainer = d.variableContainer as HTMLElement | null;
    if (!variableContainer) return;
    const doDelete = () => { ctx.updatePreview(); try { variableContainer.remove(); } catch { /* silent */ } notifyBottomLine('🗑️ Usunięto zmienne', 'info', 3000); };
    doDelete();
};

// ─── AND-ROW OPERATIONS ──────────────────────────────────────────────────────

const handleAddAndRow: UiActionHandler = (d, ctx, _r) => {
    const taskContainer = d.taskContainer as HTMLElement | null;
    const builder = taskContainer?.querySelector('.sentence-builder') as HTMLElement | null;
    if (!builder) return;
    const andRow = document.createElement('div');
    andRow.className = 'sentence-part and-row';
    andRow.innerHTML = `<span class="sentence-text">AND</span><select class="object-select rounded-4"></select><button type="button" class="btn btn-outline-success btn-add-object" title="Dodaj obiekt">+</button><button type="button" class="btn btn-outline-danger btn-remove-object" title="Usuń wybór">-</button><select class="function-select rounded-4"></select><button type="button" class="btn btn-outline-success btn-add-function" title="Dodaj funkcję">+</button><button type="button" class="btn btn-outline-danger btn-remove-function" title="Usuń wybór">-</button><button class="btn-delete-small btn-delete-and" title="Usuń">✕</button>`;
    const addPart = (builder.querySelector('.btn-add-and') as HTMLElement)?.closest('.sentence-part') as HTMLElement | null;
    if (addPart) builder.insertBefore(andRow, addPart); else builder.appendChild(andRow);
    ctx.refreshBuilderOptions();
    ctx.updatePreview();
};

// ─── DSL OPERATIONS ──────────────────────────────────────────────────────────

const handleAutoFixDsl: UiActionHandler = (_d, _ctx, _r) => {
    try {
        const pre = document.getElementById('scenario-preview');
        const src = pre?.textContent || '';
        const fixed = DslTools.autoFixText(src);
        if (pre) pre.innerHTML = DslTools.highlightDsl(fixed);
        const out = document.getElementById('dsl-results');
        if (out) out.innerHTML = '<div class="text-success">🪄 Zastosowano Auto-fix</div>';
    } catch { /* silent */ }
};

const handleExportScenario: UiActionHandler = (_d, _ctx, _r) => {
    const rawName = ((document.getElementById('scenario-name') as HTMLInputElement | null)?.value || 'scenario').trim();
    const scenarioName = rawName || 'scenario';
    try {
        const goals = collectGoalsFromDOM();
        const funcs = collectFuncsFromDOM();
        const dsl = scenarioToDsl(scenarioName, goals).trim();
        const funcDsl = funcsToDsl(funcs).trim();
        const payload = [dsl, funcDsl].filter(Boolean).join('\n\n') + '\n';
        const safeBase = (scenarioName.normalize?.('NFKD') || scenarioName)
            .replace(/[^\w.-]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'scenario';
        const fileName = `${safeBase}.cql`;
        const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
        notifyBottomLine(`📤 Wyeksportowano ${fileName}`, 'success', 2500);
    } catch {
        notifyBottomLine('❌ Nie udało się wyeksportować scenariusza', 'error', 3000);
    }
};

// ─── FIRMWARE EXECUTION ──────────────────────────────────────────────────────

const handleRunGoal: UiActionHandler = async (d, ctx, runtime) => {
    let goalSection = d.goalSection as HTMLElement | null;
    if (!goalSection) { try { goalSection = document.querySelector('.goal-section') as HTMLElement | null; } catch { goalSection = null; } }
    try {
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
        if (!scenarioId) { notifyBottomLine('❌ Brak scenariusza do uruchomienia', 'error', 3000); return; }
        const sel = goalSection?.querySelector('.goal-select') as HTMLSelectElement | null;
        const goalName = (sel?.value || '').trim();
        runtime.setContext(goalSection, scenarioId, goalName);
        runtime.openModal(goalName, scenarioId, goalSection);
        runtime.appendLog(`▶️ Start: scenariusz=${scenarioId} goal="${goalName || '—'}"`);
        let goalContent: any = null;
        try { const row = await ScenariosService.fetchScenarioById(scenarioId); const dsl = row?.content?.dsl; if (dsl && typeof dsl === 'string' && dsl.trim()) goalContent = { dsl }; } catch { /* silent */ }
        if (goalSection && !goalContent) { const gc = buildGoalContentFromSection(goalSection, goalName); if (gc) goalContent = gc; }
        const payload: any = { scenarioId, mode: 'auto', speed: 1.0 };
        if (goalContent) payload.content = goalContent;
        const startRes = await FirmwareCQRS.startExecution(payload);
        if (!startRes.ok) {
            if (startRes.status === 503) {
                runtime.appendLog('ℹ️ Firmware niedostępny — pozostaje lokalny podgląd DSL bez wykonania sprzętowego.');
                notifyBottomLine('⚠️ Firmware niedostępny — uruchomienie sprzętowe pominięte', 'warning', 3500);
                return;
            }
            notifyBottomLine('❌ Nie udało się uruchomić', 'error', 3000);
            return;
        }
        try { runtime.appendLog(`ℹ️ startExecution: HTTP ${startRes.status}`); } catch { /* silent */ }
        notifyBottomLine(`▶️ Uruchomiono ${goalName || 'scenariusz'}`, 'success', 2500);
        let execId = '';
        try { const copy = startRes.clone(); const jsStart = await copy.json().catch(() => null); execId = String(jsStart?.executionId || jsStart?.id || jsStart?.execution_id || jsStart?.execId || ''); } catch { /* silent */ }
        runtime.connectEvents(scenarioId, execId).catch(() => {});
        runtime.connectLogs(scenarioId, execId).catch(() => {});
        try { runtime.startProjectionPolling(); } catch { /* silent */ }
        try { runtime.startStateAutoRefresh(); } catch { /* silent */ }
        runtime.refreshState(goalSection).catch(() => {});
    } catch { notifyBottomLine('❌ Nie udało się uruchomić', 'error', 3000); }
};

// ─── HANDLER REGISTRY ────────────────────────────────────────────────────────

export const SCENARIO_UI_HANDLERS: Record<string, UiActionHandler> = {
    MapValidate:        handleMapValidate,
    RunGoalMap:         handleRunGoalMap,
    MapReload:          handleMapReload,
    MapSave:            handleMapSave,
    MapVisualEditor:    handleMapVisualEditor,
    DefVisualEditor:    handleDefVisualEditor,
    DslVisualEditor:    handleDslVisualEditor,
    DefValidate:        handleDefValidate,
    DefImport:          handleDefImport,
    DefReload:          handleDefReload,
    DefSave:            handleDefSave,
    FuncVisualEditor:   handleFuncVisualEditor,
    FuncValidate:       handleFuncValidate,
    FuncAddTemplate:    handleFuncAddTemplate,
    FuncSave:           handleFuncSave,
    DeleteGoal:         handleDeleteGoal,
    AddGoal:            (_d, ctx) => ctx.addNewGoal(),
    AddTask:            (d, ctx) => { if (d.goalSection) ctx.addNewTask(d.goalSection as HTMLElement); },
    AddTaskAfter:       (d, ctx) => { const gs = d.goalSection as HTMLElement | null; const ae = d.afterEl as HTMLElement | null; if (gs && ae) ctx.addNewTask(gs, ae); },
    AddCondition:       handleAddCondition,
    AddConditionAfter:  handleAddConditionAfter,
    AddFuncCall:        handleAddFuncCall,
    AddOut:             handleAddOut,
    AddDialog:          handleAddDialog,
    AddInfo:            handleAddInfo,
    AddOpt:             handleAddOpt,
    AddElse:            handleAddElse,
    AddRepeat:          handleAddRepeat,
    AddEnd:             handleAddEnd,
    CloneGoal:          (d, ctx) => { if (d.goalSection) ctx.cloneGoal(d.goalSection as HTMLElement); },
    CloneScenario:      (_d, ctx) => { if (ctx.cloneScenario) { try { ctx.cloneScenario(); } catch { /* silent */ } } },
    CloneTask:          (d, ctx) => { if (d.taskContainer) ctx.cloneTask(d.taskContainer as HTMLElement); },
    CloneCondition:     (d, ctx) => { if (d.condition) ctx.cloneCondition(d.condition as HTMLElement); },
    SaveScenario:       (_d, ctx) => ctx.saveScenario(),
    ExportScenario:     handleExportScenario,
    LoadExample:        (d, ctx) => { if (d.exampleId) try { ctx.loadExample(String(d.exampleId)); } catch { /* silent */ } },
    TaskUp:             handleTaskMove,
    TaskDown:           handleTaskMove,
    StepUp:             handleStepMove,
    StepDown:           handleStepMove,
    VariableUp:         handleVariableMove,
    VariableDown:       handleVariableMove,
    GoalUp:             handleGoalMove,
    GoalDown:           handleGoalMove,
    ConditionUp:        (d, ctx) => { const el = d.conditionEl as HTMLElement | null; if (el && moveConditionUpWithConnectors(el)) ctx.updatePreview(); },
    ConditionDown:      (d, ctx) => { const el = d.conditionEl as HTMLElement | null; if (el && moveConditionDownWithConnectors(el)) ctx.updatePreview(); },
    CloneStep:          handleCloneStep,
    DeleteStep:         handleDeleteStep,
    DeleteCondition:    handleDeleteCondition,
    DeleteTask:         handleDeleteTask,
    AddVariable:        handleAddVariable,
    AddGet:             handleAddTypedVar,
    AddSet:             handleAddTypedVar,
    AddMax:             handleAddTypedVar,
    AddMin:             handleAddTypedVar,
    AddVal:             handleAddTypedVar,
    CloneVariable:      handleCloneVariable,
    AddVarRow:          (d, ctx) => { const vc = d.variableContainer as HTMLElement | null; if (vc) { addVariableRow(vc, (d as any)?.kind); ctx.updatePreview(); ctx.refreshBuilderOptions(); } },
    DeleteVarRow:       (d, ctx) => { const vr = d.varRow as HTMLElement | null; if (vr) { try { vr.remove(); } catch { /* silent */ } ctx.updatePreview(); } },
    DeleteVariable:     handleDeleteVariable,
    AddAndRow:          handleAddAndRow,
    DeleteAndRow:       (d, ctx) => { const row = (d.row as HTMLElement | null) || (d.andRow as HTMLElement | null); if (row) { try { row.remove(); } catch { /* silent */ } ctx.updatePreview(); } },
    CopyPreview:        (_d, _ctx) => { const t = document.getElementById('scenario-preview')?.textContent; if (t) { try { navigator.clipboard.writeText(t); } catch { /* silent */ } notifyBottomLine('📋 Skopiowano do schowka!', 'info', 3000); } },
    ValidateDsl:        (_d, ctx) => ctx.validateDsl(),
    RunDsl:             (_d, ctx) => ctx.runDsl(),
    AutoFixDsl:         handleAutoFixDsl,
    ApplyDslFix:        (_d, ctx) => { try { ctx.applyDslFix(); } catch { /* silent */ } },
    RunGoal:            handleRunGoal,
};
