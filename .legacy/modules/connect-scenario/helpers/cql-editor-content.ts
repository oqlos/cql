// frontend/src/modules/connect-scenario/helpers/cql-editor-content.ts
// Central CQL/DSL example content loaded from CQL assets through a JSON manifest.

import { getDslExample, getDslExampleWithReplacements } from '../../../components/dsl/dsl.examples';

const DEFAULT_FUNC_TEMPLATE_NAME = 'Nowa procedura';

export function getFuncEditorPlaceholder(): string {
  return getDslExample('funcEditorPlaceholder');
}

export function getFuncEditorSyntaxExample(): string {
  return getDslExample('funcEditorSyntaxExample');
}

export function getFuncEditorUsageExample(): string {
  return getDslExample('funcEditorUsageExample');
}

export function getFuncEditorDefaultTemplateName(): string {
  return DEFAULT_FUNC_TEMPLATE_NAME;
}

export function buildFuncEditorTemplate(name: string): string {
  const templateName = String(name || '').trim() || getFuncEditorDefaultTemplateName();
  return getDslExampleWithReplacements('funcEditorTemplate', { name: templateName });
}

export function getDslEditorPlaceholder(): string {
  return getDslExample('dslEditorPlaceholder');
}

export function getScenarioEditorPlaceholder(): string {
  return getDslExample('scenarioEditorPlaceholder');
}

export function getScenarioEditorDefault(): string {
  return getDslExample('scenarioEditorDefault');
}
