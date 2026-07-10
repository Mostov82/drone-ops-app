// Auth gate + route table. The PIN gate renders INSTEAD of the shell — no app
// content mounts (and no data fetch runs) until the session exists (DO-005).
import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { MODULE_NAV_ITEMS, SETTINGS_PATH } from "./lib/navigation";
import type { AuthState } from "./lib/auth-api";
import DashboardPage from "./pages/DashboardPage";
import DevUploadsPage from "./pages/DevUploadsPage";
import PinGate from "./pages/PinGate";
import PlaceholderPage from "./pages/PlaceholderPage";
import RulesetPage from "./pages/RulesetPage";
import SettingsPage from "./pages/SettingsPage";

export default function App({ initialAuthState }: { initialAuthState: AuthState }) {
  const [authState, setAuthState] = useState(initialAuthState);

  if (authState !== "authenticated") {
    return (
      <PinGate
        mode={authState === "uninitialized" ? "setup" : "login"}
        onAuthenticated={() => setAuthState("authenticated")}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        {MODULE_NAV_ITEMS.filter((item) => item.path !== "/").map((item) => (
          <Route key={item.key} path={item.path} element={<PlaceholderPage item={item} />} />
        ))}
        <Route path={SETTINGS_PATH} element={<SettingsPage />} />
        {/* Ruleset editor (DO-010) — entry point from Settings per FR-S3. */}
        <Route path={`${SETTINGS_PATH}/ruleset`} element={<RulesetPage />} />
        {/* Dev-only route (DO-005): absent from production builds; DO-009 replaces it. */}
        {import.meta.env.DEV && <Route path="/dev/uploads" element={<DevUploadsPage />} />}
      </Route>
    </Routes>
  );
}
