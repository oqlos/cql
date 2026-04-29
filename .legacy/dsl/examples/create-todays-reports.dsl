# Create Today's Reports
# 
# Creates test protocols with TODAY's date that will appear
# in the current week view of Connect-Reports.
#
# Usage:
#   cd dsl && make run-script FILE=examples/create-todays-reports.dsl

LOG "Creating reports for today..." {"level": "info"}

# ============================================================================
# Report 1: Morning inspection (08:30)
# ============================================================================

NAVIGATE "/connect-test/testing"
SELECT_DEVICE "d-morning-001" {"type": "MSA_G1", "serial": "MRN001"}
START_TEST "ts-inspection" {"name": "Poranna inspekcja MSA"}
PROTOCOL_CREATED "pro-today-001" {"device_id": "d-morning-001", "status": "executed", "scheduled_date": "today_08:30"}
STEP_COMPLETE "step-1" {"name": "Kontrola wizualna", "status": "passed"}
STEP_COMPLETE "step-2" {"name": "Test funkcjonalny", "status": "passed"}
PROTOCOL_FINALIZE "pro-today-001" {"status": "executed"}
LOG "Report 1: Morning Inspection ✅"

# ============================================================================
# Report 2: Midday calibration (12:00)
# ============================================================================

SELECT_DEVICE "d-midday-001" {"type": "PSS_7000", "serial": "MID001"}
START_TEST "ts-calibration" {"name": "Kalibracja PSS"}
PROTOCOL_CREATED "pro-today-002" {"device_id": "d-midday-001", "status": "executed", "scheduled_date": "today_12:00"}
STEP_COMPLETE "step-1" {"name": "Zerowanie", "status": "passed"}
STEP_COMPLETE "step-2" {"name": "Kalibracja ciśnienia", "status": "passed"}
STEP_COMPLETE "step-3" {"name": "Weryfikacja", "status": "passed"}
PROTOCOL_FINALIZE "pro-today-002" {"status": "executed"}
LOG "Report 2: Midday Calibration ✅"

# ============================================================================
# Report 3: Afternoon maintenance (14:30) - PLANNED
# ============================================================================

SELECT_DEVICE "d-afternoon-001" {"type": "REG_3000", "serial": "AFT001"}
START_TEST "ts-maintenance" {"name": "Konserwacja regulatora"}
PROTOCOL_CREATED "pro-today-003" {"device_id": "d-afternoon-001", "status": "planned", "scheduled_date": "today_14:30"}
LOG "Report 3: Afternoon Maintenance (planned) 📅"

# ============================================================================
# Report 4: Evening test (16:00) - OVERDUE
# ============================================================================

SELECT_DEVICE "d-evening-001" {"type": "MSA_G1", "serial": "EVN001"}
START_TEST "ts-pressure" {"name": "Test ciśnienia wieczorny"}
PROTOCOL_CREATED "pro-today-004" {"device_id": "d-evening-001", "status": "overdue", "scheduled_date": "today_16:00"}
LOG "Report 4: Evening Test (overdue) ⚠️"

# ============================================================================
# Navigate to reports
# ============================================================================

NAVIGATE "/connect-reports"
EMIT "reports.refresh_requested" {"view": "week"}

LOG "========================================" {"level": "info"}
LOG "Created 4 reports for today:" {"level": "info"}
LOG "  ✅ 08:30 - Poranna inspekcja (executed)" {"level": "info"}
LOG "  ✅ 12:00 - Kalibracja PSS (executed)" {"level": "info"}
LOG "  📅 14:30 - Konserwacja (planned)" {"level": "info"}
LOG "  ⚠️ 16:00 - Test wieczorny (overdue)" {"level": "info"}
LOG "========================================" {"level": "info"}
LOG "Open: http://localhost:8100/connect-reports" {"level": "info"}
