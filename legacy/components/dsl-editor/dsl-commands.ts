// frontend/src/components/dsl-editor/dsl-commands.ts
/**
 * Centralized DSL command button definitions
 * Used across scenarios builder, dsl-editor, and renderers
 */

/** DSL command button definition */
export interface DslCommandButton {
  id: string;
  label: string;
  cssClass: string;
  dataAction?: string;
  category: 'task' | 'variable' | 'output' | 'control' | 'action';
}

/** All DSL command buttons for goal-actions */
export const DSL_COMMAND_BUTTONS: DslCommandButton[] = [
  // Action commands
  { id: 'func', label: 'FUNC', cssClass: 'btn-add-func-call', category: 'task' },
  { id: 'dialog', label: 'DIALOG', cssClass: 'btn-add-dialog', category: 'task' },
  // Variable commands
  { id: 'get', label: 'GET', cssClass: 'btn-add-get', category: 'variable' },
  { id: 'set', label: 'SET', cssClass: 'btn-add-set', category: 'variable' },
  // Output commands (OUT handles RESULT, VAL, MIN, MAX, UNIT via type selector)
  { id: 'out', label: 'OUT', cssClass: 'btn-add-out', category: 'output' },
  { id: 'info', label: 'INFO', cssClass: 'btn-add-info', category: 'output' },
  // END - closes IF/ELSE blocks
  { id: 'end', label: 'END', cssClass: 'btn-add-end', category: 'control' },
  // Control flow commands
  { id: 'if', label: 'IF', cssClass: 'btn-add-condition', category: 'control' },
  { id: 'else', label: 'ELSE', cssClass: 'btn-add-else', category: 'control' },
  { id: 'repeat', label: 'REPEAT', cssClass: 'btn-add-repeat', category: 'control' },
];

/** Get buttons by category */
export function getButtonsByCategory(category: DslCommandButton['category']): DslCommandButton[] {
  return DSL_COMMAND_BUTTONS.filter(btn => btn.category === category);
}

/** Generate HTML for goal-actions buttons */
export function renderGoalActionsButtons(options?: { 
  includeRun?: boolean;
  includeRunMap?: boolean;
  compact?: boolean;
}): string {
  const btnClass = options?.compact ? 'btn btn-sm btn-outline-primary' : 'btn btn-outline-primary';
  
  const buttons = DSL_COMMAND_BUTTONS.map(btn => 
    `<button class="${btnClass} ${btn.cssClass}"${btn.dataAction ? ` data-action="${btn.dataAction}"` : ''}>+ ${btn.label}</button>`
  ).join('\n          ');
  
  let extraButtons = '';
  if (options?.includeRun) {
    extraButtons += `\n          <button class="btn btn-primary btn-run-scenario" data-action="run-scenario">▶️ Uruchom</button>`;
  }
  if (options?.includeRunMap) {
    extraButtons += `\n          <button class="btn btn-primary" data-action="run-goal-map">▶️ Uruchom (MAP)</button>`;
  }
  
  return buttons + extraButtons;
}

/** Generate HTML for a subset of buttons (e.g., for FUNC blocks) */
export function renderFuncActionsButtons(): string {
  const funcButtons: DslCommandButton[] = [
    { id: 'set', label: 'SET', cssClass: 'btn-add-set', category: 'variable' },
    { id: 'if', label: 'IF', cssClass: 'btn-add-condition', category: 'control' },
  ];
  
  return funcButtons.map(btn => 
    `<button class="btn btn-outline-primary ${btn.cssClass}">+ ${btn.label}</button>`
  ).join('\n          ');
}
