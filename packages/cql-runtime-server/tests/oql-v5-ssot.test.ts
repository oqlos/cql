import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleRequest } from '../src/routes.ts';

const V5_SAMPLE = `VERSION: 5
GOAL:
  SET NAME 'Pressure'
  RANGE 'Ciśnienie' '10 bar' .. '100 bar'
  PASS 'Ciśnienie' 'dobrze'
  FAIL 'Ciśnienie' 'źle'
  TASK TITLE 'Potwierdź'
  TASK PASS 'OK'
`;

describe('oql v5 SSOT via @semcod/oqlts', () => {
  it('parse maps RANGE/PASS/FAIL/TASK to legacy ast steps', async () => {
    const res = await handleRequest('POST', '/api/cql/parse', { text: V5_SAMPLE });
    assert.equal(res?.status, 200);
    const body = res?.body as { ok: boolean; ast: { goals: Array<{ steps: unknown[] }> } };
    assert.equal(body.ok, true);
    const steps = body.ast.goals[0].steps;
    assert.deepEqual(steps[0], { type: 'min', parameter: 'Ciśnienie', value: '10', unit: 'bar' });
    assert.deepEqual(steps[1], { type: 'max', parameter: 'Ciśnienie', value: '100', unit: 'bar' });
    assert.deepEqual(steps[2], { type: 'pass', parameter: 'Ciśnienie', message: 'dobrze' });
    assert.deepEqual(steps[3], { type: 'fail', parameter: 'Ciśnienie', message: 'źle' });
    assert.deepEqual(steps[4], { type: 'task_dialog_line', field: 'title', value: 'Potwierdź' });
    assert.deepEqual(steps[5], { type: 'task_dialog_line', field: 'pass', value: 'OK' });
  });

  it('legacy v3 still uses block parser', async () => {
    const res = await handleRequest('POST', '/api/cql/parse', {
      text: 'SCENARIO: test\nGOAL: test\n  SET "x" "5"',
    });
    assert.equal(res?.status, 200);
    const body = res?.body as { ok: boolean; ast: { scenario: string } };
    assert.equal(body.ok, true);
    assert.equal(body.ast.scenario, 'test');
  });
});
