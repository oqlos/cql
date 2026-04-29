"""End-to-end HTTP tests for the FastAPI surface."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from cql_backend.app import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["service"] == "cql-backend"


def test_capabilities_lists_implemented_and_no_stubs(client: TestClient) -> None:
    data = client.get("/api/cql/capabilities").json()
    assert "/api/cql/quote" in data["implemented"]
    assert "/api/cql/parse" in data["implemented"]
    assert "/api/cql/serialize" in data["implemented"]
    assert "/api/cql/validate" in data["implemented"]
    assert "/api/cql/exec" in data["implemented"]
    assert "/api/cql/scenario-build" in data["implemented"]
    assert "/api/cql/xsd" in data["implemented"]
    assert "/api/cql/json-schema" in data["implemented"]
    assert "/api/cql/validate-ast" in data["implemented"]
    assert "/api/cql/dsl-to-xml" in data["implemented"]
    assert "/api/cql/ast-to-xml" in data["implemented"]
    assert "/api/cql/xml-to-ast" in data["implemented"]
    assert "/api/cql/validate-dsl-text" in data["implemented"]
    assert "/api/cql/xml-migrate" in data["implemented"]
    assert "/api/cql/xml-split" in data["implemented"]
    # All DslEngine surface ports are now complete; no stubs remain.
    assert data["stubbed_501"] == []


def test_quote(client: TestClient) -> None:
    resp = client.post("/api/cql/quote", json={"value": "2 l/min"})
    assert resp.status_code == 200
    assert resp.json() == {"quoted": "'2 l/min'"}


def test_quote_apostrophe_uses_double(client: TestClient) -> None:
    resp = client.post("/api/cql/quote", json={"value": "O'Neill"})
    assert resp.json() == {"quoted": '"O\'Neill"'}


def test_unquote(client: TestClient) -> None:
    resp = client.post("/api/cql/unquote", json={"token": "'5'"})
    assert resp.json() == {"quote": "'", "value": "5"}


def test_canonicalize(client: TestClient) -> None:
    resp = client.post("/api/cql/canonicalize", json={"text": 'SET "x" "5"'})
    assert resp.json() == {"text": "SET 'x' '5'"}


def test_highlight_basic_keywords_are_wrapped(client: TestClient) -> None:
    resp = client.post(
        "/api/cql/highlight",
        json={"text": "SET 'x' '5'", "mode": "html"},
    )
    body = resp.json()
    assert 'class="dsl-kw"' in body["html"]
    assert 'class="dsl-str"' in body["html"]


def test_parse_returns_ast(client: TestClient) -> None:
    resp = client.post("/api/cql/parse", json={"text": "SCENARIO: test\nGOAL: test\n  SET \"x\" \"5\""})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "ast" in data
    assert data["ast"]["scenario"] == "test"


def test_validate_returns_result(client: TestClient) -> None:
    resp = client.post("/api/cql/validate", json={"text": "SCENARIO: test\nGOAL: test\n  SET \"x\" \"5\""})
    assert resp.status_code == 200
    data = resp.json()
    assert "ok" in data
    assert "errors" in data
    assert "warnings" in data


def test_exec_returns_plan(client: TestClient) -> None:
    resp = client.post("/api/cql/exec", json={"text": "SCENARIO: test\nGOAL: test\n  SET \"x\" \"5\""})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "plan" in data
    assert "ast" in data


def test_serialize_returns_text(client: TestClient) -> None:
    ast = {
        "scenario": "Test",
        "goals": [
            {"name": "Test", "tasks": [], "conditions": [], "steps": [{"type": "log", "message": "test"}]}
        ],
        "funcs": []
    }
    resp = client.post("/api/cql/serialize", json={"ast": ast})
    assert resp.status_code == 200
    data = resp.json()
    assert "text" in data


def test_scenario_build_returns_dsl(client: TestClient) -> None:
    resp = client.post("/api/cql/scenario-build", json={
        "source": "test",
        "data": {"name": "Test", "activities": [{"name": "Act1", "criteria": {"min": 5}}]}
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "dsl" in data
    assert "goals" in data


# ── Schema / XSD parity (Phase A2-A3) ─────────────────────────────────────


def test_xsd_endpoint_returns_static_definition(client: TestClient) -> None:
    resp = client.get("/api/cql/xsd")
    assert resp.status_code == 200
    body = resp.json()
    assert body["xsd"].startswith('<?xml version="1.0"')
    assert '<xs:element name="dsl">' in body["xsd"]
    assert '<xs:simpleType name="Operator">' in body["xsd"]


def test_json_schema_endpoint_matches_root_shape(client: TestClient) -> None:
    resp = client.get("/api/cql/json-schema")
    assert resp.status_code == 200
    schema = resp.json()["schema"]
    assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"
    assert schema["required"] == ["scenario", "goals"]
    assert "scenario" in schema["properties"]
    assert "goals" in schema["properties"]
    assert "funcs" in schema["properties"]
    assert schema["additionalProperties"] is False


def test_validate_ast_accepts_minimal_valid_ast(client: TestClient) -> None:
    ast = {
        "scenario": "Test",
        "goals": [
            {
                "name": "Goal1",
                "tasks": [],
                "conditions": [],
                "steps": [{"type": "log", "message": "hello"}],
            }
        ],
    }
    resp = client.post("/api/cql/validate-ast", json={"ast": ast})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["errors"] == []


def test_validate_ast_rejects_missing_scenario(client: TestClient) -> None:
    ast = {"goals": [{"name": "G", "tasks": [], "conditions": []}]}
    resp = client.post("/api/cql/validate-ast", json={"ast": ast})
    body = resp.json()
    assert body["ok"] is False
    assert any("scenario" in err for err in body["errors"])


def test_validate_ast_rejects_empty_goals_and_funcs(client: TestClient) -> None:
    ast = {"scenario": "Test", "goals": []}
    resp = client.post("/api/cql/validate-ast", json={"ast": ast})
    body = resp.json()
    assert body["ok"] is False
    assert body["errors"]


# ── XML codec parity (Phase A4) ───────────────────────────────────────────


_VALID_AST = {
    "scenario": "Test",
    "goals": [
        {
            "name": "G1",
            "tasks": [],
            "conditions": [],
            "steps": [
                {"type": "set", "parameter": "x", "value": "5", "unit": "kg"},
                {"type": "if", "parameter": "x", "operator": ">", "value": "3"},
                {"type": "log", "message": "hello"},
                {"type": "end"},
            ],
        }
    ],
}


def test_ast_to_xml_returns_indented_xml(client: TestClient) -> None:
    resp = client.post("/api/cql/ast-to-xml", json={"ast": _VALID_AST})
    assert resp.status_code == 200
    xml = resp.json()["xml"]
    assert xml.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    assert '<dsl scenario="Test">' in xml
    assert '<goal name="G1">' in xml
    assert '<set parameter="x" value="5" unit="kg"/>' in xml
    assert '<if parameter="x" operator="&gt;" value="3"/>' in xml
    assert "<end/>" in xml


def test_dsl_to_xml_round_trips_via_xml_to_ast(client: TestClient) -> None:
    text = "SCENARIO: Test\nGOAL: G1\n  SET 'x' '5'\n"
    forward = client.post("/api/cql/dsl-to-xml", json={"text": text}).json()
    assert forward["ok"] is True
    xml = forward["xml"]
    assert "<dsl" in xml
    back = client.post("/api/cql/xml-to-ast", json={"xml": xml}).json()
    assert back["ok"] is True
    assert back["ast"]["scenario"] == "Test"
    assert back["ast"]["goals"][0]["name"] == "G1"
    set_step = next(s for s in back["ast"]["goals"][0]["steps"] if s["type"] == "set")
    assert set_step["parameter"] == "x"
    assert set_step["value"] == "5"


def test_xml_to_ast_rejects_missing_root(client: TestClient) -> None:
    resp = client.post("/api/cql/xml-to-ast", json={"xml": "<other/>"})
    body = resp.json()
    assert body["ok"] is False
    assert any("dsl" in err for err in body["errors"])


def test_xml_to_ast_rejects_invalid_xml(client: TestClient) -> None:
    resp = client.post("/api/cql/xml-to-ast", json={"xml": "<not-closed>"})
    body = resp.json()
    assert body["ok"] is False
    assert body["errors"]


def test_dsl_to_xml_returns_errors_on_bad_input(client: TestClient) -> None:
    # A scenario with no GOAL line is parser-invalid.
    resp = client.post("/api/cql/dsl-to-xml", json={"text": "GIBBERISH"})
    body = resp.json()
    assert body["ok"] is False
    assert "errors" in body


# ── Composite validation (Phase A6) ──────────────────────────────────────


def test_validate_dsl_text_succeeds_for_valid_dsl(client: TestClient) -> None:
    text = "SCENARIO: Test\nGOAL: G1\n  SET 'x' '5'\n"
    resp = client.post("/api/cql/validate-dsl-text", json={"text": text})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["errors"] == []
    assert body["dsl"]
    # Successful validation should also include the rendered XML.
    assert body.get("xml", "").startswith('<?xml version="1.0"')


def test_validate_dsl_text_collects_parse_errors(client: TestClient) -> None:
    resp = client.post("/api/cql/validate-dsl-text", json={"text": "GIBBERISH"})
    body = resp.json()
    assert body["ok"] is False
    assert body["errors"]


# ── Legacy XML migration (Phase A5) ──────────────────────────────────────


_LEGACY_REPORT_XML = """<?xml version="1.0"?>
<data>
  <var id="dt#name">DeviceFoo</var>
  <var id="dt#tr#1#name">Transaction One</var>
  <var id="dt#tr#1#op#1#name">Op A</var>
  <var id="dt#tr#1#op#1#dspl#1">Step 1 line</var>
  <var id="dt#tr#1#op#2#name">Op B</var>
  <var id="dt#tr#1#op#2#dspl#1">Step 2 line</var>
  <var id="dt#tr#2#name">Transaction Two</var>
  <var id="dt#tr#2#op#1#name">Op C</var>
  <var id="dt#tr#2#op#1#dspl#1">Other step</var>
</data>
"""


def test_xml_migrate_handles_native_xml(client: TestClient) -> None:
    # Roundtrip: build native XML from an AST, then migrate it back.
    native = client.post("/api/cql/ast-to-xml", json={"ast": _VALID_AST}).json()
    resp = client.post("/api/cql/xml-migrate", json={"xml": native["xml"]})
    body = resp.json()
    assert body["ok"] is True
    assert body["ast"]["scenario"] == "Test"
    assert body["dsl"]


def test_xml_migrate_handles_legacy_report(client: TestClient) -> None:
    resp = client.post(
        "/api/cql/xml-migrate", json={"xml": _LEGACY_REPORT_XML, "nameHint": "Hint"}
    )
    body = resp.json()
    assert body["ok"] is True
    # First transaction should be picked; device name is part of the scenario.
    assert "DeviceFoo" in body["ast"]["scenario"]
    assert body["ast"]["goals"]
    assert body["dsl"]


def test_xml_migrate_returns_errors_on_unrelated_xml(client: TestClient) -> None:
    resp = client.post("/api/cql/xml-migrate", json={"xml": "<unknown/>"})
    body = resp.json()
    assert body["ok"] is False
    assert body["errors"]


def test_xml_split_returns_one_scenario_per_transaction(client: TestClient) -> None:
    resp = client.post("/api/cql/xml-split", json={"xml": _LEGACY_REPORT_XML})
    body = resp.json()
    assert body["count"] == 2
    assert len(body["scenarios"]) == 2
    names = [s["name"] for s in body["scenarios"]]
    assert all("DeviceFoo" in n for n in names)
    assert all(s["dsl"] for s in body["scenarios"])


def test_xml_split_returns_empty_on_native_xml(client: TestClient) -> None:
    native = client.post("/api/cql/ast-to-xml", json={"ast": _VALID_AST}).json()
    resp = client.post("/api/cql/xml-split", json={"xml": native["xml"]})
    body = resp.json()
    assert body["count"] == 0
    assert body["scenarios"] == []
