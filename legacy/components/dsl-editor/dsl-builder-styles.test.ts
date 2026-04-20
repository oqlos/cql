// frontend/src/components/dsl-editor/dsl-builder-styles.test.ts
import { describe, it, expect } from 'vitest';
import { DslBuilderStyles } from './dsl-builder-styles';

describe('DslBuilderStyles Component', () => {
  describe('getStyles', () => {
    it('should return non-empty CSS string', () => {
      const styles = DslBuilderStyles.getStyles();
      expect(styles).toBeTruthy();
      expect(typeof styles).toBe('string');
      expect(styles.length).toBeGreaterThan(100);
    });

    it('should include layout styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.scenario-builder-layout');
      expect(styles).toContain('.scenario-list');
      expect(styles).toContain('.main-builder');
    });

    it('should include DSL syntax highlighting styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.dsl-kw');
      expect(styles).toContain('.dsl-goal');
      expect(styles).toContain('.dsl-task');
      expect(styles).toContain('.dsl-fn');
      expect(styles).toContain('.dsl-string');
      expect(styles).toContain('.dsl-comment');
    });

    it('should include goal section styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.goal-section');
      expect(styles).toContain('.goal-header');
      expect(styles).toContain('.goal-label');
      expect(styles).toContain('.goal-select');
      expect(styles).toContain('.goal-actions');
    });

    it('should include task container styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.task-container');
      expect(styles).toContain('.task-header');
      expect(styles).toContain('.task-label');
      expect(styles).toContain('.sentence-builder');
    });

    it('should include condition group styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.condition-group');
      expect(styles).toContain('.condition-label');
      expect(styles).toContain('.condition-builder');
    });

    it('should include variable container styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.variable-container');
      expect(styles).toContain('.variable-header');
      expect(styles).toContain('.variable-label');
      expect(styles).toContain('.variable-builder');
    });

    it('should include form control styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.function-select');
      expect(styles).toContain('.object-select');
      expect(styles).toContain('.param-select');
      expect(styles).toContain('.operator-select');
      expect(styles).toContain('.unit-select');
      expect(styles).toContain('.value-input');
    });

    it('should include modal styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.modal');
      expect(styles).toContain('.modal-dialog');
      expect(styles).toContain('.modal-header');
      expect(styles).toContain('.modal-body');
      expect(styles).toContain('.modal-footer');
      expect(styles).toContain('.modal-close');
    });

    it('should include run modal specific styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.run-tabs');
      expect(styles).toContain('.run-tab');
      expect(styles).toContain('.run-panel');
      expect(styles).toContain('.run-panel-header');
      expect(styles).toContain('.run-panel-content');
    });

    it('should include library manager styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.library-manager');
      expect(styles).toContain('.lm-controls');
    });

    it('should include execution step styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('#goal-run-steps');
      expect(styles).toContain('.step-current');
      expect(styles).toContain('.step-done');
    });

    it('should include progress bar styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.progress-bar');
      expect(styles).toContain('.progress-fill');
    });

    it('should include button styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.btn-delete-small');
      expect(styles).toContain('.btn-add-and');
    });

    it('should include scenario list styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.scenario-list');
      expect(styles).toContain('.scenario-table');
      expect(styles).toContain('.scenario-row');
      expect(styles).toContain('.filter-row');
    });

    it('should include preview section styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('.preview-section');
      expect(styles).toContain('.preview-code');
      expect(styles).toContain('.preview-header');
    });

    it('should use CSS custom properties for theming', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('var(--primary)');
      expect(styles).toContain('var(--panel-bg)');
      expect(styles).toContain('var(--panel-border)');
      expect(styles).toContain('var(--text)');
      expect(styles).toContain('var(--bg)');
    });

    it('should include responsive design media queries', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('@media');
      expect(styles).toContain('max-width');
    });

    it('should include scrollbar styles', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('::-webkit-scrollbar');
      expect(styles).toContain('::-webkit-scrollbar-track');
      expect(styles).toContain('::-webkit-scrollbar-thumb');
    });

    it('should include hover and active states', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain(':hover');
      expect(styles).toContain('.active');
    });

    it('should include transition animations', () => {
      const styles = DslBuilderStyles.getStyles();
      
      expect(styles).toContain('transition');
    });
  });

  describe('CSS Validity', () => {
    it('should generate valid CSS syntax', () => {
      const styles = DslBuilderStyles.getStyles();
      
      // Check for balanced braces
      const openBraces = (styles.match(/{/g) || []).length;
      const closeBraces = (styles.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });

    it('should not contain JavaScript code', () => {
      const styles = DslBuilderStyles.getStyles();
      
      // Check for JavaScript keywords (excluding CSS selectors like .function-select, .btn-delete-var)
      expect(styles).not.toContain('function(');
      expect(styles).not.toContain('function ');
      expect(styles).not.toContain('const ');
      expect(styles).not.toContain('let ');
      expect(styles).not.toMatch(/\bvar\s+\w+\s*=/);
      expect(styles).not.toMatch(/=>\s*{/);
    });

    it('should use consistent property naming', () => {
      const styles = DslBuilderStyles.getStyles();
      
      // Check for common CSS properties
      expect(styles).toContain('display:');
      expect(styles).toContain('padding:');
      expect(styles).toContain('margin:');
      expect(styles).toContain('background:');
      expect(styles).toContain('color:');
      expect(styles).toContain('border:');
    });
  });
});
