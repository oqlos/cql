import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import { AppConfigProvider, useAppConfig } from "./context/AppConfigProvider";
import "./styles/global.css";

// Thin bridge so I18nProvider picks up the lang from AppConfigProvider.
function LocalizedApp() {
  const { lang } = useAppConfig();
  return (
    <I18nProvider lang={lang}>
      <App />
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppConfigProvider>
        <LocalizedApp />
      </AppConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
