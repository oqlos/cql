"""Tests for the DSL exec runtime module."""
from __future__ import annotations

from cql_backend.exec_runtime import execute_dsl


def _get_kind(p):
    """Helper to get kind from either dict or Pydantic model."""
    return p.get("kind") if isinstance(p, dict) else getattr(p, "kind", None)


def test_exec_simple_dsl() -> None:
    text = """SCENARIO: Test
GOAL: Test Goal
  SET "x" "5"
"""
    result = execute_dsl(text)
    assert result.ok is True
    assert len(result.plan) > 0
    assert _get_kind(result.plan[0]) == "goal"


def test_exec_with_condition() -> None:
    text = """SCENARIO: Condition Test
GOAL: Check
  SET "x" "5"
  IF "x" >= "3"
  ELSE ERROR "Failed"
"""
    result = execute_dsl(text)
    assert result.ok is True
    assert any(_get_kind(p) == "condition" for p in result.plan)


def test_exec_with_log() -> None:
    text = """SCENARIO: Log Test
GOAL: Log
  LOG "test message"
"""
    result = execute_dsl(text)
    assert result.ok is True
    assert any(_get_kind(p) == "message" for p in result.plan)


def test_exec_returns_ast() -> None:
    text = """SCENARIO: AST Test
GOAL: AST
  SET "y" "10"
"""
    result = execute_dsl(text)
    assert result.ast is not None
    assert result.ast.scenario == "AST Test"
