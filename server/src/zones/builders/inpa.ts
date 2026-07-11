// DO-013 — appendix ה' INPA closures (national parks, nature reserves,
// nesting sites — LLP1xxx/LLP2xxx codes with max height in ft AGL).
//
// The appendix publishes NO coordinates. `buildInpa` extracts the
// authoritative code/name/type/AGL-ceiling table from the א'-17 text (which
// GOVERNS). `buildInpaGeo` (session 3, RATAG_kmz received 2026-07-11) pairs
// those entries by EXACT code match against the INPA RATAG KMZ placemarks
// (dumped by scripts/zones/dump_ratag.py) — appendix values win every
// conflict; KMZ values are cross-checked and mismatches reported; entries
// with no KMZ geometry are EXCLUDED and reported, never matched fuzzily
// (trigger 1: a wrong polygon is worse than a missing one).
//
// Currency caveat: the KMZ is stamped 07-09-2020 (like the ZONE gdb's
// 2016–2020 editor stamps) while the appendix text is עדכון 1/25 — another
// reason the text governs and everything ships verified=false.

import type { A17Parsed } from "../a17.js";
import type { ZoneFeature, ZoneFeatureCollection } from "../dataset.js";
import type { ReconIssue } from "./aip-zones.js";

export const INPA_ZONE_TYPE = "NATURE_RESERVE";

/** Shape of scripts/zones/dump_ratag.py output. */
export interface RatagDump {
  sourceZip: string;
  innerKmz: string;
  placemarks: {
    id: string | null;
    fields: Record<string, string | null>;
    geometry: unknown | null;
  }[];
}

export interface InpaEntry {
  code: string;
  nameHe: string | null;
  typeHe: string | null;
  maxAglFt: number | null;
  page: number;
}

export interface InpaResult {
  entries: InpaEntry[];
  issues: ReconIssue[];
  stats: {
    rawRows: number;
    unique: number;
    duplicatesDropped: number;
    parks: number;
    reserves: number;
    missingAgl: number;
    missingName: number;
  };
}

export function buildInpa(a17: A17Parsed): InpaResult {
  const issues: ReconIssue[] = [];

  for (const failure of a17.failures.filter((f) => f.appendix === "E")) {
    issues.push({ code: failure.code, kind: "parse-failure", detail: `p${failure.page}: ${failure.reason}` });
  }

  // Dedupe by code. Identical duplicates are page-artifacts; conflicting
  // duplicates are flagged and the FIRST occurrence kept (source order).
  const byCode = new Map<string, InpaEntry>();
  let duplicatesDropped = 0;
  for (const raw of a17.appendixE) {
    const entry: InpaEntry = {
      code: raw.code,
      nameHe: raw.nameHe,
      typeHe: raw.typeHe,
      maxAglFt: raw.maxAglFt,
      page: raw.page,
    };
    const existing = byCode.get(entry.code);
    if (!existing) {
      byCode.set(entry.code, entry);
      continue;
    }
    duplicatesDropped += 1;
    const conflicting =
      (entry.nameHe && existing.nameHe && entry.nameHe !== existing.nameHe) ||
      (entry.maxAglFt !== null && existing.maxAglFt !== null && entry.maxAglFt !== existing.maxAglFt);
    if (conflicting) {
      issues.push({
        code: entry.code,
        kind: "name-mismatch",
        detail: `duplicate rows disagree: "${existing.nameHe}"/${existing.maxAglFt} (p${existing.page}) vs "${entry.nameHe}"/${entry.maxAglFt} (p${entry.page}) — first kept, verify manually`,
      });
    } else {
      // fill gaps from the duplicate (split rows across a page break)
      existing.nameHe ??= entry.nameHe;
      existing.typeHe ??= entry.typeHe;
      existing.maxAglFt ??= entry.maxAglFt;
    }
  }

  const entries = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  let missingAgl = 0;
  let missingName = 0;
  for (const entry of entries) {
    if (entry.maxAglFt === null) {
      missingAgl += 1;
      issues.push({ code: entry.code, kind: "altitude-unparseable", detail: `no AGL ceiling extracted (p${entry.page}) — null` });
    }
    if (!entry.nameHe) {
      missingName += 1;
      issues.push({ code: entry.code, kind: "name-mismatch", detail: `no name extracted (p${entry.page})` });
    }
  }

  return {
    entries,
    issues,
    stats: {
      rawRows: a17.appendixE.length,
      unique: entries.length,
      duplicatesDropped,
      parks: entries.filter((e) => e.code.startsWith("LLP1")).length,
      reserves: entries.filter((e) => e.code.startsWith("LLP2")).length,
      missingAgl,
      missingName,
    },
  };
}

// ── Session 3 — geometry pairing against the RATAG KMZ ──────────────────────

export interface InpaGeoResult {
  collection: ZoneFeatureCollection;
  issues: ReconIssue[];
  stats: {
    appendixEntries: number;
    kmzPlacemarks: number;
    paired: number;
    appendixOnlyExcluded: number;
    kmzOnlyIgnored: number;
    kmzDuplicatesDropped: number;
    altitudeMismatches: number;
    kmzAltitudeWhereAppendixNull: number;
    nameMismatches: number;
  };
}

/** Whitespace/punctuation-tolerant Hebrew name comparison (NOT fuzzy matching —
 * pairing is by code only; this is a cross-check of the paired row's name). */
function normalizeName(value: string | null): string {
  return (value ?? "")
    .replace(/["'׳״“”]/g, "")
    .replace(/\s*[,-]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIntOrNull(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value.trim());
  return Number.isInteger(n) ? n : null;
}

export function buildInpaGeo(inpa: InpaResult, ratag: RatagDump): InpaGeoResult {
  const issues: ReconIssue[] = [];
  const kmzStamp = ratag.innerKmz.replace(/\.kmz$/i, "").split("/").pop() ?? ratag.innerKmz;

  // Index KMZ placemarks by code — exact match only. Duplicates: first kept, flagged.
  const byCode = new Map<string, RatagDump["placemarks"][number]>();
  let kmzDuplicatesDropped = 0;
  for (const pm of ratag.placemarks) {
    const code = pm.fields.Code?.trim();
    if (!code) {
      issues.push({ code: pm.id ?? "?", kind: "parse-failure", detail: "KMZ placemark without a Code field — ignored" });
      continue;
    }
    if (byCode.has(code)) {
      kmzDuplicatesDropped += 1;
      issues.push({ code, kind: "kmz-only", detail: "duplicate KMZ placemark for this code — first kept, verify manually" });
      continue;
    }
    byCode.set(code, pm);
  }

  const features: ZoneFeature[] = [];
  let appendixOnlyExcluded = 0;
  let altitudeMismatches = 0;
  let kmzAltitudeWhereAppendixNull = 0;
  let nameMismatches = 0;

  for (const entry of inpa.entries) {
    const pm = byCode.get(entry.code);
    if (!pm || !pm.geometry) {
      appendixOnlyExcluded += 1;
      issues.push({
        code: entry.code,
        kind: "no-geometry",
        detail: `in appendix ה' ("${entry.nameHe ?? "?"}") but ${pm ? "its KMZ placemark has no geometry" : `absent from the KMZ (${kmzStamp})`} — NOT imported; needs a newer INPA layer or manual geometry`,
      });
      continue;
    }
    byCode.delete(entry.code);

    const notes: string[] = [];
    if (entry.typeHe) notes.push(entry.typeHe);
    notes.push(`geometry: INPA RATAG KMZ (${kmzStamp}) — appendix ה' text governs attributes`);

    // Cross-check: AGL ceiling. Appendix governs; KMZ maxAlt (Alt=מעל פני השטח → AGL).
    const kmzMaxAgl = parseIntOrNull(pm.fields.maxAlt ?? null);
    if (entry.maxAglFt !== null && kmzMaxAgl !== null && kmzMaxAgl !== entry.maxAglFt) {
      altitudeMismatches += 1;
      issues.push({
        code: entry.code,
        kind: "altitude-mismatch",
        detail: `appendix ה' AGL ceiling ${entry.maxAglFt} ft vs KMZ maxAlt ${kmzMaxAgl} — appendix kept`,
      });
      notes.push(`kmz maxAlt=${kmzMaxAgl} (differs; appendix value kept)`);
    } else if (entry.maxAglFt === null && kmzMaxAgl !== null) {
      kmzAltitudeWhereAppendixNull += 1;
      issues.push({
        code: entry.code,
        kind: "altitude-not-published",
        detail: `appendix ה' has no AGL ceiling; KMZ carries maxAlt ${kmzMaxAgl} — kept OUT of aglCeilingFt (text governs; noted only)`,
      });
      notes.push(`kmz maxAlt=${kmzMaxAgl} (not adopted — appendix publishes none)`);
    }

    // Cross-check: site name (KMZ "Place") — pairing stays code-based.
    const kmzPlace = pm.fields.Place ?? null;
    if (entry.nameHe && kmzPlace && normalizeName(entry.nameHe) !== normalizeName(kmzPlace)) {
      nameMismatches += 1;
      issues.push({
        code: entry.code,
        kind: "name-mismatch",
        detail: `appendix "${entry.nameHe}" vs KMZ Place "${kmzPlace}" — appendix name used; code-paired, verify visually`,
      });
      notes.push(`kmz place: ${kmzPlace}`);
    }

    features.push({
      type: "Feature",
      properties: {
        code: entry.code,
        nameHe: entry.nameHe,
        nameEn: null,
        zoneTypeCode: INPA_ZONE_TYPE,
        floorAmslFt: null,
        ceilingAmslFt: null,
        aglCeilingFt: entry.maxAglFt,
        notes: notes.join(" | "),
      },
      geometry: pm.geometry,
    });
  }

  // Whatever is left in the index has no governing appendix row — never imported.
  for (const [code, pm] of byCode) {
    issues.push({
      code,
      kind: "kmz-only",
      detail: `KMZ placemark ("${pm.fields.Place ?? pm.fields.Name ?? "?"}") has no appendix ה' row — NOT imported (nothing governs it)`,
    });
  }

  return {
    collection: { type: "FeatureCollection", features },
    issues,
    stats: {
      appendixEntries: inpa.entries.length,
      kmzPlacemarks: ratag.placemarks.length,
      paired: features.length,
      appendixOnlyExcluded,
      kmzOnlyIgnored: byCode.size,
      kmzDuplicatesDropped,
      altitudeMismatches,
      kmzAltitudeWhereAppendixNull,
      nameMismatches,
    },
  };
}
