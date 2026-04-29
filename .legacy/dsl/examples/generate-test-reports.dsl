# Generate Test Reports Scenario
# 
# This script creates test protocols in the database and generates
# events that will appear in the Reports module.
#
# Usage:
#   cd dsl && make run-script FILE=examples/generate-test-reports.dsl
#   Then open: http://localhost:8100/connect-reports

LOG "Starting test report generation..." {"level": "info"}
RECORD_START "report-generation"

# ============================================================================
# Test 1: MSA Device - Pressure Test (Completed Today)
# ============================================================================

NAVIGATE "/connect-id/device-rfid"
SELECT_DEVICE "d-msa-7000" {"type": "MSA_G1", "serial": "AO73138"}

NAVIGATE "/connect-test/testing"
SELECT_INTERVAL "3m" {"code": "periodic_3m"}

START_TEST "ts-pressure" {"name": "Test ciśnienia MSA", "steps": 3}
PROTOCOL_CREATED "pro-msa-001" {"device_id": "d-msa-7000", "status": "IN_PROGRESS"}

STEP_COMPLETE "step-1" {"name": "Inicjalizacja", "status": "passed"}
WAIT 200
STEP_COMPLETE "step-2" {"name": "Test ciśnienia 15 mbar", "status": "passed", "value": "15.2 mbar"}
WAIT 200
STEP_COMPLETE "step-3" {"name": "Weryfikacja", "status": "passed"}

PROTOCOL_FINALIZE "pro-msa-001" {"status": "COMPLETED", "summary": {"passed": 3, "failed": 0}}
LOG "Test 1 completed: MSA Pressure Test" {"level": "info"}

# ============================================================================
# Test 2: PSS Device - Flow Test (Completed Today)
# ============================================================================

NAVIGATE "/connect-id/device-rfid"
SELECT_DEVICE "d-pss-5000" {"type": "PSS_5000", "serial": "PS12345"}

NAVIGATE "/connect-test/testing"
SELECT_INTERVAL "6m" {"code": "periodic_6m"}

START_TEST "ts-flow" {"name": "Test przepływu PSS", "steps": 4}
PROTOCOL_CREATED "pro-pss-001" {"device_id": "d-pss-5000", "status": "IN_PROGRESS"}

STEP_COMPLETE "step-1" {"name": "Kalibracja", "status": "passed"}
WAIT 200
STEP_COMPLETE "step-2" {"name": "Test przepływu min", "status": "passed", "value": "2.5 l/min"}
WAIT 200
STEP_COMPLETE "step-3" {"name": "Test przepływu max", "status": "passed", "value": "15.0 l/min"}
WAIT 200
STEP_COMPLETE "step-4" {"name": "Finalizacja", "status": "passed"}

PROTOCOL_FINALIZE "pro-pss-001" {"status": "COMPLETED", "summary": {"passed": 4, "failed": 0}}
LOG "Test 2 completed: PSS Flow Test" {"level": "info"}

# ============================================================================
# Test 3: Regulator - Maintenance (Completed Today)
# ============================================================================

NAVIGATE "/connect-id/device-rfid"
SELECT_DEVICE "d-reg-001" {"type": "REG_3000", "serial": "RG98765"}

NAVIGATE "/connect-test/testing"
SELECT_INTERVAL "12m" {"code": "annual"}

START_TEST "ts-maintenance" {"name": "Konserwacja regulatora", "steps": 5}
PROTOCOL_CREATED "pro-reg-001" {"device_id": "d-reg-001", "status": "IN_PROGRESS"}

STEP_COMPLETE "step-1" {"name": "Kontrola wizualna", "status": "passed"}
WAIT 200
STEP_COMPLETE "step-2" {"name": "Czyszczenie", "status": "passed"}
WAIT 200
STEP_COMPLETE "step-3" {"name": "Wymiana uszczelek", "status": "passed"}
WAIT 200
STEP_COMPLETE "step-4" {"name": "Test szczelności", "status": "passed", "value": "OK"}
WAIT 200
STEP_COMPLETE "step-5" {"name": "Dokumentacja", "status": "passed"}

PROTOCOL_FINALIZE "pro-reg-001" {"status": "COMPLETED", "summary": {"passed": 5, "failed": 0}}
LOG "Test 3 completed: Regulator Maintenance" {"level": "info"}

# ============================================================================
# Navigate to Reports
# ============================================================================

NAVIGATE "/connect-reports"
WAIT 500

# Emit event to trigger reports reload
EMIT "reports.refresh_requested" {"view": "week", "filter": "executed"}

LOG "Navigated to Reports - data should be visible" {"level": "info"}

# ============================================================================
# Summary
# ============================================================================

RECORD_STOP

LOG "========================================" {"level": "info"}
LOG "Report Generation Complete!" {"level": "info"}
LOG "Created 3 test protocols:" {"level": "info"}
LOG "  1. MSA Pressure Test (3 steps)" {"level": "info"}
LOG "  2. PSS Flow Test (4 steps)" {"level": "info"}
LOG "  3. Regulator Maintenance (5 steps)" {"level": "info"}
LOG "========================================" {"level": "info"}
LOG "Open: http://localhost:8100/connect-reports" {"level": "info"}
