"""Simple keyword-based DSL highlighter.

**Scope**: covers the common tokens needed by maskservice's protocol view
(keywords, quoted literals, numbers, comments). The richer rule-based
highlighter in `oqlos/cql/runtime/dsl.highlight.ts` (~250 lines, ~30
pattern rules) is scheduled for full port in a follow-up task.

Until then, this module produces HTML compatible with the existing CSS
(`dsl.highlight.css`) so callers can already swap to the REST endpoint.
"""
from __future__ import annotations

import html
import re

# Canonical keyword set extracted from the TS highlighter (see RX table).
KEYWORDS = {
    "SCENARIO", "GOAL", "FUNC", "TASK", "END", "REPEAT", "STOP", "PAUSE",
    "SET", "GET", "OUT", "VAL", "MAX", "MIN",
    "IF", "ELSE", "AND", "OR", "TO",
    "WAIT", "LOG", "ALARM", "ERROR", "SAVE", "USER", "DIALOG", "RESULT", "INFO",
    "PUMP", "POMPA",
    "SCENARIO:", "GOAL:", "FUNC:",
    "ASSERT_STATUS", "ASSERT_JSON", "ASSERT_SENSOR", "ASSERT_VALVE",
    "API_GET", "API_POST", "API_PUT", "API_DELETE",
    "EXPECT_DEVICE", "EXPECT_I2C_BUS", "EXPECT_I2C_CHIP",
    "SHELL_EXPORT", "SAMPLE", "CHECK", "CORRECT", "CONFIG", "MACRO", "INCLUDE", "CALL",
}

_KEYWORD_RX = re.compile(
    r"\b(" + "|".join(sorted(KEYWORDS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)
_QUOTED_RX = re.compile(r"(['\"])([^'\"\r\n]*)\1")
_NUMBER_UNIT_RX = re.compile(
    r"\b(\d+(?:\.\d+)?)(\s*)(ms|s|mbar|bar|l/min|l|%RH|°C|N|V|szt|Pa|kPa)?\b"
)
_COMMENT_RX = re.compile(r"(#.*)$", re.MULTILINE)
_OPERATOR_RX = re.compile(r"(>=|<=|!=|==|->|→)")


def _esc(value: str) -> str:
    return html.escape(value, quote=False)


def _mark(kind: str, inner: str) -> str:
    return f'<span class="dsl-{kind}">{inner}</span>'


def highlight_line(line: str) -> str:
    """Highlight one DSL line, returning HTML.

    The output uses the same CSS classes as the TS implementation so the
    existing `dsl.highlight.css` stylesheet can be reused unchanged.
    """
    if not line:
        return ""

    # Short-circuit for comment-only lines.
    stripped = line.lstrip()
    if stripped.startswith("#"):
        return _mark("comment", _esc(line))

    # Replace in a deterministic order using placeholder tokens so that, for
    # example, a keyword inside a quoted string is not matched.
    strings: list[str] = []

    def _strings_replace(match: re.Match[str]) -> str:
        quote = match.group(1)
        value = _esc(match.group(2))
        strings.append(f'<span class="dsl-str">{quote}{value}{quote}</span>')
        return f"\x00S{len(strings) - 1}\x00"

    escaped = _esc(line)
    # Re-apply string detection on the escaped line (quotes are preserved
    # through html.escape because quote=False).
    escaped = _QUOTED_RX.sub(_strings_replace, escaped)

    # Keywords.
    escaped = _KEYWORD_RX.sub(lambda m: _mark("kw", m.group(1)), escaped)

    # Numbers + units.
    escaped = _NUMBER_UNIT_RX.sub(
        lambda m: (
            _mark("num", m.group(1))
            + (m.group(2) or "")
            + (_mark("unit", m.group(3)) if m.group(3) else "")
        ),
        escaped,
    )

    # Operators.
    escaped = _OPERATOR_RX.sub(lambda m: _mark("op", _esc(m.group(1))), escaped)

    # Restore strings.
    def _restore(match: re.Match[str]) -> str:
        return strings[int(match.group(1))]

    escaped = re.sub(r"\x00S(\d+)\x00", _restore, escaped)
    return escaped


def highlight_dsl(text: str) -> str:
    """Highlight a multi-line DSL block; returns one HTML string (newline-joined)."""
    if not text:
        return ""
    return "\n".join(highlight_line(line) for line in text.splitlines())
