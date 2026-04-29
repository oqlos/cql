"""Python port of `oqlos/cql/runtime/dsl.serialize.text.ts`.

Serializes DSL AST back to DSL text format.
"""
from __future__ import annotations

import re
from typing import Any

from .quotes import format_dsl_literal, canonicalize_dsl_quotes
from .types import DslAst, DslGoal, DslFunc, DslStep

STEP_INDENT = '  '


def _build_value_with_unit(value: Any, unit: str | None = None) -> str:
    value_text = str(value or '').strip()
    unit_text = str(unit or '').strip()
    return f'{value_text} {unit_text}' if unit_text else value_text


def _q(value: str) -> str:
    return format_dsl_literal(value)


def _is_step_type(step: DslStep, type_: str) -> bool:
    if isinstance(step, dict):
        return step.get('type') == type_
    return getattr(step, 'type', None) == type_


def _get_step_attr(step: DslStep, attr: str, default: Any = None) -> Any:
    if isinstance(step, dict):
        return step.get(attr, default)
    return getattr(step, attr, default)


def _serialize_task_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'task'):
        return None
    from .content_helpers import render_legacy_task_as_dsl_lines
    function = _get_step_attr(step, 'function', '')
    object_ = _get_step_attr(step, 'object', '')
    ands = _get_step_attr(step, 'ands', [])
    task = {'function': function, 'object': object_, 'ands': ands}
    return render_legacy_task_as_dsl_lines(task, STEP_INDENT)


def _serialize_if_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'if'):
        return None
    parameter = _get_step_attr(step, 'parameter', '')
    operator = _get_step_attr(step, 'operator', '=')
    value = _get_step_attr(step, 'value', '')
    unit = _get_step_attr(step, 'unit')
    return [f'{STEP_INDENT}IF {_q(parameter)} {operator} {_q(_build_value_with_unit(value, unit))}']


def _serialize_else_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'else'):
        return None
    action_type = _get_step_attr(step, 'actionType')
    action_message = _get_step_attr(step, 'actionMessage')
    if not action_type and not action_message:
        return [f'{STEP_INDENT}ELSE']
    return [f'{STEP_INDENT}ELSE {str(action_type or "ERROR").upper()} {_q(action_message or "")}']


def _serialize_param_query_step(type_: str, keyword: str, step: DslStep) -> list[str] | None:
    if not _is_step_type(step, type_):
        return None
    parameter = str(_get_step_attr(step, 'parameter', ''))
    unit = str(_get_step_attr(step, 'unit', ''))
    if unit:
        return [f'{STEP_INDENT}{keyword} {_q(parameter)} {_q(unit)}']
    return [f'{STEP_INDENT}{keyword} {_q(parameter)}']


def _serialize_value_step(type_: str, keyword: str, step: DslStep) -> list[str] | None:
    if not _is_step_type(step, type_):
        return None
    parameter = str(_get_step_attr(step, 'parameter', ''))
    value = _get_step_attr(step, 'value', '')
    unit = _get_step_attr(step, 'unit')
    return [f'{STEP_INDENT}{keyword} {_q(parameter)} {_q(_build_value_with_unit(value, unit))}']


def _serialize_delta_step(type_: str, keyword: str, step: DslStep) -> list[str] | None:
    if not _is_step_type(step, type_):
        return None
    parameter = str(_get_step_attr(step, 'parameter', ''))
    value = _get_step_attr(step, 'value', '')
    unit = _get_step_attr(step, 'unit')
    per = str(_get_step_attr(step, 'per', '')).strip()
    per_text = f' PER {_q(per)}' if per else ''
    return [f'{STEP_INDENT}{keyword} {_q(parameter)} {_q(_build_value_with_unit(value, unit))}{per_text}']


def _serialize_wait_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'wait'):
        return None
    duration = _get_step_attr(step, 'duration', '')
    unit = _get_step_attr(step, 'unit')
    return [f'{STEP_INDENT}SET {_q("WAIT")} {_q(_build_value_with_unit(duration, unit))}']


def _serialize_pump_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'pump'):
        return None
    value = _get_step_attr(step, 'value', '')
    unit = _get_step_attr(step, 'unit')
    return [f'{STEP_INDENT}SET {_q("POMPA")} {_q(_build_value_with_unit(value, unit))}']


def _serialize_sample_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'sample'):
        return None
    parameter = str(_get_step_attr(step, 'parameter', ''))
    state_val = str(_get_step_attr(step, 'state', 'START')).upper()
    interval = str(_get_step_attr(step, 'interval', '')).strip()
    interval_text = f' {_q(interval)}' if interval else ''
    return [f'{STEP_INDENT}SAMPLE {_q(parameter)} {_q(state_val)}{interval_text}']


def _serialize_calc_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'calc'):
        return None
    result = str(_get_step_attr(step, 'result', ''))
    function = str(_get_step_attr(step, 'function', ''))
    input_val = str(_get_step_attr(step, 'input', ''))
    return [f'{STEP_INDENT}CALC {_q(result)} = {_q(function)} {_q(input_val)}']


def _serialize_fun_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'fun'):
        return None
    result = str(_get_step_attr(step, 'result', ''))
    expression = str(_get_step_attr(step, 'expression', ''))
    return [f'{STEP_INDENT}FUN {_q(result)} = {canonicalize_dsl_quotes(expression)}']


def _serialize_message_step(type_: str, keyword: str, step: DslStep) -> list[str] | None:
    if not _is_step_type(step, type_):
        return None
    message = str(_get_step_attr(step, 'message', ''))
    return [f'{STEP_INDENT}{keyword} {_q(message)}']


def _serialize_save_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'save'):
        return None
    parameter = str(_get_step_attr(step, 'parameter', ''))
    return [f'{STEP_INDENT}SAVE {_q(parameter)}']


def _serialize_func_call_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'func_call'):
        return None
    name = str(_get_step_attr(step, 'name', ''))
    args = _get_step_attr(step, 'arguments', []) or []
    arg_list = [str(v or '').strip() for v in args if v]
    arg_text = ''.join(f' {_q(v)}' for v in arg_list)
    return [f'{STEP_INDENT}FUNC {_q(name)}{arg_text}']


def _serialize_user_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'user'):
        return None
    action = str(_get_step_attr(step, 'action', ''))
    message = str(_get_step_attr(step, 'message', ''))
    return [f'{STEP_INDENT}USER {_q(action)} {_q(message)}']


def _serialize_result_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'result'):
        return None
    status = str(_get_step_attr(step, 'status', ''))
    return [f'{STEP_INDENT}RESULT {_q(status)}']


def _serialize_opt_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'opt'):
        return None
    parameter = str(_get_step_attr(step, 'parameter', ''))
    description = str(_get_step_attr(step, 'description', ''))
    return [f'{STEP_INDENT}OPT {_q(parameter)} {_q(description)}']


def _serialize_info_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'info'):
        return None
    level = str(_get_step_attr(step, 'level', 'INFO')).upper()
    message = str(_get_step_attr(step, 'message', ''))
    return [f'{STEP_INDENT}INFO {_q(level)} {_q(message)}']


def _serialize_repeat_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'repeat'):
        return None
    return [f'{STEP_INDENT}REPEAT']


def _serialize_end_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'end'):
        return None
    return [f'{STEP_INDENT}END']


def _serialize_out_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'out'):
        return None
    out_type = str(_get_step_attr(step, 'outType', ''))
    value = str(_get_step_attr(step, 'value', ''))
    return [f'{STEP_INDENT}OUT {_q(out_type)} {_q(value)}']


def _serialize_dialog_step(step: DslStep) -> list[str] | None:
    if not _is_step_type(step, 'dialog'):
        return None
    parameter = str(_get_step_attr(step, 'parameter', ''))
    message = str(_get_step_attr(step, 'message', ''))
    return [f'{STEP_INDENT}DIALOG {_q(parameter)} {_q(message)}']


STEP_SERIALIZERS = [
    _serialize_task_step,
    _serialize_if_step,
    _serialize_else_step,
    lambda s: _serialize_func_call_step(s),
    lambda s: _serialize_param_query_step('get', 'GET', s),
    lambda s: _serialize_param_query_step('val', 'VAL', s),
    lambda s: _serialize_value_step('set', 'SET', s),
    lambda s: _serialize_value_step('max', 'MAX', s),
    lambda s: _serialize_value_step('min', 'MIN', s),
    lambda s: _serialize_delta_step('delta_max', 'DELTA_MAX', s),
    lambda s: _serialize_delta_step('delta_min', 'DELTA_MIN', s),
    _serialize_wait_step,
    _serialize_pump_step,
    _serialize_sample_step,
    _serialize_calc_step,
    _serialize_fun_step,
    lambda s: _serialize_message_step('log', 'LOG', s),
    lambda s: _serialize_message_step('alarm', 'ALARM', s),
    lambda s: _serialize_message_step('error', 'ERROR', s),
    _serialize_save_step,
    _serialize_user_step,
    _serialize_result_step,
    _serialize_opt_step,
    _serialize_info_step,
    _serialize_repeat_step,
    _serialize_dialog_step,
    _serialize_out_step,
    _serialize_end_step,
]


def _render_structured_step(step: DslStep | dict[str, Any]) -> list[str]:
    for serializer in STEP_SERIALIZERS:
        lines = serializer(step)
        if lines is not None:
            return lines
    return []


def _render_legacy_block_content(block: DslGoal | DslFunc) -> list[str]:
    from .content_helpers import render_legacy_task_as_dsl_lines
    lines: list[str] = []
    tasks = getattr(block, 'tasks', None) or []
    for task in tasks:
        lines.extend(render_legacy_task_as_dsl_lines(task, STEP_INDENT))
    conditions = getattr(block, 'conditions', None) or []
    for condition in conditions:
        lines.extend(_render_structured_step(condition))
    return lines


def _build_block_lines(header: str, block: DslGoal | DslFunc) -> list[str]:
    lines = [header]
    steps = getattr(block, 'steps', None) or []
    if steps:
        structured_steps = []
        for step in steps:
            structured_steps.extend(_render_structured_step(step))
        lines.extend(structured_steps)
    else:
        lines.extend(_render_legacy_block_content(block))
    lines.append('')
    return lines


def _build_scenario_lines(ast: DslAst) -> list[str]:
    lines = [f'SCENARIO: {(ast.scenario or "").strip() or "Bez nazwy"}', '']
    for goal in ast.goals:
        lines.extend(_build_block_lines(f'GOAL: {goal.name}', goal))
    funcs = ast.funcs or []
    for func in funcs:
        lines.extend(_build_block_lines(f'FUNC: {func.name}', func))
    return lines


def ast_to_dsl_text(ast: DslAst | dict[str, Any]) -> str:
    """Convert DSL AST to DSL text."""
    if isinstance(ast, dict):
        from pydantic import TypeAdapter
        adapter = TypeAdapter(DslAst)
        ast = adapter.validate_python(ast)
    return '\n'.join(_build_scenario_lines(ast))


def normalize_dsl_text(text: str) -> str:
    """Simple normalization: trim trailing spaces and ensure LF newlines."""
    result = (text or '').replace('\r\n', '\n').strip()
    # Remove trailing whitespace from each line
    result = '\n'.join(line.rstrip() for line in result.split('\n'))
    return result + '\n'
