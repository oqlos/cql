# Session Recording Example
# Demonstrates how to record and replay user sessions

# Start recording session
RECORD_START "demo-session-001"
LOG "Session recording started" {"level": "info"}

# Perform some actions
NAVIGATE "/connect-id/device-rfid"
SELECT_DEVICE "d-demo-001" {"type": "PSS-7000", "serial": "PS12345"}

NAVIGATE "/connect-test/testing"
SELECT_INTERVAL "3m" {"code": "periodic_3m", "description": "3 miesiące"}

START_TEST "ts-demo" {"name": "Demo Test", "steps": 3}

STEP_COMPLETE "step-1" {"name": "Initialization", "status": "passed"}
WAIT 200
STEP_COMPLETE "step-2" {"name": "Pressure Check", "status": "passed", "value": "15.2 mbar"}
WAIT 200
STEP_COMPLETE "step-3" {"name": "Finalization", "status": "passed"}

# Stop recording
RECORD_STOP
LOG "Session recording stopped - events captured" {"level": "info"}

# The session can now be replayed with:
# REPLAY "session-id" {"variables": {"device_id": "d-other-device"}}
