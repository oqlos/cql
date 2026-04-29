"""Python port of `oqlos/cql/runtime/dsl-content-helpers.ts`.

Content processing utilities for DSL rendering.
"""
from __future__ import annotations

import re
from typing import Any

from .quotes import format_dsl_literal, quote_dsl_value


def _q(value: str) -> str:
    return format_dsl_literal(value)


def normalize_dsl(text: str, title: str | None = None) -> str:
    """Ensure SCENARIO header exists; optionally inject title."""
    raw = str(text or '').strip()
    if not raw:
        return f'SCENARIO: {title}' if title else 'SCENARIO: scenario'
    has_header = re.match(r'^\s*SCENARIO\s*:', raw, re.IGNORECASE)
    return raw if has_header else f'SCENARIO: {title or "scenario"}\n{raw}'


def normalize_quoted_dsl_line(line: str) -> str:
    """Normalize a DSL/CQL line that uses single quotes so existing parsers can read it."""
    raw = str(line or '')
    if "'" not in raw or '"' in raw:
        return raw
    return raw.replace(r"'([^']*)'", r'"\1"')


def _normalize_action_target(raw: str) -> str:
    value = str(raw or '').strip()
    if not value:
        return ''
    valve_match = re.search(r'(?:^|\b)(?:zaw[oó]r|bo)\s*0*(\d+)\b', value, re.IGNORECASE)
    if valve_match:
        return f'zawór {int(valve_match.group(1))}'
    if re.search(r'spr[eę]żarka|sprezarka|compressor', value, re.IGNORECASE):
        return 'sprężarka'
    return value


def _is_off_action(action: str) -> bool:
    return bool(re.search(r'(zamknij|wy[łl]ącz|wylacz|disable|off|stop)', str(action or ''), re.IGNORECASE))


def _is_timing_action(value: str) -> bool:
    return bool(re.match(r'^(wait|delay|pause|timeout)$', str(value or '').strip(), re.IGNORECASE))


def _build_legacy_set_line(target: str, value: str, indent: str) -> str:
    return f'{indent}SET {_q(target)} {_q(value)}'


def _get_legacy_task_function_name(task: dict[str, Any]) -> str:
    return str(task.get('function') or task.get('action') or '').strip()


def _get_legacy_task_object_name(task: dict[str, Any]) -> str:
    return str(task.get('object') or '').strip()


def _render_legacy_timing_task(function_name: str, raw_object: str, indent: str) -> list[str] | None:
    if not _is_timing_action(function_name) and not _is_timing_action(raw_object):
        return None
    keyword = (function_name if _is_timing_action(function_name) else raw_object).strip().lower()
    value = (raw_object if _is_timing_action(function_name) else function_name).strip()
    return [_build_legacy_set_line(keyword, value, indent)] if value else []


def _render_legacy_object_task(function_name: str, raw_object: str, indent: str) -> list[str] | None:
    object_name = _normalize_action_target(raw_object)
    if not object_name:
        return None
    return [_build_legacy_set_line(object_name, '0' if _is_off_action(function_name) else '1', indent)]


def _render_legacy_function_task(function_name: str, indent: str) -> list[str]:
    return [_build_legacy_set_line(function_name, '1', indent)] if function_name else []


def _render_single_legacy_task(task: dict[str, Any], indent: str = '  ') -> list[str]:
    function_name = _get_legacy_task_function_name(task)
    raw_object = _get_legacy_task_object_name(task)
    if not function_name and not raw_object:
        return []
    result = _render_legacy_timing_task(function_name, raw_object, indent)
    if result is not None:
        return result
    result = _render_legacy_object_task(function_name, raw_object, indent)
    if result is not None:
        return result
    return _render_legacy_function_task(function_name, indent)


def _get_legacy_task_sequence(task: dict[str, Any]) -> list[dict[str, Any]]:
    ands = task.get('ands') or []
    return [task] + (list(ands) if ands else [])


def render_legacy_task_as_dsl_lines(task: dict[str, Any], indent: str = '  ') -> list[str]:
    """Render legacy task as DSL lines."""
    return [line for entry in _get_legacy_task_sequence(task) for line in _render_single_legacy_task(entry, indent)]


def _build_conditional_line(step: dict[str, Any], indent: str = '  ') -> str:
    unit = str(step.get('unit') or '').strip()
    value = str(step.get('value') or '').strip()
    val_text = f'{value} {unit}' if unit else value
    return f'{indent}IF {_q(str(step.get("parameter") or ""))} {step.get("operator", "=")} {_q(val_text)}'


def _build_else_line(step: dict[str, Any], indent: str = '  ') -> str:
    action_type = str(step.get('actionType') or 'ERROR').upper()
    action_message = str(step.get('actionMessage') or '')
    return f'{indent}ELSE {action_type} {_q(action_message)}'


def _build_variable_payload(value: str, unit: str) -> str:
    return f'{value} {unit}' if unit else value


def _append_variable_entries(lines: list[str], variables: list[dict[str, Any]], indent: str = '  ') -> None:
    for entry in variables:
        action = str(entry.get('action') or 'GET').upper()
        parameter = str(entry.get('parameter') or '')
        value = str(entry.get('value') or '').strip()
        unit = str(entry.get('unit') or '').strip()
        if not parameter:
            continue
        if action == 'GET':
            unit_part = f' {_q(unit)}' if unit else ''
            lines.append(f'{indent}GET {_q(parameter)}{unit_part}')
            continue
        if action in ('SET', 'MAX', 'MIN'):
            right = _build_variable_payload(value, unit)
            lines.append(f'{indent}{action} {_q(parameter)} {_q(right)}')


def _append_variable_groups(lines: list[str], variable_groups: list[dict[str, Any]], indent: str = '  ') -> None:
    for group in variable_groups:
        variables = group.get('variables') or []
        if isinstance(variables, list):
            _append_variable_entries(lines, variables, indent)


def _append_condition_lines(lines: list[str], conditions: list[dict[str, Any]], indent: str = '  ') -> None:
    for condition in conditions:
        type_ = str(condition.get('type') or '').lower()
        if type_ == 'if':
            lines.append(_build_conditional_line(condition, indent))
        elif type_ == 'else':
            lines.append(_build_else_line(condition, indent))


def _append_task_range(lines: list[str], tasks: list[dict[str, Any]], start_index: int = 0, end_index: int | None = None) -> None:
    end = end_index if end_index is not None else len(tasks)
    for index in range(start_index, end):
        lines.extend(render_legacy_task_as_dsl_lines(tasks[index], '  '))


def _find_first_off_task_index(tasks: list[dict[str, Any]]) -> int:
    for index, task in enumerate(tasks):
        name = str(task.get('function') or '').lower()
        if 'wyłącz' in name or 'wylacz' in name or 'off' in name:
            return index
    return -1


def _append_structured_goal_steps(lines: list[str], goal: dict[str, Any]) -> None:
    steps = goal.get('steps') or []
    for step in steps:
        if not isinstance(step, dict):
            continue
        type_ = str(step.get('type') or '').lower()
        if type_ == 'task':
            lines.extend(render_legacy_task_as_dsl_lines(step, '  '))
        elif type_ == 'if':
            lines.append(_build_conditional_line(step))
        elif type_ == 'else':
            lines.append(_build_else_line(step))
        elif type_ == 'variable':
            variables = step.get('variables') or []
            if isinstance(variables, list):
                _append_variable_entries(lines, variables)


def _append_legacy_goal_content(lines: list[str], goal: dict[str, Any]) -> None:
    tasks = goal.get('tasks') or []
    variable_groups = goal.get('variables') or []
    conditions = goal.get('conditions') or []
    split_index = _find_first_off_task_index(tasks)
    if split_index >= 0:
        _append_task_range(lines, tasks, 0, split_index)
        _append_variable_groups(lines, variable_groups)
        _append_condition_lines(lines, conditions)
        _append_task_range(lines, tasks, split_index)
        return
    _append_task_range(lines, tasks)
    _append_variable_groups(lines, variable_groups)
    _append_condition_lines(lines, conditions)


def _append_goal_dsl(lines: list[str], goal: dict[str, Any]) -> None:
    goal_name = str(goal.get('name') or 'GOAL')
    lines.append(f'GOAL: {goal_name}')
    steps = goal.get('steps') or []
    if steps:
        _append_structured_goal_steps(lines, goal)
    else:
        _append_legacy_goal_content(lines, goal)
    lines.append('')


def _build_scenario_dsl_lines(content: dict[str, Any] | None, title: str | None = None) -> list[str]:
    lines = [f'SCENARIO: {title or "scenario"}']
    goals = (content or {}).get('goals') or [] if isinstance(content, dict) else []
    if not goals:
        return lines
    for goal in goals:
        _append_goal_dsl(lines, goal)
    return lines


def dsl_from_scenario_content(content: Any, title: str | None = None) -> str:
    """Build DSL string from scenario.content (prefer content.dsl, fallback to JSON goals)."""
    try:
        if isinstance(content, dict):
            dsl = str(content.get('dsl') or '').strip()
            if dsl:
                return normalize_dsl(dsl, title)
    except Exception:
        pass
    try:
        return '\n'.join(_build_scenario_dsl_lines(content if isinstance(content, dict) else None, title))
    except Exception:
        pass
    return '\n'.join(_build_scenario_dsl_lines(None, title))


def goals_from_content(content: Any, title: str | None = None) -> list[str]:
    """Extract goal names from content."""
    from .parser import parse_dsl
    try:
        text = dsl_from_scenario_content(content, title)
        res = parse_dsl(text)
        if res.ok:
            return [g.name for g in res.ast.goals]
    except Exception:
        pass
    return []
