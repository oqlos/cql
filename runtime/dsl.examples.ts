import manifest from '../../assets/dsl-examples/manifest.json';
import funcEditorPlaceholderRaw from '../../assets/dsl-examples/func-editor-placeholder.cql?raw';
import funcEditorSyntaxExampleRaw from '../../assets/dsl-examples/func-editor-syntax-example.cql?raw';
import funcEditorTemplateRaw from '../../assets/dsl-examples/func-editor-template.cql?raw';
import funcEditorUsageExampleRaw from '../../assets/dsl-examples/func-editor-usage-example.cql?raw';
import dslEditorPlaceholderRaw from '../../assets/dsl-examples/dsl-editor-placeholder.cql?raw';
import scenarioEditorDefaultRaw from '../../assets/dsl-examples/scenario-editor-default.cql?raw';
import scenarioEditorPlaceholderRaw from '../../assets/dsl-examples/scenario-editor-placeholder.cql?raw';

const RAW_EXAMPLES: Record<string, string> = {
  'func-editor-placeholder.cql': funcEditorPlaceholderRaw,
  'func-editor-syntax-example.cql': funcEditorSyntaxExampleRaw,
  'func-editor-template.cql': funcEditorTemplateRaw,
  'func-editor-usage-example.cql': funcEditorUsageExampleRaw,
  'dsl-editor-placeholder.cql': dslEditorPlaceholderRaw,
  'scenario-editor-default.cql': scenarioEditorDefaultRaw,
  'scenario-editor-placeholder.cql': scenarioEditorPlaceholderRaw,
};

export type DslExampleKey = keyof typeof manifest;

export function getDslExample(key: DslExampleKey): string {
  const fileName = manifest[key];
  return String(RAW_EXAMPLES[fileName] ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+$/g, '');
}

export function getDslExampleWithReplacements(
  key: DslExampleKey,
  replacements: Record<string, string> = {},
): string {
  let text = getDslExample(key);
  for (const [token, value] of Object.entries(replacements)) {
    text = text.split(`{{${token}}}`).join(value);
  }
  return text;
}