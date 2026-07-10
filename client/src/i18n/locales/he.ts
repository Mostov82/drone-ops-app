// Hebrew shell strings — reviewed and approved by Jonathan, 2026-07-07 (see work/decision-log.md).
// Flat keys, one per line, mirroring en.ts. `satisfies` below enforces key parity with English.
// Convention for future strings: terminology an agent cannot assert confidently carries a
// visible "[HE?] " prefix until human review — never guess regulatory terms.
import type en from "./en";

const he = {
  // Application chrome
  "app.title": "תפעול רחפנים",

  // Navigation
  "nav.ariaLabel": "ניווט ראשי",
  "nav.dashboard": "לוח בקרה",
  "nav.compliance": "רישוי ורגולציה",
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

  // Backup & restore (DO-004)
  "backup.title": "גיבוי",
  "backup.description": "יוצר קובץ ארכיון יחיד של מסד הנתונים וכל המסמכים בתיקייה שתבחר.",
  "backup.destLabel": "תיקיית יעד",
  "backup.destPlaceholder": "לדוגמה: D:\\Backups",
  "backup.run": "צור גיבוי",
  "backup.success": "הגיבוי נוצר:",
  "backup.error": "הגיבוי נכשל.",
  "restore.title": "שחזור",
  "restore.description": "מחליף את כל הנתונים הקיימים בתוכן של קובץ גיבוי. פעולה זו אינה הפיכה.",
  "restore.archiveLabel": "נתיב קובץ הגיבוי",
  "restore.archivePlaceholder": "לדוגמה: D:\\Backups\\drone-ops-backup_2026-07-07_2030.zip",
  "restore.run": "שחזר מגיבוי",
  "restore.confirmPrompt": "השחזור יחליף לצמיתות את כל הנתונים והמסמכים הקיימים בתוכן הגיבוי. להמשיך?",
  "restore.success": "השחזור הושלם. טוען מחדש…",
  "restore.error": "השחזור נכשל.",

  // Regulations Ruleset editor (DO-010, FR-A5)
  // Rule labels carry regulatory terminology not yet human-reviewed → "[HE?] "
  // prefix per the standing convention above; listed for review in the
  // DO-010 session log.
  "ruleset.entry.title": "מאגר כללי רגולציה",
  "ruleset.entry.description":
    "מגבלות רגולטוריות, היסטוריית שינויים ותאריכי אימות. כל המודולים קוראים את המגבלות מכאן.",
  "ruleset.entry.open": "פתיחת עורך הכללים",
  "ruleset.title": "מאגר כללי רגולציה",
  "ruleset.description":
    "שינוי כלל כאן הוא עריכת נתונים — ללא שינוי קוד. ערכים המסומנים כלא מאומתים טרם אושרו מול מקורות רשמיים.",
  "ruleset.backToSettings": "חזרה להגדרות",
  "ruleset.loadError": "לא ניתן לטעון את מאגר הכללים מהשרת.",
  "ruleset.unverified": "לא מאומת",
  "ruleset.verifiedOn": "אומת {{date}}",
  "ruleset.markVerified": "סימון כמאומת",
  "ruleset.edit": "עריכה",
  "ruleset.save": "שמירה",
  "ruleset.cancel": "ביטול",
  "ruleset.valueLabel": "ערך",
  "ruleset.noteLabel": "הערת שינוי (לא חובה)",
  "ruleset.saveError": "לא ניתן לשמור את השינוי.",
  "ruleset.verifyError": "לא ניתן לסמן את הכלל כמאומת.",
  "ruleset.history.show": "היסטוריה",
  "ruleset.history.hide": "הסתרת היסטוריה",
  "ruleset.history.empty": "לא נרשמו שינויים.",
  "ruleset.value.true": "כן",
  "ruleset.value.false": "לא",
  "ruleset.value.unset": "לא נקבע",
  "ruleset.category.ALTITUDE": "גובה",
  "ruleset.category.DISTANCE": "מרחקים",
  "ruleset.category.OPERATIONAL": "תפעול",
  "ruleset.category.LICENSING": "רישוי",
  "ruleset.category.PERMITS": "היתרים",
  "ruleset.category.WEIGHT": "משקל",
  "ruleset.rule.max_altitude_agl_m": "[HE?] גובה טיסה מרבי מעל פני הקרקע",
  "ruleset.rule.min_distance_people_structures_m": "[HE?] מרחק מזערי מאנשים וממבנים",
  "ruleset.rule.airport_buffer_km": "[HE?] רדיוס חיץ סביב שדות תעופה",
  "ruleset.rule.vlos_required": "[HE?] נדרש קשר עין רציף עם הכלי",
  "ruleset.rule.daylight_only": "[HE?] טיסה באור יום בלבד",
  "ruleset.rule.min_registration_age_years": "[HE?] גיל מזערי לרישום",
  "ruleset.rule.moc_frequency_license_required": "[HE?] נדרש רישיון תדר ממשרד התקשורת",
  "ruleset.rule.permit_fee_recreational_nis": "[HE?] אגרת היתר טיסת פנאי",
  "ruleset.rule.permit_turnaround_hours_min": "[HE?] זמן טיפול בהיתר (מזערי)",
  "ruleset.rule.permit_turnaround_hours_max": "[HE?] זמן טיפול בהיתר (מרבי)",
  "ruleset.rule.registration_weight_threshold_g": "[HE?] סף משקל לחובת רישום",

  // PIN login (DO-005)
  "auth.setupTitle": "בחירת קוד PIN",
  "auth.setupDescription": "קוד ה-PIN נועל את האפליקציה במחשב זה. יש להשתמש ב-4 עד 12 ספרות.",
  "auth.loginTitle": "הזנת קוד PIN",
  "auth.pinLabel": "קוד PIN",
  "auth.confirmPinLabel": "אימות קוד PIN",
  "auth.setPin": "קביעת קוד PIN",
  "auth.unlock": "כניסה",
  "auth.pinMismatch": "קודי ה-PIN אינם תואמים.",
  "auth.serverError": "לא ניתן להתחבר לשרת המקומי.",
  "auth.resetHint": "שכחת את הקוד? פקודת האיפוס מתועדת בקובץ README.",
  "auth.changeTitle": "החלפת קוד PIN",
  "auth.currentPinLabel": "קוד PIN נוכחי",
  "auth.newPinLabel": "קוד PIN חדש",
  "auth.confirmNewPinLabel": "אימות קוד PIN חדש",
  "auth.changeSubmit": "החלפת קוד",
  "auth.changed": "קוד ה-PIN הוחלף.",

  // Dev-only upload test page (DO-005 scaffolding; replaced by the vault, DO-009)
  "devUploads.title": "בדיקת העלאת מסמכים",
  "devUploads.devOnly": "עמוד לפיתוח בלבד — כספת המסמכים האמיתית תיבנה בשלב 1.",
  "devUploads.upload": "העלאה",
  "devUploads.empty": "אין מסמכים שמורים.",
  "devUploads.view": "צפייה",
  "devUploads.delete": "מחיקה",
  "devUploads.uploaded": "הועלה.",
  "devUploads.deleted": "נמחק.",
} satisfies Record<keyof typeof en, string>;

export default he;
