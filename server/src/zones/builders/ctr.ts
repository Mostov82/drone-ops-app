// DO-036 — builder for the CAAI TLV_FIR controlled-airspace dataset
// (layer `CTR`: classes CTR / ATZ / CTA — findings checkpoint resolved by
// Jonathan, DECISION 2026-07-19).
//
// Rules from the checkpoint:
//   - all three classes import; each maps to its own ZoneType (CTR/ATZ/CTA),
//     all seeded RESTRICTED (editable data). CTA gets NO overhead advisory —
//     the vertical ruling stays lanes-only.
//   - variant polygons (weekend/weekday) import as separate zones; dual
//     ceilings like "3000/3500" take the HIGHER number (conservative for a
//     restricting zone); raw strings + schedule comments preserved in notes.
//   - the file states no altitude unit/datum — adopted as ft AMSL per the
//     producer's sibling files; flagged in every note + the reconciliation
//     report for the visual check. Nothing is guessed beyond that adoption.

import type { ZoneFeature, ZoneFeatureCollection } from "../dataset.js";
import type { GdbDump } from "../gdb.js";
import type { ReconIssue } from "./aip-zones.js";

export const CTR_ZONE_TYPES: Record<string, string> = {
  CTR: "CTR",
  ATZ: "ATZ",
  CTA: "CTA",
};

const UNIT_CAVEAT =
  "altitude unit unstated in source — adopted ft AMSL per producer's sibling files (verify in visual check)";

export interface CtrResult {
  collection: ZoneFeatureCollection;
  issues: ReconIssue[];
  stats: {
    features: number;
    perClass: Record<string, number>;
    dualCeilings: number;
    unparseableCeilings: number;
    disambiguatedCodes: number;
    civil: number;
    military: number;
  };
}

/** "3000/3500" → 3500 (conservative envelope); "2000" → 2000; junk → null. */
export function parseCeilingEnvelopeFt(raw: string | number | null | undefined): {
  value: number | null;
  parts: number[];
} {
  if (raw === null || raw === undefined) return { value: null, parts: [] };
  const parts = String(raw)
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^-?\d+$/.test(part)) return { value: null, parts: numbers };
    numbers.push(Number(part));
  }
  if (numbers.length === 0) return { value: null, parts: [] };
  return { value: Math.max(...numbers), parts: numbers };
}

export function buildCtr(dump: GdbDump): CtrResult {
  const issues: ReconIssue[] = [];
  const features: ZoneFeature[] = [];
  const perClass: Record<string, number> = {};
  const usedCodes = new Map<string, number>();
  let dualCeilings = 0;
  let unparseableCeilings = 0;
  let disambiguatedCodes = 0;
  let civil = 0;
  let military = 0;

  for (const feat of dump.features) {
    const p = feat.properties;
    const type = String(p.TYPE ?? "").trim();
    const zoneTypeCode = CTR_ZONE_TYPES[type];
    const name = p.Name === null || p.Name === undefined ? null : String(p.Name);
    const rawCode = p.Code === null || p.Code === undefined ? null : String(p.Code).trim();

    if (!zoneTypeCode) {
      issues.push({
        code: rawCode ?? `fid:${feat.fid}`,
        kind: "parse-failure",
        detail: `unknown TYPE ${JSON.stringify(p.TYPE)} ("${name}") — NOT imported; classes beyond CTR/ATZ/CTA need a new checkpoint`,
      });
      continue;
    }
    if (!feat.geometryWgs84) {
      issues.push({
        code: rawCode ?? `fid:${feat.fid}`,
        kind: "no-geometry",
        detail: `feature "${name}" has no geometry — NOT imported`,
      });
      continue;
    }

    // Unique dataset code: TYPE-CODE, suffixed on collision (fid order = deterministic).
    const base = `${type}-${rawCode ?? `FID${feat.fid}`}`;
    const seen = usedCodes.get(base) ?? 0;
    usedCodes.set(base, seen + 1);
    const code = seen === 0 ? base : `${base}-${seen + 1}`;
    if (seen > 0) {
      disambiguatedCodes += 1;
      issues.push({
        code,
        kind: "note",
        detail: `code ${base} repeats in the source ("${name}" — variant/expansion polygon); imported as its own zone per checkpoint`,
      });
    }

    // Floor: numeric field. Ceiling: string, possibly dual — conservative max.
    const floorRaw = p.Min_Alt;
    const floor =
      typeof floorRaw === "number" && Number.isFinite(floorRaw) ? Math.trunc(floorRaw) : null;
    if (floor === null) {
      issues.push({
        code,
        kind: "altitude-unparseable",
        detail: `Min_Alt ${JSON.stringify(floorRaw)} not numeric — floor null`,
      });
    }
    const { value: ceiling, parts } = parseCeilingEnvelopeFt(
      p.Max_Alt as string | number | null,
    );
    if (parts.length > 1) {
      dualCeilings += 1;
      issues.push({
        code,
        kind: "altitude-multi-value",
        detail: `ceiling "${p.Max_Alt}" — envelope max ${ceiling} adopted (conservative); raw preserved in notes`,
      });
    } else if (ceiling === null) {
      unparseableCeilings += 1;
      issues.push({
        code,
        kind: "altitude-unparseable",
        detail: `Max_Alt ${JSON.stringify(p.Max_Alt)} unparseable — ceiling null (never guessed)`,
      });
    }

    const civMil = p.Civ_Mil === null || p.Civ_Mil === undefined ? null : String(p.Civ_Mil);
    if (civMil === "אזרחי") civil += 1;
    else if (civMil === "צבאי") military += 1;

    const notes: string[] = [type];
    if (civMil) notes.push(civMil);
    if (parts.length > 1) notes.push(`ceiling raw ${p.Max_Alt} (envelope max adopted)`);
    if (p.Comment) notes.push(`schedule: ${String(p.Comment)}`);
    if (p.Modified) notes.push(`source stamp ${String(p.Modified).slice(0, 10)}`);
    notes.push(UNIT_CAVEAT);

    features.push({
      type: "Feature",
      properties: {
        code,
        nameHe: name,
        nameEn: null,
        zoneTypeCode,
        floorAmslFt: floor,
        ceilingAmslFt: ceiling,
        aglCeilingFt: null,
        notes: notes.join(" | "),
      },
      geometry: feat.geometryWgs84,
    });
    perClass[type] = (perClass[type] ?? 0) + 1;
  }

  features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));
  issues.sort((a, b) => a.code.localeCompare(b.code) || a.kind.localeCompare(b.kind));

  return {
    collection: { type: "FeatureCollection", features },
    issues,
    stats: {
      features: features.length,
      perClass,
      dualCeilings,
      unparseableCeilings,
      disambiguatedCodes,
      civil,
      military,
    },
  };
}
