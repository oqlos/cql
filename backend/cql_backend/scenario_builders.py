"""Python port of `oqlos/cql/runtime/dsl-scenario-builders.ts`.

DSL builders for different scenario types.
"""
from __future__ import annotations

from typing import Any

from .content_helpers import render_legacy_task_as_dsl_lines
from .quotes import format_dsl_literal


def _q(value: str) -> str:
    return format_dsl_literal(value)


class DslScenarioBuilders:
    """Build DSL from different scenario sources."""

    @staticmethod
    def build_dsl_from_test_scenario(sc: dict[str, Any]) -> str:
        """Build DSL from TestScenario for device testing."""
        lines: list[str] = []
        name = sc.get('name') or 'Unnamed'
        lines.append(f'SCENARIO: {name}')
        lines.append('')
        activities = sc.get('activities') or []
        for act in activities:
            act_name = act.get('name') or 'Unnamed'
            lines.append(f'GOAL: {act_name}')
            lines.append(f'  SET {_q(act_name)} {_q("1")}')
            c = act.get('criteria') or {}
            unit = c.get('unit') or ''
            param = unit if unit else act_name
            if c.get('min') is not None:
                val = f"{c['min']}{f' {unit}' if unit else ''}"
                lines.append(f'  IF {_q(param)} >= {_q(val)}')
            if c.get('max') is not None:
                val = f"{c['max']}{f' {unit}' if unit else ''}"
                lines.append(f'  IF {_q(param)} <= {_q(val)}')
            if c.get('targetValue') is not None:
                val = f"{c['targetValue']}{f' {unit}' if unit else ''}"
                lines.append(f'  IF {_q(param)} = {_q(val)}')
            if c.get('duration') is not None:
                dur_val = f"{c['duration']} s"
                lines.append(f'  IF {_q("czas")} >= {_q(dur_val)}')
            lines.append('')
        return '\n'.join(lines)

    @staticmethod
    def build_goals_from_test_scenario(sc: dict[str, Any]) -> list[dict[str, Any]]:
        """Build goals JSON from TestScenario."""
        goals: list[dict[str, Any]] = []
        activities = sc.get('activities') or []
        for act in activities:
            conditions: list[dict[str, Any]] = []
            c = act.get('criteria') or {}
            unit = c.get('unit') or ''
            param = unit if unit else act.get('name', '')
            result = 'test zaliczony'
            if c.get('min') is not None:
                conditions.append({
                    'type': 'if',
                    'parameter': param,
                    'operator': '>=',
                    'value': str(c['min']),
                    'unit': unit,
                    'result': result
                })
            if c.get('max') is not None:
                conditions.append({
                    'type': 'if',
                    'parameter': param,
                    'operator': '<=',
                    'value': str(c['max']),
                    'unit': unit,
                    'result': result
                })
            if c.get('targetValue') is not None:
                conditions.append({
                    'type': 'if',
                    'parameter': param,
                    'operator': '=',
                    'value': str(c['targetValue']),
                    'unit': unit,
                    'result': result
                })
            if c.get('duration') is not None:
                conditions.append({
                    'type': 'if',
                    'parameter': 'czas',
                    'operator': '>=',
                    'value': str(c['duration']),
                    'unit': 's',
                    'result': result
                })
            goal = {
                'name': act.get('name', ''),
                'tasks': [{'function': 'Sprawdź', 'object': act.get('name', '')}],
                'conditions': conditions
            }
            goals.append(goal)
        return goals

    @staticmethod
    def build_dsl_from_generic_scenario(scenario: dict[str, Any]) -> str:
        """Build DSL from generic scenario content."""
        lines: list[str] = []
        name = scenario.get('name') if isinstance(scenario, dict) else 'Generic Scenario'
        lines.append(f'SCENARIO: {name}')
        lines.append('')

        goals = scenario.get('goals') or [] if isinstance(scenario, dict) else []
        for goal in goals:
            goal_name = goal.get('name') if isinstance(goal, dict) else 'GOAL'
            lines.append(f'GOAL: {goal_name}')

            # Tasks
            tasks = goal.get('tasks') or [] if isinstance(goal, dict) else []
            for task in tasks:
                if isinstance(task, dict) and task.get('function') and task.get('object'):
                    lines.extend(render_legacy_task_as_dsl_lines(task, '  '))

            # Variables
            variables = goal.get('variables') or [] if isinstance(goal, dict) else []
            for var_group in variables:
                vars_list = var_group.get('variables') or [] if isinstance(var_group, dict) else []
                for v in vars_list:
                    if not isinstance(v, dict):
                        continue
                    action = str(v.get('action') or 'GET').upper()
                    param = str(v.get('parameter') or '')
                    val = str(v.get('value') or '').strip()
                    unit = str(v.get('unit') or '').strip()
                    if not param:
                        continue
                    if action == 'GET':
                        unit_part = f' {_q(unit)}' if unit else ''
                        lines.append(f'  GET {_q(param)}{unit_part}')
                    elif action == 'VAL':
                        unit_part = f' {_q(unit)}' if unit else ''
                        lines.append(f'  VAL {_q(param)}{unit_part}')
                    else:
                        right = f'{val} {unit}' if unit else val
                        lines.append(f'  {action} {_q(param)} {_q(right)}')

            # Conditions
            conditions = goal.get('conditions') or [] if isinstance(goal, dict) else []
            for c in conditions:
                if not isinstance(c, dict):
                    continue
                t = str(c.get('type') or '').lower()
                if t == 'if':
                    unit = str(c.get('unit') or '').strip()
                    val = str(c.get('value') or '').strip()
                    val_text = f'{val} {unit}' if unit else val
                    lines.append(f'  IF {_q(c.get("parameter") or "")} {c.get("operator", "=")} {_q(val_text)}')
                elif t == 'else':
                    action_type = str(c.get('actionType') or 'ERROR').upper()
                    action_message = str(c.get('actionMessage') or '')
                    lines.append(f'  ELSE {action_type} {_q(action_message)}')

            lines.append('')

        return '\n'.join(lines)
