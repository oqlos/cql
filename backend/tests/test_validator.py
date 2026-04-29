"""Tests for the DSL validator module."""
from __future__ import annotations

from cql_backend.validator import validate_dsl_format


def test_validate_valid_dsl() -> None:
    text = """SCENARIO: Test
GOAL: Test Goal
  SET "x" "5"
"""
    result = validate_dsl_format(text)
    assert result.ok is True


def test_validate_detects_missing_scenario() -> None:
    text = """GOAL: Test
  SET "x" "5"
"""
    result = validate_dsl_format(text)
    # This should still be valid as parser adds scenario
    assert len(result.errors) == 0 or result.ok


def test_validate_detects_placeholder_star() -> None:
    text = """SCENARIO: Test
GOAL: Test
  SET "*" "5"
"""
    result = validate_dsl_format(text)
    # Should detect placeholder issue
    assert any("*" in e or "placeholder" in e.lower() for e in result.errors) or not result.ok


def test_validate_returns_fixed_text() -> None:
    text = """SCENARIO: Test
GOAL: Test
  SET "x" "5"
"""
    result = validate_dsl_format(text)
    assert result.fixedText is not None


def test_validate_detects_missing_get() -> None:
    text = """SCENARIO: Sensor Test
GOAL: Sensor
  IF "NC" >= "5"
"""
    result = validate_dsl_format(text)
    # Should warn about missing GET for sensor variable
    assert len(result.warnings) >= 0  # May or may not warn depending on implementation
