// frontend/src/modules/connect-scenario/helpers/scenarios.dnd.ts

/**
 * Pure DOM DnD initializer for Scenarios builder.
 * - Makes library items draggable and enables drop on sentence builders.
 * - Enables drag-to-reorder of steps (.task-container, .condition-group) per goal.
 *
 * Emits:
 *  - window event 'scenarios:steps-reordered' with detail: { goalId: string }
 */
export class ScenariosDnD {
  static initialize(root: ParentNode = document): void {
    try {
      this.initLibraryDrag(root);
      this.initStepsReorder(root);
    } catch { /* silent */ }
  }

  private static initLibraryDrag(root: ParentNode): void {
    try {
      const libraryItems = root.querySelectorAll('.library-item');
      libraryItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
          const dragEvent = e as DragEvent;
          const target = dragEvent.target as HTMLElement;
          target.classList.add('dragging');
          dragEvent.dataTransfer?.setData('text/plain', target.textContent || '');
          dragEvent.dataTransfer?.setData('elementType', target.getAttribute('data-type') || '');
        });
        item.addEventListener('dragend', (e) => {
          const dragEvent = e as DragEvent;
          const target = dragEvent.target as HTMLElement;
          target.classList.remove('dragging');
        });
      });

      const sentenceBuilders = root.querySelectorAll('.sentence-builder');
      sentenceBuilders.forEach(builder => {
        builder.addEventListener('dragover', (e) => {
          e.preventDefault();
          builder.classList.add('drag-over');
        });
        builder.addEventListener('dragleave', () => {
          builder.classList.remove('drag-over');
        });
        builder.addEventListener('drop', (e) => {
          e.preventDefault();
          const dragEvent = e as DragEvent;
          builder.classList.remove('drag-over');
          // Placeholder: consumers can listen to their own input/change events to update preview
          const text = dragEvent.dataTransfer?.getData('text/plain');
          const type = dragEvent.dataTransfer?.getData('elementType');
          void text; void type;
        });
      });
    } catch { /* silent */ }
  }

  private static initStepsReorder(root: ParentNode): void {
    const stepSelector = '.task-container, .condition-group';
    const lists = root.querySelectorAll('.goal-section .steps-container');
    lists.forEach((list) => {
      const container = list as HTMLElement;
      // Bind container listeners once
      if (container.getAttribute('data-dnd-bound') !== '1') {
        container.addEventListener('dragover', (e) => {
          e.preventDefault();
          const after = (() => {
            const siblings = Array.from(container.querySelectorAll(stepSelector)).filter(s => !(s as HTMLElement).classList.contains('dragging-step')) as HTMLElement[];
            const y = (e as DragEvent).clientY;
            let closest: { offset: number; el: HTMLElement | null } = { offset: Number.NEGATIVE_INFINITY, el: null };
            for (const child of siblings) {
              const box = child.getBoundingClientRect();
              const offset = y - (box.top + box.height / 2);
              if (offset < 0 && offset > closest.offset) {
                closest = { offset, el: child };
              }
            }
            return closest.el;
          })();
          const dragging = container.querySelector('.dragging-step') as HTMLElement | null;
          if (!dragging) return;
          if (after === undefined || after === null) {
            container.appendChild(dragging);
          } else {
            container.insertBefore(dragging, after);
          }
        });
        container.addEventListener('drop', () => {
          const goalSection = container.closest('.goal-section') as HTMLElement | null;
          const goalId = goalSection?.dataset.goalId || '';
          if (goalId) {
            try { window.dispatchEvent(new CustomEvent('scenarios:steps-reordered', { detail: { goalId } })); } catch { /* silent */ }
          }
        });
        container.setAttribute('data-dnd-bound', '1');
      }

      // Ensure step-level handlers exist for all steps (bind once per step)
      Array.from(container.querySelectorAll(stepSelector)).forEach((el) => {
        const step = el as HTMLElement;
        if (step.getAttribute('data-step-dnd') === '1') return;
        if (step.getAttribute('draggable') !== 'true') step.setAttribute('draggable', 'true');
        step.addEventListener('dragstart', (e) => {
          const de = e as DragEvent;
          step.classList.add('dragging-step');
          const dt = de.dataTransfer; if (dt) dt.effectAllowed = 'move';
        });
        step.addEventListener('dragend', () => {
          step.classList.remove('dragging-step');
        });
        step.setAttribute('data-step-dnd', '1');
      });
    });
  }
}
