import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import i18n, {
  applyLanguageToDocument,
  DEFAULT_LANGUAGE,
  initI18n,
  isAppLanguage,
} from "./i18n";
import { fetchAuthStatus } from "./lib/auth-api";
import "./index.css";

async function bootstrap() {
  // The open status endpoint reports auth state AND the saved UI language, so
  // the PIN gate renders in the right language before any authenticated API
  // (including settings) is reachable. Fall back to defaults if the server is
  // down so the gate still renders and can show its error.
  const auth = await fetchAuthStatus().catch(() => null);
  const language = auth && isAppLanguage(auth.language) ? auth.language : DEFAULT_LANGUAGE;

  await initI18n(language);
  applyLanguageToDocument(language);
  i18n.on("languageChanged", applyLanguageToDocument);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App initialAuthState={auth?.status ?? "locked"} />
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
