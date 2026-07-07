import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import i18n, { applyLanguageToDocument, DEFAULT_LANGUAGE, initI18n } from "./i18n";
import { loadSettings } from "./lib/settings-api";
import { MODULE_NAV_ITEMS, SETTINGS_PATH } from "./lib/navigation";
import DashboardPage from "./pages/DashboardPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import SettingsPage from "./pages/SettingsPage";
import "./index.css";

async function bootstrap() {
  // Language persists via the Setting model (DO-002); fall back to the default
  // when the server is unreachable so the shell still renders.
  const settings = await loadSettings().catch(() => null);
  const language = settings?.language ?? DEFAULT_LANGUAGE;

  await initI18n(language);
  applyLanguageToDocument(language);
  i18n.on("languageChanged", applyLanguageToDocument);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            {MODULE_NAV_ITEMS.filter((item) => item.path !== "/").map((item) => (
              <Route key={item.key} path={item.path} element={<PlaceholderPage item={item} />} />
            ))}
            <Route path={SETTINGS_PATH} element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
