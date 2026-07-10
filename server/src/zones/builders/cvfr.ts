// DO-013 — CVFR flight-lane conversion (FR-C6).
//
// TRIGGER 6 — RESOLVED (option A, decision log 2026-07-11): a lane carries
// FOUR directional altitude fields (N_A / S_A / W_Alt / E_Alt) with 'X' (not
// applicable), blanks and dual values ("2500/3500"), while Zone has a single
// floor/ceiling pair. Per the approved modeling, each segment becomes one
// Zone row whose floorAmslFt = minimum and ceilingAmslFt = maximum of ALL
// published directional altitude numbers (dual values contribute both
// numbers — the conservative envelope). The raw directional strings are
// preserved verbatim in the feature properties and carried onto Zone.notes
// for display/audit. Segments with no published altitude at all keep a null
// band (never guessed) and are listed in the reconciliation report.

import type { GdbDump } from "../gdb.js";
import type { ReconIssue } from "./aip-zones.js";

export const LANE_ZONE_TYPE = "CVFR_LANE"; // seeded via ZONE_TYPE_SEEDS (import.ts)

export interface LaneFeature {
  type: "Feature";
  properties: {
    // ZoneFeatureProperties contract (dataset.ts) — what the importer reads:
    code: string;
    nameHe: string | null;
    nameEn: string | null;
    zoneTypeCode: string;
    /** Option-A envelope: min/max of every published directional altitude. */
    floorAmslFt: number | null;
    ceilingAmslFt: number | null;
    aglCeilingFt: null;
    notes: string | null;
    // Lane-specific audit fields (preserved in the dataset, not columns):
    firstWaypoint: string | null;
    secondWaypoint: string | null;
    military: string | null;
    byRequest: string | null;
    curved: string | null;
    mapSheet: string | null;
    lengthNm: number | null;
    magneticTrack: string | null;
    backTrack: string | null;
    /** Raw altitude strings exactly as published — see altitude* parsed twins. */
    altitudeNorthRaw: string | null;
    altitudeSouthRaw: string | null;
    altitudeWestRaw: string | null;
    altitudeEastRaw: string | null;
    /** Parsed ft values when the raw string is one unambiguous integer, else null. */
    altitudeNorthFt: number | null;
    altitudeSouthFt: number | null;
    altitudeWestFt: number | null;
    altitudeEastFt: number | null;
  };
  geometry: unknown;
}

export interface CvfrResult {
  lanes: { type: "FeatureCollection"; features: LaneFeature[] };
  waypoints: { type: "FeatureCollection"; features: unknown[] };
  issues: ReconIssue[];
  stats: {
    segments: number;
    waypoints: number;
    altitudeValues: Record<string, Record<string, number>>;
    unparseableAltitudes: number;
    /** Segments whose envelope used a dual/multi-number altitude string. */
    envelopeFromMultiValue: number;
    /** Segments with no published altitude at all — null band, never guessed. */
    nullBandSegments: number;
  };
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

/** 'X' = not applicable for the direction; blanks/'<Null>' = not published. */
function parseAltitudeFt(raw: string | null): number | null {
  if (raw === null) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Every published altitude number in a raw directional string (option A).
 * 'X' (axis not applicable) and '<Null>'/blank (not published) yield none;
 * "2500/3500" and "1200, 2000" yield both numbers.
 */
export function publishedAltitudesFt(raw: string | null): number[] {
  if (raw === null || raw === "X" || /^<null>$/i.test(raw)) return [];
  return (raw.match(/\d+/g) ?? []).map(Number);
}

export function buildCvfr(routes: GdbDump, points: GdbDump): CvfrResult {
  const issues: ReconIssue[] = [];
  const altitudeValues: Record<string, Record<string, number>> = {};
  let unparseableAltitudes = 0;
  let envelopeFromMultiValue = 0;
  let nullBandSegments = 0;

  const laneFeatures: LaneFeature[] = routes.features
    .map((f) => {
      const first = str(f.properties.firstWayPo);
      const second = str(f.properties.secondWayp);
      const code = str(f.properties.NAME_UNIT) ?? `${first ?? "?"}${second ?? "?"}`;

      const rawAlts: Record<string, string | null> = {
        N_A: str(f.properties.N_A),
        S_A: str(f.properties.S_A),
        W_Alt: str(f.properties.W_Alt),
        E_Alt: str(f.properties.E_Alt),
      };
      let segmentHasMultiValue = false;
      for (const [field, value] of Object.entries(rawAlts)) {
        const key = value ?? "<null>";
        altitudeValues[field] ??= {};
        altitudeValues[field][key] = (altitudeValues[field][key] ?? 0) + 1;
        if (value !== null && value !== "X" && !/^\d+$/.test(value)) {
          unparseableAltitudes += 1;
          const tokens = publishedAltitudesFt(value);
          segmentHasMultiValue ||= tokens.length > 0;
          issues.push({
            code,
            kind: tokens.length > 0 ? "altitude-multi-value" : "altitude-not-published",
            detail:
              tokens.length > 0
                ? `${field} = ${JSON.stringify(value)} — not a single integer; all published numbers (${tokens.join(", ")}) enter the option-A envelope; raw carried, per-direction parsed value null`
                : `${field} = ${JSON.stringify(value)} — no published number; excluded from the envelope; raw carried`,
          });
        }
      }
      if (segmentHasMultiValue) envelopeFromMultiValue += 1;

      // Option A (decision log 2026-07-11): conservative envelope over every
      // published directional altitude number on the segment.
      const published = Object.values(rawAlts).flatMap(publishedAltitudesFt);
      const floorAmslFt = published.length > 0 ? Math.min(...published) : null;
      const ceilingAmslFt = published.length > 0 ? Math.max(...published) : null;
      if (published.length === 0) {
        nullBandSegments += 1;
        issues.push({
          code,
          kind: "altitude-null-band",
          detail:
            "no published altitude on any direction — floorAmslFt/ceilingAmslFt stay null (never guessed)",
        });
      }

      const military = str(f.properties.Military);
      const byRequest = str(f.properties.byReques);
      const directional = [
        rawAlts.N_A === null || rawAlts.N_A === "X" ? null : `N ${rawAlts.N_A}`,
        rawAlts.S_A === null || rawAlts.S_A === "X" ? null : `S ${rawAlts.S_A}`,
        rawAlts.W_Alt === null || rawAlts.W_Alt === "X" ? null : `W ${rawAlts.W_Alt}`,
        rawAlts.E_Alt === null || rawAlts.E_Alt === "X" ? null : `E ${rawAlts.E_Alt}`,
      ]
        .filter(Boolean)
        .join(" / ");
      const notes = [
        `CVFR lane; directional altitudes ft AMSL as published: ${directional || "none"}`,
        "band = option-A min/max envelope of published directional altitudes (decision 2026-07-11)",
        military ? `class=${military}` : null,
        byRequest ? `byRequest=${byRequest}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        type: "Feature" as const,
        properties: {
          code,
          nameHe: str(f.properties.HebrewName),
          nameEn: str(f.properties.Name),
          zoneTypeCode: LANE_ZONE_TYPE,
          floorAmslFt,
          ceilingAmslFt,
          aglCeilingFt: null as null,
          notes,
          firstWaypoint: first,
          secondWaypoint: second,
          military,
          byRequest,
          curved: str(f.properties.Curved),
          mapSheet: str(f.properties.MAP),
          lengthNm: typeof f.properties.Length === "number" ? f.properties.Length : null,
          magneticTrack: str(f.properties.MAG),
          backTrack: str(f.properties.Back),
          altitudeNorthRaw: rawAlts.N_A,
          altitudeSouthRaw: rawAlts.S_A,
          altitudeWestRaw: rawAlts.W_Alt,
          altitudeEastRaw: rawAlts.E_Alt,
          altitudeNorthFt: parseAltitudeFt(rawAlts.N_A === "X" ? null : rawAlts.N_A),
          altitudeSouthFt: parseAltitudeFt(rawAlts.S_A === "X" ? null : rawAlts.S_A),
          altitudeWestFt: parseAltitudeFt(rawAlts.W_Alt === "X" ? null : rawAlts.W_Alt),
          altitudeEastFt: parseAltitudeFt(rawAlts.E_Alt === "X" ? null : rawAlts.E_Alt),
        },
        geometry: f.geometryWgs84,
      };
    })
    .sort((a, b) => a.properties.code.localeCompare(b.properties.code));

  const waypointFeatures = points.features
    .map((f) => ({
      type: "Feature" as const,
      properties: {
        code: str(f.properties.Code),
        nameHe: str(f.properties.HebrewName),
        report: str(f.properties.Report),
        eastDmsRaw: str(f.properties.E),
        northDmsRaw: str(f.properties.N),
      },
      geometry: f.geometryWgs84,
    }))
    .sort((a, b) => (a.properties.code ?? "").localeCompare(b.properties.code ?? ""));

  return {
    lanes: { type: "FeatureCollection", features: laneFeatures },
    waypoints: { type: "FeatureCollection", features: waypointFeatures },
    issues,
    stats: {
      segments: laneFeatures.length,
      waypoints: waypointFeatures.length,
      altitudeValues,
      unparseableAltitudes,
      envelopeFromMultiValue,
      nullBandSegments,
    },
  };
}
