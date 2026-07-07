// Hebrew shell strings — pending human review (Jonathan), per intent DO-003 escalation trigger 3.
// Flat keys, one per line, mirroring en.ts. `satisfies` below enforces key parity with English.
// Strings whose aviation/regulatory terminology I could not assert confidently carry a
// "[HE?] " prefix — replace the whole value when reviewing; the prefix is intentionally visible.
import type en from "./en";

const he = {
  // Application chrome
  "app.title": "תפעול רחפנים",

  // Navigation
  "nav.ariaLabel": "ניווט ראשי",
  "nav.dashboard": "לוח בקרה",
  // "Compliance" as a regulatory module name — uncertain terminology, flagged for review:
  "nav.compliance": "[HE?] ציות ורגולציה",
  "nav.fleet": "צי כלים",
  "nav.airspace": "מרחב אווירי",
  "nav.missions": "משימות",
  "nav.checklists": "רשימות תיוג",
  "nav.maintenance": "תחזוקה",
  "nav.flightLog": "יומן טיסות",
  "nav.settings": "הגדרות",

  // Placeholder pages
  "placeholder.comingInPhase": "ייבנה בשלב {{phase}}",
  "placeholder.description": "מודול זה הוא חלק מהיקף גרסה 1 המלאה וייבנה בשלב מאוחר יותר.",
  "placeholder.backToDashboard": "חזרה ללוח הבקרה",

  // Dashboard placeholder extras
  "dashboard.thisWeek": "השבוע",
  "dashboard.workday": "יום עבודה",
  "dashboard.weekend": "סוף שבוע",

  // Settings page
  "settings.language.label": "שפה",
  "settings.language.en": "English",
  "settings.language.he": "עברית",
  "settings.units.label": "יחידות מידה",
  "settings.units.metric": "מטרי",
  "settings.units.note": "גרסה 1 תומכת ביחידות מטריות בלבד.",
  "settings.alerts.title": "זמני התראה מראש",
  "settings.alerts.description":
    "מספר הימים לפני מועד תפוגה שבהם תופעל כל רמת אזהרה. הערכים נשמרים כעת; מנגנון ההתראות ייבנה בשלב מאוחר יותר.",
  "settings.alerts.first": "אזהרה ראשונה (ימים)",
  "settings.alerts.second": "אזהרה שנייה (ימים)",
  "settings.alerts.final": "אזהרה אחרונה (ימים)",
  "settings.save": "שמירה",
  "settings.saved": "נשמר",
  "settings.saveError": "לא ניתן לשמור את ההגדרות.",
  "settings.loadError": "לא ניתן לטעון את ההגדרות מהשרת. מוצגים ערכי ברירת מחדל.",
} satisfies Record<keyof typeof en, string>;

export default he;
