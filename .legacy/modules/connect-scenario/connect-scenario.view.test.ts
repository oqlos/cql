import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectScenarioView } from './connect-scenario.view';

vi.mock('./index', () => ({
  ScenariosPage: {
    getContent: () => '<div data-page="scenarios">scenarios</div>',
    getStyles: () => '',
    attachEventListeners: vi.fn(),
  },
}));

vi.mock('../../pages/connect-scenario-func-editor.page', () => ({
  FuncEditorPage: {
    getContent: () => '<div data-page="func-editor">func-editor</div>',
    getStyles: () => '',
    attachEventListeners: vi.fn(),
  },
}));

vi.mock('../../pages/connect-scenario-map-editor.page', () => ({
  MapEditorPage: {
    getContent: () => '<div data-page="map-editor">map-editor</div>',
    getStyles: () => '',
    attachEventListeners: vi.fn(),
  },
}));

vi.mock('../../pages/connect-scenario-dsl-editor.page', () => ({
  DslEditorPage: {
    getContent: () => '<div data-page="dsl-editor">dsl-editor</div>',
    getStyles: () => '',
    attach: vi.fn(),
  },
}));

vi.mock('../../pages/connect-scenario-library-editor.page', () => ({
  LibraryEditorPage: {
    getContent: () => '<div data-page="library-editor">library-editor</div>',
    getStyles: () => '',
    attach: vi.fn(),
  },
}));

vi.mock('../../pages/connect-operator-parameters.page', () => ({
  OperatorParametersPage: {
    getContent: () => '<div data-page="operator-parameters">operator-parameters</div>',
    getStyles: () => '',
    setup: vi.fn(),
  },
}));

describe('ConnectScenarioView nested routing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/connect-scenario/scenarios');
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates the rendered page when the nested route changes inside connect-scenario', async () => {
    const view = new ConnectScenarioView();
    const element = view.render();
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.body.textContent).toContain('scenarios');

    window.history.replaceState({}, '', '/connect-scenario/func-editor');
    window.dispatchEvent(new CustomEvent('routeChanged', { detail: { route: '/connect-scenario/func-editor' } }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.body.textContent).toContain('func-editor');
    expect(document.body.textContent).not.toContain('scenarios');
  });
});
