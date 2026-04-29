import { ScenariosApiHelper } from '../../modules/shared/scenarios-api.helper';
import { parseDsl } from './dsl.parser';
import { validateAst, getJsonSchema } from './dsl.schema';
import { dslToXml } from './dsl.xml';
import { normalizeDslText } from './dsl.serialize.text';
import { validateDslFormat } from './dsl.validator';

export type ScenarioValidationReport = {
  id: string;
  name?: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  xml?: string;
  dsl?: string;
  fixedText?: string;
};

export async function fetchTestScenarios(): Promise<any[]> {
  return ScenariosApiHelper.listScenarioRows();
}

const TOP_LEVEL_DSL_FIELDS = ['dsl', 'script', 'text'] as const;

function extractStringFromUnknown(x: any): string {
  if (typeof x === 'string') {
    // try to parse JSON-encoded string that might contain { dsl: "..." }
    const s = x.trim();
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const j = JSON.parse(s);
        const candidates = [j?.dsl, j?.text, j?.script, j?.content?.dsl];
        for (const c of candidates) if (typeof c === 'string' && c.trim()) return c as string;
      } catch { /* silent */ }
    }
    return x as string;
  }
  return '';
}

function extractFirstNonEmptyString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function extractTopLevelDsl(row: any): string {
  return extractFirstNonEmptyString(TOP_LEVEL_DSL_FIELDS.map((field) => row?.[field]));
}

function parseLibrarySource(libRaw: any): any | null {
  if (!libRaw) return null;
  if (typeof libRaw === 'string') {
    try {
      return JSON.parse(libRaw);
    } catch {
      return null;
    }
  }
  return typeof libRaw === 'object' ? libRaw : null;
}

function appendLibraryGoalCode(lines: string[], code: string): void {
  if (!code) return;
  for (const line of code.split(/\r?\n/)) {
    lines.push(line.trim() ? `  ${line}` : '');
  }
}

function buildLibraryGoalsDsl(goals: any[]): string {
  const lines: string[] = [];
  for (const goal of goals) {
    const name = String(goal?.name || '').trim() || 'Unnamed';
    lines.push(`GOAL: ${name}`);
    appendLibraryGoalCode(lines, String(goal?.code || '').trimEnd());
    lines.push('');
  }
  return lines.join('\n').trim();
}

function extractDslFromLibrary(row: any): string {
  const lib = parseLibrarySource((row as any)?.library);
  const goals = Array.isArray(lib?.goals) ? lib.goals : [];
  return goals.length ? buildLibraryGoalsDsl(goals) : '';
}

function extractDslFromContent(content: any): string {
  if (typeof content === 'string') {
    const extracted = extractStringFromUnknown(content);
    return extracted.trim() ? extracted : content.trim() ? content : '';
  }
  if (content && typeof content === 'object') {
    return extractFirstNonEmptyString([content.dsl, content.text, content.script, content?.content?.dsl]);
  }
  return '';
}

function extractDslFromRow(row: any): string {
  return extractTopLevelDsl(row) || extractDslFromLibrary(row) || extractDslFromContent(row?.content);
}

function hasScenarioHeader(text: string): boolean {
  return /(^|\n)\s*SCENARIO\s*:/i.test(text);
}

function buildValidationText(name: string, dsl: string): string {
  return hasScenarioHeader(dsl) ? dsl : `SCENARIO: ${name || 'Bez nazwy'}\n\n${dsl}`;
}

function collectValidationErrors(
  fmt: { ok: boolean; errors?: string[] },
  parsed: { ok: boolean; errors: string[] },
  astOk: { ok: boolean; errors: string[] },
  xmlRes: { ok: boolean; errors?: string[] },
): string[] {
  if (!parsed.ok) return parsed.errors;
  return [
    ...(fmt.ok ? [] : (fmt.errors || [])),
    ...(astOk.ok ? [] : (astOk.errors || [])),
    ...(xmlRes.ok ? [] : (xmlRes as any).errors || [])
  ];
}

export function validateDslText(text: string): ScenarioValidationReport {
  const normalized = normalizeDslText(text || '');
  const fmt = validateDslFormat(normalized);
  const src = (fmt.fixedText && fmt.fixedText.trim()) ? fmt.fixedText : normalized;
  const parsed = parseDsl(src);
  const astOk = parsed.ok ? validateAst(parsed.ast) : { ok: false, errors: [], ast: null };
  const xmlRes = parsed.ok ? dslToXml(src) : { ok: false as const, errors: parsed.errors };
  const uniqueErrors = Array.from(new Set(collectValidationErrors(fmt, parsed, astOk, xmlRes)));
  return {
    id: '',
    ok: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: Array.from(new Set((fmt.warnings || []).slice())),
    xml: xmlRes.ok ? xmlRes.xml : undefined,
    dsl: src,
    fixedText: fmt.fixedText
  };
}

export async function validateAllTestScenarios(): Promise<ScenarioValidationReport[]> {
  const rows = await fetchTestScenarios();
  const reports: ScenarioValidationReport[] = [];
  for (const row of rows) {
    const id = String(row?.id || row?._id || row?.uuid || '');
    const name = String(row?.name || row?.title || '');
    const dsl = extractDslFromRow(row);
    if (!dsl) {
      reports.push({ id, name, ok: false, errors: ['Brak DSL w rekordzie'], warnings: [] });
      continue;
    }
    const textForValidation = buildValidationText(name, dsl);
    const r = validateDslText(textForValidation);
    r.id = id; r.name = name;
    reports.push(r);
  }
  return reports;
}

export function downloadJsonSchema(filename = 'dsl.schema.json'): void {
  try {
    const schema = JSON.stringify(getJsonSchema(), null, 2);
    const blob = new Blob([schema], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch { /* silent */ }
}
