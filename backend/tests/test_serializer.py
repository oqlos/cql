"""Tests for the DSL serializer module."""
from __future__ import annotations

from cql_backend.serializer import ast_to_dsl_text


def test_serialize_simple_ast() -> None:
    ast = {
        "scenario": "Test",
        "goals": [
            {
                "name": "Test Goal",
                "tasks": [],
                "conditions": [],
                "steps": [{"type": "log", "message": "hello"}]
            }
        ],
        "funcs": []
    }
    text = ast_to_dsl_text(ast)
    assert "SCENARIO: Test" in text
    assert "GOAL: Test Goal" in text
    assert "LOG" in text


def test_serialize_with_set_step() -> None:
    ast = {
        "scenario": "Set Test",
        "goals": [
            {
                "name": "Set Goal",
                "tasks": [],
                "conditions": [],
                "steps": [{"type": "set", "parameter": "x", "value": "5", "unit": "mbar"}]
            }
        ],
        "funcs": []
    }
    text = ast_to_dsl_text(ast)
    assert "SET" in text
    assert "x" in text
    assert "5 mbar" in text or "mbar" in text


def test_serialize_with_if_condition() -> None:
    ast = {
        "scenario": "If Test",
        "goals": [
            {
                "name": "If Goal",
                "tasks": [],
                "conditions": [],
                "steps": [{"type": "if", "parameter": "x", "operator": ">=", "value": "5"}]
            }
        ],
        "funcs": []
    }
    text = ast_to_dsl_text(ast)
    assert "IF" in text
    assert ">=" in text
