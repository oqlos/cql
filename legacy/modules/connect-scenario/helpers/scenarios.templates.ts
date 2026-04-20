// frontend/src/modules/connect-scenario/helpers/scenarios.templates.ts
import { DslBuilderUI } from '../../../components/dsl-editor';

/**
 * Scenarios Templates - now using reusable DSL Builder UI components
 */
export class ScenariosTemplates {
  static getContent(): string {
    return `
      <div class="page-content content-scroll">
        <div class="page-header">
          <h2>🧪 Budowanie Scenariuszy Testowych — Konstruuj scenariusze za pomocą DSL Builder: Goal → SET/PUMP/IF/FUNC</h2>
        </div>
        ${DslBuilderUI.renderBuilderLayout({
          showScenarioList: true,
          showPreview: true,
          showLibraryManager: true,
          showRunModal: true
        })}
        
        ${DslBuilderUI.renderAddScenarioModal()}
      </div>
    `;
  }
}
