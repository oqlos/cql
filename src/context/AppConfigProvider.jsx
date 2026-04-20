import { createContext, useContext, useEffect, useMemo } from "react";
import { useUrlConfig } from "../hooks/useUrlConfig";

const AppConfigContext = createContext(null);

export function AppConfigProvider({ children }) {
  const { config, patch } = useUrlConfig();

  // Apply theme/font/size to the document root so CSS vars react instantly.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", config.theme);
    root.setAttribute("data-font", config.font);
    root.setAttribute("data-role", config.role);
    root.setAttribute("data-lang", config.lang);
    root.style.setProperty("--viewport-size", `${config.size}px`);
  }, [config.theme, config.font, config.role, config.lang, config.size]);

  const value = useMemo(
    () => ({
      ...config,
      isAdmin: config.role === "admin",
      isOperator: config.role === "operator" || config.role === "admin",
      isReadOnly: config.role === "viewer" || config.role === "guest",
      patch,
    }),
    [config, patch]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used within AppConfigProvider");
  return ctx;
}
