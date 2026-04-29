# Quick Navigation Example
# Demonstrates basic navigation between modules

# Start from home
NAVIGATE "/"
LOG "Starting navigation demo" {"level": "info"}

# Navigate through main modules
NAVIGATE "/connect-id"
WAIT 300
LOG "Arrived at Connect-ID module"

NAVIGATE "/connect-test"
WAIT 300
LOG "Arrived at Connect-Test module"

NAVIGATE "/connect-data"
WAIT 300
LOG "Arrived at Connect-Data module"

NAVIGATE "/connect-reports"
WAIT 300
LOG "Arrived at Connect-Reports module"

LOG "Navigation demo complete!" {"level": "info"}
