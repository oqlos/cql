# DSL-Driven UI Architecture

## Cel

Rozszerzyć język DSL z systemu logowania do pełnego systemu:
1. **Recording** - Nagrywanie sesji użytkownika
2. **Replay** - Odtwarzanie procesów
3. **UI State** - Definiowanie stanu UI przez DSL
4. **Component Definition** - Deklaratywne tworzenie komponentów
5. **Process Flows** - Definicje przepływów biznesowych

## Warstwy DSL

```
┌─────────────────────────────────────────────────────────────┐
│                     DSL LAYERS                               │
├─────────────────────────────────────────────────────────────┤
│ L4: PROCESS     │ Przepływy biznesowe (start-test flow)     │
│ L3: UI_STATE    │ Stan aplikacji (aktywny moduł, selekcje)  │
│ L2: COMPONENT   │ Komponenty UI (menu, forms, tables)       │
│ L1: ACTION      │ Akcje użytkownika (click, input, navigate)│
│ L0: API         │ Operacje API (GET, POST, PATCH)           │
└─────────────────────────────────────────────────────────────┘
```

## Składnia DSL

### L0: API Layer (już zaimplementowane)
```dsl
API GET "/api/v3/data/devices?limit=10"
ASSERT_STATUS 200
LOG "Loaded devices" {"count": 10}
```

### L1: Action Layer (już zaimplementowane)
```dsl
NAVIGATE "/connect-test/testing"
CLICK "#device-select" {"label": "Wybierz urządzenie"}
INPUT "#search-field" {"value": "MSA"}
SELECT "#interval-select" {"value": "3m", "text": "3 miesiące"}
```

### L2: Component Layer (nowe)
```dsl
# Definicja komponentu
COMPONENT "device-card" {
  "template": "card",
  "props": {
    "deviceId": "$context.device_id",
    "showActions": true
  },
  "events": {
    "onClick": "SELECT_DEVICE $deviceId"
  }
}

# Renderowanie
RENDER "device-card" {"deviceId": "d-001"}

# Aktualizacja
UPDATE "device-card" {"status": "testing"}
```

### L3: UI State Layer (nowe)
```dsl
# Zapisanie stanu
STATE_SAVE "connect-test" {
  "module": "connect-test",
  "page": "testing-rfid",
  "selection": {
    "device": "d-001",
    "interval": "3m"
  },
  "filters": {
    "search": "MSA"
  }
}

# Przywrócenie stanu
STATE_RESTORE "connect-test"

# Nawigacja z zachowaniem stanu
STATE_PUSH "/connect-test-protocol" {"protocolId": "pro-123"}
STATE_POP  # Powrót do poprzedniego stanu
```

### L4: Process Layer (nowe)
```dsl
# Definicja procesu
PROCESS "test-device" {
  STEP "identify" {
    "ui": "connect-id/device-rfid",
    "required": ["deviceId"],
    "next": "select-interval"
  }
  STEP "select-interval" {
    "ui": "connect-test/interval-dialog",
    "required": ["intervalCode"],
    "next": "confirm"
  }
  STEP "confirm" {
    "ui": "connect-test/test-confirm",
    "actions": ["START_TEST", "CANCEL"],
    "onSuccess": "execute",
    "onCancel": "abort"
  }
  STEP "execute" {
    "ui": "connect-test-protocol/steps",
    "monitor": true,
    "onComplete": "report"
  }
  STEP "report" {
    "ui": "connect-reports/preview",
    "actions": ["PRINT", "EXPORT"]
  }
}

# Uruchomienie procesu
PROCESS_START "test-device" {"deviceId": "d-001"}

# Przejście do następnego kroku
PROCESS_NEXT {"intervalCode": "3m"}

# Status procesu
PROCESS_STATUS  # -> {"step": "confirm", "progress": 60%}
```

## Architektura implementacji

```
dsl/
├── core/
│   ├── parser.ts          # Parser DSL
│   ├── executor.ts        # Executor komend
│   ├── state-manager.ts   # Zarządzanie stanem UI
│   └── types.ts           # Typy DSL
├── layers/
│   ├── api.layer.ts       # L0: API commands
│   ├── action.layer.ts    # L1: User actions
│   ├── component.layer.ts # L2: UI components
│   ├── state.layer.ts     # L3: UI state
│   └── process.layer.ts   # L4: Process flows
├── components/
│   ├── dsl-recorder.ts    # Nagrywanie sesji
│   ├── dsl-player.ts      # Odtwarzanie DSL
│   └── dsl-editor.ts      # Edytor DSL
└── registry/
    ├── components.ts      # Rejestr komponentów
    └── processes.ts       # Rejestr procesów
```

## Przykład: Nagranie i odtworzenie testu urządzenia

### 1. Użytkownik wykonuje test (nagranie automatyczne)

```dsl
# Session recording - auto-generated
SESSION_START "2024-12-04T15:00:00Z" {"user": "operator1"}

# Identyfikacja urządzenia
NAVIGATE "/connect-id/device-rfid"
RFID_SCAN "d-001" {"type": "MSA_G1", "serial": "AO73138"}
SELECT_DEVICE "d-001" {"customerId": "cu-001"}

# Wybór interwału
OPEN_INTERVAL_DIALOG "d-001" {"customerId": "cu-001"}
SELECT_INTERVAL "3m" {"code": "periodic_3m"}
CLICK "#interval-start" {"label": "Start"}

# Tworzenie protokołu
API POST "/api/v3/data/protocols" {"device_id": "d-001", "status": "in_progress"}
ASSERT_STATUS 200
PROTOCOL_CREATED "pro-abc123" {"via": "cqrs"}

# Wykonanie kroków
NAVIGATE "/connect-test-protocol?protocol=pro-abc123&step=1"
PAGE_SETUP "protocol-steps" {"protocolId": "pro-abc123"}
STEP_COMPLETE "step-1" {"name": "Test ciśnienia", "status": "passed", "value": "15.2"}
STEP_COMPLETE "step-2" {"name": "Test szczelności", "status": "passed", "value": "OK"}

# Finalizacja
PROTOCOL_FINALIZE "pro-abc123" {"status": "executed", "summary": {"passed": 2, "failed": 0}}

SESSION_END {"duration": "00:05:23", "result": "success"}
```

### 2. Odtworzenie dla innego urządzenia

```dsl
# Replay with different device
REPLAY "session-2024-12-04" {
  "variables": {
    "device_id": "d-002",
    "customer_id": "cu-002"
  },
  "mode": "auto",  # auto | step | debug
  "speed": 1.5
}
```

### 3. Generowanie UI z procesu

```dsl
# Load process definition
PROCESS_LOAD "test-device"

# Generate UI for current step
UI_GENERATE {
  "process": "test-device",
  "step": "identify",
  "context": {
    "availableDevices": "$api.devices",
    "recentDevices": "$state.recentDevices"
  }
}
```

## Korzyści

1. **Reprodukowalność** - Każda sesja może być odtworzona
2. **Testowanie** - Automatyczne testy E2E z nagranych sesji
3. **Szkolenie** - Nagrywanie wzorcowych procesów
4. **Debugging** - Analiza problemów z dokładnym odtworzeniem
5. **Dokumentacja** - DSL jako żywa dokumentacja procesów
6. **Low-code** - Modyfikacja procesów bez zmiany kodu

## Następne kroki

1. [ ] Rozszerzyć `unified-dsl.ts` o nowe warstwy
2. [ ] Stworzyć `dsl-state-manager.ts` (L3)
3. [ ] Stworzyć `dsl-process-engine.ts` (L4)
4. [ ] Stworzyć `dsl-player.ts` (replay)
5. [ ] Zintegrować z istniejącymi modułami
6. [ ] Stworzyć UI edytora DSL
