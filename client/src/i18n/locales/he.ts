// Hebrew shell strings — reviewed and approved by Jonathan, 2026-07-07.
// Flat keys, one per line, mirroring en.ts. `satisfies` below enforces key parity with English.
// Convention for future strings: terminology an agent cannot assert confidently carries a
// visible "" prefix until human review — never guess regulatory terms.
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
  // Rule labels human-reviewed by Jonathan 2026-07-10 —
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
  "ruleset.rule.cvfr_lane_halfwidth_km": "חצי רוחב מסדרון נתיב טיסה (CVFR)",

  // Offline map & elevation (DO-012, FR-C1/C2/C5).
  // Regulatory-adjacent terms reviewed & approved by Jonathan 2026-07-23 (terrain-elevation terminology feeds DO-015's AGL/AMSL
  // vertical-separation language).
  "nav.map": "מפה",
  "map.title": "מפה",
  "map.description": "מפת ישראל ללא חיבור לרשת. לחיצה על המפה או הזנת קואורדינטות מציבה סיכה.",
  "map.loading": "טוען את מצב המפה…",
  "map.statusError": "לא ניתן לקבל את מצב המפה מהשרת המקומי.",
  "map.missing.title": "חבילת אריחי המפה אינה מותקנת",
  "map.missing.body":
    "חבילת אריחי מפה לשימוש לא מקוון אינה מותקנת. ניתן לבנות אותה לשימוש בשטח ללא חיבור לפי ההוראות בקובץ README. בינתיים, האפליקציה פועלת באמצעות אריחים מקוונים כאשר קיים חיבור לרשת.",
  "map.missing.vectorBody":
    "חבילת האריחים המותקנת מכילה אריחים וקטוריים שהאפליקציה אינה יכולה להציג. יש לבנות אותה מחדש כאריחי תמונה (PNG) לפי ההוראות ב-README לשימוש לא מקוון.",
  "map.missing.recheck": "בדיקה חוזרת",
  "map.status.offline": "חבילת מפות לא מקוונת",
  "map.status.online": "מחובר — דורש חיבור אינטרנט",
  "map.status.noSource": "אין מקור מפה",
  "map.unavailable.title": "מפה לא זמינה",
  "map.unavailable.body": "אין נתוני מפה לא מקוונים במכשיר זה ואין חיבור רשת. המפה תיטען באופן אוטומטי כאשר החיבור יתחדש.",
  "map.settings.overrideLabel": "מקור מפה",
  "map.settings.mode.auto": "אוטומטי (העדף לא מקוון)",
  "map.settings.mode.offline": "לא מקוון בלבד",
  "map.settings.mode.online": "מקוון בלבד",
  // DO-035 — sidebar sections + muted base map. Reviewed by Jonathan 2026-07-23.
  "map.section.location": "בדיקת מיקום",
  "map.section.result": "תוצאת הבדיקה",
  "map.section.layers": "שכבות ומפת רקע",
  "map.settings.muted.label": "עמעום מפת הרקע",
  "map.settings.muted.hint":
    "מחליש את צבעי אריחי הרקע כדי שהאזורים יבלטו. תצוגה בלבד — אינו משנה דבר בנתונים או בתוצאת הבדיקה.",
  "map.settings.weekendView.label": "הדגשת תצורת סוף שבוע",
  "map.settings.weekendView.hint": "עמעום אזורים הפעילים באמצע שבוע בלבד והדגשת גרסאות סוף שבוע.",
  "map.settings.weekendView.caption.title": "כלי עזר לתצוגה בלבד",
  "map.settings.weekendView.caption.body": "כל תוצאות הבדיקה נותרות מחמירות (תמיד פעיל). פרסומי NOTAM והנחיות בזמן אמת גוברים על לוחות זמנים.",
  "map.entry.label": "קואורדינטות (עשרוני או DMS)",
  // Example coordinates are LTR data — identical in both locales.
  "map.entry.placeholder": `31.771959, 35.217018 or 31° 46' 19.05" N, 35° 13' 1.26" E`,
  "map.entry.go": "הזזת הסיכה",
  "map.entry.error": "לא ניתן לפענח את הקואורדינטות — יש להשתמש במעלות עשרוניות או ב-DMS.",
  "map.search.label": "חיפוש כתובת / מקום",
  "map.search.placeholder": "הזן כתובת או שם מקום (למשל צומת גולני)...",
  "map.search.go": "חיפוש",
  "map.search.offline": "חיפוש המקומות אינו זמין. בדוק את החיבור לרשת.",
  "map.search.rateLimit": "חריגה מקצב החיפוש. אנא המתן שנייה ונסה שוב.",
  "map.search.error": "חיפוש המקום נכשל.",
  "map.search.noResults": "לא נמצאו מקומות תואמים.",
  "map.search.attribution": "חיפוש מבוסס על Nominatim (תורמי OSM)",
  "map.pin.title": "הנקודה המסומנת",
  "map.pin.none": "אין סיכה עדיין — יש ללחוץ על המפה או להזין קואורדינטות.",
  "map.pin.decimal": "עשרוני",
  "map.pin.dms": "מעלות־דקות־שניות (DMS)",
  "map.elevation.label": "גובה פני הקרקע",
  "map.elevation.loading": "בודק גובה…",
  "map.elevation.value": "{{value}} מ׳",
  "map.elevation.approximate": "משוער",
  "map.elevation.approximateNote":
    "מבוסס על מודל פני שטח ברזולוציה של כ-30 מ׳ (סטייה אופיינית ±4 מ׳). לעולם אינו מדויק; תכנון חייב לעגל באופן שמרני.",
  "map.elevation.missing":
    "נתוני הגובה אינם זמינים במצב לא מקוון. הם יורדו באופן אוטומטי כאשר יהיה חיבור לרשת.",
  "map.elevation.downloading":
    "מוריד נתוני גובה: {{downloaded}}/{{total}} אריחים ({{progress}}%)...",
  "map.elevation.downloadFailed": "הורדת נתוני גובה נכשלה: {{error}}",
  "map.elevation.downloadRetry": "נסה שוב",
  "map.elevation.downloadOffline":
    "הורדת נתוני הגובה תושלם באופן אוטומטי כאשר יהיה חיבור לרשת.",
  "map.elevation.outOfCoverage": "מחוץ לאריחי הגובה המותקנים.",
  "map.elevation.error": "בדיקת הגובה נכשלה.",
  "map.crosscheck.run": "בדיקה צולבת מקוונת",
  "map.crosscheck.failed": "הבדיקה הצולבת המקוונת אינה זמינה (אין חיבור לרשת, או שהספק לא השיב).",
  "map.crosscheck.note":
    "בדיקת אימות מקוונת אופציונלית באמצעות Open Topo Data‏ (SRTM ‏30 מ׳). מופעלת רק בלחיצה על הכפתור.",
  // OSM data attribution (ODbL) — kept in Latin script in both locales.
  "map.attributionFallback": "© OpenStreetMap contributors",

  // Zone overlays, legend, layer toggles (DO-014, FR-C1/FR-C4).
  // Regulatory-adjacent terms reviewed & approved by Jonathan 2026-07-23 (verdict tier names, AIP altitude terminology — these
  // feed DO-015's verdict language too).
  "map.zones.title": "שכבות אזורים",
  "map.zones.loading": "טוען שכבות אזורים…",
  "map.zones.error": "לא ניתן לטעון את שכבות האזורים מהשרת המקומי.",
  "map.zones.empty.title": "לא יובאו נתוני אזורים",
  "map.zones.empty.body":
    "שכבות האזורים חסרות או בייבוא כעת. הן ייובאו באופן אוטומטי בהפעלה כאשר יהיו זמינות.",
  "map.zones.layerZoneCount": "{{n}} אזורים",
  "map.zones.imported": "יובא בתאריך {{date}}",
  "map.zones.unverifiedNote":
    "נתוני האזורים טרם אומתו חזותית מול המפות הרשמיות — יש להתייחס לכל שכבה כאל לא מאומתת.",
  "map.zones.legend.title": "מקרא",
  "map.zones.legend.lane": "נתיב טיסה (CVFR)",
  "map.zones.legend.clearContext":
    "נקודה ללא אזור = פנויה — המגבלות הרגולטוריות הרגילות עדיין חלות.",
  "map.zones.legend.disclaimer":
    "הסימון לעיל הוא ייחודי לאפליקציה ושונה מהסימונים במפות רת\"א הרשמיות.",
  "map.zones.legend.family.RESTRICTED": "מרחב אווירי אסור לטיסה",
  "map.zones.legend.family.NEEDS_PERMIT": "מרחב אווירי טעון אישור",
  "map.zones.legend.family.CLEAR": "מרחב אווירי פנוי / ייעוץ",
  "map.zones.class.AIP_PROHIBITED": "אזור אסור (LLP)",
  "map.zones.class.AIP_RESTRICTED": "אזור מוגבל (LLR)",
  "map.zones.class.AIP_DANGER": "אזור סכנה (LLD)",
  "map.zones.class.LLU_DRONE": "אזור אסור לרחפנים/טיסנים (LLU)",
  "map.zones.class.AIRPORT": "חיץ שדה תעופה / מנחת",
  "map.zones.class.CTR": "אזור פיקוח שדה תעופה (CTR)",
  "map.zones.class.ATZ": "אזור תעבורת שדה תעופה (ATZ)",
  "map.zones.class.CTA": "אזור בקרה (CTA)",
  "map.zones.class.NATURE_RESERVE": "שמורת טבע (רשות הטבע והגנים)",
  "map.zones.class.CVFR_LANE": "נתיב טיסה CVFR",
  // DO-045 — new coinage, awaiting terminology review ([HE?] convention).
  "map.zones.class.WEEKEND_BUBBLE": "[HE?] בועת טיסת סופ\"ש (תעופה ספורטיבית)",
  "map.zones.class.POPULATED": "אזור מאוכלס",
  "map.zones.class.BORDER_SECURITY": "אזור אבטחת גבול",
  "map.zones.class.OTHER": "אזור אחר",
  "map.zones.verdict.RESTRICTED": "אסור לטיסה",
  "map.zones.verdict.NEEDS_PERMIT": "נדרש היתר",
  "map.zones.verdict.CLEAR": "פנוי",
  "map.zones.popup.band": "רצועת גובה",
  "map.zones.popup.directional": "גבהים לפי כיוון (כפי שפורסמו)",
  // DO-045 — new coinage, awaiting terminology review ([HE?] convention).
  "map.zones.popup.tracedTitle": "[HE?] מתאר משורטט ידנית — אינו מחייב מול המפה הרשמית",
  "map.zones.popup.tracedBody":
    "[HE?] הגבול שורטט ידנית מהמפה המפורסמת בדיוק של כ-500 מ'. יש להתייחס לקצה המדויק כמשוער ולבדוק מול המפה הרשמית לפני הסתמכות.",
  "map.zones.popup.scheduleInferred":
    "[HE?] מצב סופ\"ש/כל השבוע הוסק ואינו מפורסם במקור המשורטט.",
  "map.zones.popup.envelopeNote":
    "הרצועה המוצגת היא מעטפת מינימום/מקסימום של הגבהים הכיווניים שפורסמו.",
  "map.zones.popup.source": "מקור",
  "map.zones.popup.schedule": "לוח זמנים",
  // Altitude-band value texts — semantics per server/docs/zones-api.md.
  "map.zones.band.range": "{{floor}} – {{ceiling}}",
  "map.zones.band.ground": "פני הקרקע (GND)",
  "map.zones.band.unbounded": "ללא הגבלת גובה (UNL)",
  "map.zones.band.amsl": "{{ft}} רגל מעל פני הים (AMSL)",
  "map.zones.band.agl": "{{ft}} רגל מעל פני הקרקע (AGL) — כפי שפורסם",
  "map.zones.band.notPublished": "לא פורסם",
  "map.zones.band.noVerticalClaim": "לא פורסמה רצועת גובה",

  // Location-check verdict panel (DO-015, FR-C2/C3/C5/C6).
  // Aeronautical/regulatory terms (buffer/corridor/AMSL/AGL/vertical-separation
  // language) reviewed & approved by Jonathan 2026-07-23. Verdict-tier and
  // altitude-band names are reused from above.
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
  // DO-045 — new coinage, awaiting terminology review ([HE?] convention).
  "map.check.memberships.title": "[HE?] אזורים בנקודה זו",
  "map.check.memberships.hint":
    "[HE?] הנקודה נמצאת בתוך האזורים הבאים. הם אינם מגבילים את המיקום — הם מוצגים כדי שתדע היכן אתה.",
  "map.check.clear.body":
    "אף אזור אינו מכיל נקודה זו. המגבלות הרגולטוריות הרגילות שלהלן עדיין חלות.",
  "map.check.units.m": "מ׳",
  "map.check.reasons.title": "סיבה",
  "map.check.reasonKind.POINT_IN_ZONE": "הנקודה נמצאת בתוך אזור זה",
  "map.check.reasonKind.WITHIN_AIRPORT_BUFFER_RULE": "בתוך רדיוס החיץ סביב שדה תעופה / מנחת",
  "map.check.reasonKind.WITHIN_LANE_CORRIDOR": "בתוך מסדרון נתיב הטיסה",
  "map.check.reasonKind.CVFR_OVERHEAD": "נתיב טיסה (CVFR) ממעל",
  // DO-035 item 2 — published special text + coordination contact. New coinages.
  // "כפי שפורסם" / "בנתונים המיובאים" are load-bearing: the app states what the
  // import contains, never what exists in the world.
  "map.check.notes.title": "הערות לאזור (כפי שפורסמו)",
  "map.check.notes.none": "לא פורסמו הערות עבור אזור זה בנתונים המיובאים.",
  "map.check.contact.title": "תיאום / איש קשר (כפי שפורסם)",
  "map.check.contact.none": "לא פורסם איש קשר בנתונים המיובאים.",
  "map.check.vertical.label": "אנכי",
  "map.check.vertical.status.CONFLICT": "הגובה המתוכנן מתנגש עם רצועת הגובה של האזור",
  "map.check.vertical.status.BELOW_FLOOR": "הגובה המתוכנן נמוך מרצפת הרצועה",
  "map.check.vertical.status.ABOVE_CEILING": "הגובה המתוכנן גבוה מתקרת הרצועה",
  "map.check.vertical.status.NO_CLAIM": "לא פורסמה רצועת גובה — אין קביעה אנכית",
  "map.check.vertical.clearance": "מרווח {{ft}} רגל",
  "map.check.vertical.groundReaching": "מגיע לפני הקרקע",
  "map.check.vertical.unbounded": "ללא הגבלת גובה (UNL)",
  "map.check.vertical.title": "הפרדה אנכית",
  "map.check.vertical.plannedLabel": "גובה מתוכנן",
  "map.check.vertical.aglUnit": "מ׳ מעל פני הקרקע (AGL)",
  "map.check.vertical.interval": "מושווה כ־",
  "map.check.vertical.ftAmsl": "רגל מעל פני הים (AMSL)",
  "map.check.vertical.conservativeNote":
    "גובה פני הקרקע משוער, ולכן הגובה המושווה מורחב בטווח אי-הוודאות — התנגשויות לעולם אינן מצומצמות.",
  "map.check.vertical.allowedHeightAdvisory": "נתיב טיסה (CVFR) ממעל — גובה מותר עד {{height}} מ׳ מעל פני הקרקע (מקורב)",
  "map.check.vertical.noAltitude": "יש להזין גובה מתוכנן למעלה כדי לבדוק הפרדה אנכית.",
  "map.check.distance.title": "מרחקים",
  "map.check.distance.nearestAirport": "שדה תעופה / מנחת קרוב",
  "map.check.distance.bufferWarning": "בתוך רדיוס החיץ של {{name}} (רדיוס {{m}} מ׳).",
  "map.check.distance.insideImportedBuffer": "בתוך מצולע חיץ שדה התעופה המיובא.",
  "map.check.lanes.title": "נתיבי טיסה (CVFR)",
  "map.check.lanes.nearest": "הנתיב הקרוב",
  "map.check.lanes.centerlineDistance": "מרחק מקו המרכז",
  "map.check.lanes.withinCorridor": "בתוך מסדרון הנתיב",
  "map.check.context.title": "המגבלות הרגילות עדיין חלות",
  "map.check.context.imported": "הערכים נקראו {{date}}.",
  "map.check.dq.notAuthoritative":
    "מידע המתוחזק בידי המפעיל — אינו ייעוץ משפטי או אישור פיקוח טיסה. יש לאמת מול המפות הרשמיות וה-NOTAM לפני טיסה.",
  "map.check.dq.unverifiedLayers": "שכבות אזורים לא מאומתות: {{layers}}.",
  "map.check.dq.unverifiedRules": "ערכים רגולטוריים לא מאומתים: {{rules}}.",
  "map.check.dq.elevationApproximate":
    "גובה פני הקרקע משוער (כ-±4 מ׳); הממצאים האנכיים מורחבים באופן שמרני.",

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
