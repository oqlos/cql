"""Legacy XML → DSL migration helpers.

Port of ``oqlos/cql/runtime/dsl.migrate.xml.ts`` — only the pure-data
helpers ``migrateLegacyXmlToDsl`` and ``splitLegacyXmlToScenarios``. The
TS source also exports ``postScenarioToDb`` / ``migrateFilesToDb`` which
are c2004-specific HTTP wrappers around the maskservice scenario CRUD;
those stay in the c2004 frontend (no DSL logic to port).

The migrator handles two XML shapes:

1. **Native DSL XML** (the canonical output of ``ast_to_xml``). Detected
   when ``xml_to_ast`` succeeds.
2. **Legacy report XML** of shape
   ``<data><var id="dt#tr#1#name">…</var>…</data>`` used by older
   maskservice firmware reports. Decoded heuristically into one or more
   ``<dsl>`` ASTs (one per ``dt#tr#<idx>`` transaction).
"""
from __future__ import annotations

from typing import Any
from xml.etree import ElementTree as ET

from .serializer import ast_to_dsl_text, normalize_dsl_text
from .xml_codec import xml_to_ast

__all__ = ["migrate_legacy_xml_to_dsl", "split_legacy_xml_to_scenarios"]


def _strip_ns(tag: str) -> str:
    if isinstance(tag, str) and "}" in tag:
        return tag.split("}", 1)[1]
    return str(tag)


def _parse_legacy_report_document(xml: str) -> ET.Element | None:
    """Return the root <data> element of a legacy report XML, or None."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return None
    return root if _strip_ns(root.tag).lower() == "data" else None


def _collect_legacy_var_map(root: ET.Element) -> dict[str, str]:
    """Walk every <var id="…"> descendant of <data> and collect text values."""
    var_map: dict[str, str] = {}
    for var in root.iter():
        if _strip_ns(var.tag).lower() != "var":
            continue
        var_id = var.attrib.get("id", "")
        if not var_id:
            continue
        var_map[var_id] = (var.text or "").strip()
    return var_map


def _resolve_legacy_device_name(var_map: dict[str, str], fallback: str | None) -> str:
    for key in ("dt#name", "df#name", "cs#name1", "dv#barcode"):
        value = var_map.get(key, "")
        if value:
            return value.strip()
    return (fallback or "").strip()


def _parse_legacy_transaction_entry(key: str) -> tuple | None:
    """Decode a key like ``dt#tr#1#name`` or ``dt#tr#1#op#2#name``."""
    parts = key.split("#")
    if len(parts) < 4 or parts[0] != "dt" or parts[1] != "tr":
        return None
    tr_idx = parts[2]
    if parts[3] == "name":
        return ("transaction-name", tr_idx, None)
    if parts[3] != "op" or len(parts) < 6:
        return None
    op_idx = parts[4]
    if parts[5] == "name":
        return ("operation-name", tr_idx, op_idx)
    if parts[5] == "dspl" and len(parts) >= 7 and parts[6]:
        return ("operation-dspl", tr_idx, op_idx)
    return None


def _ensure_transaction(transactions: dict[str, dict], tr_idx: str) -> dict:
    transactions.setdefault(tr_idx, {"ops": {}})
    return transactions[tr_idx]


def _ensure_operation(transaction: dict, op_idx: str) -> dict:
    transaction["ops"].setdefault(op_idx, {"dspl": []})
    return transaction["ops"][op_idx]


def _apply_legacy_transaction_entry(
    transactions: dict[str, dict], entry: tuple, value: str
) -> None:
    kind, tr_idx, op_idx = entry
    transaction = _ensure_transaction(transactions, tr_idx)
    if kind == "transaction-name":
        transaction["name"] = value
        return
    operation = _ensure_operation(transaction, op_idx)
    if kind == "operation-name":
        operation["name"] = value
        return
    operation["dspl"].append(value)


def _collect_legacy_transactions(var_map: dict[str, str]) -> dict[str, dict]:
    transactions: dict[str, dict] = {}
    for key, value in var_map.items():
        entry = _parse_legacy_transaction_entry(key)
        if entry is not None:
            _apply_legacy_transaction_entry(transactions, entry, value)
    return transactions


def _sort_numeric_keys(d: dict) -> list[str]:
    def numeric(k: str) -> int:
        try:
            return int(k)
        except (TypeError, ValueError):
            return 0

    return sorted(d.keys(), key=numeric)


def _build_operation_title(operation: dict, op_idx: str) -> str:
    name = (operation.get("name") or "").strip()
    if name:
        return name
    dspl = [d for d in (operation.get("dspl") or []) if d]
    if dspl:
        return " ".join(dspl).strip()
    return f"OP {op_idx}".strip()


def _build_task_steps(operation: dict, op_idx: str) -> list[dict]:
    dspl_lines = [d for d in (operation.get("dspl") or []) if d]
    task_lines = dspl_lines if dspl_lines else [_build_operation_title(operation, op_idx)]
    return [{"type": "task", "function": line, "ands": []} for line in task_lines]


def _build_legacy_goals(transaction: dict) -> list[dict]:
    goals: list[dict] = []
    for op_idx in _sort_numeric_keys(transaction["ops"]):
        operation = transaction["ops"][op_idx]
        goals.append(
            {
                "name": _build_operation_title(operation, op_idx),
                "tasks": [],
                "conditions": [],
                "steps": _build_task_steps(operation, op_idx),
            }
        )
    return goals


def _build_scenario_name(
    device_name: str,
    tr_idx: str | None,
    transaction: dict | None,
    name_hint: str | None,
) -> str:
    if tr_idx:
        transaction_name = ((transaction or {}).get("name") or f"TR {tr_idx}").strip()
    else:
        transaction_name = ""
    combined = " ".join(part for part in (device_name, transaction_name) if part).strip()
    return combined or (name_hint or "Legacy Scenario")


def _build_scenario_ast(
    device_name: str,
    tr_idx: str | None,
    transaction: dict | None,
    name_hint: str | None,
) -> dict:
    return {
        "scenario": _build_scenario_name(device_name, tr_idx, transaction, name_hint),
        "goals": _build_legacy_goals(transaction) if transaction else [],
    }


def _parse_legacy_report_data(xml: str) -> dict | None:
    root = _parse_legacy_report_document(xml)
    if root is None:
        return None
    var_map = _collect_legacy_var_map(root)
    return {"var_map": var_map, "transactions": _collect_legacy_transactions(var_map)}


def _parse_legacy_report_xml_ast_multi(xml: str, name_hint: str | None) -> list[dict] | None:
    parsed = _parse_legacy_report_data(xml)
    if parsed is None:
        return None
    device_name = _resolve_legacy_device_name(parsed["var_map"], name_hint)
    return [
        _build_scenario_ast(device_name, tr_idx, parsed["transactions"][tr_idx], name_hint)
        for tr_idx in _sort_numeric_keys(parsed["transactions"])
    ]


def _parse_legacy_report_xml_ast(xml: str, name_hint: str | None) -> dict | None:
    parsed = _parse_legacy_report_data(xml)
    if parsed is None:
        return None
    transaction_keys = _sort_numeric_keys(parsed["transactions"])
    first_tr = transaction_keys[0] if transaction_keys else None
    return _build_scenario_ast(
        _resolve_legacy_device_name(parsed["var_map"], None),
        first_tr,
        parsed["transactions"][first_tr] if first_tr else None,
        name_hint,
    )


def migrate_legacy_xml_to_dsl(xml: str, name_hint: str | None = None) -> dict[str, Any]:
    """Convert any DSL-related XML into ``{ok, name, ast, dsl}``.

    Tries the native DSL XML format first (output of ``ast_to_xml``);
    falls back to the legacy ``<data><var>`` report format used by older
    firmware reports. Returns ``{ok: False, errors}`` if neither matches.
    """
    native = xml_to_ast(xml)
    if native.get("ok") and native.get("ast"):
        ast = native["ast"]
        dsl = normalize_dsl_text(ast_to_dsl_text(ast))
        return {
            "ok": True,
            "name": name_hint or ast.get("scenario", ""),
            "ast": ast,
            "dsl": dsl,
        }
    legacy_ast = _parse_legacy_report_xml_ast(xml, name_hint)
    if legacy_ast is not None:
        dsl = normalize_dsl_text(ast_to_dsl_text(legacy_ast))
        return {
            "ok": True,
            "name": name_hint or legacy_ast.get("scenario", ""),
            "ast": legacy_ast,
            "dsl": dsl,
        }
    errors = native.get("errors") or ["Failed to parse XML"]
    return {"ok": False, "name": name_hint, "errors": list(errors)}


def split_legacy_xml_to_scenarios(
    xml: str, name_hint: str | None = None
) -> list[dict[str, Any]]:
    """Decode a multi-transaction legacy XML into one item per scenario.

    Returns a list of ``{name, dsl, ast}`` items. Empty list if the XML
    is not legacy-shaped or contains no transactions.
    """
    out: list[dict[str, Any]] = []
    multi = _parse_legacy_report_xml_ast_multi(xml, name_hint) or []
    for ast in multi:
        try:
            dsl = normalize_dsl_text(ast_to_dsl_text(ast))
        except Exception:
            continue
        out.append(
            {
                "name": ast.get("scenario") or name_hint or "Legacy Scenario",
                "dsl": dsl,
                "ast": ast,
            }
        )
    return out
