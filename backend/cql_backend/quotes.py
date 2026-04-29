"""Python port of `oqlos/cql/runtime/dsl.quotes.ts`.

Keep the function signatures 1:1 with the TS original so the migration of
maskservice callers is mechanical (string in → string out, no structural
changes).
"""
from __future__ import annotations

import re

DSL_QUOTED_TOKEN_PATTERN = r"(?:'[^'\r\n]*'|\"[^\"\r\n]*\")"

_SINGLE_QUOTED_TOKEN_RX = re.compile(r"'([^'\r\n]*)'")
_DOUBLE_QUOTED_TOKEN_RX = re.compile(r'"([^"\r\n]*)"')
_LINE_SPLIT_RX = re.compile(r"\r?\n")


def _coerce_str(value: object) -> str:
    return "" if value is None else str(value)


def normalize_dsl_line_quotes(line: str) -> str:
    """Replace single-quoted tokens with double-quoted ones."""
    return _SINGLE_QUOTED_TOKEN_RX.sub(lambda m: f'"{m.group(1)}"', _coerce_str(line))


def normalize_dsl_text_quotes(text: str) -> str:
    return "\n".join(
        normalize_dsl_line_quotes(line) for line in _LINE_SPLIT_RX.split(_coerce_str(text))
    )


def format_dsl_literal(value: str) -> str:
    """Prefer single quotes; fall back to double when the value itself contains a single quote."""
    text = _coerce_str(value)
    if "'" not in text:
        return f"'{text}'"
    return f'"{text}"'


def quote_dsl_value(value: object) -> str:
    return format_dsl_literal(_coerce_str(value))


def canonicalize_dsl_line_quotes(line: str) -> str:
    return _DOUBLE_QUOTED_TOKEN_RX.sub(
        lambda m: format_dsl_literal(m.group(1)), _coerce_str(line)
    )


def canonicalize_dsl_quotes(text: str) -> str:
    return "\n".join(
        canonicalize_dsl_line_quotes(line) for line in _LINE_SPLIT_RX.split(_coerce_str(text))
    )


def read_quoted_token(token: str) -> dict[str, str]:
    raw = _coerce_str(token)
    if len(raw) >= 2 and raw[0] in ("'", '"') and raw[-1] == raw[0]:
        return {"quote": raw[0], "value": raw[1:-1]}
    return {"quote": "'", "value": raw}
