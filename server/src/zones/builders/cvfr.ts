// DO-013 — CVFR flight-lane conversion (FR-C6).
//
// TRIGGER 6 (intent doc): a lane carries per-direction altitudes — in fact
// FOUR directional fields (N_A / S_A / W_Alt / E_Alt) with 'X' (not
// applicable), blanks and dual values ("2500/3500") — while Zone has a single
// floor/ceiling pair. Per the escalation discipline this module CONVERTS the
// geodatabase to GeoJSON, faithfully preserving every published altitude
// string, but the dataset ships with `importable: false`. The modeling
// decision (how lanes map to Zone rows) is surfaced for Jonathan; the import
// becomes runnable by flipping the manifest once the decision lands.

import type { GdbDump } from "../gdb.js";
import type { ReconIssue } from "./aip-zones.js";

export const LANE_ZONE_TYPE = "CVFR_LANE"; // reserved; not seeded until trigger 6 resolves

export interface LaneFeature {
  type: "Feature";
  properties: {
    code: string;
    firstWaypoint: string | null;
    secondWaypoint: string | null;
    nameEn: string | null;
    nameHe: string | null;
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

export function buildCvfr(routes: GdbDump, points: GdbDump): CvfrResult {
  const issues: ReconIssue[] = [];
  const altitudeValues: Record<string, Record<string, number>> = {};
  let unparseableAltitudes = 0;

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
      for (const [field, value] of Object.entries(rawAlts)) {
        const key = value ?? "<null>";
        altitudeValues[field] ??= {};
        altitudeValues[field][key] = (altitudeValues[field][key] ?? 0) + 1;
        if (value !== null && value !== "X" && !/^\d+$/.test(value)) {
          unparseableAltitudes += 1;
          issues.push({
            code,
            kind: "altitude-unparseable",
            detail: `${field} = ${JSON.stringify(value)} — not a single integer; carried raw, parsed value null (trigger 6 material)`,
          });
        }
      }

      return {
        type: "Feature" as const,
        properties: {
          code,
          firstWaypoint: first,
          secondWaypoint: second,
          nameEn: str(f.properties.Name),
          nameHe: str(f.properties.HebrewName),
          military: str(f.properties.Military),
          byRequest: str(f.properties.byReques),
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
    },
  };
}
