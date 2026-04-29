import type { DefUiLibrarySnapshot } from './def-integration.library';
import type { DslTableDefinition, DslTableRuntime } from '../../../components/dsl-table/dsl-table.types';

type LiveStateDefinition = DslTableDefinition;

type LiveStateTable = {
  render: (definitions: LiveStateDefinition[], runtime: DslTableRuntime | null | undefined) => void;
};

type RefreshDefIntegrationLiveStateOptions = {
  firmwareDisabled: boolean;
  firmwareErrorCount: number;
  liveTable: LiveStateTable | null;
  container: HTMLElement | null;
  body: HTMLElement | null;
  buildUiLibrarySnapshot: () => DefUiLibrarySnapshot;
  getUnitFromUi: (paramName: string) => string;
  getFirmwareBaseUrl: () => unknown;
  fetchStateCandidates: () => Promise<unknown>;
  createLiveTable: (container: HTMLElement) => LiveStateTable;
};

export type RefreshDefIntegrationLiveStateResult = {
  liveTable: LiveStateTable | null;
  firmwareErrorCount: number;
  firmwareDisabled: boolean;
};

export function buildLiveStateDefinitions(
  uiLibrary: Pick<DefUiLibrarySnapshot, 'objects' | 'params'>,
  getUnitFromUi: (paramName: string) => string,
): LiveStateDefinition[] {
  const definitions: LiveStateDefinition[] = [];
  for (const objectName of uiLibrary.objects) {
    definitions.push({ type: 'object', name: objectName });
  }
  for (const paramName of uiLibrary.params) {
    definitions.push({ type: 'param', name: paramName, units: getUnitFromUi(paramName) });
  }
  return definitions;
}

export async function refreshDefIntegrationLiveState(
  options: RefreshDefIntegrationLiveStateOptions,
): Promise<RefreshDefIntegrationLiveStateResult> {
  if (options.firmwareDisabled) {
    return {
      liveTable: options.liveTable,
      firmwareErrorCount: options.firmwareErrorCount,
      firmwareDisabled: options.firmwareDisabled,
    };
  }

  try {
    if (!options.container || !options.body) {
      return {
        liveTable: options.liveTable,
        firmwareErrorCount: options.firmwareErrorCount,
        firmwareDisabled: options.firmwareDisabled,
      };
    }

    const liveTable = options.liveTable ?? options.createLiveTable(options.container);
    const definitions = buildLiveStateDefinitions(options.buildUiLibrarySnapshot(), options.getUnitFromUi);

    let runtime: unknown = null;
    let firmwareErrorCount = options.firmwareErrorCount;
    let firmwareDisabled: boolean = options.firmwareDisabled;

    try {
      const firmwareBaseUrl = options.getFirmwareBaseUrl();
      if (typeof firmwareBaseUrl === 'string' && firmwareBaseUrl.trim().length > 0) {
        runtime = await options.fetchStateCandidates();
        firmwareErrorCount = 0;
      }
    } catch {
      firmwareErrorCount += 1;
      const shouldDisableFirmware = firmwareErrorCount >= 5;
      if (shouldDisableFirmware) {
        firmwareDisabled = true;
      }
    }

    liveTable.render(definitions, runtime || {});

    return {
      liveTable,
      firmwareErrorCount,
      firmwareDisabled,
    };
  } catch {
    return {
      liveTable: options.liveTable,
      firmwareErrorCount: options.firmwareErrorCount,
      firmwareDisabled: options.firmwareDisabled,
    };
  }
}