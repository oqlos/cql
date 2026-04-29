# DSL Logger - Dokumentacja i Przykłady

## Wprowadzenie

DSL Logger to narzędzie do strukturalnego logowania akcji użytkownika w formacie DSL (Domain Specific Language). Umożliwia:

1. **Logowanie** - zapisywanie akcji w czytelnym formacie
2. **Eksport** - generowanie skryptów DSL z logów
3. **Replay** - odtwarzanie scenariuszy z logów
4. **Debugging** - analiza przepływu użytkownika

## Dostęp w Konsoli Przeglądarki

Po załadowaniu aplikacji, obiekt `dsl` jest dostępny globalnie:

```javascript
// Pomoc
dsl.help()

// Pokaż ostatnie 20 logów
dsl.show(20)

// Eksportuj jako skrypt DSL
dsl.export()

// Wyczyść logi
dsl.clear()
```

## Format DSL

```
ACTION "target" { param1: value1, param2: value2 } -> result
```

### Przykłady:

```dsl
NAVIGATE "/connect-test-device" {}
SELECT_DEVICE "d-001" { serial: "AO73138", type: "MSA_G1" }
CLICK "#start-test-btn" {}
START_TEST "ts-c20" { interval: "on_use" } -> protocol:pro-abc123
WAIT "2000" {}
```

## Scenariusz: Od wyboru urządzenia do realizacji testu

### Krok 1: Nawigacja do listy urządzeń

```javascript
// W konsoli przeglądarki:
dsl.nav('/connect-test-device')
```

Lub bezpośrednio w URL:
```
http://localhost:8100/connect-test-device
```

### Krok 2: Wybór urządzenia

```javascript
// Logowanie wyboru urządzenia
dsl.log('SELECT_DEVICE', 'd-001', { serial: 'AO73138', type: 'MSA_G1' })

// Lub kliknięcie w wiersz tabeli
dsl.click('[data-device-id="d-001"]')
```

### Krok 3: Wybór rodzaju testu (interwału)

```javascript
dsl.log('SELECT_INTERVAL', 'on_use', { name: 'Przed użyciem' })
```

### Krok 4: Start testu

```javascript
dsl.log('START_TEST', 'ts-c20', { 
  interval: 'on_use', 
  device: 'd-001',
  scenario: 'Test MSA G1'
})
```

### Krok 5: Przekierowanie do protokołu

```javascript
dsl.log('NAVIGATE', '/connect-test-protocol', { 
  protocol: 'pro-abc123', 
  step: 1 
})
```

## Pełny Przykład Replay

```javascript
// Eksportuj aktualną sesję
const script = dsl.export();

// Skrypt wygląda tak:
/*
# DSL Log Export - 2025-12-04T12:00:00.000Z
# 5 entries

NAVIGATE "/connect-test-device" {}
SELECT_DEVICE "d-001" { "serial": "AO73138", "type": "MSA_G1" }
SELECT_INTERVAL "on_use" { "name": "Przed użyciem" }
START_TEST "ts-c20" { "interval": "on_use", "device": "d-001" }
NAVIGATE "/connect-test-protocol" { "protocol": "pro-abc123", "step": 1 }
*/

// Odtwórz scenariusz
dsl.replay(script);
```

## Integracja z CQRS

DSL Logger może wywoływać komendy CQRS:

```javascript
// Dispatch CQRS command
dsl.log('DISPATCH', '{"type":"LoadDevices"}', {})

// W replay:
DISPATCH '{"type":"LoadDevices"}' {}
DISPATCH '{"type":"SelectDevice","serial":"AO73138"}' {}
DISPATCH '{"type":"StartProtocol","payload":{...}}' {}
```

## Użycie w Shell (curl)

### Sprawdzenie aktualnych redirectów:

```bash
curl -s 'http://localhost:8101/api/v3/redirects?active_only=true' | python3 -m json.tool
```

### Utworzenie protokołu testowego:

```bash
curl -X POST 'http://localhost:8101/api/v3/data/protocols' \
  -H 'Content-Type: application/json' \
  -d '{
    "device_id": "d-001",
    "type": "periodic",
    "status": "in_progress",
    "title": "Test MSA G1",
    "results": "{\"steps\":[{\"name\":\"Kontrola wizualna\",\"status\":\"pending\"}]}"
  }'
```

### Pobranie urządzeń:

```bash
curl -s 'http://localhost:8101/api/v3/data/devices?limit=10' | python3 -m json.tool
```

### Pobranie scenariuszy:

```bash
curl -s 'http://localhost:8101/api/v3/data/test_scenarios?limit=10' | python3 -m json.tool
```

## Timing i Pomiar Wydajności

```javascript
// Start pomiaru
const key = dsl.start('LOAD_DATA', 'devices', { count: 100 });

// ... operacja ...

// Zakończ pomiar
dsl.end(key, 'loaded:100', null);  // sukces
// lub
dsl.end(key, null, 'Network error');  // błąd
```

## Przykładowy Skrypt Testowy

```dsl
# Test: Pełny przepływ testowania urządzenia
# Autor: System
# Data: 2025-12-04

# 1. Nawigacja do modułu urządzeń
NAVIGATE "/connect-test-device" {}
WAIT "1000" {}

# 2. Wybór urządzenia z listy
SELECT_DEVICE "d-001" { "serial": "AO73138", "type": "MSA_G1" }
WAIT "500" {}

# 3. Wybór interwału testowego
SELECT_INTERVAL "on_use" { "name": "Przed użyciem" }
WAIT "500" {}

# 4. Start testu
START_TEST "ts-c20" { "interval": "on_use", "device": "d-001" }
WAIT "2000" {}

# 5. Weryfikacja przekierowania do protokołu
# System automatycznie przekieruje do /connect-test-protocol?protocol=XXX&step=1
```

## Konfiguracja

### Włączenie verbose logging:

```javascript
// W konsoli przeglądarki
localStorage.setItem('app:verbose', 'true');
location.reload();
```

### Ustawienie poziomu logowania:

```javascript
setLogLevel('debug');  // debug, info, warn, error
```

## API Reference

| Metoda | Opis |
|--------|------|
| `dsl.log(action, target, params, result)` | Loguj akcję |
| `dsl.start(action, target, params)` | Start pomiaru czasu |
| `dsl.end(key, result, error)` | Zakończ pomiar |
| `dsl.export(lastN?)` | Eksportuj jako DSL |
| `dsl.replay(script)` | Odtwórz skrypt |
| `dsl.show(lastN?)` | Pokaż ostatnie logi |
| `dsl.clear()` | Wyczyść logi |
| `dsl.help()` | Pokaż pomoc |
| `dsl.nav(path)` | Skrót: loguj nawigację |
| `dsl.click(selector)` | Skrót: loguj kliknięcie |
| `dsl.input(selector, value)` | Skrót: loguj input |

## Dostępne Akcje w Replay

| Akcja | Opis | Przykład |
|-------|------|----------|
| `NAVIGATE` | Nawigacja do URL | `NAVIGATE "/path" {}` |
| `CLICK` | Kliknięcie elementu | `CLICK "#btn" {}` |
| `INPUT` | Wprowadzenie tekstu | `INPUT "#field" { "value": "text" }` |
| `DISPATCH` | CQRS command | `DISPATCH '{"type":"X"}' {}` |
| `WAIT` | Czekaj ms | `WAIT "1000" {}` |
| `SELECT_DEVICE` | Wybór urządzenia | `SELECT_DEVICE "d-001" {}` |
| `START_TEST` | Start testu | `START_TEST "ts-c20" {}` |
