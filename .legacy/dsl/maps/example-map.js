// =============================================================================
// WARIANT 1: Kolumna MAP - mapowanie DSL → funkcje
// Zapisywane w kolumnie 'map' tabeli test_scenarios
// =============================================================================

module.exports = {
  // =========================================================================
  // METADATA
  // =========================================================================
  meta: {
    version: '1.0',
    device: 'PSS7000',
    environment: 'browser',  // 'browser' | 'node' | 'both'
  },

  // =========================================================================
  // OBJECT → ACTION MAP (wysoki poziom)
  // Mapuje: TASK: [action] [object] → funkcja
  // =========================================================================
  objectActionMap: {
    'pompa 1': {
      'Włącz': {
        kind: 'api',
        url: '/api/v1/hardware/pump/1/on',
        method: 'POST',
        // Alternatywnie dla backendu Python:
        py: 'hardware.pump.set_state(1, True)',
      },
      'Wyłącz': {
        kind: 'api',
        url: '/api/v1/hardware/pump/1/off',
        method: 'POST',
        py: 'hardware.pump.set_state(1, False)',
      },
      'Ustaw': {
        kind: 'api',
        url: '/api/v1/hardware/pump/1/speed',
        method: 'POST',
        body: { speed: '{value}' },  // {value} podstawiane z DSL
        py: 'hardware.pump.set_speed(1, {value})',
      },
    },
    
    'zawór BO04': {
      'Otwórz': {
        kind: 'api',
        url: '/api/v1/hardware/valve/BO04/open',
        method: 'POST',
        py: 'hardware.valve.open("BO04")',
      },
      'Zamknij': {
        kind: 'api',
        url: '/api/v1/hardware/valve/BO04/close',
        method: 'POST',
        py: 'hardware.valve.close("BO04")',
      },
    },
    
    'zawór BO05': {
      'Otwórz': { kind: 'api', url: '/api/v1/hardware/valve/BO05/open', method: 'POST' },
      'Zamknij': { kind: 'api', url: '/api/v1/hardware/valve/BO05/close', method: 'POST' },
    },
    
    'zawór BO06': {
      'Otwórz': { kind: 'api', url: '/api/v1/hardware/valve/BO06/open', method: 'POST' },
      'Zamknij': { kind: 'api', url: '/api/v1/hardware/valve/BO06/close', method: 'POST' },
    },
  },

  // =========================================================================
  // PARAM → SENSOR MAP
  // Mapuje: VAL [param] → odczyt z sensora
  // =========================================================================
  paramSensorMap: {
    'ciśnienie': {
      sensor: 'AI01',
      kind: 'api',
      url: '/api/v1/sensors/AI01/value',
      method: 'GET',
      unit: 'bar',
      py: 'sensors.read("AI01")',
    },
    'ciśnienie NC': {
      sensor: 'AI01',
      url: '/api/v1/sensors/AI01/value',
      unit: 'mbar',
      py: 'sensors.read("AI01") * 1000',  // konwersja bar → mbar
    },
    'ciśnienie SC': {
      sensor: 'AI02',
      url: '/api/v1/sensors/AI02/value',
      unit: 'bar',
      py: 'sensors.read("AI02")',
    },
    'temperatura': {
      sensor: 'AI03',
      url: '/api/v1/sensors/AI03/value',
      unit: '°C',
      py: 'sensors.read("AI03")',
    },
  },

  // =========================================================================
  // ACTIONS MAP (globalne akcje)
  // Mapuje: TASK: [action] [any] → funkcja
  // =========================================================================
  actions: {
    'Potwierdź': {
      kind: 'ui',
      component: 'ConfirmDialog',
      props: { message: '{object}', buttons: ['OK', 'Anuluj'] },
    },
    'Message Prompt': {
      kind: 'ui',
      component: 'MessagePrompt',
      props: { message: '{object}' },
    },
    'Zeruj': {
      kind: 'api',
      url: '/api/v1/sensors/{object}/zero',
      method: 'POST',
      py: 'sensors.zero("{object}")',
    },
    'Kalibruj': {
      kind: 'api',
      url: '/api/v1/sensors/{object}/calibrate',
      method: 'POST',
      py: 'sensors.calibrate("{object}")',
    },
  },

  // =========================================================================
  // FUNC IMPLEMENTATIONS (opcjonalne nadpisanie FUNC z kolumny func)
  // =========================================================================
  funcImplementations: {
    'Odpowietrzenie systemu': {
      kind: 'sequence',
      steps: [
        { action: 'Wyłącz', object: 'pompa 1' },
        { action: 'Zamknij', object: 'zawór BO04' },
        { action: 'Zamknij', object: 'zawór BO05' },
        { action: 'Zamknij', object: 'zawór BO06' },
      ],
      // Lub bezpośrednia implementacja:
      py: 'procedures.deaerate_system()',
      js: 'await procedures.deaerateSystem()',
    },
  },

  // =========================================================================
  // TIMER/STOPER CONFIG
  // =========================================================================
  timerConfig: {
    defaultUnit: 's',
    tickInterval: 100,  // ms
    maxDuration: 3600000,  // 1h max
  },

  // =========================================================================
  // CONDITION EVALUATORS
  // Mapuje: IF [condition] → ewaluator
  // =========================================================================
  conditionEvaluators: {
    'button': {
      kind: 'ui',
      getValue: () => 'globalThis.__lastButtonPressed',
      py: 'ui.get_last_button()',
    },
    'tryb': {
      kind: 'state',
      getValue: () => 'globalThis.__currentMode',
      py: 'state.get("mode")',
    },
  },
};
