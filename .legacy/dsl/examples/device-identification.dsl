# Device Identification Example
# Demonstrates the device identification workflow

# Navigate to device RFID scanner
NAVIGATE "/connect-id/device-rfid"
LOG "Ready for device identification" {"level": "info"}

# Simulate RFID scan - device identified
SELECT_DEVICE "d-msa-001" {"type": "MSA_G1", "serial": "AO73138", "customer": "cu-acme-001"}

LOG "Device identified successfully" {"level": "info", "deviceId": "d-msa-001"}

# Show device details
EMIT "ui.device_details_shown" {"deviceId": "d-msa-001", "panel": "device-info"}

# Navigate to test selection
NAVIGATE "/connect-test/testing"
LOG "Ready for test selection" {"level": "info"}
