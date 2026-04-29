import { beforeEach, describe, expect, it } from 'vitest';

describe('DSL Highlight Renderer', () => {
  let highlightDsl: (text: string) => string;

  beforeEach(async () => {
    const module = await import('../components/dsl/dsl.highlight');
    highlightDsl = module.highlightDsl;
  });

  it('renders POMPA alias with canonical single quotes', () => {
    const result = highlightDsl("  SET 'POMPA' '5l'");

    expect(result).toContain('SET');
    expect(result).toContain("'POMPA'");
    expect(result).not.toContain('"PUMP"');
  });

  it('preserves dedicated WAIT syntax instead of rewriting it to SET WAIT', () => {
    const result = highlightDsl("  WAIT '1s'");

    expect(result).toContain('WAIT');
    expect(result).not.toContain('SET');
  });
});