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

  // Backup & restore (DO-004)
  "backup.title": "Backup",
  "backup.description":
    "Creates a single archive of the database and all documents at the folder you choose.",
  "backup.destLabel": "Destination folder",
  "backup.destPlaceholder": "e.g. D:\\Backups",
  "backup.run": "Create backup",
  "backup.success": "Backup created:",
  "backup.error": "Backup failed.",
  "restore.title": "Restore",
  "restore.description":
    "Replaces ALL current data with the contents of a backup archive. This cannot be undone.",
  "restore.archiveLabel": "Backup archive path",
  "restore.archivePlaceholder": "e.g. D:\\Backups\\drone-ops-backup_2026-07-07_2030.zip",
  "restore.run": "Restore from backup",
  "restore.confirmPrompt":
    "Restore will permanently REPLACE all current data and documents with the backup's contents. Continue?",
  "restore.success": "Restore complete. Reloading…",
  "restore.error": "Restore failed.",

  // PIN login (DO-005)
  "auth.setupTitle": "Choose a PIN",
  "auth.setupDescription": "The PIN locks this app on this computer. Use 4–12 digits.",
  "auth.loginTitle": "Enter your PIN",
  "auth.pinLabel": "PIN",
  "auth.confirmPinLabel": "Confirm PIN",
  "auth.setPin": "Set PIN",
  "auth.unlock": "Unlock",
  "auth.pinMismatch": "The PINs do not match.",
  "auth.serverError": "Could not reach the local server.",
  "auth.resetHint": "Forgot your PIN? The README documents the reset command.",
  "auth.changeTitle": "Change PIN",
  "auth.currentPinLabel": "Current PIN",
  "auth.newPinLabel": "New PIN",
  "auth.confirmNewPinLabel": "Confirm new PIN",
  "auth.changeSubmit": "Change PIN",
  "auth.changed": "PIN changed.",

  // Dev-only upload test page (DO-005 scaffolding; replaced by the vault, DO-009)
  "devUploads.title": "Document upload test",
  "devUploads.devOnly": "Development-only page — the real document vault arrives in Phase 1.",
  "devUploads.upload": "Upload",
  "devUploads.empty": "No documents stored.",
  "devUploads.view": "View",
  "devUploads.delete": "Delete",
  "devUploads.uploaded": "Uploaded.",
  "devUploads.deleted": "Deleted.",
} as const;

export default en;
