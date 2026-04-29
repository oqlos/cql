"""DSL ↔ XML codec.

Port of ``oqlos/cql/runtime/dsl.xml.ts``. Produces byte-identical XML output
to the TypeScript implementation (same indentation, same attribute ordering)
so a TS-rendered XML can be diffed verbatim against a Python-rendered one.

Public API (mirrors the TS exports):

- ``ast_to_xml(ast)`` ↔ ``astToXml``
- ``dsl_to_xml(text)`` ↔ ``dslToXml``
- ``xml_to_ast(xml)`` ↔ ``xmlToAst``
"""
from __future__ import annotations

from typing import Any, Callable
from xml.etree import ElementTree as ET

from .parser import parse_dsl

__all__ = ["ast_to_xml", "dsl_to_xml", "xml_to_ast"]


# ── Indentation constants (must match dsl.xml.ts:27-30) ────────────────

_GOAL_INDENT = "  "
_STEPS_INDENT = "    "
_STEP_INDENT = "      "
_STEP_CHILD_INDENT = "        "


def _esc(s: Any) -> str:
    """Escape XML special characters. Mirrors dsl.xml.ts:esc."""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _build_xml_attributes(attributes: dict[str, Any]) -> str:
    """Serialize attribute dict to ` key="value"` pairs.

    Drops attributes whose value is ``None``, missing, or empty string —
    matching the TS filter ``value !== undefined && value !== null && String(value) !== ''``.
    Preserves insertion order so attributes appear in the same sequence as
    in the TS source (Python 3.7+ dicts are insertion-ordered).
    """
    parts: list[str] = []
    for key, value in attributes.items():
        if value is None:
            continue
        text = str(value)
        if text == "":
            continue
        parts.append(f' {key}="{_esc(text)}"')
    return "".join(parts)


def _build_value_with_unit(value: Any, unit: str | None = None) -> str:
    value_text = str(value if value is not None else "").strip()
    unit_text = str(unit or "").strip()
    return f"{value_text} {unit_text}" if unit_text else value_text


def _build_self_closing_tag(indent: str, tag: str, attributes: dict[str, Any]) -> list[str]:
    return [f"{indent}<{tag}{_build_xml_attributes(attributes)}/>"]


# ── Step serializers (one per type) ────────────────────────────────────


def _is_type(step: dict, type_value: str) -> bool:
    return isinstance(step, dict) and step.get("type") == type_value


def _serialize_task(step: dict) -> list[str] | None:
    if not _is_type(step, "task"):
        return None
    parts = [f"{_STEP_INDENT}<task>"]
    parts.append(
        f"{_STEP_CHILD_INDENT}<action"
        f"{_build_xml_attributes({'function': step.get('function'), 'object': step.get('object')})}"
        f"/>"
    )
    ands = step.get("ands") or []
    if isinstance(ands, list):
        for and_step in ands:
            parts.append(
                f"{_STEP_CHILD_INDENT}<and"
                f"{_build_xml_attributes({'function': and_step.get('function'), 'object': and_step.get('object')})}"
                f"/>"
            )
    parts.append(f"{_STEP_INDENT}</task>")
    return parts


def _serialize_if(step: dict) -> list[str] | None:
    if not _is_type(step, "if"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT,
        "if",
        {
            "parameter": step.get("parameter"),
            "operator": step.get("operator"),
            "value": step.get("value"),
            "unit": step.get("unit"),
            "connector": step.get("connector"),
        },
    )


def _serialize_else(step: dict) -> list[str] | None:
    if not _is_type(step, "else"):
        return None
    if not step.get("actionType") and not step.get("actionMessage"):
        return _build_self_closing_tag(_STEP_INDENT, "else", {})
    return _build_self_closing_tag(
        _STEP_INDENT,
        "else",
        {
            "actionType": step.get("actionType") or "ERROR",
            "actionMessage": step.get("actionMessage") or "",
        },
    )


def _make_param_serializer(type_value: str) -> Callable[[dict], list[str] | None]:
    def serializer(step: dict) -> list[str] | None:
        if not _is_type(step, type_value):
            return None
        return _build_self_closing_tag(
            _STEP_INDENT, type_value, {"parameter": step.get("parameter"), "unit": step.get("unit")}
        )

    return serializer


def _make_value_serializer(type_value: str) -> Callable[[dict], list[str] | None]:
    def serializer(step: dict) -> list[str] | None:
        if not _is_type(step, type_value):
            return None
        return _build_self_closing_tag(
            _STEP_INDENT,
            type_value,
            {
                "parameter": step.get("parameter"),
                "value": step.get("value"),
                "unit": step.get("unit"),
            },
        )

    return serializer


def _make_delta_serializer(type_value: str) -> Callable[[dict], list[str] | None]:
    def serializer(step: dict) -> list[str] | None:
        if not _is_type(step, type_value):
            return None
        return _build_self_closing_tag(
            _STEP_INDENT,
            type_value,
            {
                "parameter": step.get("parameter"),
                "value": step.get("value"),
                "unit": step.get("unit"),
                "per": step.get("per"),
            },
        )

    return serializer


def _serialize_wait(step: dict) -> list[str] | None:
    if not _is_type(step, "wait"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT, "wait", {"duration": step.get("duration"), "unit": step.get("unit")}
    )


def _serialize_pump(step: dict) -> list[str] | None:
    if not _is_type(step, "pump"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT,
        "pump",
        {"value": step.get("value"), "unit": step.get("unit"), "raw": step.get("raw")},
    )


def _serialize_sample(step: dict) -> list[str] | None:
    if not _is_type(step, "sample"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT,
        "sample",
        {
            "parameter": step.get("parameter"),
            "state": step.get("state"),
            "interval": step.get("interval"),
        },
    )


def _serialize_calc(step: dict) -> list[str] | None:
    if not _is_type(step, "calc"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT,
        "calc",
        {
            "result": step.get("result"),
            "function": step.get("function"),
            "input": step.get("input"),
        },
    )


def _serialize_fun(step: dict) -> list[str] | None:
    if not _is_type(step, "fun"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT, "fun", {"result": step.get("result"), "expression": step.get("expression")}
    )


def _make_message_serializer(type_value: str) -> Callable[[dict], list[str] | None]:
    def serializer(step: dict) -> list[str] | None:
        if not _is_type(step, type_value):
            return None
        return _build_self_closing_tag(_STEP_INDENT, type_value, {"message": step.get("message")})

    return serializer


def _serialize_save(step: dict) -> list[str] | None:
    if not _is_type(step, "save"):
        return None
    return _build_self_closing_tag(_STEP_INDENT, "save", {"parameter": step.get("parameter")})


def _serialize_func_call(step: dict) -> list[str] | None:
    if not _is_type(step, "func_call"):
        return None
    args = step.get("arguments") or []
    if not isinstance(args, list):
        args = []
    if not args:
        return _build_self_closing_tag(_STEP_INDENT, "func_call", {"name": step.get("name")})
    parts = [f"{_STEP_INDENT}<func_call{_build_xml_attributes({'name': step.get('name')})}>"]
    for arg in args:
        parts.append(
            f"{_STEP_CHILD_INDENT}<argument{_build_xml_attributes({'value': arg})}/>"
        )
    parts.append(f"{_STEP_INDENT}</func_call>")
    return parts


def _serialize_user(step: dict) -> list[str] | None:
    if not _is_type(step, "user"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT, "user", {"action": step.get("action"), "message": step.get("message")}
    )


def _serialize_result(step: dict) -> list[str] | None:
    if not _is_type(step, "result"):
        return None
    return _build_self_closing_tag(_STEP_INDENT, "result", {"status": step.get("status")})


def _serialize_opt(step: dict) -> list[str] | None:
    if not _is_type(step, "opt"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT,
        "opt",
        {"parameter": step.get("parameter"), "description": step.get("description")},
    )


def _serialize_info(step: dict) -> list[str] | None:
    if not _is_type(step, "info"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT, "info", {"level": step.get("level"), "message": step.get("message")}
    )


def _serialize_repeat(step: dict) -> list[str] | None:
    if not _is_type(step, "repeat"):
        return None
    return _build_self_closing_tag(_STEP_INDENT, "repeat", {})


def _serialize_end(step: dict) -> list[str] | None:
    if not _is_type(step, "end"):
        return None
    return _build_self_closing_tag(_STEP_INDENT, "end", {})


def _serialize_out(step: dict) -> list[str] | None:
    if not _is_type(step, "out"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT, "out", {"outType": step.get("outType"), "value": step.get("value")}
    )


def _serialize_dialog(step: dict) -> list[str] | None:
    if not _is_type(step, "dialog"):
        return None
    return _build_self_closing_tag(
        _STEP_INDENT,
        "dialog",
        {"parameter": step.get("parameter"), "message": step.get("message")},
    )


# Order must match XML_STEP_SERIALIZERS in dsl.xml.ts:193-222.
_XML_STEP_SERIALIZERS: list[Callable[[dict], list[str] | None]] = [
    _serialize_task,
    _serialize_if,
    _serialize_else,
    _serialize_func_call,
    _make_param_serializer("get"),
    _make_param_serializer("val"),
    _make_value_serializer("set"),
    _make_value_serializer("max"),
    _make_value_serializer("min"),
    _make_delta_serializer("delta_max"),
    _make_delta_serializer("delta_min"),
    _serialize_wait,
    _serialize_pump,
    _serialize_sample,
    _serialize_calc,
    _serialize_fun,
    _make_message_serializer("log"),
    _make_message_serializer("alarm"),
    _make_message_serializer("error"),
    _serialize_save,
    _serialize_user,
    _serialize_result,
    _serialize_opt,
    _serialize_info,
    _serialize_repeat,
    _serialize_dialog,
    _serialize_out,
    _serialize_end,
]


def _render_structured_step_xml(step: dict) -> list[str]:
    for serializer in _XML_STEP_SERIALIZERS:
        lines = serializer(step)
        if lines is not None:
            return lines
    return []


def _render_legacy_block_steps_xml(block: dict) -> list[str]:
    lines: list[str] = []
    for task in block.get("tasks") or []:
        # Legacy tasks lack a 'type' marker — synthesize one.
        if isinstance(task, dict):
            lines.extend(_render_structured_step_xml({**task, "type": "task"}))
    for condition in block.get("conditions") or []:
        if isinstance(condition, dict):
            lines.extend(_render_structured_step_xml(condition))
    return lines


def _build_block_xml(tag_name: str, block: dict) -> list[str]:
    parts = [
        f"{_GOAL_INDENT}<{tag_name}{_build_xml_attributes({'name': block.get('name')})}>",
        f"{_STEPS_INDENT}<steps>",
    ]
    steps = block.get("steps")
    if isinstance(steps, list) and steps:
        step_lines: list[str] = []
        for step in steps:
            if isinstance(step, dict):
                step_lines.extend(_render_structured_step_xml(step))
        parts.extend(step_lines)
    else:
        parts.extend(_render_legacy_block_steps_xml(block))
    parts.append(f"{_STEPS_INDENT}</steps>")
    parts.append(f"{_GOAL_INDENT}</{tag_name}>")
    return parts


def ast_to_xml(ast: dict) -> str:
    """Render a DSL AST dict as the canonical XML representation."""
    parts: list[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f"<dsl{_build_xml_attributes({'scenario': (ast or {}).get('scenario')})}>",
    ]
    for goal in (ast or {}).get("goals") or []:
        if isinstance(goal, dict):
            parts.extend(_build_block_xml("goal", goal))
    for func in (ast or {}).get("funcs") or []:
        if isinstance(func, dict):
            parts.extend(_build_block_xml("func", func))
    parts.append("</dsl>")
    return "\n".join(parts)


def dsl_to_xml(text: str) -> dict[str, Any]:
    """Parse DSL text and serialize the resulting AST as XML.

    Returns ``{ok, xml}`` on success or ``{ok: False, errors: [...]}`` on
    parse failure (mirrors `dslToXml` in the TS source).
    """
    parsed = parse_dsl(text)
    if not parsed.ok or parsed.ast is None:
        return {"ok": False, "errors": parsed.errors}
    ast_dict = parsed.ast.model_dump(by_alias=True)
    return {"ok": True, "xml": ast_to_xml(ast_dict)}


# ── XML → AST parsers ──────────────────────────────────────────────────


def _attr(element: ET.Element, name: str) -> str:
    return element.attrib.get(name, "")


def _direct_children(element: ET.Element, tag: str | None = None) -> list[ET.Element]:
    if tag is None:
        return list(element)
    target = tag.lower()
    return [child for child in element if _local_tag(child).lower() == target]


def _first_direct_child(element: ET.Element, tag: str) -> ET.Element | None:
    children = _direct_children(element, tag)
    return children[0] if children else None


def _local_tag(element: ET.Element) -> str:
    """Return tag name without XML namespace (the TS code uses tagName as-is)."""
    tag = element.tag
    if isinstance(tag, str) and "}" in tag:
        return tag.split("}", 1)[1]
    return str(tag)


def _parse_task(element: ET.Element) -> dict | None:
    action = _first_direct_child(element, "action")
    if action is None:
        return None
    ands = [
        {"function": _attr(a, "function"), "object": _attr(a, "object")}
        for a in _direct_children(element, "and")
    ]
    return {
        "type": "task",
        "function": _attr(action, "function"),
        "object": _attr(action, "object"),
        "ands": ands,
    }


def _parse_if(element: ET.Element) -> dict:
    unit = _attr(element, "unit")
    out: dict[str, Any] = {
        "type": "if",
        "parameter": _attr(element, "parameter"),
        "operator": _attr(element, "operator") or ">",
        "value": _attr(element, "value"),
    }
    if unit:
        out["unit"] = unit
    return out


def _parse_else(element: ET.Element) -> dict:
    if "actionType" not in element.attrib and "actionMessage" not in element.attrib:
        return {"type": "else"}
    return {
        "type": "else",
        "actionType": _attr(element, "actionType") or "ERROR",
        "actionMessage": _attr(element, "actionMessage"),
    }


def _make_param_parser(type_value: str) -> Callable[[ET.Element], dict]:
    def parser(element: ET.Element) -> dict:
        unit = _attr(element, "unit")
        out: dict[str, Any] = {"type": type_value, "parameter": _attr(element, "parameter")}
        if unit:
            out["unit"] = unit
        return out

    return parser


def _make_value_parser(type_value: str) -> Callable[[ET.Element], dict]:
    def parser(element: ET.Element) -> dict:
        unit = _attr(element, "unit")
        out: dict[str, Any] = {
            "type": type_value,
            "parameter": _attr(element, "parameter"),
            "value": _attr(element, "value"),
        }
        if unit:
            out["unit"] = unit
        return out

    return parser


def _make_delta_parser(type_value: str) -> Callable[[ET.Element], dict]:
    def parser(element: ET.Element) -> dict:
        unit = _attr(element, "unit")
        per = _attr(element, "per")
        out: dict[str, Any] = {
            "type": type_value,
            "parameter": _attr(element, "parameter"),
            "value": _attr(element, "value"),
        }
        if unit:
            out["unit"] = unit
        if per:
            out["per"] = per
        return out

    return parser


def _parse_wait(element: ET.Element) -> dict:
    unit = _attr(element, "unit")
    out: dict[str, Any] = {"type": "wait", "duration": _attr(element, "duration")}
    if unit:
        out["unit"] = unit
    return out


def _parse_pump(element: ET.Element) -> dict:
    value = _attr(element, "value")
    unit = _attr(element, "unit")
    raw = _attr(element, "raw") or _build_value_with_unit(value, unit)
    out: dict[str, Any] = {"type": "pump", "value": value, "raw": raw}
    if unit:
        out["unit"] = unit
    return out


def _parse_sample(element: ET.Element) -> dict:
    interval = _attr(element, "interval")
    out: dict[str, Any] = {
        "type": "sample",
        "parameter": _attr(element, "parameter"),
        "state": _attr(element, "state") or "START",
    }
    if interval:
        out["interval"] = interval
    return out


def _parse_calc(element: ET.Element) -> dict:
    return {
        "type": "calc",
        "result": _attr(element, "result"),
        "function": _attr(element, "function") or "AVG",
        "input": _attr(element, "input"),
    }


def _extract_expression_variables(expression: str) -> list[str]:
    import re

    variables: list[str] = []
    for match in re.finditer(r'"([^"]+)"|\[([^\]]+)\]', expression):
        variables.append((match.group(1) or match.group(2) or "").strip())
    return variables


def _parse_fun(element: ET.Element) -> dict:
    expression = _attr(element, "expression")
    return {
        "type": "fun",
        "result": _attr(element, "result"),
        "expression": expression,
        "variables": _extract_expression_variables(expression),
    }


def _make_message_parser(type_value: str) -> Callable[[ET.Element], dict]:
    def parser(element: ET.Element) -> dict:
        return {"type": type_value, "message": _attr(element, "message")}

    return parser


def _parse_save(element: ET.Element) -> dict:
    return {"type": "save", "parameter": _attr(element, "parameter")}


def _parse_func_call(element: ET.Element) -> dict:
    args = [
        _attr(arg, "value")
        for arg in _direct_children(element, "argument")
        if _attr(arg, "value")
    ]
    out: dict[str, Any] = {"type": "func_call", "name": _attr(element, "name")}
    if args:
        out["arguments"] = args
    return out


def _parse_user(element: ET.Element) -> dict:
    return {
        "type": "user",
        "action": _attr(element, "action"),
        "message": _attr(element, "message"),
    }


def _parse_result(element: ET.Element) -> dict:
    return {"type": "result", "status": _attr(element, "status")}


def _parse_opt(element: ET.Element) -> dict:
    return {
        "type": "opt",
        "parameter": _attr(element, "parameter"),
        "description": _attr(element, "description"),
    }


def _parse_info(element: ET.Element) -> dict:
    return {
        "type": "info",
        "level": _attr(element, "level"),
        "message": _attr(element, "message"),
    }


def _parse_repeat(_element: ET.Element) -> dict:
    return {"type": "repeat"}


def _parse_end(_element: ET.Element) -> dict:
    return {"type": "end"}


def _parse_out(element: ET.Element) -> dict:
    return {
        "type": "out",
        "outType": _attr(element, "outType"),
        "value": _attr(element, "value"),
    }


def _parse_dialog(element: ET.Element) -> dict:
    return {
        "type": "dialog",
        "parameter": _attr(element, "parameter"),
        "message": _attr(element, "message"),
    }


_XML_STEP_PARSERS: dict[str, Callable[[ET.Element], dict | None]] = {
    "task": _parse_task,
    "if": _parse_if,
    "else": _parse_else,
    "get": _make_param_parser("get"),
    "val": _make_param_parser("val"),
    "set": _make_value_parser("set"),
    "max": _make_value_parser("max"),
    "min": _make_value_parser("min"),
    "delta_max": _make_delta_parser("delta_max"),
    "delta_min": _make_delta_parser("delta_min"),
    "wait": _parse_wait,
    "pump": _parse_pump,
    "sample": _parse_sample,
    "calc": _parse_calc,
    "fun": _parse_fun,
    "log": _make_message_parser("log"),
    "alarm": _make_message_parser("alarm"),
    "error": _make_message_parser("error"),
    "save": _parse_save,
    "func_call": _parse_func_call,
    "user": _parse_user,
    "result": _parse_result,
    "opt": _parse_opt,
    "info": _parse_info,
    "repeat": _parse_repeat,
    "end": _parse_end,
    "out": _parse_out,
    "dialog": _parse_dialog,
}


def _parse_step_element(element: ET.Element) -> dict | None:
    parser = _XML_STEP_PARSERS.get(_local_tag(element).lower())
    return parser(element) if parser else None


def _parse_block_steps(element: ET.Element) -> list[dict]:
    steps_element = _first_direct_child(element, "steps")
    if steps_element is None:
        return []
    out: list[dict] = []
    for child in _direct_children(steps_element):
        parsed = _parse_step_element(child)
        if parsed is not None:
            out.append(parsed)
    return out


def _parse_goal_element(element: ET.Element) -> dict:
    return {
        "name": _attr(element, "name"),
        "tasks": [],
        "conditions": [],
        "steps": _parse_block_steps(element),
    }


def _parse_func_element(element: ET.Element) -> dict:
    return {
        "name": _attr(element, "name"),
        "tasks": [],
        "steps": _parse_block_steps(element),
    }


def xml_to_ast(xml: str) -> dict[str, Any]:
    """Parse XML produced by ``ast_to_xml`` back into a DSL AST dict.

    Returns ``{ok, ast}`` on success, ``{ok: False, errors: [...]}`` otherwise.
    """
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        return {"ok": False, "errors": ["Invalid XML document", str(exc)]}
    except Exception as exc:  # pragma: no cover
        return {"ok": False, "errors": ["Failed to parse XML", str(exc)]}
    if _local_tag(root).lower() != "dsl":
        return {"ok": False, "errors": ["Missing <dsl> root"]}
    goals = [_parse_goal_element(g) for g in _direct_children(root, "goal")]
    funcs = [_parse_func_element(f) for f in _direct_children(root, "func")]
    ast: dict[str, Any] = {
        "scenario": _attr(root, "scenario"),
        "goals": goals,
    }
    if funcs:
        ast["funcs"] = funcs
    return {"ok": True, "ast": ast}
