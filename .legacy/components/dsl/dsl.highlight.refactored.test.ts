// Test suite for refactored highlightDsl (rules-based approach)
import { highlightDsl } from './dsl.highlight';

describe('highlightDsl (refactored)', () => {
  describe('basic structure', () => {
    it('handles empty string', () => {
      expect(highlightDsl('')).toBe('');
    });

    it('handles empty lines', () => {
      expect(highlightDsl('\n\n')).toBe('\n\n');
    });

    it('handles comments', () => {
      const input = '# This is a comment';
      expect(highlightDsl(input)).toContain('# This is a comment');
    });
  });

  describe('definitions', () => {
    it('highlights SCENARIO', () => {
      const input = 'SCENARIO: TestScenario';
      expect(highlightDsl(input)).toContain('SCENARIO:');
      expect(highlightDsl(input)).toContain('TestScenario');
    });

    it('highlights GOAL', () => {
      const input = 'GOAL: TestGoal';
      expect(highlightDsl(input)).toContain('GOAL:');
      expect(highlightDsl(input)).toContain('TestGoal');
    });

    it('highlights FUNC definition', () => {
      const input = 'FUNC: myFunction';
      expect(highlightDsl(input)).toContain('FUNC:');
      expect(highlightDsl(input)).toContain('myFunction');
    });
  });

  describe('variable operations', () => {
    it('highlights GET', () => {
      const input = 'GET "temperature"';
      expect(highlightDsl(input)).toContain('GET');
      expect(highlightDsl(input)).toContain('temperature');
    });

    it('highlights GET with unit', () => {
      const input = 'GET "pressure" "bar"';
      expect(highlightDsl(input)).toContain('GET');
      expect(highlightDsl(input)).toContain('pressure');
      expect(highlightDsl(input)).toContain('bar');
    });

    it('highlights SET', () => {
      const input = 'SET "var" "value"';
      expect(highlightDsl(input)).toContain('SET');
      expect(highlightDsl(input)).toContain('var');
      expect(highlightDsl(input)).toContain('value');
    });

    it('highlights VAL', () => {
      const input = 'VAL "result"';
      expect(highlightDsl(input)).toContain('VAL');
      expect(highlightDsl(input)).toContain('result');
    });

    it('highlights OUT', () => {
      const input = 'OUT "VAL" "output"';
      expect(highlightDsl(input)).toContain('OUT');
      expect(highlightDsl(input)).toContain('VAL');
      expect(highlightDsl(input)).toContain('output');
    });

    it('highlights MAX/MIN', () => {
      expect(highlightDsl('MAX "temp" "100"')).toContain('MAX');
      expect(highlightDsl('MIN "temp" "0"')).toContain('MIN');
    });
  });

  describe('tasks', () => {
    it('highlights TASK numbered', () => {
      const input = 'TASK 1:';
      expect(highlightDsl(input)).toContain('TASK');
      expect(highlightDsl(input)).toContain('1');
    });

    it('highlights TASK with action', () => {
      const input = 'TASK "action" "value"';
      expect(highlightDsl(input)).toContain('TASK');
      expect(highlightDsl(input)).toContain('action');
    });
  });

  describe('IF conditions', () => {
    it('highlights simple IF', () => {
      const input = 'IF "temp" > "100"';
      expect(highlightDsl(input)).toContain('IF');
      expect(highlightDsl(input)).toContain('temp');
      expect(highlightDsl(input)).toContain('&gt;'); // HTML escaped
    });

    it('highlights IF with TO', () => {
      const input = 'IF "temp" > "100" TO "result"';
      expect(highlightDsl(input)).toContain('IF');
      expect(highlightDsl(input)).toContain('TO');
    });

    it('highlights compound IF with OR', () => {
      const input = 'IF "a" > "1" OR "b" < "2"';
      expect(highlightDsl(input)).toContain('IF');
      expect(highlightDsl(input)).toContain('OR');
    });

    it('highlights AND IF / OR IF', () => {
      const input = 'AND IF "x" > "1"';
      expect(highlightDsl(input)).toContain('AND');
      expect(highlightDsl(input)).toContain('IF');
    });
  });

  describe('ELSE', () => {
    it('highlights simple ELSE', () => {
      const input = 'ELSE';
      expect(highlightDsl(input)).toContain('ELSE');
    });

    it('highlights ELSE with message type', () => {
      const input = 'ELSE ERROR "message"';
      expect(highlightDsl(input)).toContain('ELSE');
      expect(highlightDsl(input)).toContain('ERROR');
      expect(highlightDsl(input)).toContain('message');
    });
  });

  describe('control flow', () => {
    it('highlights REPEAT', () => {
      expect(highlightDsl('REPEAT')).toContain('REPEAT');
    });

    it('highlights STOP/PAUSE', () => {
      expect(highlightDsl('STOP')).toContain('STOP');
      expect(highlightDsl('PAUSE')).toContain('PAUSE');
    });

    it('highlights END', () => {
      expect(highlightDsl('END')).toContain('END');
    });
  });

  describe('misc commands', () => {
    it('highlights LOG', () => {
      expect(highlightDsl('LOG "message"')).toContain('LOG');
    });

    it('highlights SAVE', () => {
      expect(highlightDsl('SAVE "data"')).toContain('SAVE');
    });

    it('highlights RESULT', () => {
      expect(highlightDsl('RESULT "value"')).toContain('RESULT');
    });

    it('highlights FUNC call', () => {
      expect(highlightDsl('FUNC "myFunc" "arg1"')).toContain('FUNC');
    });

    it('highlights DIALOG', () => {
      expect(highlightDsl('DIALOG "title" "message"')).toContain('DIALOG');
    });

    it('highlights USER', () => {
      expect(highlightDsl('USER "name" "role"')).toContain('USER');
    });

    it('highlights INFO', () => {
      expect(highlightDsl('INFO "key"')).toContain('INFO');
    });
  });

  describe('arrow and AND function', () => {
    it('highlights arrow operator', () => {
      const input = '→ function "var"';
      expect(highlightDsl(input)).toContain('→');
      expect(highlightDsl(input)).toContain('function');
    });

    it('highlights AND function', () => {
      const input = 'AND func "var"';
      expect(highlightDsl(input)).toContain('AND');
      expect(highlightDsl(input)).toContain('func');
    });
  });

  describe('pump and wait', () => {
    it('highlights PUMP', () => {
      expect(highlightDsl('PUMP "value"')).toContain('PUMP');
      expect(highlightDsl('SET "PUMP" "value"')).toContain('SET');
    });

    it('highlights WAIT', () => {
      expect(highlightDsl('WAIT "10s"')).toContain('WAIT');
      expect(highlightDsl('SET "WAIT" "10s"')).toContain('WAIT');
    });
  });

  describe('indentation preservation', () => {
    it('preserves leading whitespace', () => {
      const input = '  GET "var"';
      const result = highlightDsl(input);
      expect(result.startsWith('  ')).toBe(true);
    });

    it('preserves tabs', () => {
      const input = '\tGET "var"';
      const result = highlightDsl(input);
      expect(result.startsWith('\t')).toBe(true);
    });
  });

  describe('complex scripts', () => {
    it('handles multi-line script', () => {
      const input = `SCENARIO: Test
GOAL: Main
GET "var"
IF "var" > "10"
  LOG "big"
ELSE
  LOG "small"
END`;
      const result = highlightDsl(input);
      expect(result).toContain('SCENARIO:');
      expect(result).toContain('GOAL:');
      expect(result).toContain('GET');
      expect(result).toContain('IF');
      expect(result).toContain('LOG');
      expect(result).toContain('ELSE');
      expect(result).toContain('END');
    });
  });

  describe('fallback (unmatched lines)', () => {
    it('escapes unmatched lines', () => {
      const input = 'some random <text>';
      const result = highlightDsl(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });
  });
});
