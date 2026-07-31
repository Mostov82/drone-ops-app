// DO-015 — vertical separation (FR-C5/C6): pure band arithmetic.
//
// Semantics implemented EXACTLY as ratified (DECISION 2026-07-11;
// zones-api.md "Altitude semantics"):
//   - AIP P/R/D zones: floor <= 0 ft AMSL = ground-reaching, INCLUDING
//     below-sea-level terrain (Dead Sea) — airspace between the terrain and
//     0 ft AMSL is inside the zone. Null ceiling = unbounded above.
//   - CVFR lanes: Option A min/max envelope; a blank published band
//     (null/null) makes NO vertical claim — never "probably low".
//   - Every other zone type (INPA, LLU, airports, …): a null bound means
//     "not published", NOT unbounded (the null=unbounded rule is P/R/D-only)
//     — no claim is made on an unpublished side. AGL-published ceilings ride
//     in Zone.notes (`aglCeilingFt=N`) and are NOT evaluated here — AGL→AMSL
//     conversion awaits a modeling decision (zones-api.md).
//
// CONSERVATIVE ROUNDING RULE (the contract — documented in verdict-api.md):
// elevation is a ~±4 m surface model (DECISION 2026-07-10, always
// `approximate`), so the planned altitude is evaluated as an INTERVAL that
// the uncertainty can only WIDEN, never narrow:
//   minFt = floor((elevationM - 4 + aglM) / 0.3048)
//   maxFt = ceil ((elevationM + 4 + aglM) / 0.3048)
// A band conflicts iff the widened interval overlaps the effective band,
// INCLUSIVE at both edges (touching a band edge counts as conflict).
// Clearances are the SMALLEST values consistent with the uncertainty.
// 0.3048 m/ft is the exact international-foot definition (unit conversion,
// not a regulatory value).

/** GLO-30 vertical uncertainty, meters (DECISION 2026-07-10: "~±4 m"). */
export const ELEVATION_UNCERTAINTY_M = 4;

/** Exact international foot (unit definition, not a regulatory value). */
export const M_PER_FT = 0.3048;

/** Zone types under the ratified P/R/D semantics (GND/UNL ratification). */
const PRD_ZONE_TYPES = new Set(["AIP_PROHIBITED", "AIP_RESTRICTED", "AIP_DANGER"]);

export const LANE_ZONE_TYPE = "CVFR_LANE";

export interface PlannedAmslEnvelope {
  /** Conservative lower bound of the planned altitude, ft AMSL (widened down). */
  minFt: number;
  /** Conservative upper bound of the planned altitude, ft AMSL (widened up). */
  maxFt: number;
  elevationM: number;
  plannedAltitudeAglM: number;
  uncertaintyM: number;
}

export function plannedAmslEnvelope(elevationM: number, plannedAltitudeAglM: number): PlannedAmslEnvelope {
  const minFt = Math.floor((elevationM - ELEVATION_UNCERTAINTY_M + plannedAltitudeAglM) / M_PER_FT);
  const maxFt = Math.ceil((elevationM + ELEVATION_UNCERTAINTY_M + plannedAltitudeAglM) / M_PER_FT);
  return { minFt, maxFt, elevationM, plannedAltitudeAglM, uncertaintyM: ELEVATION_UNCERTAINTY_M };
}

export type VerticalStatus =
  /** The widened planned-altitude interval overlaps (or cannot be excluded from) the band. */
  | "CONFLICT"
  /** Certainly below the published floor, even at the widened maximum. */
  | "BELOW_FLOOR"
  /** Certainly above the published ceiling, even at the widened minimum. */
  | "ABOVE_CEILING"
  /** The zone publishes no usable vertical band — NO claim either way. */
  | "NO_CLAIM";

export interface VerticalFinding {
  status: VerticalStatus;
  /**
   * BELOW_FLOOR: ft between the widened planned maximum and the floor.
   * ABOVE_CEILING: ft between the widened planned minimum and the ceiling.
   * The smallest clearance consistent with the elevation uncertainty.
   * Null for CONFLICT / NO_CLAIM.
   */
  clearanceFt: number | null;
  /** Band effective floor reaches the surface (floor <= 0, incl. Dead Sea terrain). */
  groundReaching: boolean;
  /** Ceiling treated as unbounded above (null ceiling on a P/R/D zone). */
  unboundedCeiling: boolean;
  /**
   * Conservative assumptions applied where the data is silent (each widens
   * the conflict, never narrows it). Empty when the band was fully published.
   */
  assumptions: string[];
}

/**
 * Evaluate the planned-altitude envelope against one zone's band.
 * Never claims clearance the data cannot support: an unpublished bound on a
 * non-P/R/D zone yields either a certain clearance on the published side or
 * a conservative CONFLICT flagged with the assumption made.
 */
export function evaluateBand(
  zoneTypeCode: string,
  floorAmslFt: number | null,
  ceilingAmslFt: number | null,
  env: PlannedAmslEnvelope,
): VerticalFinding {
  const assumptions: string[] = [];
  const isPrd = PRD_ZONE_TYPES.has(zoneTypeCode);

  // Blank band → no vertical claim (ratified for lanes; identical honesty for
  // every non-P/R/D type: null means "not published", never a guess).
  if (floorAmslFt === null && ceilingAmslFt === null && !isPrd) {
    return {
      status: "NO_CLAIM",
      clearanceFt: null,
      groundReaching: false,
      unboundedCeiling: false,
      assumptions: [],
    };
  }

  // Effective floor. -Infinity = reaches the ground (or unknown, assumed so).
  let floor: number;
  let groundReaching = false;
  if (floorAmslFt === null) {
    if (isPrd) {
      // Not expected in the imported data (gdb publishes AltMin); if it ever
      // occurs, assume ground-reaching — widens the conflict, never narrows.
      assumptions.push("floor not published on P/R/D zone — conservatively treated as ground-reaching");
      floor = Number.NEGATIVE_INFINITY;
      groundReaching = true;
    } else if (ceilingAmslFt !== null) {
      // Published ceiling, unpublished floor: a certain ABOVE_CEILING can be
      // claimed; anything at/below the ceiling cannot be excluded → conflict.
      assumptions.push("floor not published — conflict below the ceiling cannot be excluded (conservative)");
      floor = Number.NEGATIVE_INFINITY;
    } else {
      floor = Number.NEGATIVE_INFINITY; // unreachable (blank handled above)
    }
  } else if (floorAmslFt <= 0) {
    // GND/MSL stored as 0 (zones-api.md): the zone starts at the surface —
    // including below-sea-level terrain. Planned AMSL below 0 ft is still in.
    floor = Number.NEGATIVE_INFINITY;
    groundReaching = true;
  } else {
    floor = floorAmslFt;
  }

  // Effective ceiling. +Infinity = unbounded (or unknown, assumed so).
  let ceiling: number;
  let unboundedCeiling = false;
  if (ceilingAmslFt === null) {
    if (isPrd) {
      // UNL ratification: null ceiling on P/R/D = unbounded above.
      ceiling = Number.POSITIVE_INFINITY;
      unboundedCeiling = true;
    } else {
      // Not published (e.g. an AGL ceiling riding in notes): no clearance
      // above can be claimed → conflict above the floor cannot be excluded.
      assumptions.push("ceiling not published — conflict above the floor cannot be excluded (conservative)");
      ceiling = Number.POSITIVE_INFINITY;
    }
  } else {
    ceiling = ceilingAmslFt;
  }

  // Certain clearances first (they survive the widened interval by definition).
  if (Number.isFinite(floor) && env.maxFt < floor) {
    return {
      status: "BELOW_FLOOR",
      clearanceFt: floor - env.maxFt,
      groundReaching,
      unboundedCeiling,
      assumptions,
    };
  }
  if (Number.isFinite(ceiling) && env.minFt > ceiling) {
    return {
      status: "ABOVE_CEILING",
      clearanceFt: env.minFt - ceiling,
      groundReaching,
      unboundedCeiling,
      assumptions,
    };
  }

  // Overlap (inclusive at both edges — touching a band edge is a conflict).
  return {
    status: "CONFLICT",
    clearanceFt: null,
    groundReaching,
    unboundedCeiling,
    assumptions,
  };
}
