// frontend/src/components/dsl/dsl-scenario-builders.ts
// DSL builders for different scenario types (moved from modules)
import { renderLegacyTaskAsDslLines } from './dsl-content-helpers';
import { quoteDslValue as q } from './dsl.quotes';

/**
 * Build DSL from TestScenario for device testing
 */
export class DslScenarioBuilders {
  /**
   * Build DSL text from TestScenario (moved from device-testing.dsl.ts)
   */
  static buildDslFromTestScenario(sc: any): string {
    const lines: string[] = [];
    lines.push(`SCENARIO: ${sc.name}`);
    lines.push('');
    for (const act of (sc.activities || [])) {
      lines.push(`GOAL: ${act.name}`);
      lines.push(`  SET ${q(act.name)} ${q('1')}`);
      const c: any = act.criteria || {};
      const unit = c.unit || '';
      const param = unit ? unit : act.name;
      if (typeof c.min !== 'undefined') lines.push(`  IF ${q(param)} >= ${q(`${c.min}${unit ? ` ${unit}` : ''}`)}`);
      if (typeof c.max !== 'undefined') lines.push(`  IF ${q(param)} <= ${q(`${c.max}${unit ? ` ${unit}` : ''}`)}`);
      if (typeof c.targetValue !== 'undefined') lines.push(`  IF ${q(param)} = ${q(`${c.targetValue}${unit ? ` ${unit}` : ''}`)}`);
      if (typeof c.duration !== 'undefined') lines.push(`  IF ${q('czas')} >= ${q(`${c.duration} s`)}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  /**
   * Build goals JSON from TestScenario (moved from device-testing.dsl.ts)
   */
  static buildGoalsFromTestScenario(sc: any): any[] {
    const goals: any[] = [];
    for (const act of (sc.activities || [])) {
      const conditions: any[] = [];
      const c: any = act.criteria || {};
      const unit = c.unit || '';
      const param = unit ? unit : act.name;
      const result = 'test zaliczony';
      if (typeof c.min !== 'undefined') conditions.push({ type: 'if', parameter: param, operator: '>=', value: String(c.min), unit, result });
      if (typeof c.max !== 'undefined') conditions.push({ type: 'if', parameter: param, operator: '<=', value: String(c.max), unit, result });
      if (typeof c.targetValue !== 'undefined') conditions.push({ type: 'if', parameter: param, operator: '=', value: String(c.targetValue), unit, result });
      if (typeof c.duration !== 'undefined') conditions.push({ type: 'if', parameter: 'czas', operator: '>=', value: String(c.duration), unit: 's', result });
      const goal = {
        name: act.name,
        tasks: [{ function: 'Sprawdź', object: act.name }],
        conditions
      };
      goals.push(goal);
    }
    return goals;
  }

  /**
   * Build DSL from generic scenario content
   */
  static buildDslFromGenericScenario(scenario: any): string {
    const lines: string[] = [];
    const name = scenario?.name || 'Generic Scenario';
    lines.push(`SCENARIO: ${name}`);
    lines.push('');

    const goals = Array.isArray(scenario?.goals) ? scenario.goals : [];
    for (const goal of goals) {
      lines.push(`GOAL: ${goal.name || 'GOAL'}`);
      
      // Tasks
      const tasks = Array.isArray(goal?.tasks) ? goal.tasks : [];
      for (const task of tasks) {
        if (task?.function && task?.object) {
          lines.push(...renderLegacyTaskAsDslLines(task, '  '));
        }
      }

      // Variables  
      const variables = Array.isArray(goal?.variables) ? goal.variables : [];
      for (const varGroup of variables) {
        const vars = Array.isArray(varGroup?.variables) ? varGroup.variables : [];
        for (const v of vars) {
          const action = String(v?.action || 'GET').toUpperCase();
          const param = String(v?.parameter || '');
          const val = String(v?.value ?? '').trim();
          const unit = String(v?.unit || '').trim();
          if (!param) continue;
          if (action === 'GET') {
            lines.push(`  GET ${q(param)}${unit ? ` ${q(unit)}` : ''}`);
          } else if (action === 'VAL') {
            lines.push(`  VAL ${q(param)}${unit ? ` ${q(unit)}` : ''}`);
          } else {
            const right = unit ? `${val} ${unit}` : `${val}`;
            lines.push(`  ${action} ${q(param)} ${q(right)}`);
          }
        }
      }

      // Conditions
      const conditions = Array.isArray(goal?.conditions) ? goal.conditions : [];
      for (const c of conditions) {
        const t = (c?.type || '').toLowerCase();
        if (t === 'if') {
          const unit = (c?.unit || '').trim();
          const val = String(c?.value ?? '').trim();
          lines.push(`  IF ${q(c?.parameter || '')} ${c?.operator || '='} ${q(`${val}${unit ? ` ${unit}` : ''}`)}`);
        } else if (t === 'else') {
          lines.push(`  ELSE ${c?.actionType || 'ERROR'} ${q(c?.actionMessage || '')}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
