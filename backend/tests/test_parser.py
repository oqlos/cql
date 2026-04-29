"""Tests for the DSL parser module."""
from __future__ import annotations

import pytest

from cql_backend.parser import parse_dsl


def test_parse_simple_scenario() -> None:
    text = """SCENARIO: Test
GOAL: Test Goal
  SET "x" "5"
"""
    result = parse_dsl(text)
    assert result.ok is True
    assert result.ast.scenario == "Test"
    assert len(result.ast.goals) == 1
    assert result.ast.goals[0].name == "Test Goal"


def test_parse_with_condition() -> None:
    text = """SCENARIO: Pressure Test
GOAL: Check Pressure
  SET "Pressure" "5.0 mbar"
  IF "Pressure" >= "4.0 mbar"
  ELSE ERROR "Too low"
"""
    result = parse_dsl(text)
    assert result.ok is True
    assert len(result.ast.goals[0].conditions) == 2
    assert result.ast.goals[0].conditions[0].type == "if"


def test_parse_with_task() -> None:
    text = """SCENARIO: Task Test
GOAL: Do Something
  TASK: Action [Object]
"""
    result = parse_dsl(text)
    assert result.ok is True


def test_parse_empty_returns_error() -> None:
    result = parse_dsl("")
    assert result.ok is False
    assert len(result.errors) > 0


def test_parse_with_func() -> None:
    text = """SCENARIO: Func Test
FUNC: MyFunc
  SET "x" "1"
GOAL: Test
  FUNC "MyFunc"
"""
    result = parse_dsl(text)
    assert result.ok is True
    assert len(result.ast.funcs) == 1


def test_parse_with_wait() -> None:
    text = """SCENARIO: Wait Test
GOAL: Wait Test
  WAIT "5 s"
"""
    result = parse_dsl(text)
    assert result.ok is True
