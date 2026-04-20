import { useEffect, useMemo, useState, useCallback } from "react";

// Canonical set of iframe-embed params read from the URL when cql is hosted
// inside maskservice at /connect-scenario/scenarios.
// Example:
//   ?font=default&theme=dark&role=admin&lang=pl&size=1280&scenario=ts-c20
export const SUPPORTED_THEMES = ["dark", "light", "high-contrast"];
export const SUPPORTED_FONTS = ["default", "mono", "dyslexic", "large"];
export const SUPPORTED_ROLES = ["admin", "operator", "viewer", "guest"];
export const SUPPORTED_LANGS_ENUM = ["pl", "en", "de"];

const DEFAULTS = Object.freeze({
  font: "default",
  theme: "dark",
  role: "admin",
  lang: "pl",
  size: 1280,
  scenario: "",
});

function parseParams(search) {
  const params = new URLSearchParams(search);
  const out = { ...DEFAULTS };

  const font = params.get("font");
  if (font && SUPPORTED_FONTS.includes(font)) out.font = font;

  const theme = params.get("theme");
  if (theme && SUPPORTED_THEMES.includes(theme)) out.theme = theme;

  const role = params.get("role");
  if (role && SUPPORTED_ROLES.includes(role)) out.role = role;

  const lang = params.get("lang");
  if (lang && SUPPORTED_LANGS_ENUM.includes(lang)) out.lang = lang;

  const size = Number(params.get("size"));
  if (Number.isFinite(size) && size >= 320 && size <= 4096) out.size = size;

  const scenario = params.get("scenario") || params.get("scenario_id");
  if (scenario) out.scenario = scenario.trim();

  return out;
}

/**
 * Reads font/theme/role/lang/size/scenario from the current URL and keeps
 * state in sync when the history changes (e.g. parent frame postMessage or
 * browser navigation).
 */
export function useUrlConfig() {
  const [config, setConfig] = useState(() => parseParams(window.location.search));

  useEffect(() => {
    const onPop = () => setConfig(parseParams(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const patch = useCallback((partial) => {
    const url = new URL(window.location.href);
    Object.entries(partial).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") {
        url.searchParams.delete(k);
      } else {
        url.searchParams.set(k, String(v));
      }
    });
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    setConfig(parseParams(url.search));
  }, []);

  return useMemo(() => ({ config, patch }), [config, patch]);
}

export { DEFAULTS as APP_CONFIG_DEFAULTS };
