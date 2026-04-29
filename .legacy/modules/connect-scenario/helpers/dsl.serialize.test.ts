import { afterEach, describe, expect, it } from 'vitest';

import { buildGoalContentFromSection } from './dsl.serialize';

describe('dsl.serialize buildGoalContentFromSection', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no goal section is provided', () => {
    expect(buildGoalContentFromSection(null, 'Goal')).toBeNull();
  });

  it('serializes modern step blocks in DOM order', () => {
    document.body.innerHTML = `
      <div class="goal-section">
        <div class="steps-container">
          <div class="step-block set-action-block">
            <select class="task-action-select"><option selected>Włącz</option></select>
            <select class="task-object-select"><option selected>pompa 1</option></select>
          </div>
          <div class="step-block wait-block">
            <select class="task-wait-select"><option selected>delay</option></select>
            <input class="wait-duration-input" value="1.5 s" />
          </div>
          <div class="step-block variable-block" data-var-kind="SET">
            <select class="param-select"><option selected>NC</option></select>
            <input class="value-input" value="12" />
            <span class="unit-label">mbar</span>
          </div>
          <div class="step-block condition-group" data-condition-type="if">
            <select class="param-select"><option selected>NC</option></select>
            <select class="operator-select"><option selected>&gt;</option></select>
            <select class="variable-select"><option selected>threshold</option></select>
          </div>
          <div class="step-block condition-group" data-condition-type="else">
            <select class="action-type-select"><option selected>ERROR</option></select>
            <input class="message-input" value="Brak progu" />
          </div>
          <div class="step-block info-block">
            <select class="info-level-select"><option selected>INFO</option></select>
            <input class="info-message-input" value="Uruchomiono" />
          </div>
          <div class="step-block result-block">
            <select class="result-select"><option selected>OK</option></select>
          </div>
          <div class="step-block log-block">
            <select class="log-select"><option selected>Start</option></select>
          </div>
          <div class="step-block func-call-block">
            <select class="func-call-select"><option selected>helper</option></select>
          </div>
          <div class="step-block out-block">
            <select class="out-type-select"><option selected>RESULT</option></select>
            <input class="out-value-input" value="" />
            <select class="out-value-select"><option selected>OK</option></select>
          </div>
          <div class="step-block dialog-block">
            <select class="dialog-param-select"><option selected>Operator</option></select>
            <input class="dialog-message-input" value="Potwierdź" />
          </div>
          <div class="step-block repeat-block"></div>
          <div class="step-block end-block"></div>
        </div>
      </div>
    `;

    const goalSection = document.querySelector('.goal-section') as HTMLElement;

    expect(buildGoalContentFromSection(goalSection, 'Runtime Goal')).toEqual({
      dsl: [
        'GOAL: Runtime Goal',
        "  SET 'pompa 1' '1'",
        "  SET 'DELAY' '1.5 s'",
        "  SET 'NC' '12 mbar'",
        "  IF 'NC' > 'threshold'",
        "  ELSE ERROR 'Brak progu'",
        "  INFO 'INFO' 'Uruchomiono'",
        "  RESULT 'OK'",
        '  LOG "Start"',
        "  FUNC 'helper'",
        "  OUT 'RESULT' 'OK'",
        "  DIALOG 'Operator' 'Potwierdź'",
        '  REPEAT',
        '  END',
      ].join('\n'),
      goals: ['Runtime Goal'],
    });
  });

  it('serializes legacy task and variable containers', () => {
    document.body.innerHTML = `
      <div class="goal-section">
        <div class="steps-container">
          <div class="task-container">
            <div class="sentence-builder">
              <div class="sentence-part">
                <select class="function-select"><option selected>Włącz</option></select>
                <select class="object-select"><option selected>pompa 1</option></select>
              </div>
              <div class="sentence-part">
                <button class="btn-add-and">AND</button>
                <select class="function-select"><option selected>Zamknij</option></select>
                <select class="object-select"><option selected>zawór 1</option></select>
              </div>
            </div>
          </div>
          <div class="variable-container" data-var-kind="SET">
            <div class="variable-builder">
              <div class="var-row">
                <select class="action-select"><option selected>GET</option></select>
                <select class="param-select"><option selected>NC</option></select>
                <input class="value-input" value="" />
                <select class="unit-select"><option selected>mbar</option></select>
              </div>
              <div class="var-row">
                <select class="action-select"><option selected>VAL</option></select>
                <select class="param-select"><option selected>Temp</option></select>
                <input class="value-input" value="" />
                <select class="unit-select"><option selected>C</option></select>
              </div>
              <div class="var-row">
                <select class="action-select"><option selected>SET</option></select>
                <select class="param-select"><option selected>czas</option></select>
                <input class="value-input" value="5" />
                <select class="unit-select"><option selected>s</option></select>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const goalSection = document.querySelector('.goal-section') as HTMLElement;
    const result = buildGoalContentFromSection(goalSection, 'Legacy Goal');

    expect(result?.dsl).toBe([
      'GOAL: Legacy Goal',
      "  SET 'pompa 1' '1'",
      "  GET 'NC' 'mbar'",
      "  VAL 'Temp' 'C'",
      "  SET 'czas' '5 s'",
    ].join('\n'));
  });
});