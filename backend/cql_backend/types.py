"""Python port of `oqlos/cql/runtime/dsl.types.ts`.

Type definitions for the DSL/AST structures. These are Pydantic-compatible dataclasses
to ensure JSON serialization matches the TypeScript originals byte-for-byte.
"""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel


# Task types
class DslTaskAnd(BaseModel):
    function: str
    object: str | None = None


class DslTask(BaseModel):
    function: str
    object: str | None = None
    ands: list[DslTaskAnd] | None = None


# Condition types
class DslIfCondition(BaseModel):
    type: Literal["if"] = "if"
    parameter: str
    operator: Literal[">", "<", "=", ">=", "<=", "!="]
    value: str
    unit: str | None = None
    connector: Literal["AND", "OR", "ELSE"] | None = None
    incomingConnector: Literal["AND", "OR", "ELSE"] | None = None


class DslElseCondition(BaseModel):
    type: Literal["else"] = "else"
    actionType: Literal["ERROR", "WARNING", "INFO", "GOAL"] | None = None
    actionMessage: str | None = None


DslCondition = DslIfCondition | DslElseCondition


# Step types
class DslStepTask(BaseModel):
    type: Literal["task"] = "task"
    function: str
    object: str | None = None
    ands: list[DslTaskAnd] | None = None


class DslStepPump(BaseModel):
    type: Literal["pump"] = "pump"
    value: str
    unit: str | None = None
    raw: str


class DslStepFuncCall(BaseModel):
    type: Literal["func_call"] = "func_call"
    name: str
    arguments: list[str] | None = None


class DslStepGet(BaseModel):
    type: Literal["get"] = "get"
    parameter: str
    unit: str | None = None


class DslStepSet(BaseModel):
    type: Literal["set"] = "set"
    parameter: str
    value: str
    unit: str | None = None


class DslStepMax(BaseModel):
    type: Literal["max"] = "max"
    parameter: str
    value: str
    unit: str | None = None


class DslStepMin(BaseModel):
    type: Literal["min"] = "min"
    parameter: str
    value: str
    unit: str | None = None


class DslStepDeltaMax(BaseModel):
    type: Literal["delta_max"] = "delta_max"
    parameter: str
    value: str
    unit: str | None = None
    per: str | None = None


class DslStepDeltaMin(BaseModel):
    type: Literal["delta_min"] = "delta_min"
    parameter: str
    value: str
    unit: str | None = None
    per: str | None = None


class DslStepVal(BaseModel):
    type: Literal["val"] = "val"
    parameter: str
    unit: str | None = None


class DslStepWait(BaseModel):
    type: Literal["wait"] = "wait"
    duration: str
    unit: str | None = None


class DslStepSample(BaseModel):
    type: Literal["sample"] = "sample"
    parameter: str
    state: Literal["START", "STOP"]
    interval: str | None = None


class DslStepCalc(BaseModel):
    type: Literal["calc"] = "calc"
    result: str
    function: Literal["AVG", "SUM", "MIN", "MAX", "COUNT", "STDDEV"]
    input: str


class DslStepFun(BaseModel):
    type: Literal["fun"] = "fun"
    result: str
    expression: str
    variables: list[str]


class DslStepLog(BaseModel):
    type: Literal["log"] = "log"
    message: str


class DslStepAlarm(BaseModel):
    type: Literal["alarm"] = "alarm"
    message: str


class DslStepError(BaseModel):
    type: Literal["error"] = "error"
    message: str


class DslStepSave(BaseModel):
    type: Literal["save"] = "save"
    parameter: str


class DslStepUser(BaseModel):
    type: Literal["user"] = "user"
    action: str
    message: str


class DslStepResult(BaseModel):
    type: Literal["result"] = "result"
    status: str


class DslStepOpt(BaseModel):
    type: Literal["opt"] = "opt"
    parameter: str
    description: str


class DslStepEnd(BaseModel):
    type: Literal["end"] = "end"


class DslStepOut(BaseModel):
    type: Literal["out"] = "out"
    outType: str
    value: str


class DslStepDialog(BaseModel):
    type: Literal["dialog"] = "dialog"
    parameter: str
    message: str


class DslStepInfo(BaseModel):
    type: Literal["info"] = "info"
    level: str
    message: str


class DslStepRepeat(BaseModel):
    type: Literal["repeat"] = "repeat"


DslStep = (
    DslStepTask | DslStepPump | DslStepFuncCall | DslIfCondition | DslElseCondition
    | DslStepGet | DslStepSet | DslStepMax | DslStepMin | DslStepDeltaMax | DslStepDeltaMin
    | DslStepVal | DslStepWait | DslStepSample | DslStepCalc | DslStepFun | DslStepLog
    | DslStepAlarm | DslStepError | DslStepSave | DslStepUser | DslStepResult | DslStepOpt
    | DslStepInfo | DslStepRepeat | DslStepEnd | DslStepOut | DslStepDialog
)


# Goal, Func, AST
class DslGoal(BaseModel):
    name: str
    tasks: list[DslTask]
    conditions: list[DslCondition]
    steps: list[DslStep] | None = None


class DslFunc(BaseModel):
    name: str
    tasks: list[DslTask]
    steps: list[DslStep] | None = None


class DslAst(BaseModel):
    scenario: str
    goals: list[DslGoal]
    funcs: list[DslFunc] | None = None


class ParseResult(BaseModel):
    ok: bool
    errors: list[str]
    ast: DslAst


# Execution types
class ExecContext(BaseModel):
    getParamValue: Any | None = None  # Callable
    runTask: Any | None = None  # Callable
    executeTasks: bool | None = None


class ExecPlanGoal(BaseModel):
    kind: Literal["goal"] = "goal"
    name: str


class ExecPlanConditionIf(BaseModel):
    kind: Literal["condition"] = "condition"
    condition: DslIfCondition
    passed: bool | None


class ExecPlanConditionElse(BaseModel):
    kind: Literal["else"] = "else"
    else_: DslElseCondition = None  # type: ignore[assignment]


class ExecPlanTask(BaseModel):
    kind: Literal["task"] = "task"
    task: DslTask


class ExecPlanPump(BaseModel):
    kind: Literal["pump"] = "pump"
    value: str
    unit: str | None = None
    raw: str | None = None


class ExecPlanFuncCall(BaseModel):
    kind: Literal["func_call"] = "func_call"
    name: str
    arguments: list[str] | None = None


class ExecPlanVar(BaseModel):
    kind: Literal["var"] = "var"
    action: Literal["GET", "SET", "MAX", "MIN", "VAL", "DELTA_MAX", "DELTA_MIN"]
    parameter: str
    value: str | float | None = None
    unit: str | None = None
    per: str | None = None


class ExecPlanWait(BaseModel):
    kind: Literal["wait"] = "wait"
    duration: str
    unit: str | None = None


class ExecPlanMessage(BaseModel):
    kind: Literal["message"] = "message"
    level: Literal["LOG", "ALARM", "ERROR"]
    message: str


class ExecPlanSave(BaseModel):
    kind: Literal["save"] = "save"
    parameter: str


class ExecPlanUser(BaseModel):
    kind: Literal["user"] = "user"
    action: str
    message: str


class ExecPlanResult(BaseModel):
    kind: Literal["result"] = "result"
    status: str


class ExecPlanOpt(BaseModel):
    kind: Literal["opt"] = "opt"
    parameter: str
    description: str


class ExecPlanRepeat(BaseModel):
    kind: Literal["repeat"] = "repeat"


class ExecPlanSample(BaseModel):
    kind: Literal["sample"] = "sample"
    parameter: str
    state: Literal["START", "STOP"]
    interval: str | None = None


class ExecPlanCalc(BaseModel):
    kind: Literal["calc"] = "calc"
    result: str
    function: str
    input: str
    value: float | None


class ExecPlanFun(BaseModel):
    kind: Literal["fun"] = "fun"
    result: str
    expression: str
    value: float | None


class ExecPlanEnd(BaseModel):
    kind: Literal["end"] = "end"


class ExecPlanOut(BaseModel):
    kind: Literal["out"] = "out"
    outType: str
    value: str


class ExecPlanDialog(BaseModel):
    kind: Literal["dialog"] = "dialog"
    parameter: str
    message: str


class ExecPlanInfo(BaseModel):
    kind: Literal["info"] = "info"
    level: str
    message: str


ExecPlanStep = (
    ExecPlanGoal | ExecPlanConditionIf | ExecPlanConditionElse | ExecPlanTask
    | ExecPlanPump | ExecPlanFuncCall | ExecPlanVar | ExecPlanWait | ExecPlanMessage
    | ExecPlanSave | ExecPlanUser | ExecPlanResult | ExecPlanOpt | ExecPlanRepeat
    | ExecPlanSample | ExecPlanCalc | ExecPlanFun | ExecPlanEnd | ExecPlanOut
    | ExecPlanDialog | ExecPlanInfo
)


class ExecResult(BaseModel):
    ok: bool
    errors: list[str]
    ast: DslAst
    plan: list[ExecPlanStep]


# Validation types
class DslRuleViolation(BaseModel):
    ruleId: str
    line: int
    message: str
    severity: Literal["error", "warning"]
    suggestion: str | None = None
    fixedLine: str | None = None


class DslValidateResult(BaseModel):
    ok: bool
    errors: list[str]
    warnings: list[str]
    violations: list[DslRuleViolation]
    fixedText: str | None = None
