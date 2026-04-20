// frontend/src/components/dsl-editor/dsl-builder-styles.ts
/**
 * Reusable DSL Builder Styles Component
 * CSS extracted to dsl-builder.css — loaded via Vite ?inline import
 */
import css from './dsl-builder.css?raw';

export class DslBuilderStyles {
  /**
   * Returns complete CSS styles for DSL builder
   */
  static getStyles(): string {
    return css;
  }
}
