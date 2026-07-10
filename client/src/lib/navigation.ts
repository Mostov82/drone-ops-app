// Single source of truth for the app's module routes and nav order.
// Order mirrors the operator's mental flow (intent DO-003 context notes):
// Dashboard → what you have (Compliance, Fleet) → flying (Airspace, Missions,
// Checklists) → records (Maintenance, Flight Log) → Settings last.

/** i18n key suffix under "nav.", route path, and the delivery phase of the real module. */
export interface ModuleNavItem {
  key: string;
  path: string;
  phase: number;
}

// Phases per the PRD §8 delivery plan.
export const MODULE_NAV_ITEMS: readonly ModuleNavItem[] = [
  { key: "dashboard", path: "/", phase: 5 },
  { key: "compliance", path: "/compliance", phase: 1 },
  { key: "fleet", path: "/fleet", phase: 1 },
  { key: "airspace", path: "/airspace", phase: 2 },
  { key: "map", path: "/map", phase: 2 }, // DO-012 — offline map (FR-C1); real page, not a placeholder
  { key: "missions", path: "/missions", phase: 3 },
  { key: "checklists", path: "/checklists", phase: 3 },
  { key: "maintenance", path: "/maintenance", phase: 4 },
  { key: "flightLog", path: "/flight-log", phase: 3 },
] as const;

export const SETTINGS_PATH = "/settings";
