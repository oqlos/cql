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
