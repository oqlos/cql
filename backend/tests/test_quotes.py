"""Parity tests for the Python port of ``runtime/dsl.quotes.ts``.

Each test asserts the same input/output contract as the TS tests in
``oqlos/cql/runtime/dsl.quote-utils`` and the broader scenarios in
maskservice's `dsl-single-quote.test.ts`.
"""
from __future__ import annotations

from cql_backend.quotes import (
    canonicalize_dsl_line_quotes,
    canonicalize_dsl_quotes,
    format_dsl_literal,
    normalize_dsl_line_quotes,
    normalize_dsl_text_quotes,
    quote_dsl_value,
    read_quoted_token,
)


def test_format_dsl_literal_defaults_to_single_quotes() -> None:
    assert format_dsl_literal("hello") == "'hello'"


def test_format_dsl_literal_falls_back_to_double_quotes_with_apostrophe() -> None:
    assert format_dsl_literal("O'Neill") == '"O\'Neill"'


def test_quote_dsl_value_handles_none() -> None:
    assert quote_dsl_value(None) == "''"


def test_normalize_line_single_to_double() -> None:
    assert normalize_dsl_line_quotes("SET 'x' '5'") == 'SET "x" "5"'


def test_normalize_text_multiline() -> None:
    text = "GOAL:\n  SET 'x' '5'\n  # comment"
    assert normalize_dsl_text_quotes(text) == 'GOAL:\n  SET "x" "5"\n  # comment'


def test_canonicalize_line_double_to_single() -> None:
    assert canonicalize_dsl_line_quotes('SET "x" "5"') == "SET 'x' '5'"


def test_canonicalize_preserves_double_quotes_for_values_with_apostrophes() -> None:
    assert canonicalize_dsl_line_quotes('DIALOG "O\'Neill"') == 'DIALOG "O\'Neill"'


def test_canonicalize_text_multiline() -> None:
    text = 'GOAL:\n  SET "x" "5"'
    assert canonicalize_dsl_quotes(text) == "GOAL:\n  SET 'x' '5'"


def test_read_quoted_token_single() -> None:
    assert read_quoted_token("'hello'") == {"quote": "'", "value": "hello"}


def test_read_quoted_token_double() -> None:
    assert read_quoted_token('"hello"') == {"quote": '"', "value": "hello"}


def test_read_quoted_token_bare() -> None:
    assert read_quoted_token("hello") == {"quote": "'", "value": "hello"}
