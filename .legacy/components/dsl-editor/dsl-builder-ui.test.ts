/* @vitest-environment jsdom */
// frontend/src/components/dsl-editor/dsl-builder-ui.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DslBuilderUI } from './dsl-builder-ui';

describe('DslBuilderUI Component', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('renderBuilderLayout', () => {
    it('should render complete builder layout with all components', () => {
      const html = DslBuilderUI.renderBuilderLayout({
        showScenarioList: true,
        showPreview: true,
        showLibraryManager: true,
        showRunModal: true
      });

      container.innerHTML = html;

      // Check for main layout
      expect(container.querySelector('.scenario-builder-layout')).toBeTruthy();
      expect(container.querySelector('.scenario-list')).toBeTruthy();
      expect(container.querySelector('.main-builder')).toBeTruthy();
    });

    it('should render scenario list when showScenarioList is true', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showScenarioList: true });
      container.innerHTML = html;

      expect(container.querySelector('.scenario-list')).toBeTruthy();
      expect(container.querySelector('#scenario-filter')).toBeTruthy();
      expect(container.querySelector('#scenario-add-btn')).toBeTruthy();
      expect(container.querySelector('#scenario-list-body')).toBeTruthy();
    });

    it('should hide scenario list when showScenarioList is false', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showScenarioList: false });
      container.innerHTML = html;

      expect(container.querySelector('.scenario-list')).toBeFalsy();
    });

    it('should render library manager modal when showLibraryManager is true', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showLibraryManager: true });
      container.innerHTML = html;

      expect(container.querySelector('#library-modal')).toBeTruthy();
      expect(container.querySelector('#lm-dataset')).toBeTruthy();
      expect(container.querySelector('#lm-filter')).toBeTruthy();
    });

    it('should render goal run modal when showRunModal is true', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showRunModal: true });
      container.innerHTML = html;

      expect(container.querySelector('#goal-run-modal')).toBeTruthy();
      expect(container.querySelector('.run-tabs')).toBeTruthy();
    });
  });

  describe('renderPreviewSection', () => {
    it('should render preview section with validation buttons', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showPreview: true });
      container.innerHTML = html;

      const preview = container.querySelector('.preview-section');
      expect(preview).toBeTruthy();

      // Check for preview buttons
      expect(preview?.querySelector('[data-action="copy-scenario"]')).toBeTruthy();
      expect(preview?.querySelector('[data-action="clone-scenario"]')).toBeTruthy();
      expect(preview?.querySelector('[data-action="validate-dsl"]')).toBeTruthy();
      expect(preview?.querySelector('[data-action="run-dsl"]')).toBeTruthy();

      // Check for preview elements
      expect(preview?.querySelector('#scenario-preview')).toBeTruthy();
      expect(preview?.querySelector('#dsl-results')).toBeTruthy();
    });
  });

  describe('renderMainBuilder', () => {
    it('should render main builder with scenario name input', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      const mainBuilder = container.querySelector('.main-builder');
      expect(mainBuilder).toBeTruthy();

      const nameInput = mainBuilder?.querySelector('#scenario-name') as HTMLInputElement;
      expect(nameInput).toBeTruthy();
      expect(nameInput?.value).toBe('Test szczelności C20');
    });

    it('should render action buttons', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      const actions = container.querySelector('.top-actions');
      expect(actions).toBeTruthy();

      expect(actions?.querySelector('.btn-save-scenario')).toBeTruthy();
      expect(actions?.querySelector('.btn-load-scenario')).toBeTruthy();
      expect(actions?.querySelector('.btn-export')).toBeTruthy();
      expect(actions?.querySelector('.btn-run-scenario')).toBeTruthy();
    });

    it('should render goals container', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      expect(container.querySelector('#goals-container')).toBeTruthy();
      expect(container.querySelector('#add-goal-btn')).toBeTruthy();
    });
  });

  describe('renderDefaultGoal', () => {
    it('should render default goal with all controls', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      const goalSection = container.querySelector('.goal-section');
      expect(goalSection).toBeTruthy();

      // Check goal header
      expect(goalSection?.querySelector('.goal-label')).toBeTruthy();
      expect(goalSection?.querySelector('.goal-select')).toBeTruthy();

      // Check action buttons
      expect(goalSection?.querySelector('[data-action="goal-up"]')).toBeTruthy();
      expect(goalSection?.querySelector('[data-action="goal-down"]')).toBeTruthy();
      expect(goalSection?.querySelector('[data-action="clone-goal"]')).toBeTruthy();
      expect(goalSection?.querySelector('[data-action="delete-goal"]')).toBeTruthy();

      // Check steps container
      expect(goalSection?.querySelector('.steps-container')).toBeTruthy();

      // Check goal actions
      expect(goalSection?.querySelector('.goal-actions')).toBeTruthy();
      expect(goalSection?.querySelector('.btn-add-set')).toBeTruthy();
      expect(goalSection?.querySelector('.btn-add-condition')).toBeTruthy();
    });
  });

  describe('default builder state', () => {
    it('should not render legacy task-container by default', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      const taskContainer = container.querySelector('.task-container');
      expect(taskContainer).toBeFalsy();
      expect(container.querySelector('.btn-add-task')).toBeFalsy();
      expect(container.querySelector('.btn-add-set')).toBeTruthy();
    });
  });

  describe('renderDefaultCondition', () => {
    it('should render default condition with all controls', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      const conditionGroup = container.querySelector('.condition-group');
      expect(conditionGroup).toBeTruthy();

      // Check condition header
      expect(conditionGroup?.querySelector('.condition-label')).toBeTruthy();
      expect(conditionGroup?.querySelector('[data-action="condition-up"]')).toBeTruthy();
      expect(conditionGroup?.querySelector('[data-action="condition-down"]')).toBeTruthy();
      expect(conditionGroup?.querySelector('[data-action="clone-condition"]')).toBeTruthy();
      expect(conditionGroup?.querySelector('[data-action="delete-condition"]')).toBeTruthy();

      // Check condition builder
      const conditionBuilder = conditionGroup?.querySelector('.condition-builder');
      expect(conditionBuilder).toBeTruthy();
      expect(conditionBuilder?.querySelector('.param-select')).toBeTruthy();
      expect(conditionBuilder?.querySelector('.operator-select')).toBeTruthy();
      expect(conditionBuilder?.querySelector('.value-input')).toBeTruthy();
      expect(conditionBuilder?.querySelector('.unit-select')).toBeTruthy();
    });
  });

  describe('renderAddScenarioModal', () => {
    it('should render add scenario modal', () => {
      const html = DslBuilderUI.renderAddScenarioModal();
      container.innerHTML = html;

      const modal = container.querySelector('#scenario-add-modal');
      expect(modal).toBeTruthy();
      expect(modal?.classList.contains('hidden')).toBe(true);

      expect(modal?.querySelector('#scenario-new-name')).toBeTruthy();
      expect(modal?.querySelector('#scenario-save-new')).toBeTruthy();
      expect(modal?.querySelector('[data-modal-close]')).toBeTruthy();
    });
  });

  describe('renderGoalRunModal', () => {
    it('should render goal run modal with 4 tabs', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showRunModal: true });
      container.innerHTML = html;

      const modal = container.querySelector('#goal-run-modal');
      expect(modal).toBeTruthy();

      // Check tabs
      const tabs = modal?.querySelectorAll('.run-tab');
      expect(tabs?.length).toBe(4);

      // Check tab names
      const tabExec = modal?.querySelector('[data-run-tab="exec"]');
      const tabTerminal = modal?.querySelector('[data-run-tab="terminal"]');
      const tabState = modal?.querySelector('[data-run-tab="state"]');
      const tabCode = modal?.querySelector('[data-run-tab="code"]');

      expect(tabExec).toBeTruthy();
      expect(tabTerminal).toBeTruthy();
      expect(tabState).toBeTruthy();
      expect(tabCode).toBeTruthy();
    });

    it('should render execution panel with controls', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showRunModal: true });
      container.innerHTML = html;

      expect(container.querySelector('#goal-run-exec')).toBeTruthy();
      expect(container.querySelector('#goal-run-status')).toBeTruthy();
      expect(container.querySelector('#goal-run-progress')).toBeTruthy();
      expect(container.querySelector('#goal-run-steps')).toBeTruthy();

      // Check control buttons
      expect(container.querySelector('#goal-run-pause')).toBeTruthy();
      expect(container.querySelector('#goal-run-resume')).toBeTruthy();
      expect(container.querySelector('#goal-run-stop')).toBeTruthy();
    });

    it('should render terminal panel', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showRunModal: true });
      container.innerHTML = html;

      expect(container.querySelector('#goal-run-terminal')).toBeTruthy();
      expect(container.querySelector('#goal-run-logs')).toBeTruthy();
      expect(container.querySelector('#goal-run-logs-clear')).toBeTruthy();
    });

    it('should render state panel', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showRunModal: true });
      container.innerHTML = html;

      expect(container.querySelector('#goal-run-state')).toBeTruthy();
      expect(container.querySelector('#goal-run-state-body')).toBeTruthy();
      expect(container.querySelector('#goal-run-state-refresh')).toBeTruthy();
    });

    it('should render code panel', () => {
      const html = DslBuilderUI.renderBuilderLayout({ showRunModal: true });
      container.innerHTML = html;

      expect(container.querySelector('#goal-run-code')).toBeTruthy();
      expect(container.querySelector('#goal-run-code-pre')).toBeTruthy();
    });
  });

  describe('Configuration options', () => {
    it('should apply custom container class', () => {
      const html = DslBuilderUI.renderBuilderLayout({
        containerClass: 'custom-builder-layout'
      });
      container.innerHTML = html;

      expect(container.querySelector('.custom-builder-layout')).toBeTruthy();
      expect(container.querySelector('.scenario-builder-layout')).toBeFalsy();
    });

    it('should handle default configuration', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      // Should render with defaults
      expect(container.querySelector('.scenario-builder-layout')).toBeTruthy();
      expect(container.querySelector('.scenario-list')).toBeTruthy();
      expect(container.querySelector('.main-builder')).toBeTruthy();
    });
  });

  describe('HTML Structure Validation', () => {
    it('should generate valid HTML structure', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      // Should not have parsing errors
      expect(container.childNodes.length).toBeGreaterThan(0);
    });

    it('should have proper nesting of elements', () => {
      const html = DslBuilderUI.renderBuilderLayout();
      container.innerHTML = html;

      const layout = container.querySelector('.scenario-builder-layout');
      expect(layout?.children.length).toBeGreaterThan(0);

      const mainBuilder = container.querySelector('.main-builder');
      expect(mainBuilder?.querySelector('#goals-container')).toBeTruthy();
      expect(mainBuilder?.querySelector('#add-goal-btn')).toBeTruthy();
    });

    it('should include all required IDs for JavaScript interaction', () => {
      const html = DslBuilderUI.renderBuilderLayout({
        showScenarioList: true,
        showPreview: true,
        showLibraryManager: true,
        showRunModal: true
      });
      container.innerHTML = html;

      const requiredIds = [
        'scenario-filter',
        'scenario-add-btn',
        'scenario-list-body',
        'scenario-preview',
        'dsl-results',
        'scenario-name',
        'goals-container',
        'add-goal-btn',
        'library-modal',
        'goal-run-modal'
      ];

      requiredIds.forEach(id => {
        expect(container.querySelector(`#${id}`), `Missing element with id: ${id}`).toBeTruthy();
      });
    });
  });
});
