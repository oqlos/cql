# DSL Example: Complete Device Test Flow
# 
# This script demonstrates a full device testing workflow
# that can be executed from CLI and visualized in browser.
#
# Usage:
#   cd dsl && make run-script FILE=examples/test-device-flow.dsl

# Start session recording
RECORD_START "operator1"

# Navigate to device identification
NAVIGATE "/connect-id/device-rfid"
LOG "Waiting for RFID scan..." {"level": "info"}

# Simulate device selection
SELECT_DEVICE "d-001" {"type": "MSA_G1", "serial": "AO73138", "customer": "cu-001"}

# Navigate to test setup
NAVIGATE "/connect-test/testing"

# Open interval dialog
EMIT "test.interval_dialog_opened" {"deviceId": "d-001"}

# Select test interval
SELECT_INTERVAL "3m" {"code": "periodic_3m", "description": "3 miesiące"}

# Start the test
START_TEST "ts-c20" {"name": "C20 Standard", "steps": 5}

# Protocol created
PROTOCOL_CREATED "pro-example-001" {"via": "cqrs", "deviceId": "d-001"}

# Navigate to protocol execution
NAVIGATE "/connect-test-protocol?protocol=pro-example-001&step=1"

# Execute test steps
STEP_COMPLETE "step-1" {"name": "Sprawdzenie ciśnienia", "status": "passed", "value": "15.2 mbar"}
WAIT 500

STEP_COMPLETE "step-2" {"name": "Test szczelności", "status": "passed", "value": "OK"}
WAIT 500

STEP_COMPLETE "step-3" {"name": "Kontrola wizualna", "status": "passed", "note": "Brak uszkodzeń"}
WAIT 500

STEP_COMPLETE "step-4" {"name": "Test funkcjonalny", "status": "passed"}
WAIT 500

STEP_COMPLETE "step-5" {"name": "Weryfikacja końcowa", "status": "passed"}

# Finalize protocol
PROTOCOL_FINALIZE "pro-example-001" {"status": "executed", "summary": {"passed": 5, "failed": 0}}

# Navigate to report
NAVIGATE "/connect-test/reports?protocol=pro-example-001"

LOG "Test completed successfully!" {"level": "info"}

# Stop recording
RECORD_STOP

# Session complete - events can now be replayed
LOG "Session recorded. Replay with: REPLAY session-id" {"level": "info"}
