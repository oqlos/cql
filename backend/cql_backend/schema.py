"""DSL JSON-Schema export and AST validator.

Port of ``oqlos/cql/runtime/dsl.schema.ts``:

- ``DSL_JSON_SCHEMA`` mirrors the ``dslJsonSchema`` constant exported from TS
  byte-for-byte (used by `/api/cql/json-schema`).
- ``validate_ast(ast)`` mirrors the ``validateAst`` function — it checks the
  AST against the JSON Schema using `jsonschema.Draft7Validator` so error
  messages are similar to the Zod issues produced by the TS validator.

We deliberately do not re-derive the JSON Schema from pydantic models: the
TS schema is hand-tuned (specific ``anyOf`` for goals/funcs requirement,
``additionalProperties: false``, etc.) and round-tripping through pydantic
would drift over time.
"""
from __future__ import annotations

from typing import Any

try:
    from jsonschema import Draft7Validator
except Exception:  # pragma: no cover
    Draft7Validator = None  # type: ignore[assignment]


_STRING = {"type": "string"}
_NON_EMPTY_STRING = {"type": "string", "minLength": 1}
_OPERATOR = {"enum": [">", "<", "=", ">=", "<=", "!="]}
_CONNECTOR = {"enum": ["AND", "OR", "ELSE"]}
_ELSE_ACTION = {"enum": ["ERROR", "WARNING", "INFO", "GOAL"]}
_SAMPLE_STATE = {"enum": ["START", "STOP"]}
_CALC_FUNCTION = {"enum": ["AVG", "SUM", "MIN", "MAX", "COUNT", "STDDEV"]}


def _obj(required: list[str], properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "required": required,
        "properties": properties,
        "additionalProperties": False,
    }


def _typed(type_value: str, required: list[str], properties: dict[str, Any]) -> dict[str, Any]:
    return _obj(["type", *required], {"type": {"const": type_value}, **properties})


_TASK_AND = _obj(["function"], {"function": _NON_EMPTY_STRING, "object": _STRING})

_TASK = _obj(
    ["function"],
    {
        "function": _NON_EMPTY_STRING,
        "object": _STRING,
        "ands": {"type": "array", "items": _TASK_AND},
    },
)

_IF = _typed(
    "if",
    ["parameter", "operator", "value"],
    {
        "parameter": _NON_EMPTY_STRING,
        "operator": _OPERATOR,
        "value": _NON_EMPTY_STRING,
        "unit": _STRING,
        "connector": _CONNECTOR,
        "incomingConnector": _CONNECTOR,
    },
)

_ELSE = _typed(
    "else",
    [],
    {"actionType": _ELSE_ACTION, "actionMessage": _STRING},
)

_STEP_TASK = _typed(
    "task",
    ["function"],
    {
        "function": _NON_EMPTY_STRING,
        "object": _STRING,
        "ands": {"type": "array", "items": _TASK_AND},
    },
)

_STEPS: list[dict[str, Any]] = [
    _STEP_TASK,
    _typed("pump", ["value", "raw"], {"value": _NON_EMPTY_STRING, "unit": _STRING, "raw": _NON_EMPTY_STRING}),
    _typed(
        "func_call",
        ["name"],
        {"name": _NON_EMPTY_STRING, "arguments": {"type": "array", "items": _NON_EMPTY_STRING}},
    ),
    _IF,
    _ELSE,
    _typed("get", ["parameter"], {"parameter": _NON_EMPTY_STRING, "unit": _STRING}),
    _typed("set", ["parameter", "value"], {"parameter": _NON_EMPTY_STRING, "value": _NON_EMPTY_STRING, "unit": _STRING}),
    _typed("max", ["parameter", "value"], {"parameter": _NON_EMPTY_STRING, "value": _NON_EMPTY_STRING, "unit": _STRING}),
    _typed("min", ["parameter", "value"], {"parameter": _NON_EMPTY_STRING, "value": _NON_EMPTY_STRING, "unit": _STRING}),
    _typed(
        "delta_max",
        ["parameter", "value"],
        {"parameter": _NON_EMPTY_STRING, "value": _NON_EMPTY_STRING, "unit": _STRING, "per": _STRING},
    ),
    _typed(
        "delta_min",
        ["parameter", "value"],
        {"parameter": _NON_EMPTY_STRING, "value": _NON_EMPTY_STRING, "unit": _STRING, "per": _STRING},
    ),
    _typed("val", ["parameter"], {"parameter": _NON_EMPTY_STRING, "unit": _STRING}),
    _typed("wait", ["duration"], {"duration": _NON_EMPTY_STRING, "unit": _STRING}),
    _typed(
        "sample",
        ["parameter", "state"],
        {"parameter": _NON_EMPTY_STRING, "state": _SAMPLE_STATE, "interval": _STRING},
    ),
    _typed(
        "calc",
        ["result", "function", "input"],
        {"result": _NON_EMPTY_STRING, "function": _CALC_FUNCTION, "input": _NON_EMPTY_STRING},
    ),
    _typed(
        "fun",
        ["result", "expression"],
        {
            "result": _NON_EMPTY_STRING,
            "expression": _NON_EMPTY_STRING,
            "variables": {"type": "array", "items": _NON_EMPTY_STRING},
        },
    ),
    _typed("log", ["message"], {"message": _STRING}),
    _typed("alarm", ["message"], {"message": _STRING}),
    _typed("error", ["message"], {"message": _STRING}),
    _typed("save", ["parameter"], {"parameter": _NON_EMPTY_STRING}),
    _typed("user", ["action", "message"], {"action": _NON_EMPTY_STRING, "message": _STRING}),
    _typed("result", ["status"], {"status": _NON_EMPTY_STRING}),
    _typed("opt", ["parameter", "description"], {"parameter": _NON_EMPTY_STRING, "description": _STRING}),
    _typed("info", ["level", "message"], {"level": _NON_EMPTY_STRING, "message": _STRING}),
    _typed("repeat", [], {}),
    _typed("end", [], {}),
    _typed("out", ["outType", "value"], {"outType": _NON_EMPTY_STRING, "value": _STRING}),
    _typed("dialog", ["parameter", "message"], {"parameter": _NON_EMPTY_STRING, "message": _STRING}),
]

_GOAL = _obj(
    ["name", "tasks", "conditions"],
    {
        "name": _NON_EMPTY_STRING,
        "tasks": {"type": "array", "items": _TASK},
        "conditions": {"type": "array", "items": {"anyOf": [_IF, _ELSE]}},
        "steps": {"type": "array", "items": {"anyOf": _STEPS}},
    },
)

_FUNC = _obj(
    ["name", "tasks"],
    {
        "name": _NON_EMPTY_STRING,
        "tasks": {"type": "array", "items": _TASK},
        "steps": {"type": "array", "items": {"anyOf": _STEPS}},
    },
)


DSL_JSON_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://example.com/dsl.schema.json",
    "type": "object",
    "required": ["scenario", "goals"],
    "properties": {
        "scenario": _NON_EMPTY_STRING,
        "goals": {"type": "array", "items": _GOAL},
        "funcs": {"type": "array", "items": _FUNC},
    },
    "anyOf": [
        {"properties": {"goals": {"type": "array", "minItems": 1}}},
        {"required": ["funcs"], "properties": {"funcs": {"type": "array", "minItems": 1}}},
    ],
    "additionalProperties": False,
}


def get_json_schema() -> dict[str, Any]:
    """Return the DSL JSON Schema (draft-07). Mirrors ``dsl.schema.ts:getJsonSchema``."""
    return DSL_JSON_SCHEMA


def validate_ast(ast: Any) -> dict[str, Any]:
    """Validate a parsed DSL AST against the JSON Schema.

    Mirrors ``dsl.schema.ts:validateAst``. Returns ``{ok, errors, ast}``.
    Errors are formatted as ``"path.to.field: message"`` for Zod parity.
    """
    if Draft7Validator is None:
        return {
            "ok": False,
            "errors": ["jsonschema package not installed; run `pip install jsonschema`"],
            "ast": None,
        }
    validator = Draft7Validator(DSL_JSON_SCHEMA)
    errors_iter = sorted(validator.iter_errors(ast), key=lambda e: list(e.absolute_path))
    if not errors_iter:
        return {"ok": True, "errors": [], "ast": ast}
    formatted = []
    for err in errors_iter:
        path = ".".join(str(p) for p in err.absolute_path)
        formatted.append(f"{path}: {err.message}" if path else err.message)
    return {"ok": False, "errors": formatted, "ast": None}


__all__ = ["DSL_JSON_SCHEMA", "get_json_schema", "validate_ast"]
