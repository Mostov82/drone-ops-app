// DO-015 — structured, bilingual, FAIL-CLOSED errors for the verdict engine.
//
// The engine is the safety-critical decision path (intent doc): a check that
// cannot be completed honestly must abort with one of these — NEVER degrade
// to a silent "clear". RulesetError (ruleset-api.md) and the DEM ApiErrors
// (map-api.md) propagate through the engine unchanged; the codes below cover
// the engine's own fail-closed conditions. Documented in
// server/docs/verdict-api.md.
import { ApiError } from "../api-error.js";

export function verdictBadRequest(detailEn: string, detailHe: string): ApiError {
  return new ApiError(400, "VERDICT_BAD_REQUEST", {
    en: `Invalid location-check request: ${detailEn}.`,
    he: `בקשת בדיקת מיקום שגויה: ${detailHe}.`,
  });
}

/** Zero imported zone layers (or zero zones) — a verdict would be meaningless. */
export function verdictNoZoneData(): ApiError {
  return new ApiError(503, "VERDICT_NO_ZONE_DATA", {
    en: "No zone data is imported. Run the zone import (README / `npm run zones:import`) before checking locations — a check without zone data can never be a verdict.",
    he: "לא יובאו נתוני אזורים. יש להריץ את ייבוא האזורים (README / ‎`npm run zones:import`) לפני בדיקת מיקום — בדיקה ללא נתוני אזורים אינה יכולה להיות פסיקה.",
  });
}

/**
 * The airports layer is missing entirely — FR-C3 (distance to nearest
 * airport + buffer proximity) cannot be answered, so the whole check aborts.
 */
export function verdictNoAirportData(): ApiError {
  return new ApiError(503, "VERDICT_NO_AIRPORT_DATA", {
    en: "No airport zones are imported, so the distance-to-airport check (FR-C3) cannot run. Import the airports dataset before checking locations.",
    he: "לא יובאו אזורי שדות תעופה, ולכן בדיקת המרחק משדה תעופה (FR-C3) אינה אפשרית. יש לייבא את מערך שדות התעופה לפני בדיקת מיקום.",
  });
}

/**
 * A triggered zone's type carries a verdict value outside the Gate 3 mapping
 * (RESTRICTED / NEEDS_PERMIT / CLEAR). By design:
 * fail closed and surface — never default to needs-permit or clear.
 */
export function verdictUnmappedZoneType(zoneTypeCode: string, value: string): ApiError {
  return new ApiError(409, "VERDICT_UNMAPPED_ZONE_TYPE", {
    en: `Zone type "${zoneTypeCode}" has verdict mapping "${value}", which is not a known verdict (RESTRICTED / NEEDS_PERMIT / CLEAR). The mapping is editable data — fix it before checks can run. No default is assumed.`,
    he: `לסוג האזור "${zoneTypeCode}" מוגדרת פסיקה "${value}" שאינה פסיקה מוכרת (RESTRICTED / NEEDS_PERMIT / CLEAR). המיפוי הוא נתון הניתן לעריכה — יש לתקנו לפני שניתן להריץ בדיקות. לא מונחת ברירת מחדל.`,
  });
}

/**
 * A zone the engine cannot geometrically evaluate could silently hide a
 * restriction — abort rather than skip it.
 */
export function verdictGeometryUnsupported(zoneName: string, geometryType: string): ApiError {
  return new ApiError(409, "VERDICT_GEOMETRY_UNSUPPORTED", {
    en: `Zone "${zoneName}" has geometry type "${geometryType}", which the verdict engine cannot evaluate. The check aborts rather than skip a zone it cannot assess.`,
    he: `לאזור "${zoneName}" גאומטריה מסוג "${geometryType}" שמנוע הפסיקה אינו יכול להעריך. הבדיקה נעצרת במקום לדלג על אזור שלא ניתן להעריך.`,
  });
}

/**
 * The airport buffer rule exists but in a unit the engine will not guess a
 * conversion for (same stance as the DO-013 importer).
 */
export function verdictBadRuleUnit(ruleKey: string, unit: string | null): ApiError {
  return new ApiError(409, "VERDICT_BAD_RULE_UNIT", {
    en: `Regulation rule "${ruleKey}" has unit ${JSON.stringify(unit)} — expected km or m. No unit conversion is guessed; fix the rule.`,
    he: `לכלל הרגולציה "${ruleKey}" יחידה ${JSON.stringify(unit)} — הצפוי הוא km או m. לא מנוחשת המרת יחידות; יש לתקן את הכלל.`,
  });
}
