// DO-015 — the "can I fly here?" location-check verdict engine (FR-C2/C3/C5/C6).
//
// THE SAFETY-CRITICAL DECISION PATH. Standing obligations (intent doc):
//   - FAIL CLOSED everywhere: missing Ruleset value, missing elevation when
//     an altitude was asked, zero imported layers, an unmapped verdict value,
//     an unevaluable geometry → structured error, NEVER a silent "clear".
//   - Verdict = worst-of the triggered zones' verdict mapping (Gate 3 data,
//     editable — read at check time, never cached): RESTRICTED > NEEDS_PERMIT
//     > CLEAR. No zones triggered → CLEAR, with the standard Ruleset limits
//     echoed as context.
//   - Ruleset values are read fail-closed at CHECK time — never constants
//     (NFR-5: editing `airport_buffer_km` or a `ZoneType.defaultVerdict`
//     changes verdicts with no code change).
//   - Every response carries data-quality flags (unverified layers,
//     approximate elevation, import dates). A verdict is NEVER authoritative
//     (PRD §10) — consumers badge at point of use.
//
// LANES (escalation 1 RESOLVED — option (a), DECISION 2026-07-11):
// CVFR lanes are centerlines; the corridor width lives in the Ruleset as
// `cvfr_lane_half_width_m`, seeded from the governing ב'-03 text (§2.ב:
// route width 2 km, 1 km each side of the centerline, unless stated
// otherwise — per-lane exceptions are NOT modeled; the ב'-03 visual check
// covers them). A point within the half-width of a lane centerline is
// horizontally contained: the lane's Gate 3 verdict mapping participates in
// worst-of. The rule is read fail-closed at check time whenever lane zones
// exist — never a constant. Distance flooring WIDENS containment, never
// narrows it (see corridorContains).
//
// Contract doc: server/docs/verdict-api.md (written for DO-017's reuse).

import type { DemService, ElevationResult } from "../map/dem.js";
import type { NumberRuleValue, RulesetReader } from "../ruleset/service.js";
import { verdictBadRequest, verdictBadRuleUnit, verdictNoAirportData, verdictNoZoneData, verdictUnmappedZoneType } from "./errors.js";
import { areaContainsPoint, distanceToCentroidM, distanceToLineM, isAreaGeometry } from "./geometry.js";
import type { VerdictDataStore, VerdictLayer, VerdictZone } from "./store.js";
import { evaluateBand, plannedAmslEnvelope, LANE_ZONE_TYPE, type PlannedAmslEnvelope, type VerticalFinding } from "./vertical.js";

// ─────────────────────────── Result types (the contract) ───────────────────────────

export type VerdictValue = "RESTRICTED" | "NEEDS_PERMIT" | "CLEAR";

/** Gate 3 precedence: restricted > needs-permit > clear. */
const VERDICT_SEVERITY: Record<VerdictValue, number> = { RESTRICTED: 2, NEEDS_PERMIT: 1, CLEAR: 0 };

export const AIRPORT_ZONE_TYPE = "AIRPORT";
export const AIRPORT_BUFFER_RULE_KEY = "airport_buffer_km";
/** Seeded from AIP ב'-03 §2.ב (DECISION 2026-07-11, DO-015 escalation 1 → option a; updated 2026-07-13). */
export const LANE_HALF_WIDTH_RULE_KEY = "cvfr_lane_halfwidth_km";

/**
 * Corridor containment under the conservative rounding discipline: the
 * measured centerline distance is FLOORED before comparing, so rounding can
 * only pull a point INTO the corridor, never push it out (widens containment
 * — the horizontal sibling of the vertical ±4 m widening rule).
 */
export function corridorContains(rawDistanceM: number, halfWidthM: number): boolean {
  return Math.floor(rawDistanceM) <= halfWidthM;
}

/**
 * Standard limits echoed on every verdict (Gate 3: a CLEAR still shows the
 * standard Ruleset limits). Read fail-closed at check time; `lastVerifiedAt`
 * is carried so consumers can badge unverified values and snapshot what the
 * check used (ruleset-api.md consumer obligations 2–3).
 */
export const STANDARD_NUMBER_LIMIT_KEYS = [
  "max_altitude_agl_m",
  "min_distance_people_structures_m",
  AIRPORT_BUFFER_RULE_KEY,
] as const;
export const STANDARD_BOOLEAN_LIMIT_KEYS = ["vlos_required", "daylight_only"] as const;

export interface ZoneRef {
  id: string;
  name: string;
  zoneTypeCode: string;
  zoneTypeName: string;
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  /** Provenance & source oddities verbatim (incl. lane raw directional altitudes, `aglCeilingFt=N`). */
  notes: string | null;
}

export interface LayerRef {
  name: string;
  importedAt: string; // ISO
  verified: boolean;
}

export type ReasonKind =
  /** The point is horizontally inside the zone's imported geometry (boundary inclusive). */
  | "POINT_IN_ZONE"
  /** The point is within the LIVE Ruleset airport buffer of the nearest airport (NFR-5). */
  | "WITHIN_AIRPORT_BUFFER_RULE"
  /** The point is within the LIVE Ruleset corridor half-width of a lane centerline. */
  | "WITHIN_LANE_CORRIDOR"
  /** The point is within the corridor but under the published floor (advisory overhead airspace). */
  | "CVFR_OVERHEAD";

export interface VerdictReason {
  kind: ReasonKind;
  /** The triggered zone type's mapped verdict (editable Gate 3 data). */
  verdict: VerdictValue;
  zone: ZoneRef;
  layer: LayerRef | null;
  /**
   * WITHIN_AIRPORT_BUFFER_RULE: distance to the airport reference point.
   * WITHIN_LANE_CORRIDOR: distance to the lane centerline.
   * Meters, rounded down.
   */
  distanceM?: number;
  /** WITHIN_AIRPORT_BUFFER_RULE / WITHIN_LANE_CORRIDOR: the rule value the check used. */
  rule?: EchoedNumberRule;
  /** Present when a planned altitude was given; null = zone not vertically evaluated. */
  vertical: VerticalFinding | null;
  allowedAglM?: number | null;
}

export interface EchoedNumberRule {
  key: string;
  value: number;
  unit: string | null;
  lastVerifiedAt: string | null;
}

export interface EchoedBooleanRule {
  key: string;
  value: boolean;
  lastVerifiedAt: string | null;
}

export interface NearestAirport {
  zoneId: string;
  name: string;
  /** Geodesic distance to the airport reference point, m, rounded DOWN (conservative). */
  distanceM: number;
  /** Whether the point is inside the IMPORTED buffer polygon (may lag the Ruleset). */
  insideImportedBuffer: boolean;
}

export interface BufferWarning {
  ruleKey: string;
  /** The live Ruleset buffer radius, meters. */
  bufferM: number;
  airportZoneId: string;
  airportName: string;
  distanceM: number;
  ruleLastVerifiedAt: string | null;
}

export interface LaneCorridorInfo {
  ruleKey: string;
  /** The live Ruleset corridor half-width, meters. */
  halfWidthM: number;
  ruleLastVerifiedAt: string | null;
}

export interface NearestLane {
  zoneId: string;
  name: string;
  /** Distance to the lane CENTERLINE, m, rounded down (flooring widens containment). */
  horizontalDistanceM: number;
  /** floor(distance) <= live Ruleset half-width (DECISION 2026-07-11). */
  withinCorridor: boolean;
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  /** Raw directional altitude strings ride here verbatim (Option A audit trail). */
  notes: string | null;
  layer: LayerRef | null;
  /** Present when a planned altitude was given. */
  vertical: VerticalFinding | null;
  allowedAglM?: number | null;
}

export interface VerticalReport {
  plannedAltitudeAglM: number;
  elevation: ElevationResult;
  /** Uncertainty applied by the conservative rounding rule, meters. */
  uncertaintyM: number;
  /** The widened planned-altitude interval actually compared, ft AMSL. */
  plannedAmslFt: { minFt: number; maxFt: number };
}

export interface DataQuality {
  /** Every layer consulted (a CLEAR over unverified layers is itself unverified). */
  layers: LayerRef[];
  /** Names of consulted layers with verified=false — badge at point of use. */
  unverifiedLayers: string[];
  /** True when an elevation value contributed (it is ALWAYS approximate, map-api.md). */
  elevationApproximate: boolean;
  /** Ruleset keys used whose lastVerifiedAt is null — badge at point of use. */
  unverifiedRuleKeys: string[];
}

export interface VerdictResult {
  verdict: VerdictValue;
  point: { lat: number; lng: number };
  /** Triggered zones, worst verdict first. Empty ⇔ verdict CLEAR. */
  reasons: VerdictReason[];
  distance: {
    nearestAirport: NearestAirport;
    /** Non-null when the point is within the live Ruleset buffer (FR-C3). */
    bufferWarning: BufferWarning | null;
  };
  lanes: {
    nearest: NearestLane | null;
    laneCount: number;
    /** The live corridor rule the check used; null when no lane zones are imported. */
    corridor: LaneCorridorInfo | null;
  };
  /** Null when no planned altitude was requested. */
  vertical: VerticalReport | null;
  context: {
    numberLimits: EchoedNumberRule[];
    booleanLimits: EchoedBooleanRule[];
  };
  dataQuality: DataQuality;
  checkedAt: string; // ISO
}

// ─────────────────────────── Engine ───────────────────────────

export interface CheckRequest {
  lat: number;
  lng: number;
  /** Planned altitude above ground level, METERS (the Ruleset's AGL unit). Optional. */
  plannedAltitudeAglM?: number;
}

export interface VerdictEngine {
  check(request: CheckRequest): Promise<VerdictResult>;
}

export interface VerdictEngineDeps {
  store: VerdictDataStore;
  /** Fail-closed Ruleset read API (ruleset-api.md) — errors propagate. */
  rulesetReader: RulesetReader;
  /** Fail-closed elevation service (map-api.md) — errors propagate. */
  demService: DemService;
  now?: () => Date;
}

function isVerdictValue(value: string): value is VerdictValue {
  return value === "RESTRICTED" || value === "NEEDS_PERMIT" || value === "CLEAR";
}

function requireVerdict(zone: VerdictZone): VerdictValue {
  if (!isVerdictValue(zone.defaultVerdict)) {
    // By design — fail closed, never default.
    throw verdictUnmappedZoneType(zone.zoneTypeCode, zone.defaultVerdict);
  }
  return zone.defaultVerdict;
}

function layerRef(layers: Map<string, VerdictLayer>, zone: VerdictZone): LayerRef | null {
  const layer = zone.mapLayerId ? layers.get(zone.mapLayerId) : undefined;
  if (!layer) return null;
  return { name: layer.name, importedAt: layer.importedAt.toISOString(), verified: layer.verified };
}

function zoneRef(zone: VerdictZone): ZoneRef {
  return {
    id: zone.id,
    name: zone.name,
    zoneTypeCode: zone.zoneTypeCode,
    zoneTypeName: zone.zoneTypeName,
    floorAmslFt: zone.floorAmslFt,
    ceilingAmslFt: zone.ceilingAmslFt,
    notes: zone.notes,
  };
}

function echoNumber(rule: NumberRuleValue): EchoedNumberRule {
  return {
    key: rule.key,
    value: rule.value,
    unit: rule.unit,
    lastVerifiedAt: rule.lastVerifiedAt ? rule.lastVerifiedAt.toISOString() : null,
  };
}

/** Buffer radius in meters from the rule — km/m only, never a guessed conversion. */
function bufferRadiusM(rule: NumberRuleValue): number {
  if (rule.unit === "km") return rule.value * 1000;
  if (rule.unit === "m") return rule.value;
  throw verdictBadRuleUnit(rule.key, rule.unit);
}

export function createVerdictEngine(deps: VerdictEngineDeps): VerdictEngine {
  const now = deps.now ?? (() => new Date());

  return {
    async check(request) {
      const { lat, lng, plannedAltitudeAglM } = request;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw verdictBadRequest("lat and lng must be finite numbers", "lat ו-lng חייבים להיות מספרים");
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw verdictBadRequest("lat/lng out of range", "lat/lng מחוץ לטווח");
      }
      if (plannedAltitudeAglM !== undefined && (!Number.isFinite(plannedAltitudeAglM) || plannedAltitudeAglM < 0)) {
        throw verdictBadRequest(
          "plannedAltitudeAglM must be a non-negative number of meters AGL",
          "plannedAltitudeAglM חייב להיות מספר לא-שלילי של מטרים מעל פני הקרקע",
        );
      }

      // Zone data — fail closed on emptiness (never a verdict over nothing).
      const layerRows = await deps.store.listLayers();
      const zones = await deps.store.listZones();
      if (layerRows.length === 0 || zones.length === 0) throw verdictNoZoneData();
      const layers = new Map(layerRows.map((l) => [l.id, l]));

      // Horizontal containment (point-in-polygon, boundary inclusive) over
      // every area zone; lanes and other line geometries collected separately.
      const containing: VerdictZone[] = [];
      const laneZones: VerdictZone[] = [];
      const airportZones: VerdictZone[] = [];
      for (const zone of zones) {
        if (zone.zoneTypeCode === AIRPORT_ZONE_TYPE) airportZones.push(zone);
        if (isAreaGeometry(zone.geometryJson, zone.name)) {
          if (areaContainsPoint(zone.geometryJson, zone.name, lat, lng)) containing.push(zone);
        } else if (zone.zoneTypeCode === LANE_ZONE_TYPE) {
          laneZones.push(zone);
        }
        // Non-lane line geometries have zero area: they can never contain the
        // point and carry no defined proximity semantics — not evaluated.
      }

      // Elevation lookup. If altitude is requested, missing DEM aborts check.
      // If no altitude is requested but lane zones exist, try to lookup elevation
      // for CVFR_OVERHEAD allowed height calculations but ignore failures.
      let env: PlannedAmslEnvelope | null = null;
      let elevation: ElevationResult | null = null;
      if (plannedAltitudeAglM !== undefined) {
        elevation = await deps.demService.lookup(lat, lng); // DEM errors propagate
        env = plannedAmslEnvelope(elevation.elevationM, plannedAltitudeAglM);
      } else if (laneZones.length > 0) {
        try {
          elevation = await deps.demService.lookup(lat, lng);
        } catch {
          elevation = null;
        }
      }

      const reasons: VerdictReason[] = containing.map((zone) => ({
        kind: "POINT_IN_ZONE" as const,
        verdict: requireVerdict(zone),
        zone: zoneRef(zone),
        layer: layerRef(layers, zone),
        vertical: env ? evaluateBand(zone.zoneTypeCode, zone.floorAmslFt, zone.ceilingAmslFt, env) : null,
      }));

      // FR-C3 — distance to nearest airport + LIVE Ruleset buffer proximity.
      if (airportZones.length === 0) throw verdictNoAirportData();
      let nearestAirport: NearestAirport | null = null;
      for (const zone of airportZones) {
        const distanceM = Math.floor(distanceToCentroidM(zone.geometryJson, zone.name, lat, lng));
        if (nearestAirport === null || distanceM < nearestAirport.distanceM) {
          nearestAirport = {
            zoneId: zone.id,
            name: zone.name,
            distanceM,
            insideImportedBuffer: containing.some((c) => c.id === zone.id),
          };
        }
      }
      const airport = nearestAirport!; // airportZones is non-empty

      const bufferRule = await deps.rulesetReader.getNumberRule(AIRPORT_BUFFER_RULE_KEY); // fail-closed
      const bufferM = bufferRadiusM(bufferRule);
      let bufferWarning: BufferWarning | null = null;
      if (airport.distanceM <= bufferM) {
        bufferWarning = {
          ruleKey: bufferRule.key,
          bufferM,
          airportZoneId: airport.zoneId,
          airportName: airport.name,
          distanceM: airport.distanceM,
          ruleLastVerifiedAt: bufferRule.lastVerifiedAt ? bufferRule.lastVerifiedAt.toISOString() : null,
        };
        // The LIVE buffer triggers the airport verdict mapping even when the
        // imported (possibly stale) polygon does not contain the point —
        // this is what makes a Ruleset buffer edit flip a verdict (NFR-5).
        const airportZone = airportZones.find((z) => z.id === airport.zoneId)!;
        if (!containing.some((c) => c.id === airport.zoneId)) {
          reasons.push({
            kind: "WITHIN_AIRPORT_BUFFER_RULE",
            verdict: requireVerdict(airportZone),
            zone: zoneRef(airportZone),
            layer: layerRef(layers, airportZone),
            distanceM: airport.distanceM,
            rule: echoNumber(bufferRule),
            vertical: env
              ? evaluateBand(airportZone.zoneTypeCode, airportZone.floorAmslFt, airportZone.ceilingAmslFt, env)
              : null,
          });
        }
      }

      // FR-C6 — lanes. The corridor half-width is read from the Ruleset
      // FAIL-CLOSED whenever lane zones exist (DECISION 2026-07-11,
      // escalation 1 → option a); a point within the half-width of a
      // centerline is horizontally contained and the lane's mapped verdict
      // participates in worst-of. Flooring the distance widens containment.
      let nearestLane: NearestLane | null = null;
      let corridor: LaneCorridorInfo | null = null;
      if (laneZones.length > 0) {
        const laneRule = await deps.rulesetReader.getNumberRule(LANE_HALF_WIDTH_RULE_KEY); // fail-closed
        const halfWidthM = bufferRadiusM(laneRule); // km/m only, never guessed
        corridor = {
          ruleKey: laneRule.key,
          halfWidthM,
          ruleLastVerifiedAt: laneRule.lastVerifiedAt ? laneRule.lastVerifiedAt.toISOString() : null,
        };

        // 1. Calculate minAllowedAglM over all corridor-contained lanes w/ published floors that don't conflict
        let minAllowedAglM: number | null = null;
        if (elevation !== null) {
          let maxAltRuleValue: number | null = null;
          for (const lane of laneZones) {
            if (lane.floorAmslFt !== null) {
              const rawDistanceM = distanceToLineM(lane.geometryJson, lane.name, lat, lng);
              const withinCorridor = corridorContains(rawDistanceM, halfWidthM);
              if (withinCorridor) {
                let hasConflict = false;
                if (plannedAltitudeAglM !== undefined) {
                  const env = plannedAmslEnvelope(elevation.elevationM, plannedAltitudeAglM);
                  const vertical = evaluateBand(lane.zoneTypeCode, lane.floorAmslFt, lane.ceilingAmslFt, env);
                  if (vertical.status === "CONFLICT" || vertical.status === "ABOVE_CEILING") {
                    hasConflict = true;
                  }
                }
                if (!hasConflict) {
                  if (maxAltRuleValue === null) {
                    const maxAltRule = await deps.rulesetReader.getNumberRule("max_altitude_agl_m");
                    maxAltRuleValue = maxAltRule.value;
                  }
                  const floorM = lane.floorAmslFt * 0.3048;
                  const allowed = floorM - elevation.elevationM - 4;
                  const allowedAglM = Math.min(Math.max(0, allowed), maxAltRuleValue);
                  if (minAllowedAglM === null || allowedAglM < minAllowedAglM) {
                    minAllowedAglM = allowedAglM;
                  }
                }
              }
            }
          }
        }

        // 2. Add reasons and track nearest lane
        for (const lane of laneZones) {
          const rawDistanceM = distanceToLineM(lane.geometryJson, lane.name, lat, lng);
          const distanceM = Math.floor(rawDistanceM);
          const withinCorridor = corridorContains(rawDistanceM, halfWidthM);
          const hasPublishedFloor = lane.floorAmslFt !== null;
          let hasConflict = false;
          let vertical: VerticalFinding | null = null;

          if (plannedAltitudeAglM !== undefined && elevation !== null) {
            const env = plannedAmslEnvelope(elevation.elevationM, plannedAltitudeAglM);
            vertical = evaluateBand(lane.zoneTypeCode, lane.floorAmslFt, lane.ceilingAmslFt, env);
            if (vertical.status === "CONFLICT" || vertical.status === "ABOVE_CEILING") {
              hasConflict = true;
            }
          }

          if (withinCorridor) {
            if (hasPublishedFloor && elevation !== null && !hasConflict) {
              // CVFR_OVERHEAD reason
              reasons.push({
                kind: "CVFR_OVERHEAD",
                verdict: "CLEAR",
                zone: zoneRef(lane),
                layer: layerRef(layers, lane),
                distanceM,
                rule: echoNumber(laneRule),
                vertical: vertical || {
                  status: "BELOW_FLOOR",
                  clearanceFt: null,
                  groundReaching: false,
                  unboundedCeiling: false,
                  assumptions: [],
                },
                allowedAglM: minAllowedAglM !== null ? Math.round(minAllowedAglM * 100) / 100 : null,
              });
            } else {
              // Mapped restriction reason (WITHIN_LANE_CORRIDOR)
              reasons.push({
                kind: "WITHIN_LANE_CORRIDOR",
                verdict: requireVerdict(lane), // RESTRICTED
                zone: zoneRef(lane),
                layer: layerRef(layers, lane),
                distanceM,
                rule: echoNumber(laneRule),
                vertical: vertical || (hasPublishedFloor ? null : {
                  status: "NO_CLAIM",
                  clearanceFt: null,
                  groundReaching: false,
                  unboundedCeiling: false,
                  assumptions: [],
                }),
              });
            }
          }

          if (nearestLane === null || distanceM < nearestLane.horizontalDistanceM) {
            nearestLane = {
              zoneId: lane.id,
              name: lane.name,
              horizontalDistanceM: distanceM,
              withinCorridor,
              floorAmslFt: lane.floorAmslFt,
              ceilingAmslFt: lane.ceilingAmslFt,
              notes: lane.notes,
              layer: layerRef(layers, lane),
              vertical: vertical || (hasPublishedFloor && withinCorridor && !hasConflict ? {
                status: "BELOW_FLOOR",
                clearanceFt: null,
                groundReaching: false,
                unboundedCeiling: false,
                assumptions: [],
              } : null),
              allowedAglM: null,
            };
          }
        }

        // Set allowedAglM on nearestLane if it qualifies
        if (nearestLane && nearestLane.withinCorridor && nearestLane.floorAmslFt !== null && elevation !== null) {
          let hasConflict = false;
          if (plannedAltitudeAglM !== undefined) {
            const env = plannedAmslEnvelope(elevation.elevationM, plannedAltitudeAglM);
            const vertical = evaluateBand("CVFR_LANE", nearestLane.floorAmslFt, nearestLane.ceilingAmslFt, env);
            if (vertical.status === "CONFLICT" || vertical.status === "ABOVE_CEILING") {
              hasConflict = true;
            }
          }
          if (!hasConflict && minAllowedAglM !== null) {
            nearestLane.allowedAglM = Math.round(minAllowedAglM * 100) / 100;
          }
        }
      }

      // Standard limits echo — every read fail-closed, lastVerifiedAt carried.
      const numberLimits: EchoedNumberRule[] = [];
      for (const key of STANDARD_NUMBER_LIMIT_KEYS) {
        numberLimits.push(key === AIRPORT_BUFFER_RULE_KEY ? echoNumber(bufferRule) : echoNumber(await deps.rulesetReader.getNumberRule(key)));
      }
      const booleanLimits: EchoedBooleanRule[] = [];
      for (const key of STANDARD_BOOLEAN_LIMIT_KEYS) {
        const rule = await deps.rulesetReader.getBooleanRule(key);
        booleanLimits.push({
          key: rule.key,
          value: rule.value,
          lastVerifiedAt: rule.lastVerifiedAt ? rule.lastVerifiedAt.toISOString() : null,
        });
      }

      // Worst-of aggregation (Gate 3 precedence), worst first in the listing.
      reasons.sort((a, b) => VERDICT_SEVERITY[b.verdict] - VERDICT_SEVERITY[a.verdict]);
      const verdict: VerdictValue = reasons.length === 0 ? "CLEAR" : reasons[0].verdict;

      const layerRefs: LayerRef[] = layerRows.map((l) => ({
        name: l.name,
        importedAt: l.importedAt.toISOString(),
        verified: l.verified,
      }));
      const unverifiedRuleKeys = [
        ...numberLimits.filter((r) => r.lastVerifiedAt === null).map((r) => r.key),
        ...booleanLimits.filter((r) => r.lastVerifiedAt === null).map((r) => r.key),
        ...(corridor && corridor.ruleLastVerifiedAt === null ? [corridor.ruleKey] : []),
      ];

      return {
        verdict,
        point: { lat, lng },
        reasons,
        distance: { nearestAirport: airport, bufferWarning },
        lanes: { nearest: nearestLane, laneCount: laneZones.length, corridor },
        vertical:
          env && elevation
            ? {
                plannedAltitudeAglM: plannedAltitudeAglM!,
                elevation,
                uncertaintyM: env.uncertaintyM,
                plannedAmslFt: { minFt: env.minFt, maxFt: env.maxFt },
              }
            : null,
        context: { numberLimits, booleanLimits },
        dataQuality: {
          layers: layerRefs,
          unverifiedLayers: layerRefs.filter((l) => !l.verified).map((l) => l.name),
          elevationApproximate: plannedAltitudeAglM !== undefined || reasons.some((r) => r.kind === "CVFR_OVERHEAD"),
          unverifiedRuleKeys,
        },
        checkedAt: now().toISOString(),
      };
    },
  };
}
