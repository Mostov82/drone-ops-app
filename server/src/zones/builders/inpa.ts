// DO-013 — appendix ה' INPA closures (national parks, nature reserves,
// nesting sites — LLP1xxx/LLP2xxx codes with max height in ft AGL).
//
// The appendix publishes NO coordinates. Geometry was to come from INPA's
// RATAG_kmz.zip (download manifest Priority 2 — still outstanding/optional)
// or, failing that, OSM polygons as a provenance-tagged gap-filler. This
// builder extracts the authoritative code/name/type/AGL-ceiling table; the
// geometry pairing ships separately once a geometry source is available
// (see the dataset's reconciliation report for the blocked-thread record).

import type { A17Parsed } from "../a17.js";
import type { ReconIssue } from "./aip-zones.js";

export const INPA_ZONE_TYPE = "NATURE_RESERVE";

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
