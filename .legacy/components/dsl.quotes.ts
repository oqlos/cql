export const DSL_QUOTED_TOKEN_PATTERN = String.raw`(?:'[^'\r\n]*'|"[^"\r\n]*")`;

const SINGLE_QUOTED_TOKEN_RX = /'([^'\r\n]*)'/g;
const DOUBLE_QUOTED_TOKEN_RX = /"([^"\r\n]*)"/g;

export function normalizeDslLineQuotes(line: string): string {
  return String(line ?? '').replace(SINGLE_QUOTED_TOKEN_RX, (_match, value) => `"${value}"`);
}

export function normalizeDslTextQuotes(text: string): string {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => normalizeDslLineQuotes(line))
    .join('\n');
}

export function formatDslLiteral(value: string): string {
  const text = String(value ?? '');
  if (!text.includes("'")) return `'${text}'`;
  return `"${text}"`;
}

export function quoteDslValue(value: unknown): string {
  return formatDslLiteral(String(value ?? ''));
}

export function canonicalizeDslLineQuotes(line: string): string {
  return String(line ?? '').replace(DOUBLE_QUOTED_TOKEN_RX, (_match, value) => formatDslLiteral(value));
}

export function canonicalizeDslQuotes(text: string): string {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => canonicalizeDslLineQuotes(line))
    .join('\n');
}

export function getFirstDefined(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return '';
}

export function readQuotedToken(token: string): { quote: string; value: string } {
  const raw = String(token ?? '');
  const last = raw.charAt(raw.length - 1);
  if (raw.length >= 2 && (raw.startsWith("'") || raw.startsWith('"')) && last === raw.charAt(0)) {
    return { quote: raw.charAt(0), value: raw.slice(1, -1) };
  }
  return { quote: "'", value: raw };
}