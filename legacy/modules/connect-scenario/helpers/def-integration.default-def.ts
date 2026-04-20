import {
  generateDefTemplate,
  buildObjectFunctionMapFromLib,
  buildParamUnitsMapFromLib,
} from './def-integration.templates';
import {
  buildUiSyncedDefLibrary,
  normalizeDefLibraryList,
  type DefUiLibrarySnapshot,
} from './def-integration.library';

type DefaultDefLibrary = Record<string, unknown>;

export type BuildDefaultDefTemplateOptions = {
  scenarioId: string;
  currentLibrary: DefaultDefLibrary;
  uiLibrarySnapshot: DefUiLibrarySnapshot;
};

export function buildDefaultDefTemplate(options: BuildDefaultDefTemplateOptions): string {
  const mergedLibrary = buildUiSyncedDefLibrary(options.currentLibrary, options.uiLibrarySnapshot);

  const objects = normalizeDefLibraryList(mergedLibrary.objects);
  const functions = normalizeDefLibraryList(mergedLibrary.functions);
  const params = normalizeDefLibraryList(mergedLibrary.params);
  const units = normalizeDefLibraryList(mergedLibrary.units);

  const objectFunctionMap = buildObjectFunctionMapFromLib(objects, mergedLibrary);
  const paramUnitsMap = buildParamUnitsMapFromLib(params, mergedLibrary);

  return generateDefTemplate({
    scenarioId: options.scenarioId,
    objects,
    functions,
    params,
    units,
    objectFunctionMap,
    paramUnitsMap,
  });
}