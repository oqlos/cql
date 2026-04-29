// frontend/src/modules/connect-scenario/connect-scenario.view.ts
import { ModuleStyleHelper } from '../../utils/style-helper';

let _staticRouteListener: ((ev: Event) => void) | null = null;

export class ConnectScenarioView {
  private contentContainer: HTMLElement | null = null;
  private lastLoadedPath = '';

  render(): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="module-content-only">
        <div class="module-main-content flex-1 content-scroll">
          <div id="connect-scenario-content"><div class="loading-skeleton p-md">Ładowanie...</div></div>
        </div>
      </div>
    `;

    this.contentContainer = container.querySelector('#connect-scenario-content') as HTMLElement | null;
    this.bindRouteListener(container);

    // Lazy-load the required page and resync once nested routing settles.
    void this.loadCurrentPage();
    queueMicrotask(() => { void this.loadCurrentPage(); });
    requestAnimationFrame(() => { void this.loadCurrentPage(); });

    return container;
  }

  private bindRouteListener(container: HTMLElement): void {
    if (_staticRouteListener) {
      window.removeEventListener('routeChanged', _staticRouteListener);
    }

    _staticRouteListener = (ev: Event) => {
      if (!container.isConnected) return;

      const route = String((ev as CustomEvent).detail?.route || window.location.pathname || '');
      if (
        route === '/connect-scenario' ||
        route.startsWith('/connect-scenario/') ||
        route === '/connect-operator-parameters' ||
        route.startsWith('/connect-operator-parameters')
      ) {
        void this.loadCurrentPage(route);
      }
    };

    window.addEventListener('routeChanged', _staticRouteListener);
  }

  private async loadCurrentPage(routeOverride?: string): Promise<void> {
    const route = routeOverride || (globalThis as any)?.location?.pathname || '';
    const content = this.contentContainer;
    if (!content) return;

    const fullPath = `${route}${(globalThis as any)?.location?.search || ''}`;
    if (fullPath === this.lastLoadedPath && content.childElementCount > 0) {
      return;
    }
    this.lastLoadedPath = fullPath;

    const isScenarioEditor = route.includes('/scenario-editor');
    const isLibraryEditor = route.includes('/library-editor') || route.includes('connect-scenario-library-editor');
    const isFuncEditor = route.includes('/func-editor') || route.includes('connect-scenario-func-editor');
    const isMapEditor = route.includes('/map-editor') || route.includes('connect-scenario-map-editor');
    const isDslEditor = route.includes('/dsl-editor') || route.includes('connect-scenario-dsl-editor');
    const isOperatorParameters = route.includes('/operator-parameters') || route.includes('/connect-operator-parameters');

    let pageContent = '';
    let pageStyles = '';
    let pageId = 'scenarios';

    if (isScenarioEditor) {
      const { ScenarioEditorPage } = await import('../../pages/connect-scenario-scenario-editor.page');
      pageContent = ScenarioEditorPage.getContent();
      pageStyles = ScenarioEditorPage.getStyles();
      pageId = 'scenario-editor';
      this.injectAndAttach(content, pageContent, pageStyles, pageId, (el) => ScenarioEditorPage.attachEventListeners(el));
    } else if (isOperatorParameters) {
      const { OperatorParametersPage } = await import('../../pages/connect-operator-parameters.page');
      pageContent = OperatorParametersPage.getContent();
      pageStyles = OperatorParametersPage.getStyles();
      pageId = 'operator-parameters';
      this.injectAndAttach(content, pageContent, pageStyles, pageId, (el) => OperatorParametersPage.setup(el));
    } else if (isDslEditor) {
      const { DslEditorPage } = await import('../../pages/connect-scenario-dsl-editor.page');
      pageContent = DslEditorPage.getContent();
      pageStyles = DslEditorPage.getStyles();
      pageId = 'dsl-editor';
      this.injectAndAttach(content, pageContent, pageStyles, pageId, (el) => DslEditorPage.attach(el));
    } else if (isFuncEditor) {
      const { FuncEditorPage } = await import('../../pages/connect-scenario-func-editor.page');
      pageContent = FuncEditorPage.getContent();
      pageStyles = FuncEditorPage.getStyles();
      pageId = 'func-editor';
      this.injectAndAttach(content, pageContent, pageStyles, pageId, () => FuncEditorPage.attachEventListeners());
    } else if (isMapEditor) {
      const { MapEditorPage } = await import('../../pages/connect-scenario-map-editor.page');
      pageContent = MapEditorPage.getContent();
      pageStyles = MapEditorPage.getStyles();
      pageId = 'map-editor';
      this.injectAndAttach(content, pageContent, pageStyles, pageId, () => MapEditorPage.attachEventListeners());
    } else if (isLibraryEditor) {
      const { LibraryEditorPage } = await import('../../pages/connect-scenario-library-editor.page');
      pageContent = LibraryEditorPage.getContent();
      pageStyles = LibraryEditorPage.getStyles();
      pageId = 'library-editor';
      this.injectAndAttach(content, pageContent, pageStyles, pageId, (el) => LibraryEditorPage.attach(el));
    } else {
      const { ScenariosPage } = await import('./index');
      pageContent = ScenariosPage.getContent();
      pageStyles = ScenariosPage.getStyles();
      this.injectAndAttach(content, pageContent, pageStyles, pageId, (el) => ScenariosPage.attachEventListeners(el));
    }
  }

  private injectAndAttach(
    content: HTMLElement,
    pageContent: string,
    pageStyles: string,
    pageId: string,
    attach: (el: HTMLElement) => void,
  ): void {
    try {
      ModuleStyleHelper.forPage(pageId, 'connect-scenario', pageStyles);
    } catch { /* silent */ }

    content.innerHTML = pageContent;
    requestAnimationFrame(() => attach(content));
  }
}
