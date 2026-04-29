type DefIntegrationNotificationType = 'info' | 'success' | 'warning' | 'error';

type ScenarioDefLike = {
  def?: unknown;
  content?: { def?: unknown } | null;
  data?: { def?: unknown } | null;
};

type DslModuleLoader = () => Promise<{
  createExecContextFromDef: (defSource: string) => unknown;
}>;

export type LoadScenarioDefOptions = {
  scenarioId: string;
  hasEditor: boolean;
  fetchScenario: (scenarioId: string) => Promise<ScenarioDefLike | null>;
  applyDefSourceUiState: (hasDef: boolean) => void;
  setDefCode: (defCode: string) => void;
  updateDefLibraryFromCode: (defCode: string) => void;
  generateDefaultDef: () => void;
  onError?: (error: unknown) => void;
};

export type SaveScenarioDefOptions = {
  scenarioId: string;
  defCode: string;
  updateScenario: (scenarioId: string, payload: { def: string }) => Promise<void>;
  notify: (message: string, type: DefIntegrationNotificationType) => void;
  dispatchScenarioDefUpdate?: (event: { type: 'UpdateScenarioDEF'; scenarioId: string; def: string }) => void;
  updateDefLibraryFromCode: (defCode: string) => void;
  refreshSelectlists: () => void;
  loadDslModule?: DslModuleLoader;
  onError?: (error: unknown) => void;
  onRefreshError?: (error: unknown) => void;
};

export type ImportDefFromDatabaseOptions = {
  hasEditor: boolean;
  setSourceOverride: (source: string) => void;
  refreshSelectlists: () => void;
  generateDefaultDef: () => void;
  notify: (message: string, type: DefIntegrationNotificationType) => void;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  onError?: (error: unknown) => void;
};

const defaultDslModuleLoader: DslModuleLoader = () => import('../../../components/dsl');

export function extractScenarioDefCode(scenario: ScenarioDefLike | null | undefined): string {
  if (!scenario) return '';
  if (typeof scenario.def === 'string' && scenario.def) return scenario.def;
  if (typeof scenario.content?.def === 'string' && scenario.content.def) return scenario.content.def;
  if (typeof scenario.data?.def === 'string' && scenario.data.def) return scenario.data.def;
  return '';
}

export async function loadScenarioDef(options: LoadScenarioDefOptions): Promise<void> {
  if (!options.scenarioId || !options.hasEditor) return;

  try {
    const scenario = await options.fetchScenario(options.scenarioId);
    if (!scenario) return;

    const defCode = extractScenarioDefCode(scenario);
    const hasDef = !!defCode;
    options.applyDefSourceUiState(hasDef);

    if (hasDef) {
      options.setDefCode(defCode);
      options.updateDefLibraryFromCode(defCode);
      return;
    }

    options.generateDefaultDef();
  } catch (error) {
    options.onError?.(error);
    options.generateDefaultDef();
  }
}

export async function saveScenarioDef(options: SaveScenarioDefOptions): Promise<void> {
  if (!options.scenarioId) {
    options.notify('❌ Brak ID scenariusza', 'error');
    return;
  }

  try {
    await options.updateScenario(options.scenarioId, { def: options.defCode });
    options.notify('✅ DEF zapisany do scenariusza', 'success');

    try {
      options.dispatchScenarioDefUpdate?.({
        type: 'UpdateScenarioDEF',
        scenarioId: options.scenarioId,
        def: options.defCode,
      });
    } catch {
      /* silent */
    }

    options.updateDefLibraryFromCode(options.defCode);

    try {
      const { createExecContextFromDef } = await (options.loadDslModule ?? defaultDslModuleLoader)();
      createExecContextFromDef(options.defCode);
      options.refreshSelectlists();
      options.notify('🔄 Builder odświeżony z nowymi opcjami DEF', 'success');
    } catch (error) {
      options.onRefreshError?.(error);
    }
  } catch (error) {
    options.onError?.(error);
    options.notify('❌ Błąd podczas zapisywania DEF', 'error');
  }
}

export function importDefFromDatabase(options: ImportDefFromDatabaseOptions): void {
  if (!options.hasEditor) return;

  try {
    options.setSourceOverride('DB');
    options.refreshSelectlists();

    (options.schedule ?? window.setTimeout)(() => {
      options.generateDefaultDef();
      options.notify('📥 Zaimportowano dane z bazy', 'success');
    }, 500);
  } catch (error) {
    options.onError?.(error);
    options.notify('❌ Błąd podczas importu z bazy', 'error');
  }
}