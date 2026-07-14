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
  // Rule labels human-reviewed by Jonathan 2026-07-10 (see decision log) —
  // "[HE?]" prefixes removed. Register choices: מינימלי/מקסימלי over
  // מזערי/מרבי; VLOS grounded in AIP א'-17 appendix ג' (קשר־עין).
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
  "ruleset.rule.max_altitude_agl_m": "גובה טיסה מרבי מעל פני הקרקע (AGL)",
  "ruleset.rule.min_distance_people_structures_m": "מרחק מינימלי מאנשים וממבנים",
  "ruleset.rule.airport_buffer_km": "רדיוס חיץ סביב שדות תעופה",
  "ruleset.rule.vlos_required": "נדרש קשר עין רציף עם כלי הטיס (VLOS)",
  "ruleset.rule.daylight_only": "טיסה בשעות האור בלבד",
  "ruleset.rule.min_registration_age_years": "גיל מינימלי לרישום",
  "ruleset.rule.moc_frequency_license_required": "נדרש רישיון להקצאת תדר ממשרד התקשורת",
  "ruleset.rule.permit_fee_recreational_nis": "אגרת היתר טיסת פנאי",
  "ruleset.rule.permit_turnaround_hours_min": "זמן טיפול בהיתר (מינימלי)",
  "ruleset.rule.permit_turnaround_hours_max": "זמן טיפול בהיתר (מקסימלי)",
  "ruleset.rule.registration_weight_threshold_g": "סף משקל המראה לחובת רישום",
  "ruleset.rule.cvfr_lane_halfwidth_km": "[HE?] חצי רוחב מסדרון נתיב טיסה (CVFR)",

  // Offline map & elevation (DO-012, FR-C1/C2/C5).
  // "[HE?]"-prefixed terms are new regulatory-adjacent coinage awaiting
  // Jonathan's review (terrain-elevation terminology feeds DO-015's AGL/AMSL
  // vertical-separation language). Full list in the DO-012 session log.
  "nav.map": "מפה",
  "map.title": "מפה",
  "map.description": "מפת ישראל ללא חיבור לרשת. לחיצה על המפה או הזנת קואורדינטות מציבה סיכה.",
  "map.loading": "טוען את מצב המפה…",
  "map.statusError": "לא ניתן לקבל את מצב המפה מהשרת המקומי.",
  "map.missing.title": "חבילת אריחי המפה אינה מותקנת",
  "map.missing.body":
    "[HE?] חבילת אריחי מפה לשימוש לא מקוון אינה מותקנת. ניתן לבנות אותה לשימוש בשטח ללא חיבור לפי ההוראות בקובץ README. בינתיים, האפליקציה פועלת באמצעות אריחים מקוונים כאשר קיים חיבור לרשת.",
  "map.missing.vectorBody":
    "[HE?] חבילת האריחים המותקנת מכילה אריחים וקטוריים שהאפליקציה אינה יכולה להציג. יש לבנות אותה מחדש כאריחי תמונה (PNG) לפי ההוראות ב-README לשימוש לא מקוון.",
  "map.missing.recheck": "בדיקה חוזרת",
  "map.status.offline": "[HE?] חבילת מפות לא מקוונת",
  "map.status.online": "[HE?] מחובר — דורש חיבור אינטרנט",
  "map.status.noSource": "[HE?] אין מקור מפה",
  "map.unavailable.title": "[HE?] מפה לא זמינה",
  "map.unavailable.body": "[HE?] אין נתוני מפה לא מקוונים במכשיר זה ואין חיבור רשת. המפה תיטען באופן אוטומטי כאשר החיבור יתחדש.",
  "map.settings.overrideLabel": "[HE?] מקור מפה",
  "map.settings.mode.auto": "[HE?] אוטומטי (העדף לא מקוון)",
  "map.settings.mode.offline": "[HE?] לא מקוון בלבד",
  "map.settings.mode.online": "[HE?] מקוון בלבד",
  "map.entry.label": "קואורדינטות (עשרוני או DMS)",
  // Example coordinates are LTR data — identical in both locales.
  "map.entry.placeholder": `31.771959, 35.217018 or 31° 46' 19.05" N, 35° 13' 1.26" E`,
  "map.entry.go": "הזזת הסיכה",
  "map.entry.error": "לא ניתן לפענח את הקואורדינטות — יש להשתמש במעלות עשרוניות או ב-DMS.",
  "map.pin.title": "הנקודה המסומנת",
  "map.pin.none": "אין סיכה עדיין — יש ללחוץ על המפה או להזין קואורדינטות.",
  "map.pin.decimal": "עשרוני",
  "map.pin.dms": "מעלות־דקות־שניות (DMS)",
  "map.elevation.label": "[HE?] גובה פני הקרקע",
  "map.elevation.loading": "בודק גובה…",
  "map.elevation.value": "{{value}} מ׳",
  "map.elevation.approximate": "משוער",
  "map.elevation.approximateNote":
    "[HE?] מבוסס על מודל פני שטח ברזולוציה של כ-30 מ׳ (סטייה אופיינית ±4 מ׳). לעולם אינו מדויק; תכנון חייב לעגל באופן שמרני.",
  "map.elevation.missing":
    "[HE?] נתוני הגובה אינם זמינים במצב לא מקוון. הם יורדו באופן אוטומטי כאשר יהיה חיבור לרשת.",
  "map.elevation.downloading":
    "[HE?] מוריד נתוני גובה: {{downloaded}}/{{total}} אריחים ({{progress}}%)...",
  "map.elevation.downloadFailed": "[HE?] הורדת נתוני גובה נכשלה: {{error}}",
  "map.elevation.downloadRetry": "[HE?] נסה שוב",
  "map.elevation.downloadOffline":
    "[HE?] הורדת נתוני הגובה תושלם באופן אוטומטי כאשר יהיה חיבור לרשת.",
  "map.elevation.outOfCoverage": "מחוץ לאריחי הגובה המותקנים.",
  "map.elevation.error": "בדיקת הגובה נכשלה.",
  "map.crosscheck.run": "בדיקה צולבת מקוונת",
  "map.crosscheck.failed": "הבדיקה הצולבת המקוונת אינה זמינה (אין חיבור לרשת, או שהספק לא השיב).",
  "map.crosscheck.note":
    "בדיקת אימות מקוונת אופציונלית באמצעות Open Topo Data‏ (SRTM ‏30 מ׳). מופעלת רק בלחיצה על הכפתור.",
  // OSM data attribution (ODbL) — kept in Latin script in both locales.
  "map.attributionFallback": "© OpenStreetMap contributors",

  // Zone overlays, legend, layer toggles (DO-014, FR-C1/FR-C4).
  // "[HE?]"-prefixed terms are new regulatory-adjacent coinage awaiting
  // Jonathan's review (verdict tier names, AIP altitude terminology — these
  // feed DO-015's verdict language too). Full list in the DO-014 session log.
  "map.zones.title": "שכבות אזורים",
  "map.zones.loading": "טוען שכבות אזורים…",
  "map.zones.error": "לא ניתן לטעון את שכבות האזורים מהשרת המקומי.",
  "map.zones.empty.title": "לא יובאו נתוני אזורים",
  "map.zones.empty.body":
    "[HE?] שכבות האזורים חסרות או בייבוא כעת. הן ייובאו באופן אוטומטי בהפעלה כאשר יהיו זמינות.",
  "map.zones.layerZoneCount": "{{n}} אזורים",
  "map.zones.imported": "יובא בתאריך {{date}}",
  "map.zones.unverifiedNote":
    "[HE?] נתוני האזורים טרם אומתו חזותית מול המפות הרשמיות — יש להתייחס לכל שכבה כאל לא מאומתת.",
  "map.zones.legend.title": "מקרא",
  "map.zones.legend.lane": "[HE?] נתיב טיסה (CVFR)",
  "map.zones.legend.clearContext":
    "[HE?] נקודה ללא אזור = פנויה — המגבלות הרגולטוריות הרגילות עדיין חלות.",
  "map.zones.verdict.RESTRICTED": "[HE?] אסור לטיסה",
  "map.zones.verdict.NEEDS_PERMIT": "[HE?] נדרש היתר",
  "map.zones.verdict.CLEAR": "[HE?] פנוי",
  "map.zones.popup.band": "[HE?] רצועת גובה",
  "map.zones.popup.directional": "[HE?] גבהים לפי כיוון (כפי שפורסמו)",
  "map.zones.popup.envelopeNote":
    "[HE?] הרצועה המוצגת היא מעטפת מינימום/מקסימום של הגבהים הכיווניים שפורסמו.",
  "map.zones.popup.source": "מקור",
  // Altitude-band value texts — semantics per server/docs/zones-api.md.
  "map.zones.band.range": "{{floor}} – {{ceiling}}",
  "map.zones.band.ground": "[HE?] פני הקרקע (GND)",
  "map.zones.band.unbounded": "[HE?] ללא הגבלת גובה (UNL)",
  "map.zones.band.amsl": "[HE?] {{ft}} רגל מעל פני הים (AMSL)",
  "map.zones.band.agl": "[HE?] {{ft}} רגל מעל פני הקרקע (AGL) — כפי שפורסם",
  "map.zones.band.notPublished": "לא פורסם",
  "map.zones.band.noVerticalClaim": "[HE?] לא פורסמה רצועת גובה",

  // Location-check verdict panel (DO-015, FR-C2/C3/C5/C6).
  // "[HE?]"-prefixed terms are aeronautical/regulatory coinage awaiting
  // Jonathan's review (buffer/corridor/AMSL/AGL/vertical-separation language),
  // matching the DO-012/DO-014 convention. Plain UI chrome is translated
  // directly. Verdict-tier and altitude-band names are reused from above.
  "map.check.title": "בדיקת מיקום",
  "map.check.prompt": "יש להציב סיכה על המפה או להזין קואורדינטות, ואז לבדוק אם מותר לטוס שם.",
  "map.check.altitude.label": "גובה טיסה מתוכנן (לא חובה)",
  "map.check.altitude.placeholder": "לדוגמה: 50",
  "map.check.altitude.hint": "מטרים מעל פני הקרקע. יש להשאיר ריק לבדיקה אופקית בלבד.",
  "map.check.altitude.error": "יש להזין גובה מתוכנן כמספר מטרים לא-שלילי.",
  "map.check.run": "בדיקת מיקום",
  "map.check.running": "בודק…",
  "map.check.checkedAt": "נבדק {{date}}",
  "map.check.error.title": "לא ניתן היה להשלים את בדיקת המיקום",
  "map.check.error.generic": "הבדיקה נכשלה. שום דבר כאן אינו קביעה — יש לנסות שוב.",
  "map.check.clear.body":
    "אף אזור אינו מכיל נקודה זו. המגבלות הרגולטוריות הרגילות שלהלן עדיין חלות.",
  "map.check.units.m": "מ׳",
  "map.check.reasons.title": "סיבה",
  "map.check.reasonKind.POINT_IN_ZONE": "הנקודה נמצאת בתוך אזור זה",
  "map.check.reasonKind.WITHIN_AIRPORT_BUFFER_RULE": "[HE?] בתוך רדיוס החיץ סביב שדה תעופה / מנחת",
  "map.check.reasonKind.WITHIN_LANE_CORRIDOR": "[HE?] בתוך מסדרון נתיב הטיסה",
  "map.check.reasonKind.CVFR_OVERHEAD": "[HE?] נתיב טיסה (CVFR) ממעל",
  "map.check.vertical.label": "[HE?] אנכי",
  "map.check.vertical.status.CONFLICT": "[HE?] הגובה המתוכנן מתנגש עם רצועת הגובה של האזור",
  "map.check.vertical.status.BELOW_FLOOR": "[HE?] הגובה המתוכנן נמוך מרצפת הרצועה",
  "map.check.vertical.status.ABOVE_CEILING": "[HE?] הגובה המתוכנן גבוה מתקרת הרצועה",
  "map.check.vertical.status.NO_CLAIM": "[HE?] לא פורסמה רצועת גובה — אין קביעה אנכית",
  "map.check.vertical.clearance": "[HE?] מרווח {{ft}} רגל",
  "map.check.vertical.groundReaching": "[HE?] מגיע לפני הקרקע",
  "map.check.vertical.unbounded": "[HE?] ללא הגבלת גובה (UNL)",
  "map.check.vertical.title": "[HE?] הפרדה אנכית",
  "map.check.vertical.plannedLabel": "גובה מתוכנן",
  "map.check.vertical.aglUnit": "[HE?] מ׳ מעל פני הקרקע (AGL)",
  "map.check.vertical.interval": "[HE?] מושווה כ־",
  "map.check.vertical.ftAmsl": "[HE?] רגל מעל פני הים (AMSL)",
  "map.check.vertical.conservativeNote":
    "[HE?] גובה פני הקרקע משוער, ולכן הגובה המושווה מורחב בטווח אי-הוודאות — התנגשויות לעולם אינן מצומצמות.",
  "map.check.vertical.allowedHeightAdvisory": "[HE?] נתיב טיסה (CVFR) ממעל — גובה מותר עד {{height}} מ׳ מעל פני השטח (מקורב)",
  "map.check.vertical.noAltitude": "יש להזין גובה מתוכנן למעלה כדי לבדוק הפרדה אנכית.",
  "map.check.distance.title": "מרחקים",
  "map.check.distance.nearestAirport": "שדה תעופה / מנחת קרוב",
  "map.check.distance.bufferWarning": "[HE?] בתוך רדיוס החיץ של {{name}} (רדיוס {{m}} מ׳).",
  "map.check.distance.insideImportedBuffer": "[HE?] בתוך מצולע חיץ שדה התעופה המיובא.",
  "map.check.lanes.title": "[HE?] נתיבי טיסה (CVFR)",
  "map.check.lanes.nearest": "[HE?] הנתיב הקרוב",
  "map.check.lanes.centerlineDistance": "[HE?] מרחק מקו המרכז",
  "map.check.lanes.withinCorridor": "[HE?] בתוך מסדרון הנתיב",
  "map.check.context.title": "המגבלות הרגילות עדיין חלות",
  "map.check.context.imported": "הערכים נקראו {{date}}.",
  "map.check.dq.notAuthoritative":
    "[HE?] מידע המתוחזק בידי המפעיל — אינו ייעוץ משפטי או אישור פיקוח טיסה. יש לאמת מול המפות הרשמיות וה-NOTAM לפני טיסה.",
  "map.check.dq.unverifiedLayers": "[HE?] שכבות אזורים לא מאומתות: {{layers}}.",
  "map.check.dq.unverifiedRules": "[HE?] ערכים רגולטוריים לא מאומתים: {{rules}}.",
  "map.check.dq.elevationApproximate":
    "[HE?] גובה פני הקרקע משוער (כ-±4 מ׳); הממצאים האנכיים מורחבים באופן שמרני.",

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
