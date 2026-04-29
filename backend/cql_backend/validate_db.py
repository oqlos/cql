"""Composite DSL validation.

Port of ``oqlos/cql/runtime/dsl.validate.db.ts`` — only the
``validateDslText`` function. The ``validateAllTestScenarios`` and
``downloadJsonSchema`` helpers from the TS source are intentionally NOT
ported: the former is c2004-specific (DB scenario polling against the
maskservice backend) and stays in the c2004 frontend; the latter is a
browser-side download helper with no server analogue.
"""
from __future__ import annotations

from typing import Any

from .parser import parse_dsl
from .schema import validate_ast
from .serializer import normalize_dsl_text
from .validator import validate_dsl_format
from .xml_codec import dsl_to_xml

__all__ = ["validate_dsl_text"]


def _unique_preserving_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def _collect_validation_errors(
    fmt_ok: bool,
    fmt_errors: list[str],
    parsed_ok: bool,
    parsed_errors: list[str],
    ast_ok: bool,
    ast_errors: list[str],
    xml_ok: bool,
    xml_errors: list[str],
) -> list[str]:
    """Mirror ``collectValidationErrors`` from the TS source.

    If parse failed, that single failure is the only meaningful signal —
    formatting / schema / xml errors derived from invalid AST would be
    misleading. Otherwise concatenate everything.
    """
    if not parsed_ok:
        return list(parsed_errors)
    out: list[str] = []
    if not fmt_ok:
        out.extend(fmt_errors)
    if not ast_ok:
        out.extend(ast_errors)
    if not xml_ok:
        out.extend(xml_errors)
    return out


def validate_dsl_text(text: str) -> dict[str, Any]:
    """Run the full validation pipeline on a DSL text snippet.

    Returns a ``ScenarioValidationReport``-shaped dict (parity with the
    TS export ``validateDslText``):

    ``{id: '', ok, errors, warnings, xml?, dsl, fixedText?}``
    """
    normalized = normalize_dsl_text(text or "")
    fmt = validate_dsl_format(normalized)
    fixed = (fmt.fixedText or "").strip()
    src = fmt.fixedText if fixed else normalized
    parsed = parse_dsl(src)
    if parsed.ok and parsed.ast is not None:
        ast_dict = parsed.ast.model_dump(by_alias=True)
        ast_check = validate_ast(ast_dict)
        xml_res = dsl_to_xml(src)
    else:
        ast_check = {"ok": False, "errors": [], "ast": None}
        xml_res = {"ok": False, "errors": list(parsed.errors)}

    errors = _unique_preserving_order(
        _collect_validation_errors(
            fmt_ok=fmt.ok,
            fmt_errors=list(fmt.errors or []),
            parsed_ok=parsed.ok,
            parsed_errors=list(parsed.errors),
            ast_ok=bool(ast_check.get("ok")),
            ast_errors=list(ast_check.get("errors") or []),
            xml_ok=bool(xml_res.get("ok")),
            xml_errors=list(xml_res.get("errors") or []),
        )
    )
    warnings = _unique_preserving_order(list(fmt.warnings or []))

    report: dict[str, Any] = {
        "id": "",
        "ok": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "dsl": src,
    }
    if xml_res.get("ok"):
        report["xml"] = xml_res.get("xml")
    if fmt.fixedText:
        report["fixedText"] = fmt.fixedText
    return report
