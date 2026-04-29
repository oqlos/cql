import { createContext, useContext, useState, useCallback, useEffect } from "react";

const dictionaries = {
  en: {
    nav: { scenarios: "Scenarios" },
    scenarios: {
      title: "Test Scenarios",
      subtitle: "Create and edit OQL test scenarios with syntax highlighting and visual preview.",
      loading: "Loading scenario…",
      saveError: "Failed to save scenario",
      saved: "Scenario saved",
      loadError: "Could not load scenario",
      connected: "Live",
      disconnected: "Offline",
      protocol: "Protocol View",
      terminal: "Terminal",
      report: "Report",
      loadReport: "Load data.json",
    },
    role: { readonly: "Read-only view — editing disabled for current role" },
    editors: {
      placeholderHint: "This editor is embedded from maskservice. React re-implementation is in progress — URL params are honored and the backend connection is live.",
      dslEditorDesc: "Low-level DSL editor for scenario payloads.",
      funcEditorDesc: "Reusable function definitions shared between scenarios.",
      libraryEditorDesc: "Scenario templates and per-device libraries.",
      mapEditorDesc: "Device / signal mappings between scenarios and hardware.",
      scenarioEditorDesc: "Full visual scenario editor (goals + steps + asserts).",
      operatorParametersDesc: "Edit scenario parameters exposed to the test operator.",
    },
    library: {
      title: "Library Editor",
      subtitle: "Manage DSL objects, functions, and parameters used in scenarios.",
      objects: "Objects",
      functions: "Functions",
      params: "Parameters",
      type: "Type",
      name: "Name",
      units: "Units",
      actions: "Actions",
      add: "Add",
      delete: "Delete",
      loading: "Loading library items…",
      loadError: "Failed to load library items",
      confirmDelete: "Delete this item?",
      deleteError: "Failed to delete item",
      noItems: "No items found",
      newNamePlaceholder: "New name",
      unitsPlaceholder: "Units (e.g., s, min, °C)",
      filterNamePlaceholder: "Filter by name",
      filterUnitsPlaceholder: "Filter by units",
    },
    mapEditor: {
      title: "Map Editor",
      subtitle: "Edit MAP bindings between DSL objects, params, actions and runtime function handlers.",
      save: "Save",
      reload: "Reload",
      add: "Add",
      format: "Format",
      filter: "Filter scenarios…",
      sortDateDesc: "Date (newest)",
      sortDateAsc: "Date (oldest)",
      sortNameAsc: "Name (A→Z)",
      sortNameDesc: "Name (Z→A)",
      noScenario: "Select a scenario from the list.",
      objectsDesc: "Object → Action mappings",
      paramsDesc: "Parameter → Sensor mappings",
      actionsDesc: "Global action mappings",
      funcsDesc: "FUNC implementations",
      jsonDesc: "Raw MAP JSON editor",
      emptyObjects: "No objects defined",
      emptyParams: "No params defined",
      emptyActions: "No actions defined",
      emptyFuncs: "No functions defined",
      tabs: {
        objects: "Objects",
        params: "Params",
        actions: "Actions",
        funcs: "FUNC",
        json: "JSON",
      },
      prompts: {
        objectName: "Object name:",
        paramName: "Parameter name:",
        actionName: "Action name:",
        funcName: "FUNC name:",
        rename: "New name:",
        confirmDelete: "Delete \"{name}\"?",
      },
    },
  },
  pl: {
    nav: { scenarios: "Scenariusze" },
    scenarios: {
      title: "Scenariusze testowe",
      subtitle: "Twórz i edytuj scenariusze OQL z podświetlaniem składni i podglądem graficznym.",
      loading: "Wczytywanie scenariusza…",
      saveError: "Nie udało się zapisać scenariusza",
      saved: "Scenariusz zapisany",
      loadError: "Nie udało się wczytać scenariusza",
      connected: "Połączono",
      disconnected: "Brak połączenia",
      protocol: "Widok protokołu",
      terminal: "Terminal",
      report: "Raport",
      loadReport: "Wczytaj data.json",
    },
    role: { readonly: "Tryb podglądu — edycja zablokowana dla tej roli" },
    editors: {
      placeholderHint: "Edytor osadzony z maskservice. Trwa migracja do Reacta — parametry URL i połączenie z backendem działają.",
      dslEditorDesc: "Niskopoziomowy edytor DSL dla danych scenariusza.",
      funcEditorDesc: "Definicje funkcji wielokrotnego użytku współdzielone między scenariuszami.",
      libraryEditorDesc: "Szablony scenariuszy i biblioteki per-urządzenie.",
      mapEditorDesc: "Mapowania urządzeń/sygnałów między scenariuszami a hardware.",
      scenarioEditorDesc: "Pełny wizualny edytor scenariusza (cele + kroki + asercje).",
      operatorParametersDesc: "Edycja parametrów scenariusza dostępnych dla operatora testu.",
    },
    library: {
      title: "Edytor biblioteki",
      subtitle: "Zarządzaj obiektami, funkcjami i parametrami DSL używanymi w scenariuszach.",
      objects: "Obiekty",
      functions: "Funkcje",
      params: "Parametry",
      type: "Typ",
      name: "Nazwa",
      units: "Jednostki",
      actions: "Akcje",
      add: "Dodaj",
      delete: "Usuń",
      loading: "Wczytywanie elementów biblioteki…",
      loadError: "Nie udało się wczytać elementów biblioteki",
      confirmDelete: "Usunąć ten element?",
      deleteError: "Nie udało się usunąć elementu",
      noItems: "Brak elementów",
      newNamePlaceholder: "Nowa nazwa",
      unitsPlaceholder: "Jednostki (np. s, min, °C)",
      filterNamePlaceholder: "Filtruj po nazwie",
      filterUnitsPlaceholder: "Filtruj po jednostkach",
    },
    mapEditor: {
      title: "Edytor MAP",
      subtitle: "Edytuj mapowania MAP między obiektami DSL, parametrami, akcjami i runtime.",
      save: "Zapisz",
      reload: "Przeładuj",
      add: "Dodaj",
      format: "Formatuj",
      filter: "Filtruj scenariusze…",
      sortDateDesc: "Data (najnowsze)",
      sortDateAsc: "Data (najstarsze)",
      sortNameAsc: "Nazwa (A→Z)",
      sortNameDesc: "Nazwa (Z→A)",
      noScenario: "Wybierz scenariusz z listy.",
      objectsDesc: "Mapowania Object → Action",
      paramsDesc: "Mapowania Parametr → Sensor",
      actionsDesc: "Globalne mapowania akcji",
      funcsDesc: "Implementacje FUNC",
      jsonDesc: "Surowy edytor JSON mapy",
      emptyObjects: "Brak obiektów",
      emptyParams: "Brak parametrów",
      emptyActions: "Brak akcji",
      emptyFuncs: "Brak funkcji",
      tabs: {
        objects: "Obiekty",
        params: "Parametry",
        actions: "Akcje",
        funcs: "FUNC",
        json: "JSON",
      },
      prompts: {
        objectName: "Nazwa obiektu:",
        paramName: "Nazwa parametru:",
        actionName: "Nazwa akcji:",
        funcName: "Nazwa FUNC:",
        rename: "Nowa nazwa:",
        confirmDelete: "Usunąć \"{name}\"?",
      },
    },
  },
  de: {
    nav: { scenarios: "Szenarien" },
    scenarios: {
      title: "Test-Szenarien",
      subtitle: "OQL-Testszenarien erstellen und bearbeiten mit Syntaxhervorhebung und Vorschau.",
      loading: "Szenario wird geladen…",
      saveError: "Speichern fehlgeschlagen",
      saved: "Szenario gespeichert",
      loadError: "Szenario konnte nicht geladen werden",
      connected: "Verbunden",
      disconnected: "Getrennt",
      protocol: "Protokoll-Ansicht",
      terminal: "Terminal",
      report: "Bericht",
      loadReport: "data.json laden",
    },
    role: { readonly: "Nur-Lese-Modus — Bearbeitung für diese Rolle deaktiviert" },
    editors: {
      placeholderHint: "Editor aus maskservice eingebettet. React-Neuimplementierung läuft — URL-Parameter und Backend-Verbindung sind aktiv.",
      dslEditorDesc: "Low-Level DSL-Editor für Szenario-Payloads.",
      funcEditorDesc: "Wiederverwendbare Funktionsdefinitionen zwischen Szenarien.",
      libraryEditorDesc: "Szenariovorlagen und gerätespezifische Bibliotheken.",
      mapEditorDesc: "Geräte-/Signal-Zuordnungen zwischen Szenarien und Hardware.",
      scenarioEditorDesc: "Vollständiger visueller Szenario-Editor (Ziele + Schritte + Assertions).",
      operatorParametersDesc: "Bearbeitung von Szenarioparametern für den Testoperator.",
    },
    library: {
      title: "Bibliotheks-Editor",
      subtitle: "DSL-Objekte, Funktionen und Parameter verwalten, die in Szenarien verwendet werden.",
      objects: "Objekte",
      functions: "Funktionen",
      params: "Parameter",
      type: "Typ",
      name: "Name",
      units: "Einheiten",
      actions: "Aktionen",
      add: "Hinzufügen",
      delete: "Löschen",
      loading: "Bibliothekselemente werden geladen…",
      loadError: "Bibliothekselemente konnten nicht geladen werden",
      confirmDelete: "Dieses Element löschen?",
      deleteError: "Element konnte nicht gelöscht werden",
      noItems: "Keine Elemente gefunden",
      newNamePlaceholder: "Neuer Name",
      unitsPlaceholder: "Einheiten (z. B. s, min, °C)",
      filterNamePlaceholder: "Nach Name filtern",
      filterUnitsPlaceholder: "Nach Einheiten filtern",
    },
    mapEditor: {
      title: "MAP-Editor",
      subtitle: "Bearbeite MAP-Zuordnungen zwischen DSL-Objekten, Parametern, Aktionen und Runtime-Handlern.",
      save: "Speichern",
      reload: "Neu laden",
      add: "Hinzufügen",
      format: "Formatieren",
      filter: "Szenarien filtern…",
      sortDateDesc: "Datum (neueste)",
      sortDateAsc: "Datum (älteste)",
      sortNameAsc: "Name (A→Z)",
      sortNameDesc: "Name (Z→A)",
      noScenario: "Wähle ein Szenario aus der Liste.",
      objectsDesc: "Objekt → Aktion Zuordnungen",
      paramsDesc: "Parameter → Sensor Zuordnungen",
      actionsDesc: "Globale Aktionszuordnungen",
      funcsDesc: "FUNC-Implementierungen",
      jsonDesc: "Rohes MAP-JSON",
      emptyObjects: "Keine Objekte definiert",
      emptyParams: "Keine Parameter definiert",
      emptyActions: "Keine Aktionen definiert",
      emptyFuncs: "Keine Funktionen definiert",
      tabs: {
        objects: "Objekte",
        params: "Parameter",
        actions: "Aktionen",
        funcs: "FUNC",
        json: "JSON",
      },
      prompts: {
        objectName: "Objektname:",
        paramName: "Parametername:",
        actionName: "Aktionsname:",
        funcName: "FUNC-Name:",
        rename: "Neuer Name:",
        confirmDelete: "\"{name}\" löschen?",
      },
    },
  },
};

const I18nContext = createContext();

function getInitialLang(forced) {
  if (forced && dictionaries[forced]) return forced;
  try {
    const saved = localStorage.getItem("lang");
    if (saved && dictionaries[saved]) return saved;
  } catch {}
  const browser = navigator.language?.slice(0, 2);
  return dictionaries[browser] ? browser : "pl";
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.lang] When provided (e.g. from the URL ?lang= param),
 *                              overrides browser + localStorage detection.
 */
export function I18nProvider({ children, lang: forcedLang }) {
  const [lang, setLangState] = useState(() => getInitialLang(forcedLang));

  // React to parent-driven lang changes (URL param)
  useEffect(() => {
    if (forcedLang && dictionaries[forcedLang] && forcedLang !== lang) {
      setLangState(forcedLang);
    }
  }, [forcedLang, lang]);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch {}
  }, []);

  const dict = dictionaries[lang] || dictionaries.en;

  const t = useCallback((key, vars) => {
    const keys = key.split(".");
    let val = dict;
    for (const k of keys) {
      val = val?.[k];
      if (val === undefined) return key;
    }
    if (typeof val === "string" && vars) {
      return val.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    }
    return val;
  }, [dict]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, SUPPORTED_LANGS: Object.keys(dictionaries) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
