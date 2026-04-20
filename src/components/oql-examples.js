export const OQL_EXAMPLES = {
  "pump-test": {
    title: "Test Pompy / Pump Test",
    lang: "oql",
    code: `SCENARIO: "Pump Flow Test"
DEVICE_TYPE: "BA"
DEVICE_MODEL: "PSS 7000"
MANUFACTURER: "Dräger"

FUNC:
  SET NAME 'Sterowanie pompą'
  # Ustaw pompę i czekaj
  SET 'pompa 1' '$1'
  WAIT $2

GOAL:
  SET NAME 'Test przepływu'
  # 1. Start pump at 2 l/min
    FUNC 'Sterowanie pompą' '2 l/min' '2000ms'
  # 2. Reverse flow direction
    FUNC 'Sterowanie pompą' '-2 l/min' '2000ms'
  # 3. Stop pump
    SET 'pompa 1' '0'`,
  },
  "mask-leak": {
    title: "Test Szczelności / Leak Test",
    lang: "oql",
    code: `SCENARIO: "Mask Leak Test"
DEVICE_TYPE: "BA"
DEVICE_MODEL: "FPS 7000"
MANUFACTURER: "Dräger"

GOAL:
  SET NAME 'Pressure Seal Verification'
  SET VAL 'AI01'
  SET MIN '-11.0 mbar'

  SET 'PUMP' 'off'
  SET 'zawór 2' '1'
  SET 'PUMP' '5 l'
  WAIT 7000ms

  IF AI01 -11.0 .. 0.0 mbar
  CORRECT 'Podciśnienie w normie'
  ERROR 'Vacuum too low'
  SAVE 'AI01'

GOAL:
  SET NAME 'Overpressure Check'
  SET VAL 'AI01'
  SET MIN '4.2 mbar'
  SET MAX '6.0 mbar'

  SET 'PUMP' '10 l'
  WAIT 5000ms

  IF AI01 -9.0 .. 0.0 mbar
  CORRECT 'Ciśnienie nadmiarowe OK'
  ERROR 'Seal failure'
  SAVE 'AI01'

  IF AI01 4.2 .. 6.0 mbar
  CORRECT 'Ciśnienie SC w normie (4.2-6.0 bar)'
  ERROR 'Błąd: ciśnienie SC poza zakresem 4.2-6.0 bar'
  SAVE 'AI01'`,
  },
  "hw-diagnostics": {
    title: "Diagnostyka HW / Diagnostics",
    lang: "oql",
    code: `SCENARIO: "Hardware Diagnostics"
DEVICE_TYPE: "TEST_EQUIPMENT"

GOAL:
  SET NAME 'Detect and validate hardware'
  LOG "Detecting USB/serial peripherals..."
  EXPECT_DEVICE "/dev/ttyACM0" "CH340" "Modbus RTU"
  EXPECT_I2C_BUS "/dev/i2c-1"
  EXPECT_I2C_CHIP "0x48" "ADS1115 ADC"

  API_GET "/api/v1/hardware/health"
  ASSERT_STATUS 200
  ASSERT_JSON "mode" "real"
  ASSERT_JSON "piadc" "ok"
  ASSERT_JSON "motor" "ok"

  # Test pump
  SET "pompa" "2"
  WAIT 500ms
  ASSERT_SENSOR "sc-sensor" ">" "1" "mbar"
  SET "pompa" "0"

  # Test valves
  SET "zawor NC" "ON"
  WAIT 200ms
  ASSERT_VALVE "valve-nc" "True"
  SET "zawor NC" "OFF"

  LOG "Hardware diagnostics complete!"`,
  },
  "api-test": {
    title: "Test API / TestQL",
    lang: "iql",
    code: `# TestQL — API & GUI Test Scenario
SET api_url "http://localhost:8101"

LOG "Starting API test suite"

# Test device listing
API GET "\${api_url}/api/v3/data/devices"
ASSERT_STATUS 200
ASSERT_CONTAINS "device"
ASSERT_JSON data.length > 0

# Test scenario registration
API POST "\${api_url}/api/v3/scenarios" {
  "id": "ts-pump-001",
  "name": "Pump Flow Test"
}
ASSERT_STATUS 201

# GUI Navigation Test
NAVIGATE "/connect-workshop"
WAIT 500
CLICK "[data-action='search']"
INPUT "#search-input" "drager"
ASSERT_VISIBLE "[data-testid='results']"
ASSERT_TEXT "#status" "Connected"`,
  },
  "session-record": {
    title: "Nagrywanie Sesji / Record",
    lang: "iql",
    code: `# Session Recording & Replay
RECORD_START "demo-session-001"
LOG "Recording started" {"level": "info"}

# Device identification
NAVIGATE "/connect-id/device-rfid"
SELECT_DEVICE "d-demo-001" {
  "type": "PSS-7000",
  "serial": "PS12345"
}

# Start test interval
NAVIGATE "/connect-test/testing"
SELECT_INTERVAL "3m" {
  "code": "periodic_3m",
  "description": "3 miesiące"
}

# Execute test steps
START_TEST "ts-demo" {"name": "Demo", "steps": 3}
STEP_COMPLETE "step-1" {"name": "Init", "status": "passed"}
WAIT 200
STEP_COMPLETE "step-2" {
  "name": "Pressure",
  "status": "passed",
  "value": "15.2 mbar"
}
STEP_COMPLETE "step-3" {"name": "Final", "status": "passed"}

RECORD_STOP
# REPLAY "session-id" {"variables": {...}}`,
  },
};
