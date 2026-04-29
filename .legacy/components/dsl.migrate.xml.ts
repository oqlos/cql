import { xmlToAst } from './dsl.xml';
import { astToDslText, normalizeDslText } from './dsl.serialize.text';
import type { DslAst, DslGoal, DslStepTask } from './dsl.types';
import { ScenariosApiHelper } from '../../modules/shared/scenarios-api.helper';

export type MigrationResult = {
  ok: boolean;
  name?: string;
  ast?: DslAst;
  dsl?: string;
  errors?: string[];
};

type DbMigrationResult = { file: string; ok: boolean; id?: string; errors?: string[] };

type LegacyOperationData = { name?: string; dspl: string[] };
type LegacyTransactionData = { name?: string; ops: Record<string, LegacyOperationData> };
type LegacyTransactionEntry =
  | { type: 'transaction-name'; trIdx: string }
  | { type: 'operation-name'; trIdx: string; opIdx: string }
  | { type: 'operation-dspl'; trIdx: string; opIdx: string };

function parseLegacyReportDocument(xml: string): Document | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  return root && root.tagName.toLowerCase() === 'data' ? doc : null;
}

function collectLegacyVarMap(doc: Document): Map<string, string> {
  const vars = Array.from(doc.querySelectorAll('var')) as Element[];
  const varMap = new Map<string, string>();
  for (const variable of vars) {
    const id = variable.getAttribute('id') || '';
    const value = (variable.textContent || '').trim();
    if (id) varMap.set(id, value);
  }
  return varMap;
}

function getLegacyValue(varMap: Map<string, string>, id: string): string {
  return varMap.get(id) || '';
}

function resolveLegacyDeviceName(varMap: Map<string, string>, fallback?: string): string {
  return (
    getLegacyValue(varMap, 'dt#name')
    || getLegacyValue(varMap, 'df#name')
    || getLegacyValue(varMap, 'cs#name1')
    || getLegacyValue(varMap, 'dv#barcode')
    || fallback
    || ''
  ).trim();
}

function parseLegacyTransactionEntry(key: string): LegacyTransactionEntry | null {
  const parts = key.split('#');
  if (parts.length < 4 || parts[0] !== 'dt' || parts[1] !== 'tr') return null;
  const trIdx = parts[2];
  if (parts[3] === 'name') return { type: 'transaction-name', trIdx };
  if (parts[3] !== 'op' || parts.length < 6) return null;
  const opIdx = parts[4];
  if (parts[5] === 'name') return { type: 'operation-name', trIdx, opIdx };
  if (parts[5] === 'dspl' && parts[6]) return { type: 'operation-dspl', trIdx, opIdx };
  return null;
}

function ensureLegacyTransaction(transactions: Record<string, LegacyTransactionData>, trIdx: string): LegacyTransactionData {
  transactions[trIdx] = transactions[trIdx] || { ops: {} };
  return transactions[trIdx];
}

function ensureLegacyOperation(transaction: LegacyTransactionData, opIdx: string): LegacyOperationData {
  transaction.ops[opIdx] = transaction.ops[opIdx] || { dspl: [] };
  return transaction.ops[opIdx];
}

function applyLegacyTransactionEntry(
  transactions: Record<string, LegacyTransactionData>,
  entry: LegacyTransactionEntry,
  value: string,
): void {
  const transaction = ensureLegacyTransaction(transactions, entry.trIdx);
  if (entry.type === 'transaction-name') {
    transaction.name = value;
    return;
  }
  const operation = ensureLegacyOperation(transaction, entry.opIdx);
  if (entry.type === 'operation-name') {
    operation.name = value;
    return;
  }
  operation.dspl.push(value);
}

function collectLegacyTransactions(varMap: Map<string, string>): Record<string, LegacyTransactionData> {
  const transactions: Record<string, LegacyTransactionData> = {};
  for (const [key, value] of varMap) {
    const entry = parseLegacyTransactionEntry(key);
    if (entry) applyLegacyTransactionEntry(transactions, entry, value);
  }
  return transactions;
}

function sortLegacyNumericKeys(values: Record<string, unknown>): string[] {
  return Object.keys(values).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
}

function buildLegacyOperationTitle(operation: LegacyOperationData, opIdx: string): string {
  return (operation.name || operation.dspl.filter(Boolean).join(' ').trim() || `OP ${opIdx}`).trim();
}

function buildLegacyTaskSteps(operation: LegacyOperationData, opIdx: string): DslStepTask[] {
  const dsplLines = Array.isArray(operation.dspl) ? operation.dspl.filter(Boolean) : [];
  const taskLines = dsplLines.length ? dsplLines : [buildLegacyOperationTitle(operation, opIdx)];
  return taskLines.map((line) => ({ type: 'task', function: line, ands: [] }));
}

function buildLegacyGoals(transaction: LegacyTransactionData): DslGoal[] {
  const goals: DslGoal[] = [];
  const operationKeys = sortLegacyNumericKeys(transaction.ops);
  for (const opIdx of operationKeys) {
    const operation = transaction.ops[opIdx];
    const goalName = buildLegacyOperationTitle(operation, opIdx);
    goals.push({
      name: goalName,
      tasks: [],
      conditions: [],
      steps: buildLegacyTaskSteps(operation, opIdx),
    });
  }
  return goals;
}

function buildLegacyScenarioName(deviceName: string, trIdx: string | undefined, transaction: LegacyTransactionData | undefined, nameHint?: string): string {
  const transactionName = trIdx ? (transaction?.name || `TR ${trIdx}`).trim() : '';
  return [deviceName, transactionName].filter(Boolean).join(' ').trim() || (nameHint || 'Legacy Scenario');
}

function buildLegacyScenarioAst(
  deviceName: string,
  trIdx: string | undefined,
  transaction: LegacyTransactionData | undefined,
  nameHint?: string,
): DslAst {
  return {
    scenario: buildLegacyScenarioName(deviceName, trIdx, transaction, nameHint),
    goals: transaction ? buildLegacyGoals(transaction) : [],
  };
}

function parseLegacyReportData(xml: string): { varMap: Map<string, string>; transactions: Record<string, LegacyTransactionData> } | null {
  try {
    const doc = parseLegacyReportDocument(xml);
    if (!doc) return null;
    const varMap = collectLegacyVarMap(doc);
    return { varMap, transactions: collectLegacyTransactions(varMap) };
  } catch {
    return null;
  }
}

// New: Parse legacy <data><var id> XML and split into multiple scenarios (one per test type/transaction)
function parseLegacyReportXmlAstMulti(xml: string, nameHint?: string): DslAst[] | null {
  const parsed = parseLegacyReportData(xml);
  if (!parsed) return null;
  const deviceName = resolveLegacyDeviceName(parsed.varMap, nameHint);
  return sortLegacyNumericKeys(parsed.transactions).map((trIdx) =>
    buildLegacyScenarioAst(deviceName, trIdx, parsed.transactions[trIdx], nameHint),
  );
}

function parseLegacyReportXmlAst(xml: string, nameHint?: string): DslAst | null {
  const parsed = parseLegacyReportData(xml);
  if (!parsed) return null;
  const transactionKeys = sortLegacyNumericKeys(parsed.transactions);
  const firstTr = transactionKeys[0];
  return buildLegacyScenarioAst(
    resolveLegacyDeviceName(parsed.varMap),
    firstTr,
    firstTr ? parsed.transactions[firstTr] : undefined,
    nameHint,
  );
}

export function migrateLegacyXmlToDsl(xml: string, nameHint?: string): MigrationResult {
  // 1) Try native DSL XML first
  const res = xmlToAst(xml);
  if (res.ok && res.ast) {
    const ast = res.ast as DslAst;
    const dsl = normalizeDslText(astToDslText(ast));
    return { ok: true, name: nameHint || ast.scenario, ast, dsl };
  }
  // 2) Fallback: legacy report XML (<data><var id="...">)
  const legacyAst = parseLegacyReportXmlAst(xml, nameHint);
  if (legacyAst) {
    const dsl = normalizeDslText(astToDslText(legacyAst));
    return { ok: true, name: nameHint || legacyAst.scenario, ast: legacyAst, dsl };
  }
  return { ok: false, name: nameHint, errors: res.errors || ['Failed to parse XML'] };
}

export async function postScenarioToDb(name: string, dsl: string): Promise<{ ok: boolean; id?: string }> {
  try {
    const contentObj = { dsl } as any;
    const id = await ScenariosApiHelper.createScenario(name);
    if (!id) return { ok: false };
    try {
      await ScenariosApiHelper.updateScenario(id, { title: name, content: contentObj, dsl });
    } catch {
      try { await ScenariosApiHelper.deleteScenario(id); } catch { /* silent */ }
      return { ok: false };
    }
    return { ok: true, id };
  } catch {
    return { ok: false };
  }
}

function isFileList(files: FileList | File[]): files is FileList {
  return typeof FileList !== 'undefined' && files instanceof FileList;
}

function normalizeMigrationFiles(files: FileList | File[]): File[] {
  return isFileList(files) ? Array.from(files) : Array.from(files);
}

function getMigrationName(file: File, nameFromFile: boolean): string | undefined {
  return nameFromFile ? file.name.replace(/\.xml$/i, '') : undefined;
}

function buildDbMigrationResult(file: string, ok: boolean, id?: string, errors: string[] = []): DbMigrationResult {
  return { file, ok, id, errors };
}

function buildDbMigrationError(file: string, error: unknown): DbMigrationResult {
  return { file, ok: false, errors: [String((error as any)?.message || error)] };
}

async function postMigratedScenario(file: string, name: string, dsl: string): Promise<DbMigrationResult> {
  const post = await postScenarioToDb(name, dsl);
  return buildDbMigrationResult(file, post.ok, post.id, post.ok ? [] : ['POST failed']);
}

async function migrateNativeFileToDb(file: File, xml: string, name: string | undefined): Promise<DbMigrationResult | null> {
  const native = xmlToAst(xml);
  if (!native.ok || !native.ast) return null;
  const ast = native.ast as DslAst;
  const dsl = normalizeDslText(astToDslText(ast));
  const scenarioName = name || ast.scenario || file.name;
  return postMigratedScenario(file.name, scenarioName, dsl);
}

async function migrateLegacyScenarioBatchToDb(file: File, xml: string, name: string | undefined): Promise<DbMigrationResult[] | null> {
  const scenarios = parseLegacyReportXmlAstMulti(xml, name);
  if (!scenarios?.length) return null;

  const results: DbMigrationResult[] = [];
  for (const ast of scenarios) {
    const scenarioName = ast.scenario || name || file.name;
    try {
      const dsl = normalizeDslText(astToDslText(ast));
      results.push(await postMigratedScenario(`${file.name} (${scenarioName})`, scenarioName, dsl));
    } catch (error) {
      results.push(buildDbMigrationError(`${file.name} (${ast.scenario || ''})`, error));
    }
  }
  return results;
}

async function migrateLegacyFallbackFileToDb(file: File, xml: string, name: string | undefined): Promise<DbMigrationResult> {
  const migrated = migrateLegacyXmlToDsl(xml, name);
  if (!migrated.ok || !migrated.dsl) return buildDbMigrationResult(file.name, false, undefined, migrated.errors || ['parse failed']);
  return postMigratedScenario(file.name, migrated.name || file.name, migrated.dsl);
}

async function migrateSingleFileToDb(file: File, nameFromFile: boolean): Promise<DbMigrationResult[]> {
  try {
    const xml = await file.text();
    const name = getMigrationName(file, nameFromFile);

    const nativeResult = await migrateNativeFileToDb(file, xml, name);
    if (nativeResult) return [nativeResult];

    const legacyBatchResults = await migrateLegacyScenarioBatchToDb(file, xml, name);
    if (legacyBatchResults) return legacyBatchResults;

    return [await migrateLegacyFallbackFileToDb(file, xml, name)];
  } catch (error) {
    return [buildDbMigrationError(file.name, error)];
  }
}

export async function migrateFilesToDb(files: FileList | File[], nameFromFile = true): Promise<DbMigrationResult[]> {
  const out: DbMigrationResult[] = [];
  for (const file of normalizeMigrationFiles(files)) out.push(...await migrateSingleFileToDb(file, nameFromFile));
  return out;
}

// Export util: split legacy XML into multiple scenarios with individual DSL texts
export function splitLegacyXmlToScenarios(xml: string, nameHint?: string): Array<{ name: string; dsl: string; ast: DslAst }> {
  const out: Array<{ name: string; dsl: string; ast: DslAst }> = [];
  const multi = parseLegacyReportXmlAstMulti(xml, nameHint) || [];
  for (const ast of multi) {
    try {
      const dsl = normalizeDslText(astToDslText(ast));
      const scnName = ast.scenario || nameHint || 'Legacy Scenario';
      out.push({ name: scnName, dsl, ast });
    } catch { /* silent */ }
  }
  return out;
}
