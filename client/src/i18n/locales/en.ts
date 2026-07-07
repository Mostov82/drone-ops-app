// English shell strings.
// Flat keys ("group.name"), one per line, for easy human editing (intent DO-003).
// Module-feature strings arrive with their modules — only shell strings live here.
const en = {
  // Application chrome
  "app.title": "Drone Operations",

  // Navigation — order in the UI: Dashboard → Settings (intent DO-003 context notes)
  "nav.ariaLabel": "Main navigation",
  "nav.dashboard": "Dashboard",
  "nav.compliance": "Compliance",
  "nav.fleet": "Fleet",
  "nav.airspace": "Airspace",
  "nav.missions": "Missions",
  "nav.checklists": "Checklists",
  "nav.maintenance": "Maintenance",
  "nav.flightLog": "Flight Log",
  "nav.settings": "Settings",

  // Placeholder pages for not-yet-built modules
  "placeholder.comingInPhase": "Coming in Phase {{phase}}",
  "placeholder.description":
    "This module is part of the full V1 scope and will be built in a later phase.",
  "placeholder.backToDashboard": "Back to Dashboard",

  // Dashboard placeholder extras — demonstrates the Sun–Thu week helper
  "dashboard.thisWeek": "This week",
  "dashboard.workday": "Workday",
  "dashboard.weekend": "Weekend",

  // Settings page
  "settings.language.label": "Language",
  // Language option labels are shown in their own language in BOTH locales (standard practice).
  "settings.language.en": "English",
  "settings.language.he": "עברית",
  "settings.units.label": "Units",
  "settings.units.metric": "Metric",
  "settings.units.note": "V1 is metric-only.",
  "settings.alerts.title": "Alert lead times",
  "settings.alerts.description":
    "Days before an expiry at which each warning tier is raised. Stored now; the alerts engine arrives in a later phase.",
  "settings.alerts.first": "First warning (days)",
  "settings.alerts.second": "Second warning (days)",
  "settings.alerts.final": "Final warning (days)",
  "settings.save": "Save",
  "settings.saved": "Saved",
  "settings.saveError": "Could not save settings.",
  "settings.loadError": "Could not load settings from the server. Showing defaults.",
} as const;

export default en;
