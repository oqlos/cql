"""Tests for the DSL scenario builders module."""
from __future__ import annotations

from cql_backend.scenario_builders import DslScenarioBuilders


def test_build_dsl_from_test_scenario() -> None:
    sc = {
        "name": "Pressure Test",
        "activities": [
            {
                "name": "Check Pressure",
                "criteria": {"min": 5.0, "max": 10.0, "unit": "mbar"}
            }
        ]
    }
    dsl = DslScenarioBuilders.build_dsl_from_test_scenario(sc)
    assert "SCENARIO: Pressure Test" in dsl
    assert "GOAL: Check Pressure" in dsl
    assert "IF" in dsl
    assert "mbar" in dsl


def test_build_goals_from_test_scenario() -> None:
    sc = {
        "name": "Flow Test",
        "activities": [
            {
                "name": "Check Flow",
                "criteria": {"min": 2.0, "unit": "l/min"}
            }
        ]
    }
    goals = DslScenarioBuilders.build_goals_from_test_scenario(sc)
    assert len(goals) == 1
    assert goals[0]["name"] == "Check Flow"
    assert len(goals[0]["conditions"]) > 0


def test_build_dsl_from_generic_scenario() -> None:
    scenario = {
        "name": "Generic Test",
        "goals": [
            {
                "name": "Generic Goal",
                "tasks": [{"function": "Test", "object": "Device"}],
                "variables": [],
                "conditions": []
            }
        ]
    }
    dsl = DslScenarioBuilders.build_dsl_from_generic_scenario(scenario)
    assert "SCENARIO: Generic Test" in dsl
    assert "GOAL: Generic Goal" in dsl


def test_build_dsl_with_duration() -> None:
    sc = {
        "name": "Duration Test",
        "activities": [
            {"name": "Wait Test", "criteria": {"duration": 30}}
        ]
    }
    dsl = DslScenarioBuilders.build_dsl_from_test_scenario(sc)
    assert "czas" in dsl
    assert "30 s" in dsl
