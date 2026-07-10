// DO-013 — builder for the appendix ג' LLU drone no-fly dataset
// (MTOW < 25 kg, VLOS). The single most drone-relevant table in the AIP.
//
// Circles: published center (DMS) + closure radius in metres, generated as
// geodesic polygons (segment count documented in the manifest). Polygon LLUs
// (LLU22 two airspaces, LLU55) come from their published vertex lists,
// visually verified in-session against the rendered PDF pages.
// The LLU59–LLU72 max-height note (ft AGL) is parsed from the chapter prose —
// an AGL value that deliberately does NOT populate the AMSL columns.

import type { A17Dump, A17Parsed } from "../a17.js";
import type { ZoneFeature, ZoneFeatureCollection } from "../dataset.js";
import { circlePolygon, polygonFromVertices } from "../geometry.js";
import type { ReconIssue } from "./aip-zones.js";
import { stripBidi } from "../dms.js";

export const LLU_ZONE_TYPE = "LLU_DRONE";

export interface LluResult {
  collection: ZoneFeatureCollection;
  issues: ReconIssue[];
  stats: {
    textEntries: number;
    circles: number;
    polygonZones: number;
    excluded: number;
    proseCodes: number;
    aglNote: { codes: string[]; ceilingFt: number } | null;
  };
}

/**
 * Find the prose rule "אזורים LLU59-LLU72 הינם בגובה מירבי 300 רגל מעפ"ש"
 * and return the code range + ft value — parsed from the source text, never
 * hard-coded (conventions §4). Returns null (and a report entry) if absent.
 */
export function parseAglNote(dump: A17Dump): { from: number; to: number; ceilingFt: number } | null {
  for (const page of dump.pages) {
    const text = stripBidi(page.text);
    // Word order may run either way; both captured forms appear in the wild.
    const m =
      /LLU(\d{1,3})\s*-\s*LLU(\d{1,3})[^\n]*?(\d{2,4})\s*רגל/.exec(text) ??
      /רגל\s*(\d{2,4})[^\n]*?LLU(\d{1,3})\s*-\s*LLU(\d{1,3})/.exec(text);
    if (!m) continue;
    const nums = m.slice(1).map(Number);
    const isFirstForm = /LLU\d{1,3}\s*-\s*LLU\d{1,3}[^\n]*?\d{2,4}\s*רגל/.test(text);
    const [from, to, ceilingFt] = isFirstForm ? nums : [nums[1], nums[2], nums[0]];
    return { from, to, ceilingFt };
  }
  return null;
}

export function buildLlu(a17: A17Parsed, dump: A17Dump): LluResult {
  const issues: ReconIssue[] = [];
  const features: ZoneFeature[] = [];
  let circles = 0;
  let polygonZones = 0;
  let excluded = 0;

  for (const failure of a17.failures.filter((f) => f.appendix === "C")) {
    excluded += 1;
    issues.push({ code: failure.code, kind: "parse-failure", detail: `p${failure.page}: ${failure.reason} — zone EXCLUDED` });
  }

  const aglNote = parseAglNote(dump);
  if (!aglNote) {
    issues.push({ code: "LLU59-LLU72", kind: "note", detail: "prose AGL-ceiling note not found in the chapter text — aglCeilingFt left null for all LLU zones" });
  }

  const entries = [...a17.appendixC].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );

  for (const entry of entries) {
    const codeNum = Number(entry.code.replace("LLU", ""));
    const aglCeilingFt =
      aglNote && codeNum >= aglNote.from && codeNum <= aglNote.to ? aglNote.ceilingFt : null;
    const notes: string[] = [];
    if (aglCeilingFt !== null) {
      notes.push(`max height ${aglCeilingFt} ft AGL (מעפ"ש) per א'-17 prose — AGL, deliberately not stored in the AMSL columns`);
    }

    try {
      let geometry: unknown;
      if (entry.radiusM !== null && entry.center) {
        geometry = circlePolygon(entry.center.lat, entry.center.lng, entry.radiusM);
        notes.push(`circle: center ${entry.center.northRaw} ${entry.center.eastRaw}, radius ${entry.radiusM} m (published)`);
        circles += 1;
      } else if (entry.polygons.length > 0) {
        const polys = entry.polygons.map((p) => polygonFromVertices(p.vertices));
        geometry =
          polys.length === 1
            ? polys[0]
            : { type: "MultiPolygon", coordinates: polys.map((p) => p.coordinates) };
        notes.push(`polygon zone: ${entry.polygons.map((p) => `${p.labelHe} (${p.vertices.length} vertices)`).join("; ")}`);
        polygonZones += 1;
      } else {
        throw new Error("entry has neither radius nor polygons");
      }

      features.push({
        type: "Feature",
        properties: {
          code: entry.code,
          nameHe: entry.nameHe,
          nameEn: null,
          zoneTypeCode: LLU_ZONE_TYPE,
          floorAmslFt: null,
          ceilingAmslFt: null,
          aglCeilingFt,
          notes: notes.join(" | "),
        },
        geometry,
      });
    } catch (err) {
      excluded += 1;
      issues.push({ code: entry.code, kind: "parse-failure", detail: `${(err as Error).message} — zone EXCLUDED` });
    }
  }

  // cross-check against the prose list in the chapter body
  const tableCodes = new Set(entries.map((e) => e.code));
  for (const code of a17.proseLluCodes) {
    if (!tableCodes.has(code)) {
      issues.push({ code, kind: "text-only", detail: "mentioned in chapter prose but missing from the appendix ג' table" });
    }
  }
  for (const code of tableCodes) {
    if (!a17.proseLluCodes.includes(code)) {
      issues.push({ code, kind: "note", detail: "in the appendix ג' table but not mentioned in chapter prose (informational)" });
    }
  }

  issues.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }) || a.kind.localeCompare(b.kind));

  return {
    collection: { type: "FeatureCollection", features },
    issues,
    stats: {
      textEntries: a17.appendixC.length,
      circles,
      polygonZones,
      excluded,
      proseCodes: a17.proseLluCodes.length,
      aglNote: aglNote ? { codes: [`LLU${aglNote.from}`, `LLU${aglNote.to}`], ceilingFt: aglNote.ceilingFt } : null,
    },
  };
}
