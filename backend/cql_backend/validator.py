"""Python port of `oqlos/cql/runtime/dsl.validator.ts`.

DSL format validator with fix suggestions.
"""
from __future__ import annotations

import re
from typing import Any

from .quotes import canonicalize_dsl_quotes, format_dsl_literal
from .types import DslRuleViolation, DslValidateResult

# Shared pattern for "literal" value
VALUE = '"([^"]*)"'

# Pre-compiled regex for validation
RX = {
    'ELSE_MSG': re.compile(r'^\s*ELSE\s+(ERROR|WARN|WARNING|INFO)\s*(?:"([^"]*)")?\s*$', re.IGNORECASE),
    'ELSE_BLOCK': re.compile(r'^\s*ELSE\s*$', re.IGNORECASE),
    'ELSE_INVALID': re.compile(r'^\s*ELSE\s+(?!ERROR|WARN|WARNING|INFO)\S+', re.IGNORECASE),
    'IF_BRACKET_OP': re.compile(r'^\s*IF\s*"(.*?)"\s*\[(>=|<=|>|<|=)\]\s*"(.*?)"\s*$', re.IGNORECASE),
    'SET': re.compile(f'^\\s*SET\\s*"([^"]+)"\\s*{VALUE}\\s*$', re.IGNORECASE),
    'IF': re.compile(f'^\\s*IF\\s*"([^"]+)"\\s*(>=|<=|>|<|=)?\\s*{VALUE}\\s*$', re.IGNORECASE),
    'GET': re.compile(r'^\s*GET\s*"(.*?)"(?:\s*"(.*?)")?\s*$', re.IGNORECASE),
    'VAL': re.compile(r'^\s*VAL\s*"(.*?)"(?:\s*"(.*?)")?\s*$', re.IGNORECASE),
    'MAX': re.compile(f'^\\s*MAX\\s*"([^"]+)"\\s*{VALUE}\\s*$', re.IGNORECASE),
    'MIN': re.compile(f'^\\s*MIN\\s*"([^"]+)"\\s*{VALUE}\\s*$', re.IGNORECASE),
    'GOAL': re.compile(r'^\s*GOAL:\s*(.+)$', re.IGNORECASE),
    'OUT': re.compile(f'^\\s*OUT\\s*"(VAL|MAX|MIN|UNIT|GET|RESULT)"\\s*{VALUE}\\s*$', re.IGNORECASE),
    'DIALOG': re.compile(f'^\\s*DIALOG\\s*"([^"]+)"\\s*{VALUE}\\s*$', re.IGNORECASE),
}

# Known sensor/firmware variables that require GET declaration
SENSOR_VARIABLES = {'NC', 'WC', 'PC', 'TC', 'SC', 'P1', 'P2', 'T1', 'T2'}


def _is_bad_token(s: str) -> bool:
    t = str(s or '').strip()
    return not t or t == '*' or re.match(r'^undefined$', t, re.IGNORECASE) or t == '""'


def _violation(
    rule_id: str, line: int, severity: str,
    message: str, suggestion: str | None = None, fixed_line: str | None = None
) -> DslRuleViolation:
    return DslRuleViolation(
        ruleId=rule_id, line=line, message=message,
        severity=severity, suggestion=suggestion, fixedLine=fixed_line
    )


def _q(value: str) -> str:
    return format_dsl_literal(value)


class GoalTrackingState:
    def __init__(self, start_line: int = -1):
        self.declared_vals: set[str] = set()
        self.declared_mins: set[str] = set()
        self.declared_maxs: set[str] = set()
        self.declared_gets: set[str] = set()
        self.used_vars: set[str] = set()
        self.start_line = start_line


class ValidationState:
    def __init__(self, text: str):
        self.lines = (text or '').split('\n')
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.violations: list[DslRuleViolation] = []
        self.fixed = self.lines.copy()
        self.goal = GoalTrackingState()


def _add_error(state: ValidationState, item: DslRuleViolation) -> None:
    state.violations.append(item)
    state.errors.append(f'Linia {item.line}: {item.message}')


def _add_warning(state: ValidationState, item: DslRuleViolation) -> None:
    state.violations.append(item)
    state.warnings.append(f'Linia {item.line}: {item.message}')


def _track_sensor_usage(state: ValidationState, *values: str) -> None:
    for value in values:
        normalized = str(value or '').strip()
        if normalized and normalized in SENSOR_VARIABLES:
            state.goal.used_vars.add(normalized)


def _insert_get_declaration(state: ValidationState, variable_name: str) -> None:
    if state.goal.start_line < 0:
        return
    get_line = f'  GET {_q(variable_name)}'
    insert_idx = state.goal.start_line + 1
    while insert_idx < len(state.fixed) and not state.fixed[insert_idx].strip():
        insert_idx += 1
    state.fixed.insert(insert_idx, get_line)


def _flush_missing_get_declarations(state: ValidationState) -> None:
    for used_var in state.goal.used_vars:
        if used_var not in SENSOR_VARIABLES or used_var in state.goal.declared_gets or state.goal.start_line < 0:
            continue
        _add_warning(state, _violation(
            'missing_get_declaration',
            state.goal.start_line + 1,
            'warning',
            f'Zmienna czujnika "{used_var}" użyta bez deklaracji GET.',
            f'Dodaj: GET {_q(used_var)} przed użyciem zmiennej.',
        ))
        _insert_get_declaration(state, used_var)


def _start_new_goal(state: ValidationState, line_index: int) -> None:
    _flush_missing_get_declarations(state)
    state.goal = GoalTrackingState(line_index)


def _flush_missing_goal_ends(
    in_goal: bool, current_goal_line: int, depth: int,
    output: list[str], issues: list[dict[str, Any]]
) -> int:
    if not in_goal or depth <= 0:
        return 0
    issues.append({'line': current_goal_line, 'missing': depth})
    for _ in range(depth):
        output.append('  END')
    return 0


def _ensure_end_blocks(src_lines: list[str]) -> tuple[list[str], list[dict[str, Any]]]:
    fixed_lines: list[str] = []
    issues: list[dict[str, Any]] = []
    in_goal = False
    current_goal_line = 1
    depth = 0

    for line in src_lines:
        text = str(line or '')
        trimmed = text.strip()
        upper = trimmed.upper()

        if RX['GOAL'].match(text):
            depth = _flush_missing_goal_ends(in_goal, current_goal_line, depth, fixed_lines, issues)
            in_goal = True
            current_goal_line = len(fixed_lines) + 1
            fixed_lines.append(text)
            continue

        if in_goal and upper.startswith('IF '):
            depth += 1
            fixed_lines.append(text)
            continue

        if in_goal and upper == 'END':
            if depth > 0:
                depth -= 1
            fixed_lines.append(text)
            continue

        fixed_lines.append(text)

    _flush_missing_goal_ends(in_goal, current_goal_line, depth, fixed_lines, issues)
    return fixed_lines, issues


def _handle_goal_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    if not RX['GOAL'].match(normalized):
        return False
    _start_new_goal(state, index)
    return True


def _handle_else_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    if RX['ELSE_BLOCK'].match(normalized) or RX['ELSE_MSG'].match(normalized):
        return True
    if not RX['ELSE_INVALID'].match(normalized):
        return False
    _add_error(state, _violation(
        'else_invalid',
        line_num,
        'error',
        'ELSE wymaga typu akcji (ERROR/WARN/INFO).',
        f'Użyj: ELSE ERROR {_q("komunikat")} lub ELSE WARN {_q("komunikat")}',
    ))
    state.fixed[index] = f'ELSE ERROR {_q("Błąd")}'
    return True


def _handle_bracketed_if_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    match = RX['IF_BRACKET_OP'].match(normalized)
    if not match:
        return False
    param, op, value = (match.group(1) or '').strip(), (match.group(2) or '').strip(), (match.group(3) or '').strip()
    preferred = f'IF {_q(param)} {op} {_q(value)}'
    if preferred != line:
        _add_warning(state, _violation(
            'operator_no_brackets',
            line_num,
            'warning',
            'Preferowany zapis operatora bez nawiasów kwadratowych.',
            preferred,
            preferred,
        ))
        state.fixed[index] = preferred
    if _is_bad_token(param) or _is_bad_token(value):
        which = 'parametr i wartość' if (_is_bad_token(param) and _is_bad_token(value)) else ('parametr' if _is_bad_token(param) else 'wartość')
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            f'Niedozwolone użycie placeholdera "*" lub undefined ({which}) w IF.',
            'Wybierz konkretną zmienną/cel; usuń placeholdery.',
        ))
    return True


def _handle_if_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    match = RX['IF'].match(normalized)
    if not match:
        return False
    param = (match.group(1) or '').strip()
    value = (match.group(3) or '').strip()
    _track_sensor_usage(state, param, value)
    if _is_bad_token(param) or _is_bad_token(value):
        which = 'parametr i wartość' if (_is_bad_token(param) and _is_bad_token(value)) else ('parametr' if _is_bad_token(param) else 'wartość')
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            f'Niedozwolone użycie placeholdera "*" lub undefined ({which}) w IF.',
            'Wybierz konkretną zmienną/cel; usuń placeholdery.',
        ))
    return True


def _track_compound_if_usage(state: ValidationState, normalized_line: str) -> None:
    compound_if_match = re.search(r'IF\s*\[([^\]]+)\].*OR.*\[([^\]]+)\]', normalized_line, re.IGNORECASE)
    if compound_if_match:
        _track_sensor_usage(state, compound_if_match.group(1) or '', compound_if_match.group(2) or '')


def _handle_set_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    match = RX['SET'].match(normalized)
    if not match:
        return False
    param = (match.group(1) or '').strip()
    value = (match.group(2) or '').strip()
    if _is_bad_token(param):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolony parametr "*" lub undefined w SET.',
            'Podaj prawidłową nazwę zmiennej.',
        ))
    if _is_bad_token(value):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolona wartość "*" lub undefined w SET.',
            'Podaj konkretną wartość, np. 9 s',
        ))
    if not value:
        _add_error(state, _violation(
            'set_value_required',
            line_num,
            'error',
            'SET wymaga wartości.',
            f'Dodaj wartość, np. SET {_q("ciśnienie")} {_q("6.0 mbar")}',
        ))
    return True


def _handle_get_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    match = RX['GET'].match(normalized)
    if not match:
        return False
    param = (match.group(1) or '').strip()
    unit = (match.group(2) or '').strip()
    if _is_bad_token(param):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolony parametr "*" lub undefined w GET.',
            'Wybierz konkretną zmienną.',
        ))
    else:
        state.goal.declared_gets.add(param)
    if unit and _is_bad_token(unit):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolona jednostka "*" lub undefined w GET.',
            'Wybierz poprawną jednostkę lub pomiń ją.',
        ))
    return True


def _handle_val_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    match = RX['VAL'].match(normalized)
    if not match:
        return False
    param = (match.group(1) or '').strip()
    unit = (match.group(2) or '').strip()
    if _is_bad_token(param):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolony parametr "*" lub undefined w VAL.',
            'Wybierz konkretną zmienną.',
        ))
    elif param in state.goal.declared_vals:
        _add_warning(state, _violation(
            'duplicate_val',
            line_num,
            'warning',
            f'VAL "{param}" już zadeklarowane w tym GOAL. Zamieniono na GET.',
            'VAL może być użyte tylko raz dla danego parametru w GOAL.',
        ))
        state.fixed[index] = f'  GET {_q(param)} {_q(unit)}' if unit else f'  GET {_q(param)}'
    else:
        state.goal.declared_vals.add(param)
    if unit and _is_bad_token(unit):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolona jednostka "*" lub undefined w VAL.',
            'Wybierz poprawną jednostkę lub pomiń ją.',
        ))
    return True


def _handle_limit_line(
    state: ValidationState, line: str, normalized: str, line_num: int, index: int,
    action: str, regex: re.Pattern[str], declared: set[str]
) -> bool:
    match = regex.match(normalized)
    if not match:
        return False
    param = (match.group(1) or '').strip()
    value = (match.group(2) or '').strip()
    if _is_bad_token(param) or _is_bad_token(value):
        which = 'parametr i wartość' if (_is_bad_token(param) and _is_bad_token(value)) else ('parametr' if _is_bad_token(param) else 'wartość')
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            f'Niedozwolone użycie "*" lub undefined ({which}) w {action}.',
            'Podaj prawidłową nazwę i wartość.',
        ))
        return True
    if param in declared:
        rule_id = 'duplicate_max' if action == 'MAX' else 'duplicate_min'
        _add_warning(state, _violation(
            rule_id,
            line_num,
            'warning',
            f'{action} "{param}" już zadeklarowane w tym GOAL. Zamieniono na SET.',
            f'{action} może być użyte tylko raz dla danego parametru w GOAL.',
        ))
        state.fixed[index] = f'  SET {_q(param)} {_q(value)}'
        return True
    declared.add(param)
    return True


def _handle_out_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    match = RX['OUT'].match(normalized)
    if not match:
        return False
    out_type = (match.group(1) or '').strip().upper()
    var_name = (match.group(2) or '').strip()
    if out_type == 'VAL':
        _track_sensor_usage(state, var_name)
    if _is_bad_token(var_name):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolona zmienna "*" lub undefined w OUT.',
            'Podaj prawidłową nazwę zmiennej.',
        ))
    return True


def _handle_dialog_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> bool:
    match = RX['DIALOG'].match(normalized)
    if not match:
        return False
    var_name = (match.group(1) or '').strip()
    prompt = (match.group(2) or '').strip()
    if _is_bad_token(var_name):
        _add_error(state, _violation(
            'no_placeholder_or_undefined',
            line_num,
            'error',
            'Niedozwolona zmienna "*" lub undefined w DIALOG.',
            'Podaj prawidłową nazwę zmiennej.',
        ))
    if not prompt:
        _add_error(state, _violation(
            'dialog_prompt_required',
            line_num,
            'error',
            'DIALOG wymaga tekstu pytania.',
            f'Dodaj pytanie, np. DIALOG {_q("Potwierdzenie")} {_q("Sprawdź stan maski")}',
        ))
    return True


def _validate_dsl_line(state: ValidationState, line: str, normalized: str, line_num: int, index: int) -> None:
    if _handle_goal_line(state, line, normalized, line_num, index):
        return
    if _handle_else_line(state, line, normalized, line_num, index):
        return
    if _handle_bracketed_if_line(state, line, normalized, line_num, index):
        return

    direct_if_handled = _handle_if_line(state, line, normalized, line_num, index)
    if direct_if_handled:
        return
    _track_compound_if_usage(state, normalized)

    if _handle_set_line(state, line, normalized, line_num, index):
        return
    if _handle_get_line(state, line, normalized, line_num, index):
        return
    if _handle_val_line(state, line, normalized, line_num, index):
        return
    if _handle_limit_line(state, line, normalized, line_num, index, 'MAX', RX['MAX'], state.goal.declared_maxs):
        return
    if _handle_limit_line(state, line, normalized, line_num, index, 'MIN', RX['MIN'], state.goal.declared_mins):
        return
    if _handle_out_line(state, line, normalized, line_num, index):
        return
    _handle_dialog_line(state, line, normalized, line_num, index)


def _finalize_validation(state: ValidationState) -> DslValidateResult:
    _flush_missing_get_declarations(state)

    fixed_lines, issues = _ensure_end_blocks(state.fixed)
    for item in issues:
        _add_warning(state, _violation(
            'missing_end',
            item['line'],
            'warning',
            f"Brak END w bloku IF (dodano {item['missing']}× END).",
            'Dodaj brakujące END aby domknąć IF/ELSE.',
        ))

    return DslValidateResult(
        ok=len(state.errors) == 0,
        errors=state.errors,
        warnings=state.warnings,
        violations=state.violations,
        fixedText=canonicalize_dsl_quotes('\n'.join(fixed_lines))
    )


def validate_dsl_format(text: str) -> DslValidateResult:
    """Validate DSL format and return errors, warnings, and fix suggestions."""
    state = ValidationState(text)

    for index, line in enumerate(state.lines):
        if not line.strip():
            continue
        normalized = line.replace("'", '"') if "'" in line and '"' not in line else line
        _validate_dsl_line(state, line, normalized, index + 1, index)

    return _finalize_validation(state)


# Default rules for reference
DEFAULT_RULES = [
    {'id': 'else_invalid', 'desc': 'ELSE z niepoprawnym typem (dozwolone: samodzielne ELSE lub ELSE ERROR/WARN/INFO)'},
    {'id': 'operator_no_brackets', 'desc': 'Operator IF bez nawiasów kwadratowych'},
    {'id': 'set_value_required', 'desc': 'SET musi mieć wartość'},
    {'id': 'missing_end', 'desc': 'Brak END domykającego blok IF/ELSE'},
    {'id': 'no_placeholder_or_undefined', 'desc': 'Zakaz użycia * / undefined / [] w tokenach DSL'},
    {'id': 'duplicate_val', 'desc': 'VAL może być użyte tylko raz w GOAL'},
    {'id': 'duplicate_min', 'desc': 'MIN może być użyte tylko raz w GOAL'},
    {'id': 'duplicate_max', 'desc': 'MAX może być użyte tylko raz w GOAL'},
    {'id': 'dialog_prompt_required', 'desc': 'DIALOG wymaga tekstu pytania'},
    {'id': 'missing_get_declaration', 'desc': 'Zmienna czujnika (NC, WC, PC, TC, SC) wymaga deklaracji GET przed użyciem'},
]
