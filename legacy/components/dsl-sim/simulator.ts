// frontend/src/components/dsl-sim/simulator.ts
import { executeDsl, highlightDsl } from '../dsl';
import type { ExecPlanStep } from '../dsl/dsl.types';
import { escapeHtml } from '../../utils/html.utils';
import { renderLegacyTaskAsDslLines } from '../dsl/dsl-content-helpers';
import { quoteDslValue as q } from '../dsl/dsl.quotes';

export type SimulationStep = ExecPlanStep;

export class DslSimulator {
  private readonly element: HTMLElement;
  private runtime: Record<string, any> = {};

  constructor(elementOrSelector: HTMLElement | string) {
    if (typeof elementOrSelector === 'string') {
      const el = document.querySelector(elementOrSelector) as HTMLElement;
      if (!el) throw new Error(`DSL Simulator: Element not found: ${elementOrSelector}`);
      this.element = el;
    } else {
      this.element = elementOrSelector;
    }
  }

  setRuntime(runtime: Record<string, any>): void {
    this.runtime = {...runtime};
  }

  updateRuntime(key: string, value: any): void {
    this.runtime[key] = value;
  }

  simulate(dslText: string): Promise<SimulationStep[]> {
    try {
      const res = executeDsl(dslText, { 
        getParamValue: (name: string) => this.runtime[name] 
      });
      return Promise.resolve(res.plan || []);
    } catch {
      return Promise.resolve([]);
    }
  }

  render(dslText: string): void {
    this.simulate(dslText).then(steps => {
      const html = steps.map((p: SimulationStep) => {
        if (p.kind === 'goal') {
          return `<li class="sim-goal">${escapeHtml('GOAL: ' + String(p.name || ''))}</li>`;
        }
        if (p.kind === 'condition') {
          const c = p.condition;
          const line = `IF ${q(c.parameter)} ${c.operator} ${q(c.value)}`;
          const hl = highlightDsl(line);
          const cls = p.passed ? 'pass' : 'fail';
          const badge = `<span class="badge ${cls}">${p.passed ? 'PASS' : 'FAIL'}</span>`;
          return `<li class="${cls}">${hl} ${badge}</li>`;
        }
        if (p.kind === 'task') {
          const t = p.task as any;
          const line = renderLegacyTaskAsDslLines(t, '  ').join('\n');
          return `<li>${highlightDsl(line)}</li>`;
        }
        if (p.kind === 'var') {
          const action = String(p.action || '').toUpperCase();
          const unit = String(p.unit || '').trim();
          const value = String(p.value ?? '').trim();
          const line = (action === 'GET' || action === 'VAL')
            ? `${action} ${q(p.parameter)}${unit ? ` ${q(unit)}` : ''}`
            : `${action} ${q(p.parameter)} ${q(`${value}${unit ? ` ${unit}` : ''}`)}`;
          return `<li>${highlightDsl(line)}</li>`;
        }
        if (p.kind === 'wait') {
          const unit = p.unit ? ` ${p.unit}` : '';
          return `<li>${highlightDsl(`SET ${q('WAIT')} ${q(`${p.duration ?? ''}${unit}`)}`)}</li>`;
        }
        if (p.kind === 'pump') {
          const raw = `${p.raw || `${p.value || ''}${p.unit ? ` ${p.unit}` : ''}`}`.trim();
          return `<li>${highlightDsl(`SET ${q('POMPA')} ${q(raw)}`)}</li>`;
        }
        if (p.kind === 'else') {
          const e = p.else;
          const line = `ELSE ${e.actionType} ${q(e.actionMessage || '')}`;
          return `<li>${highlightDsl(line)}</li>`;
        }
        return '';
      }).join('');
      
      this.element.innerHTML = html;
    }).catch(() => {
      this.element.innerHTML = '<li class="text-muted"><em>Błąd symulacji</em></li>';
    });
  }

  clear(): void {
    this.element.innerHTML = '';
  }
}
