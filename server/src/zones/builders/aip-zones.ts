// DO-013 — builder for the LLP/LLR/danger zones dataset.
//
// Geometry: CAAI zones geodatabase `F_Limited` (Gate 1 second amendment,
// 2026-07-10), already verified in-session against the source's own
// `Limited_Edges` WGS-84 vertices (~1 cm agreement).
// Reconciliation: designator-by-designator against the א'-17 text (appendix
// ב'), which GOVERNS — presence, altitude band, name. On altitude conflict the
// text value wins and the zone is flagged; unparseable values yield null and a
// report entry. Nothing is averaged or guessed (trigger 1).

import type { A17Parsed, AppendixBEntry } from "../a17.js";
import type { ZoneFeature, ZoneFeatureCollection } from "../dataset.js";
import { parseDmsPair } from "../dms.js";
import { circlePolygon, polygonFromVertices } from "../geometry.js";
import { isUnlimited, parseA17AltitudeFt, parseGdbAltitudeFt, type GdbDump } from "../gdb.js";

export const AIP_ZONE_TYPES: Record<string, string> = {
  P: "AIP_PROHIBITED",
  R: "AIP_RESTRICTED",
  D: "AIP_DANGER",
};

export interface ReconIssue {
  code: string;
  kind:
    | "gdb-only"
    | "text-only"
    | "text-built"
    | "altitude-mismatch"
    | "altitude-unparseable"
    | "altitude-multi-value"
    | "altitude-not-published"
    | "altitude-null-band"
    | "name-mismatch"
    | "vertex-mismatch"
    | "vertex-issue"
    | "parse-failure"
    | "note";
  detail: string;
}

export interface AipZonesResult {
  collection: ZoneFeatureCollection;
  issues: ReconIssue[];
  stats: {
    gdbZones: number;
    textEntries: number;
    matched: number;
    gdbOnly: number;
    textOnly: number;
    textBuilt: number;
    textVerticesChecked: number;
    textVerticesMatched: number;
  };
}

/** Compare Hebrew names ignoring spacing/punctuation/quote differences. */
function normalizeName(s: string | null): string {
  return (s ?? "").replace(/["'׳״()\s·–—-]+/g, "");
}

function str(v: string | number | boolean | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

/** All WGS-84 [lng, lat] positions of a (Multi)Polygon geometry. */
function polygonPositions(geometry: unknown): [number, number][] {
  const g = geometry as { type: string; coordinates: number[][][] | number[][][][] };
  const out: [number, number][] = [];
  const polys = g.type === "MultiPolygon" ? (g.coordinates as number[][][][]) : [g.coordinates as number[][][]];
  for (const poly of polys) for (const ring of poly) for (const pos of ring) out.push([pos[0], pos[1]]);
  return out;
}

const VERTEX_TOLERANCE_DEG = 2e-5; // ≈ 2 m — both sides derive from the same published DMS

/**
 * Strictly-parseable text geometry for a zone absent from the gdb:
 * a pure vertex list (≥3 vertices, no unparseable cells, no prose), or a
 * circle whose definition is exactly "מעגל שרדיוסו <int> מטר/ק"מ" with one
 * published center. Everything else returns null — excluded, never guessed.
 */
function tryTextGeometry(
  entry: AppendixBEntry,
): { geometry: unknown; kind: "vertex list" | "circle"; detail: string } | null {
  if (entry.vertexIssues.length > 0) return null;
  if (!entry.noteHe && entry.vertices.length >= 3) {
    return {
      geometry: polygonFromVertices(entry.vertices),
      kind: "vertex list",
      detail: `${entry.vertices.length} published vertices`,
    };
  }
  if (entry.noteHe) {
    // The PDF word-splits unpredictably ("ש רדיוסו", 'ק " מ') — match on the
    // despaced note. Digits and units survive despacing unambiguously.
    const despaced = entry.noteHe.replace(/\s+/g, "");
    const m = /מעגלשרדיוסו(\d+)(מטר|ק"מ)ומרכזו/.exec(despaced);
    if (m) {
      const radiusM = m[2] === "מטר" ? Number(m[1]) : Number(m[1]) * 1000;
      // Center: either the single vertex cell, or (some rows merge the
      // coordinates into the note cell) exactly one DMS pair inside the note.
      let center = entry.vertices.length === 1 ? entry.vertices[0] : null;
      if (!center && entry.vertices.length === 0) {
        const pairs = [
          ...entry.noteHe.matchAll(/(\d{1,3}° \d{1,2}' [\d.]+" N)\s+(\d{1,3}° \d{1,2}' [\d.]+" E)/g),
        ];
        if (pairs.length === 1) {
          const { lat, lng } = parseDmsPair(pairs[0][1], pairs[0][2]);
          center = { northRaw: pairs[0][1], eastRaw: pairs[0][2], lat, lng };
        }
      }
      if (center) {
        return {
          geometry: circlePolygon(center.lat, center.lng, radiusM),
          kind: "circle",
          detail: `radius ${m[1]} ${m[2]} around ${center.northRaw} ${center.eastRaw}`,
        };
      }
    }
  }
  return null;
}

export function buildAipZones(fLimited: GdbDump, a17: A17Parsed): AipZonesResult {
  const issues: ReconIssue[] = [];
  const textByCode = new Map<string, AppendixBEntry>(a17.appendixB.map((e) => [e.code, e]));
  const gdbCodes = new Set<string>();

  for (const failure of a17.failures.filter((f) => f.appendix === "B")) {
    issues.push({ code: failure.code, kind: "parse-failure", detail: `p${failure.page}: ${failure.reason}` });
  }

  const features: ZoneFeature[] = [];
  const sorted = [...fLimited.features].sort((a, b) =>
    String(a.properties.designator).localeCompare(String(b.properties.designator)),
  );

  let matched = 0;
  let textVerticesChecked = 0;
  let textVerticesMatched = 0;

  for (const feature of sorted) {
    const code = str(feature.properties.designator)!;
    gdbCodes.add(code);
    const type = str(feature.properties.Type) ?? "";
    const zoneTypeCode = AIP_ZONE_TYPES[type];
    if (!zoneTypeCode) {
      issues.push({ code, kind: "parse-failure", detail: `unknown gdb Type ${JSON.stringify(type)} — zone excluded` });
      continue;
    }

    const gdbFloorRaw = str(feature.properties.AltMin);
    const gdbCeilingRaw = str(feature.properties.AltMax);
    const gdbFloor = parseGdbAltitudeFt(gdbFloorRaw);
    const gdbCeiling = parseGdbAltitudeFt(gdbCeilingRaw);
    const text = textByCode.get(code);

    let floorAmslFt: number | null;
    let ceilingAmslFt: number | null;
    const notes: string[] = [];

    if (text) {
      matched += 1;
      // The text governs. Use its altitude band; reconcile against the gdb.
      const textFloor = parseA17AltitudeFt(text.altMinRaw);
      const textCeiling = parseA17AltitudeFt(text.altMaxRaw);

      if (text.altMinRaw !== null && textFloor === null) {
        issues.push({ code, kind: "altitude-unparseable", detail: `text floor ${JSON.stringify(text.altMinRaw)} — floor left null` });
      }
      if (isUnlimited(text.altMaxRaw)) {
        // Published "UNL" — a real value with no numeric representation.
        notes.push("ceiling UNL (unlimited) per א'-17 — stored null; gdb encodes as 99000");
        issues.push({ code, kind: "note", detail: `ceiling published as UNL (unlimited) — stored null (gdb: ${gdbCeilingRaw ?? "-"})` });
      } else if (text.altMaxRaw !== null && textCeiling === null) {
        issues.push({ code, kind: "altitude-unparseable", detail: `text ceiling ${JSON.stringify(text.altMaxRaw)} — ceiling left null` });
      }
      floorAmslFt = textFloor;
      ceilingAmslFt = textCeiling;

      if (textFloor !== null && gdbFloor !== null && textFloor !== gdbFloor) {
        issues.push({ code, kind: "altitude-mismatch", detail: `floor: text ${text.altMinRaw} (=${textFloor} ft) vs gdb ${gdbFloorRaw} — text wins` });
        notes.push(`altitude floor: text governs (${text.altMinRaw}); gdb had ${gdbFloorRaw}`);
      }
      if (textCeiling !== null && gdbCeiling !== null && textCeiling !== gdbCeiling) {
        issues.push({ code, kind: "altitude-mismatch", detail: `ceiling: text ${text.altMaxRaw} ft vs gdb ${gdbCeilingRaw} — text wins` });
        notes.push(`altitude ceiling: text governs (${text.altMaxRaw} ft); gdb had ${gdbCeilingRaw}`);
      }
      if (textCeiling === null && !isUnlimited(text.altMaxRaw) && gdbCeilingRaw !== null) {
        issues.push({ code, kind: "altitude-mismatch", detail: `text ceiling missing/unparseable while gdb has ${JSON.stringify(gdbCeilingRaw)} — ceiling null (text governs)` });
      }

      // name reconciliation (display-level, normalized comparison)
      const gdbNameHe = str(feature.properties.HebrewName);
      if (text.nameHe && gdbNameHe && normalizeName(text.nameHe) !== normalizeName(gdbNameHe)) {
        issues.push({ code, kind: "name-mismatch", detail: `text "${text.nameHe}" vs gdb "${gdbNameHe}"` });
      }

      // Vertex spot-check: text vertices should coincide with gdb polygon
      // vertices (both derive from the same published DMS). For zones whose
      // text definition is partly prose (circles/arcs/border-following), the
      // text coordinates are centers/arc-points — they legitimately don't
      // appear as outline vertices, so they get a per-zone summary instead of
      // per-vertex noise.
      const positions = polygonPositions(feature.geometryWgs84);
      let hits = 0;
      const missed: typeof text.vertices = [];
      for (const vertex of text.vertices) {
        textVerticesChecked += 1;
        const hit = positions.some(
          (p) => Math.abs(p[0] - vertex.lng) < VERTEX_TOLERANCE_DEG && Math.abs(p[1] - vertex.lat) < VERTEX_TOLERANCE_DEG,
        );
        if (hit) {
          hits += 1;
          textVerticesMatched += 1;
        } else {
          missed.push(vertex);
        }
      }
      if (text.noteHe) {
        notes.push(`א'-17 definition note: ${text.noteHe}`);
        issues.push({
          code,
          kind: "note",
          detail: `text defines geometry partly by prose (circle/arc/border) — gdb geometry used; ${hits}/${text.vertices.length} text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it`,
        });
      } else if (missed.length > 0) {
        // Pure vertex list disagreeing with the gdb outline — a real
        // text-vs-gdb geometry conflict. Gdb geometry retained (Gate 1);
        // the text governs on contradiction, so this REQUIRES adjudication.
        notes.push(
          `GEOMETRY DISAGREEMENT: ${missed.length}/${text.vertices.length} א'-17 vertices do not appear in the gdb outline — requires visual adjudication (ב'-08)`,
        );
        for (const vertex of missed) {
          issues.push({ code, kind: "vertex-mismatch", detail: `text vertex ${vertex.northRaw} / ${vertex.eastRaw} not found in gdb polygon (±2 m)` });
        }
      }
      for (const issue of text.vertexIssues) {
        issues.push({ code, kind: "vertex-issue", detail: `unparseable coordinate cell in text: ${JSON.stringify(issue)}` });
      }
    } else {
      // gdb-only zone: not in the א'-17 appendix (e.g. ENR 5.1 zones).
      const a17Flag = str(feature.properties.A17);
      const enr = [str(feature.properties.ENR6_1), str(feature.properties.enr6_6)].filter(Boolean).join(", ");
      issues.push({
        code,
        kind: "gdb-only",
        detail: `not in א'-17 appendix ב' (gdb A17 flag: ${a17Flag ?? "null"}${enr ? `; ENR refs: ${enr}` : ""}) — altitudes from gdb, flagged unverified`,
      });
      floorAmslFt = gdbFloor;
      ceilingAmslFt = gdbCeiling;
      if (gdbFloorRaw !== null && gdbFloor === null) {
        issues.push({ code, kind: "altitude-unparseable", detail: `gdb floor ${JSON.stringify(gdbFloorRaw)} — floor left null` });
      }
      if (gdbCeilingRaw !== null && gdbCeiling === null) {
        issues.push({ code, kind: "altitude-unparseable", detail: `gdb ceiling ${JSON.stringify(gdbCeilingRaw)} — ceiling left null` });
      }
      notes.push(`not in א'-17 appendix ב' — source: gdb only (A17 flag ${a17Flag ?? "null"})`);
    }

    const editor = str(feature.properties.Editor);
    const modified = str(feature.properties.Modified);
    if (modified) notes.push(`gdb editor stamp: ${editor ?? "?"} ${modified}`);
    const comment = str(feature.properties.Comment);
    if (comment) notes.push(`gdb comment: ${comment}`);

    features.push({
      type: "Feature",
      properties: {
        code,
        nameHe: text?.nameHe ?? str(feature.properties.HebrewName),
        nameEn: str(feature.properties.name),
        zoneTypeCode,
        floorAmslFt,
        ceilingAmslFt,
        aglCeilingFt: null,
        notes: notes.length > 0 ? notes.join(" | ") : null,
      },
      geometry: feature.geometryWgs84,
    });
  }

  // Zones in the text but missing from the gdb — the gdb carries 2016–2020
  // editor stamps while the text is עדכון 2/25, so newer zones exist only in
  // the text. The text GOVERNS: where its definition is strictly parseable
  // (a pure vertex list, or an explicit integer-radius circle), the zone is
  // built from the text and provenance-flagged. Anything looser (arcs,
  // border-following, "חצי ק"מ") is excluded and reported — never guessed.
  let textOnly = 0;
  let textBuilt = 0;
  for (const entry of a17.appendixB) {
    if (gdbCodes.has(entry.code)) continue;
    textOnly += 1;
    const zoneTypeCode = AIP_ZONE_TYPES[{ P: "P", R: "R", D: "D" }[entry.code.charAt(2)] ?? ""];
    const geometry = tryTextGeometry(entry);
    if (!geometry || !zoneTypeCode) {
      issues.push({
        code: entry.code,
        kind: "text-only",
        detail: `in א'-17 appendix ב' (p${entry.page}, "${entry.nameHe ?? "?"}") but NOT in the gdb, and its text definition is not a strictly-parseable vertex list/circle — zone NOT imported${entry.noteHe ? `; definition: ${entry.noteHe}` : ""}${entry.vertexIssues.length > 0 ? `; unparseable coordinates: ${entry.vertexIssues.join("; ")}` : ""}`,
      });
      continue;
    }
    textBuilt += 1;
    const textFloor = parseA17AltitudeFt(entry.altMinRaw);
    const textCeiling = isUnlimited(entry.altMaxRaw) ? null : parseA17AltitudeFt(entry.altMaxRaw);
    issues.push({
      code: entry.code,
      kind: "text-built",
      detail: `NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 ${geometry.kind} (${geometry.detail}); needs ב'-08 visual check`,
    });
    features.push({
      type: "Feature",
      properties: {
        code: entry.code,
        nameHe: entry.nameHe,
        nameEn: null,
        zoneTypeCode,
        floorAmslFt: textFloor,
        ceilingAmslFt: textCeiling,
        aglCeilingFt: null,
        notes: `geometry from א'-17 appendix ב' text (${geometry.detail}) — zone absent from ZONE_gdb.zip${isUnlimited(entry.altMaxRaw) ? " | ceiling UNL (unlimited) — stored null" : ""}`,
      },
      geometry: geometry.geometry,
    });
  }
  features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

  issues.sort((a, b) => a.code.localeCompare(b.code) || a.kind.localeCompare(b.kind));

  return {
    collection: { type: "FeatureCollection", features },
    issues,
    stats: {
      gdbZones: fLimited.features.length,
      textEntries: a17.appendixB.length,
      matched,
      gdbOnly: fLimited.features.length - matched,
      textOnly,
      textBuilt,
      textVerticesChecked,
      textVerticesMatched,
    },
  };
}
