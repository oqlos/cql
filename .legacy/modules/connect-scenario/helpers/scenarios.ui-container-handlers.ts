import { ScenariosService } from './scenarios.service';
import { ScenariosLibrary } from './scenarios.library';
import { createExecContextFromDef } from '../../../components/dsl';
import { notifyBottomLine } from '../../../modules/shared/generic-grid/utils';
import { handleActionSelectChange, handleParamChange } from './variables.ui';
import { showBulkChangePopover } from './scenarios.ui-popover';
import { confirmAction, promptText } from './scenario-dialogs';
import type { ScenariosControllerCtx } from './scenarios.ui-types';

export type ContainerClickHandler = (
    btn: HTMLElement,
    e: Event,
    container: HTMLElement,
    ctx: ScenariosControllerCtx
) => void | Promise<void>;

export interface ContainerClickDef {
    selector: string;
    handler: ContainerClickHandler;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function _removeOptionFromSelect(sel: HTMLSelectElement, value: string): void {
    Array.from(sel.options).forEach(o => { if ((o.text || o.value) === value) { try { o.remove(); } catch { /* silent */ } } });
    if (sel.options.length === 0) {
        const opt = document.createElement('option'); opt.text = 'niezdefiniowany'; opt.value = 'niezdefiniowany'; sel.add(opt, 0);
    }
    if ((sel.value || '') === value || sel.selectedIndex < 0) sel.selectedIndex = 0;
}

function _addToExcluded(sel: HTMLSelectElement, value: string): void {
    try {
        const raw = (sel as any).dataset?.excludedOptions || '[]';
        let exc: string[] = []; try { exc = JSON.parse(raw); if (!Array.isArray(exc)) exc = []; } catch { exc = []; }
        if (value && !exc.includes(value)) exc.push(value);
        (sel as any).dataset.excludedOptions = JSON.stringify(exc);
    } catch { /* silent */ }
}

function _removeFromExcluded(sel: HTMLSelectElement, value: string): void {
    try {
        const raw = (sel as any).dataset?.excludedOptions || '[]';
        let exc: string[] = []; try { exc = JSON.parse(raw); if (!Array.isArray(exc)) exc = []; } catch { exc = []; }
        (sel as any).dataset.excludedOptions = JSON.stringify(exc.filter(x => String(x || '') !== value));
    } catch { /* silent */ }
}

function _getOrCreateSelect(host: HTMLElement, cls: string, beforeSel: string): HTMLSelectElement {
    let sel = host.querySelector(`select.${cls}`) as HTMLSelectElement | null;
    if (!sel) {
        const before = host.querySelector(beforeSel) as HTMLElement | null;
        const anchor = before?.previousElementSibling as HTMLElement | null;
        if (anchor && anchor.classList.contains('dsl-add-link')) { try { anchor.remove(); } catch { /* silent */ } }
        sel = document.createElement('select'); sel.className = `${cls} rounded-4`;
        if (before && before.parentElement) before.parentElement.insertBefore(sel, before);
        else host.appendChild(sel);
    }
    return sel;
}

async function _persistDef(
    src: string, scenarioId: string,
    ta: HTMLTextAreaElement | null,
    ctx: ScenariosControllerCtx
): Promise<void> {
    if (ta) ta.value = src;
    try { createExecContextFromDef(src); } catch { /* silent */ }
    (globalThis as any).__dslLibrarySourceOverride = 'DEF';
    const badge = document.getElementById('def-source-badge') as HTMLElement | null;
    if (badge) badge.textContent = 'Źródło: DEF';
    try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
    if (scenarioId) {
        try { await ScenariosService.updateScenario(scenarioId, { def: src }); notifyBottomLine('💾 Zapisano DEF', 'success', 2000); } catch { /* silent */ }
    }
}

function _addOptionToSelect(sel: HTMLSelectElement, name: string): void {
    const has = Array.from(sel.options).some(o => (o.text || o.value) === name);
    if (!has) { const opt = document.createElement('option'); opt.text = name; opt.value = name; sel.add(opt, 0); }
    sel.value = name;
}

// ─── CLICK HANDLERS ──────────────────────────────────────────────────────────

const handleActionSelectClick: ContainerClickHandler = (btn, _e, _c, ctx) => {
    setTimeout(() => {
        const varRow = btn.closest('.var-row') as HTMLElement | null;
        if (!varRow) return;
        handleActionSelectChange(varRow);
        ctx.updatePreview();
    }, 0);
};

const handleIncDecButton: ContainerClickHandler = (btn, e, _c, ctx) => {
    const me = e as MouseEvent;
    const row = btn.closest('.var-row') as HTMLElement | null;
    if (!row) return;
    const input = row.querySelector<HTMLInputElement>('input.value-input');
    const unitSel = row.querySelector<HTMLSelectElement>('select.unit-select');
    const unit = (unitSel?.value || '').toLowerCase();
    const curRaw = (input?.value || '').toString().replace(',', '.');
    let cur = Number.isFinite(parseFloat(curRaw)) ? parseFloat(curRaw) : 0;
    let step = 1;
    if (unit.includes('bar') && !unit.includes('mbar')) step = 0.1;
    if (me && me.shiftKey) step = step * 10;
    if (me && (me as any).altKey) step = step / 10;
    const dir = btn.classList.contains('btn-inc-val') ? 1 : -1;
    const decimals = step < 1 ? String(step).split('.')[1]?.length || 1 : 0;
    cur = cur + dir * step;
    const next = decimals > 0 ? Number(cur.toFixed(decimals)) : Math.round(cur);
    if (input) input.value = String(next);
    ctx.updatePreview();
};

const handleRemoveObject: ContainerClickHandler = async (_btn, _e, container, ctx) => {
    const host = _btn.closest('.sentence-part') as HTMLElement | null;
    if (!host) return;
    const sel2 = _getOrCreateSelect(host, 'object-select', 'button.btn-add-object');
    const current = (sel2.value || '').trim();
    const ask = current ? await confirmAction(`Usunąć obiekt "${current}" z biblioteki?`) : false;
    if (ask && current) {
        const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
        const nameEsc = current.replace(/'/g, "\\'");
        const overlay = `\n(function(){const __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));const __rm=(a,v)=>Array.isArray(a)?a.filter(x=>String(x)!==v):a;__m.objects=__rm(__m.objects,'${nameEsc}');if(__m.library&&typeof __m.library==='object'){__m.library.objects=__rm(__m.library.objects,'${nameEsc}');}module.exports=__m;})();\n`;
        let src = String(ta?.value || '') + overlay;
        await _persistDef(src, scenarioId, ta, ctx);
        try {
            container.querySelectorAll<HTMLSelectElement>('select.object-select').forEach(s => {
                Array.from(s.options).forEach(o => { if ((o.text || o.value) === current) { try { o.remove(); } catch { /* silent */ } } });
                if ((s.value || '') === current) s.selectedIndex = 0;
            });
        } catch { /* silent */ }
        try {
            const lib = (globalThis as any).__libraryCache || {};
            if (lib && typeof lib === 'object') {
                lib.objects = (Array.isArray(lib.objects) ? lib.objects : []).filter((s: any) => String(s || '') !== current);
                (globalThis as any).__libraryCache = lib;
                await ScenariosLibrary.persistLibraryToDB();
            }
        } catch { /* silent */ }
        try {
            const vars = (globalThis as any).__variablesCache as Array<{ type: string; name: string }>;
            if (Array.isArray(vars)) (globalThis as any).__variablesCache = vars.filter(v => !(v && v.type === 'objects' && String(v.name || '') === current));
        } catch { /* silent */ }
        return;
    }
    _addToExcluded(sel2, current);
    const idx = sel2.selectedIndex;
    if (idx >= 0) { try { const opt = sel2.options[idx]; if (opt) opt.remove(); } catch { /* silent */ } }
    if (sel2.options.length === 0) { const opt = document.createElement('option'); opt.text = 'niezdefiniowany'; opt.value = 'niezdefiniowany'; sel2.add(opt, 0); }
    else sel2.selectedIndex = 0;
    try { (globalThis as any).__suppressDefLibrarySyncUntil = Date.now() + 600; } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
};

const handleRemoveFunction: ContainerClickHandler = async (_btn, _e, container, ctx) => {
    const host = _btn.closest('.sentence-part') as HTMLElement | null;
    if (!host) return;
    const sel3 = _getOrCreateSelect(host, 'function-select', 'button.btn-add-function');
    const current = (sel3.value || '').trim();
    const ask = current ? await confirmAction(`Usunąć funkcję "${current}" z biblioteki?`) : false;
    if (ask && current) {
        const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
        const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
        const nameEsc = current.replace(/'/g, "\\'");
        const objSel = host.querySelector('select.object-select') as HTMLSelectElement | null;
        const objName = (objSel?.value || '').trim();
        const objEsc = objName.replace(/'/g, "\\'");
        const overlay = objName
            ? `\n(function(){const __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));const __rm=(a,v)=>Array.isArray(a)?a.filter(x=>String(x)!==v):a;if(__m.library&&typeof __m.library==='object'){__m.library.objectFunctionMap=__m.library.objectFunctionMap||{};var k='${objEsc}';var cur=(__m.library.objectFunctionMap[k]&&Array.isArray(__m.library.objectFunctionMap[k].functions))?__m.library.objectFunctionMap[k].functions:[];var next=__rm(cur,'${nameEsc}');__m.library.objectFunctionMap[k]=Object.assign({},(__m.library.objectFunctionMap[k]||{}),{functions:next});}module.exports=__m;})();\n`
            : `\n(function(){const __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));const __rm=(a,v)=>Array.isArray(a)?a.filter(x=>String(x)!==v):a;__m.functions=__rm(__m.functions,'${nameEsc}');if(__m.library&&typeof __m.library==='object'){__m.library.functions=__rm(__m.library.functions,'${nameEsc}');}module.exports=__m;})();\n`;
        let src = String(ta?.value || '') + overlay;
        await _persistDef(src, scenarioId, ta, ctx);
        try {
            const parts = Array.from(container.querySelectorAll<HTMLElement>('.sentence-part'));
            parts.forEach(p => {
                const s = p.querySelector('select.function-select') as HTMLSelectElement | null;
                if (!s) return;
                const oSel = p.querySelector('select.object-select') as HTMLSelectElement | null;
                if (!objName || (oSel && (oSel.value || '').trim() === objName)) {
                    Array.from(s.options).forEach(o => { if ((o.text || o.value) === current) { try { o.remove(); } catch { /* silent */ } } });
                    if ((s.value || '') === current) s.selectedIndex = 0;
                }
            });
        } catch { /* silent */ }
        try {
            const lib = (globalThis as any).__libraryCache || {};
            if (lib && typeof lib === 'object') {
                lib.functions = objName ? lib.functions : (Array.isArray(lib.functions) ? lib.functions : []).filter((s: any) => String(s || '') !== current);
                (globalThis as any).__libraryCache = lib;
                await ScenariosLibrary.persistLibraryToDB();
            }
        } catch { /* silent */ }
        try {
            const vars = (globalThis as any).__variablesCache as Array<{ type: string; name: string }>;
            if (Array.isArray(vars)) (globalThis as any).__variablesCache = vars.filter(v => !(v && v.type === 'functions' && String(v.name || '') === current));
        } catch { /* silent */ }
        return;
    }
    _addToExcluded(sel3, current);
    const idx = sel3.selectedIndex;
    if (idx >= 0) { try { const opt = sel3.options[idx]; if (opt) opt.remove(); } catch { /* silent */ } }
    if (sel3.options.length === 0) { const opt = document.createElement('option'); opt.text = 'niezdefiniowany'; opt.value = 'niezdefiniowany'; sel3.add(opt, 0); }
    else sel3.selectedIndex = 0;
    try { (globalThis as any).__suppressDefLibrarySyncUntil = Date.now() + 600; } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
};

const handleAddGoal: ContainerClickHandler = async (_btn, _e, _c, ctx) => {
    const goalHeader = _btn.closest('.goal-header') as HTMLElement | null;
    const selGoal = goalHeader?.querySelector('select.goal-select') as HTMLSelectElement | null;
    const current = (selGoal?.value || '').trim();
    const entered = await promptText('Podaj nazwę czynności (GOAL):', current, { title: 'Dodaj GOAL' }) || '';
    const name = entered.trim();
    if (!name) return;
    try {
        const cache = (globalThis as any).__activitiesCache as Array<{ id: string; name: string }> | undefined;
        if (Array.isArray(cache)) { if (!cache.some(r => String(r?.name || '').trim().toLowerCase() === name.toLowerCase())) cache.unshift({ id: `act-${Date.now()}`, name }); }
        else (globalThis as any).__activitiesCache = [{ id: `act-${Date.now()}`, name }];
    } catch { /* silent */ }
    if (selGoal) {
        if (!Array.from(selGoal.options).some(o => (o.text || o.value) === name)) { const opt = document.createElement('option'); opt.text = name; opt.value = name; selGoal.add(opt, 0); }
        selGoal.value = name;
    } else if (goalHeader) {
        const link = goalHeader.querySelector('.dsl-add-link') as HTMLElement | null;
        if (link) { try { link.remove(); } catch { /* silent */ } }
        const newSel = document.createElement('select'); newSel.className = 'goal-select rounded-4';
        const opt = document.createElement('option'); opt.text = name; opt.value = name; newSel.add(opt);
        const addBtn = goalHeader.querySelector('.btn-add-goal') as HTMLElement | null;
        if (addBtn && addBtn.parentElement) {
            addBtn.parentElement.insertBefore(newSel, addBtn);
            if (!goalHeader.querySelector('.btn-remove-goal')) {
                const remBtn = document.createElement('button'); remBtn.type = 'button'; remBtn.className = 'btn btn-outline-danger btn-remove-goal'; remBtn.title = 'Usuń czynność z listy'; remBtn.textContent = '-';
                addBtn.parentElement.insertBefore(remBtn, addBtn.nextSibling);
            }
        }
    }
    try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
    notifyBottomLine(`➕ Dodano czynność: ${name}`, 'success', 2000);
};

const handleRemoveGoal: ContainerClickHandler = async (_btn, _e, container, ctx) => {
    const goalHeader = _btn.closest('.goal-header') as HTMLElement | null;
    const selGoal = goalHeader?.querySelector('select.goal-select') as HTMLSelectElement | null;
    if (!selGoal) return;
    const current = (selGoal.value || '').trim();
    if (!current || !(await confirmAction(`Usunąć czynność "${current}" z listy?`))) return;
    try {
        const cache = (globalThis as any).__activitiesCache as Array<{ id: string; name: string }> | undefined;
        if (Array.isArray(cache)) (globalThis as any).__activitiesCache = cache.filter(r => String(r?.name || '').trim().toLowerCase() !== current.toLowerCase());
    } catch { /* silent */ }
    try {
        container.querySelectorAll<HTMLSelectElement>('select.goal-select').forEach(s => {
            Array.from(s.options).forEach(o => { if ((o.text || o.value) === current) { try { o.remove(); } catch { /* silent */ } } });
            if ((s.value || '') === current && s.options.length > 0) s.selectedIndex = 0;
        });
    } catch { /* silent */ }
    try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
    try { ctx.updatePreview(); } catch { /* silent */ }
    notifyBottomLine(`🗑️ Usunięto czynność: ${current}`, 'info', 2000);
};

const handleAddResult: ContainerClickHandler = async (_btn, _e, _c, ctx) => {
    const resultBlock = _btn.closest('.result-block') as HTMLElement | null;
    const selResult = resultBlock?.querySelector('select.result-select') as HTMLSelectElement | null;
    const current = (selResult?.value || '').trim();
    const entered = await promptText('Podaj nazwę statusu RESULT:', current, { title: 'Dodaj RESULT' }) || '';
    const name = entered.trim().toUpperCase();
    if (!name) return;
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    const nameEsc = name.replace(/'/g, "\\'");
    const overlay = `\n(function(){const __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));const __add=(a,v)=>Array.from(new Set([...(Array.isArray(a)?a:[]),v]));__m.results=__add(__m.results,'${nameEsc}');if(__m.library&&typeof __m.library==='object'){__m.library.results=__add(__m.library.results,'${nameEsc}');}module.exports=__m;})();\n`;
    const src = String(ta?.value || '') + overlay;
    await _persistDef(src, scenarioId, ta, ctx);
    if (selResult) _addOptionToSelect(selResult, name);
    notifyBottomLine(`➕ Dodano status: ${name}`, 'success', 2000);
};

const handleRemoveResult: ContainerClickHandler = async (_btn, _e, container, ctx) => {
    const resultBlock = _btn.closest('.result-block') as HTMLElement | null;
    const selResult = resultBlock?.querySelector('select.result-select') as HTMLSelectElement | null;
    if (!selResult) return;
    const current = (selResult.value || '').trim();
    if (!current || !(await confirmAction(`Usunąć status "${current}" z biblioteki?`))) return;
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    const nameEsc = current.replace(/'/g, "\\'");
    const overlay = `\n(function(){const __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));const __rm=(a,v)=>Array.isArray(a)?a.filter(x=>String(x)!==v):a;__m.results=__rm(__m.results,'${nameEsc}');if(__m.library&&typeof __m.library==='object'){__m.library.results=__rm(__m.library.results,'${nameEsc}');}module.exports=__m;})();\n`;
    const src = String(ta?.value || '') + overlay;
    await _persistDef(src, scenarioId, ta, ctx);
    try {
        container.querySelectorAll<HTMLSelectElement>('select.result-select').forEach(s => {
            _removeOptionFromSelect(s, current);
        });
    } catch { /* silent */ }
    notifyBottomLine(`🗑️ Usunięto status: ${current}`, 'info', 2000);
};

const handleAddOpt: ContainerClickHandler = async (_btn, _e, _c, ctx) => {
    const optBlock = _btn.closest('.opt-block') as HTMLElement | null;
    const sel = optBlock?.querySelector('select.opt-desc-select') as HTMLSelectElement | null;
    const current = (sel?.value || '').trim();
    const name = (await promptText('Podaj opis (OPT):', current, { title: 'Dodaj OPT' }) || '').trim();
    if (!name || !sel) return;
    _addOptionToSelect(sel, name);
    try { ctx.updatePreview(); } catch { /* silent */ }
};

const handleAddInfoMsg: ContainerClickHandler = async (_btn, _e, _c, ctx) => {
    const infoBlock = _btn.closest('.info-block') as HTMLElement | null;
    const sel = infoBlock?.querySelector('select.info-message-select') as HTMLSelectElement | null;
    const current = (sel?.value || '').trim();
    const name = (await promptText('Podaj opis (INFO):', current, { title: 'Dodaj INFO' }) || '').trim();
    if (!name || !sel) return;
    _addOptionToSelect(sel, name);
    try { ctx.updatePreview(); } catch { /* silent */ }
};

const handleRemoveInfoMsg: ContainerClickHandler = async (_btn, _e, _c, ctx) => {
    const infoBlock = _btn.closest('.info-block') as HTMLElement | null;
    const sel = infoBlock?.querySelector('select.info-message-select') as HTMLSelectElement | null;
    if (!sel) return;
    const current = (sel.value || '').trim();
    if (!current || !(await confirmAction(`Usunąć opis "${current}" z tej listy?`))) return;
    _removeOptionFromSelect(sel, current);
    try { ctx.updatePreview(); } catch { /* silent */ }
};

const handleRemoveOpt: ContainerClickHandler = async (_btn, _e, _c, ctx) => {
    const optBlock = _btn.closest('.opt-block') as HTMLElement | null;
    const sel = optBlock?.querySelector('select.opt-desc-select') as HTMLSelectElement | null;
    if (!sel) return;
    const current = (sel.value || '').trim();
    if (!current || !(await confirmAction(`Usunąć opis "${current}" z tej listy?`))) return;
    _removeOptionFromSelect(sel, current);
    try { ctx.updatePreview(); } catch { /* silent */ }
};

const handleAddObject: ContainerClickHandler = async (_btn, _e, _c, ctx) => {
    const host = _btn.closest('.sentence-part') as HTMLElement | null;
    const selObj = (_btn.previousElementSibling && (_btn.previousElementSibling as HTMLElement).classList.contains('object-select'))
        ? (_btn.previousElementSibling as HTMLSelectElement)
        : (host?.querySelector('select.object-select') as HTMLSelectElement | null);
    const current = (selObj?.value || '').trim();
    const name = (await promptText('Podaj nazwę obiektu:', current, { title: 'Dodaj obiekt' }) || '').trim();
    if (!name) return;
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    const nameEsc = name.replace(/'/g, "\\'");
    const overlay = `\n(function(){const __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));const __add=(a,v)=>Array.from(new Set([...(Array.isArray(a)?a:[]),v]));__m.objects=__add(__m.objects,'${nameEsc}');if(__m.library&&typeof __m.library==='object'){__m.library.objects=__add(__m.library.objects,'${nameEsc}');__m.library.objectFunctionMap=__m.library.objectFunctionMap||{};if(!(__m.library.objectFunctionMap['${nameEsc}'])){__m.library.objectFunctionMap['${nameEsc}']={ functions: [] };}}module.exports=__m;})();\n`;
    const src = String(ta?.value || '') + overlay;
    await _persistDef(src, scenarioId, ta, ctx);
    if (selObj) _addOptionToSelect(selObj, name);
};

const handleAddFunction: ContainerClickHandler = async (_btn, _e, container, ctx) => {
    const host = _btn.closest('.sentence-part') as HTMLElement | null;
    const selFn = (_btn.previousElementSibling && (_btn.previousElementSibling as HTMLElement).classList.contains('function-select'))
        ? (_btn.previousElementSibling as HTMLSelectElement)
        : (host?.querySelector('select.function-select') as HTMLSelectElement | null);
    const current = (selFn?.value || '').trim();
    const name = (await promptText('Podaj nazwę funkcji:', current, { title: 'Dodaj funkcję' }) || '').trim();
    if (!name) return;
    const ta = document.getElementById('scenario-def-editor') as HTMLTextAreaElement | null;
    const scenarioId = (ScenariosService.getCurrentScenarioId && ScenariosService.getCurrentScenarioId()) || ctx.readScenarioIdFromUrl() || '';
    const nameEsc = name.replace(/'/g, "\\'");
    const objSelLocal = host?.querySelector('select.object-select') as HTMLSelectElement | null;
    const objName = (objSelLocal?.value || '').trim();
    const objEsc = objName.replace(/'/g, "\\'");
    const overlay = `\n(function(){const __m=(typeof module!=='undefined'&&module.exports?module.exports:(typeof exports!=='undefined'?exports:{}));const __add=(a,v)=>Array.from(new Set([...(Array.isArray(a)?a:[]),v]));__m.functions=__add(__m.functions,'${nameEsc}');if(__m.library&&typeof __m.library==='object'){__m.library.functions=__add(__m.library.functions,'${nameEsc}');__m.library.objectFunctionMap=__m.library.objectFunctionMap||{};if('${objEsc}'){var k='${objEsc}';var cur=(__m.library.objectFunctionMap[k]&&Array.isArray(__m.library.objectFunctionMap[k].functions))?__m.library.objectFunctionMap[k].functions:[];var next=__add(cur,'${nameEsc}');__m.library.objectFunctionMap[k]=Object.assign({},(__m.library.objectFunctionMap[k]||{}),{functions:next});}}module.exports=__m;})();\n`;
    const src = String(ta?.value || '') + overlay;
    await _persistDef(src, scenarioId, ta, ctx);
    if (selFn) {
        _addOptionToSelect(selFn, name);
        _removeFromExcluded(selFn, name);
    }
    try {
        container.querySelectorAll<HTMLSelectElement>('select.function-select').forEach(s => _removeFromExcluded(s, name));
    } catch { /* silent */ }
};

// ─── CLICK HANDLER REGISTRY ──────────────────────────────────────────────────

export const CONTAINER_CLICK_HANDLERS: ContainerClickDef[] = [
    { selector: '.action-select',           handler: handleActionSelectClick },
    { selector: '.btn-inc-val',             handler: handleIncDecButton },
    { selector: '.btn-dec-val',             handler: handleIncDecButton },
    { selector: 'button.btn-remove-object', handler: handleRemoveObject },
    { selector: 'button.btn-remove-function', handler: handleRemoveFunction },
    { selector: 'button.btn-add-goal',      handler: handleAddGoal },
    { selector: 'button.btn-remove-goal',   handler: handleRemoveGoal },
    { selector: 'button.btn-add-result',    handler: handleAddResult },
    { selector: 'button.btn-remove-result', handler: handleRemoveResult },
    { selector: 'button.btn-add-opt',       handler: handleAddOpt },
    { selector: 'button.btn-add-info-msg',  handler: handleAddInfoMsg },
    { selector: 'button.btn-remove-info-msg', handler: handleRemoveInfoMsg },
    { selector: 'button.btn-remove-opt',    handler: handleRemoveOpt },
    { selector: 'button.btn-add-object',    handler: handleAddObject },
    { selector: 'button.btn-add-function',  handler: handleAddFunction },
];

// ─── CHANGE HANDLER ──────────────────────────────────────────────────────────

export function handleContainerChange(
    e: Event,
    container: HTMLElement,
    ctx: ScenariosControllerCtx
): void {
    const target = e.target as HTMLElement;
    const objSel = (target.closest && target.closest('select.object-select')) as HTMLSelectElement | null;
    const fnSel  = (target.closest && target.closest('select.function-select')) as HTMLSelectElement | null;
    if (objSel || fnSel) {
        const el = (objSel || fnSel) as HTMLSelectElement;
        const prev = String(((el as any).dataset.prevValue || '')).trim();
        const cur = String(el.value || '').trim();
        if (prev && cur && prev !== cur) {
            showBulkChangePopover(el, objSel ? 'object' : 'function', prev, cur, (applyAll) => {
                if (applyAll) {
                    const sel2 = objSel ? 'select.object-select' : 'select.function-select';
                    container.querySelectorAll<HTMLSelectElement>(sel2).forEach(s => {
                        if ((s.value || '').trim() === prev) { _addOptionToSelect(s, cur); }
                    });
                    try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
                }
                try { ctx.updatePreview(); } catch { /* silent */ }
            }, () => {
                try { el.value = prev; } catch { /* silent */ }
                try { ctx.updatePreview(); } catch { /* silent */ }
            });
            return;
        }
        try { ctx.updatePreview(); } catch { /* silent */ }
        return;
    }
    const actionSel = (target.closest && target.closest('select.action-select')) as HTMLSelectElement | null;
    if (actionSel) {
        const varRow = actionSel.closest('.var-row') as HTMLElement | null;
        if (varRow) { handleActionSelectChange(varRow); ctx.updatePreview(); }
        return;
    }
    const paramSel = (target.closest && target.closest('select.param-select')) as HTMLSelectElement | null;
    if (paramSel) {
        const varRow = paramSel.closest('.var-row') as HTMLElement | null;
        if (varRow && varRow.closest('.variable-container')) { handleParamChange(varRow, paramSel.value || ''); ctx.updatePreview(); }
    }
}

export async function handleVariableSelectChange(e: Event, ctx: ScenariosControllerCtx): Promise<void> {
    const vs = (e.target as HTMLElement).closest('select.variable-select') as HTMLSelectElement | null;
    if (!vs) return;
    if ((vs.value || '').trim() === '*') {
        const name = (await promptText('Podaj nazwę zmiennej:', '', { title: 'Dodaj zmienną' }) || '').trim();
        if (!name || name === '*') { try { ctx.updatePreview(); } catch { /* silent */ } return; }
        if (!Array.from(vs.options).some(o => (o.text || o.value) === name)) { const opt = document.createElement('option'); opt.text = name; opt.value = name; vs.add(opt, 1); }
        vs.value = name;
        try { ctx.refreshBuilderOptions(); } catch { /* silent */ }
        try { ctx.updatePreview(); } catch { /* silent */ }
    }
}
