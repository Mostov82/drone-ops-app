// DO-013 — dataset build CLI.
//
// Turns the raw dumps (produced by the two Python scripts in this directory)
// into the committed, provenance-tagged datasets under data-sources/zones/.
//
// Full regeneration (offline, from the read-only snapshots):
//   1. python server/scripts/zones/dump_gdb.py <repo-root> <dumps-dir>
//   2. python server/scripts/zones/dump_a17.py \
//        data-sources/aip/aip_a-17_prohibited-restricted-danger-areas.pdf <dumps-dir>/a17.json
//   3. npm run zones:build -w server -- <dumps-dir> [repo-root]
//
// Deterministic: identical inputs yield byte-identical GeoJSON; the manifest's
// `extractedAt` field is the single documented timestamp exception.

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseA17, type A17Dump } from "../../src/zones/a17.js";
import { buildAipZones } from "../../src/zones/builders/aip-zones.js";
import { buildCvfr } from "../../src/zones/builders/cvfr.js";
import { buildInpa, buildInpaGeo, type RatagDump } from "../../src/zones/builders/inpa.js";
import { buildLlu } from "../../src/zones/builders/llu.js";
import { buildOsmAirports } from "../../src/zones/builders/osm-airports.js";
import { stableJson, type DatasetManifest } from "../../src/zones/dataset.js";
import { CIRCLE_SEGMENTS } from "../../src/zones/geometry.js";
import type { GdbDump } from "../../src/zones/gdb.js";
import { issueCounts, renderIssueTable } from "../../src/zones/report.js";

const dumpsDir = process.argv[2];
const repoRoot = process.argv[3] ?? path.resolve(import.meta.dirname, "../../..");
if (!dumpsDir) {
  console.error("usage: tsx build-datasets.ts <dumps-dir> [repo-root]");
  process.exit(2);
}

const zonesRoot = path.join(repoRoot, "data-sources", "zones");

function readDump<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(dumpsDir, name), "utf8")) as T;
}

function sha256(relPath: string): { path: string; sha256: string } {
  const bytes = fs.readFileSync(path.join(repoRoot, relPath));
  return { path: relPath, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function writeDataset(dir: string, files: Record<string, string>): void {
  const abs = path.join(zonesRoot, dir);
  fs.mkdirSync(abs, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(abs, name), content, "utf8");
  }
  console.log(`${dir}: ${Object.keys(files).join(", ")}`);
}

const extractedAt = new Date().toISOString().slice(0, 10); // documented timestamp
const TOOLS = [
  "pyogrio 0.13.0 (GDAL 3.12.4)",
  "pyproj 3.7.2",
  "PyMuPDF 1.28.0",
  "server/src/zones builders (DO-013)",
];
const A17_PDF = "data-sources/aip/aip_a-17_prohibited-restricted-danger-areas.pdf";
const A17_STAMP = "עדכון 2/25 (02 Oct 2025); appendix pages stamped עדכון 1/25 (15 May 2025)";

const fLimited = readDump<GdbDump>("F_Limited.json");
const cvfrRoutes = readDump<GdbDump>("CVFR_ROUTES2023.json");
const cvfrPoints = readDump<GdbDump>("CVFR_POINTS2023.json");
const a17Dump = readDump<A17Dump>("a17.json");
const a17 = parseA17(a17Dump);

// ── 1. LLP/LLR/danger zones (gdb geometry ⊕ א'-17 reconciliation) ───────────
{
  const result = buildAipZones(fLimited, a17);
  const manifest: DatasetManifest = {
    layerKey: "aip-a17-llp-llr-danger",
    title: "AIP א'-17 prohibited / restricted / danger areas (LLP·LLR·LLD)",
    sourceFiles: [sha256("data-sources/gis/ZONE_gdb.zip"), sha256(A17_PDF)],
    aipUpdateStamp: A17_STAMP,
    extractedAt,
    extractionTools: TOOLS,
    featureCount: result.collection.features.length,
    importable: true,
    verified: false,
    notes:
      "Geometry: CAAI zones geodatabase F_Limited (EPSG:32636→WGS-84, verified in-session against Limited_Edges published DMS, ~1 cm agreement). Altitude bands: א'-17 text governs; gdb used only where the text has no entry (flagged). GND/MSL floors stored as 0 ft AMSL (CAAI gdb convention) — see zones-api.md caveat.",
  };
  const report = `# Reconciliation — aip-a17-llp-llr-danger — ${extractedAt}

**Sources:** \`ZONE_gdb.zip\` → \`F_Limited\` (geometry + attributes) vs **א'-17 appendix ב' text (governs)**.

## Counts

- gdb zones: **${result.stats.gdbZones}** (all imported)
- א'-17 appendix ב' entries parsed: **${result.stats.textEntries}**
- matched (gdb ∩ text): **${result.stats.matched}**
- gdb-only (not in א'-17 — ENR-referenced etc.): **${result.stats.gdbOnly}** (imported, flagged; altitudes from gdb)
- text-only (in א'-17, missing from the gdb — the gdb's editor stamps are 2016–2020 vs the text's עדכון 2/25): **${result.stats.textOnly}**, of which **${result.stats.textBuilt}** built from the governing text (pure vertex list / explicit circle, flagged \`text-built\`) and **${result.stats.textOnly - result.stats.textBuilt}** NOT imported (definition not strictly parseable; listed below)
- text vertex spot-checks: **${result.stats.textVerticesMatched}/${result.stats.textVerticesChecked}** matched a gdb polygon vertex within ±2 m (prose-defined zones' centers/arc-points legitimately don't — see per-zone notes)
- total features in dataset: **${result.collection.features.length}**

## Issue summary

${issueCounts(result.issues)}

## Issues (every mismatch listed; text governs — nothing averaged or guessed)

${renderIssueTable(result.issues)}
_Everything ships \`verified=false\` until Jonathan's visual check against the ב'-08 sheets (GB-06 Gate 3)._
`;
  writeDataset("aip-a17-llp-llr-danger", {
    "zones.geojson": stableJson(result.collection),
    "manifest.json": stableJson(manifest),
    "reconciliation.md": report,
  });
}

// ── 2. LLU drone no-fly zones (appendix ג') ──────────────────────────────────
{
  const result = buildLlu(a17, a17Dump);
  const manifest: DatasetManifest = {
    layerKey: "aip-a17-llu-drone",
    title: "AIP א'-17 appendix ג' — LLU drone no-fly zones (MTOW < 25 kg, VLOS)",
    sourceFiles: [sha256(A17_PDF)],
    aipUpdateStamp: A17_STAMP,
    extractedAt,
    extractionTools: TOOLS,
    circleSegments: CIRCLE_SEGMENTS,
    featureCount: result.collection.features.length,
    importable: true,
    verified: false,
    notes:
      "Centers/radii/vertices exactly as published in appendix ג'. Circles are geodesic polygons. LLU59–LLU72 carry a 300 ft AGL max-height note (from chapter prose) in properties.aglCeilingFt — NOT in the AMSL columns.",
  };
  const report = `# Reconciliation — aip-a17-llu-drone — ${extractedAt}

**Source:** א'-17 appendix ג' table (pages 25–28), parsed from PDF table-cell geometry; polygon LLUs (LLU22, LLU55) visually verified against the rendered pages in-session.

## Counts

- appendix ג' entries parsed: **${result.stats.textEntries}**
- imported circles: **${result.stats.circles}** · polygon zones: **${result.stats.polygonZones}** · excluded: **${result.stats.excluded}**
- chapter-prose LLU mentions: **${result.stats.proseCodes}** (cross-checked below)
- AGL ceiling note: ${result.stats.aglNote ? `**${result.stats.aglNote.codes.join("–")} → ${result.stats.aglNote.ceilingFt} ft AGL** (parsed from prose)` : "**NOT FOUND** — aglCeilingFt null everywhere"}

## Issue summary

${issueCounts(result.issues)}

## Issues

${renderIssueTable(result.issues)}
_Everything ships \`verified=false\` until Jonathan's visual check against the ב'-08 sheets (GB-06 Gate 3)._
`;
  writeDataset("aip-a17-llu-drone", {
    "zones.geojson": stableJson(result.collection),
    "manifest.json": stableJson(manifest),
    "reconciliation.md": report,
  });
}

// ── 3. CVFR lanes (option A envelope per DECISION 2026-07-11) ────────────
{
  const result = buildCvfr(cvfrRoutes, cvfrPoints);
  const manifest: DatasetManifest = {
    layerKey: "cvfr-lanes",
    title: "CVFR low transport routes (נתיבי תובלה נמוכים) — one Zone per segment, option-A altitude envelope",
    sourceFiles: [sha256("data-sources/gis/CVFR_caai.zip")],
    aipUpdateStamp: "CVFR_ROUTES2023 / CVFR_POINTS2023 (CAAI GIS layer); governing publication פמ\"ת ב'-03",
    extractedAt,
    extractionTools: TOOLS,
    featureCount: result.stats.segments,
    importable: true,
    verified: false,
    notes:
      "Trigger 6 resolved — option A (DECISION 2026-07-11): floorAmslFt/ceilingAmslFt = min/max of every published directional altitude number (N_A/S_A/W_Alt/E_Alt; dual values contribute both numbers). Raw directional strings preserved verbatim in properties and on Zone.notes. Segments with no published altitude keep a null band (never guessed).",
  };
  const altitudeTable = Object.entries(result.stats.altitudeValues)
    .map(
      ([field, counts]) =>
        `- **${field}**: ${Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([v, n]) => `\`${v}\`×${n}`)
          .join(", ")}`,
    )
    .join("\n");
  const report = `# Reconciliation — cvfr-lanes — ${extractedAt}

**Source:** \`CVFR_caai.zip\` → \`CVFR_ROUTES2023\` (${result.stats.segments} segments) + \`CVFR_POINTS2023\` (${result.stats.waypoints} waypoints), EPSG:32636→WGS-84. Governing publication: **פמ"ת ב'-03** (cross-check target for Jonathan's verification; the chart sheets are \`aip_b-03_cvfr-north/south.pdf\`).

## Counts

- route segments converted: **${result.stats.segments}** (expected 265 — ${result.stats.segments === 265 ? "MATCH" : "MISMATCH"})
- waypoints converted: **${result.stats.waypoints}** (expected 201 — ${result.stats.waypoints === 201 ? "MATCH" : "MISMATCH"})
- altitude strings that are not a single integer (raw carried, per-direction parsed null): **${result.stats.unparseableAltitudes}**
- segments whose option-A envelope used a dual/multi-number string: **${result.stats.envelopeFromMultiValue}**
- segments with NO published altitude — null band, never guessed: **${result.stats.nullBandSegments}**

## Option-A altitude modeling (trigger 6 resolved 2026-07-11)

One Zone row per segment; \`floorAmslFt\` = minimum and \`ceilingAmslFt\` = maximum of every
published directional altitude number on the segment (dual values like \`2000/1000\` contribute
both numbers — the conservative envelope). Raw directional strings are preserved verbatim in the
feature properties and carried onto \`Zone.notes\`. Partially published segments (one direction
\`<Null>\`) take the envelope of what IS published. Per DECISION 2026-07-11.

## Directional altitude value inventory (trigger 6 evidence)

${altitudeTable}

## Issues

${renderIssueTable(result.issues)}
_In-session ב'-03 spot-checks: \`spot-checks_2026-07-10.md\` beside this file. Everything ships \`verified=false\` until Jonathan's visual check (GB-06 Gate 3)._
`;
  writeDataset("cvfr-lanes", {
    "zones.geojson": stableJson(result.lanes),
    "waypoints.geojson": stableJson(result.waypoints),
    "manifest.json": stableJson(manifest),
    "reconciliation.md": report,
  });
}

// ── 4. INPA closures (appendix ה' ⊕ RATAG KMZ geometry — session 3) ──────────
{
  const result = buildInpa(a17);
  const ratagPath = path.join(dumpsDir, "ratag.json");
  if (!fs.existsSync(ratagPath)) {
    // Pre-session-3 behavior kept for regeneration without the KMZ dump.
    console.warn("aip-a17-inpa-closures: ratag.json dump missing — attributes-only dataset (importable: false)");
    const manifest: DatasetManifest = {
      layerKey: "aip-a17-inpa-closures",
      title: "AIP א'-17 appendix ה' — INPA closures (parks/reserves/nesting sites) — attributes only, geometry source outstanding",
      sourceFiles: [sha256(A17_PDF)],
      aipUpdateStamp: A17_STAMP,
      extractedAt,
      extractionTools: TOOLS,
      featureCount: result.entries.length,
      importable: false,
      verified: false,
      notes:
        "Appendix ה' publishes code/name/type/max-height(ft AGL) but NO coordinates. Geometry requires RATAG_kmz.zip (run scripts/zones/dump_ratag.py and rebuild). Max heights are AGL and stay out of the AMSL columns.",
    };
    const report = `# Reconciliation — aip-a17-inpa-closures — ${extractedAt}

**Source:** א'-17 appendix ה' tables (pages 30–49). Geometry dump absent — see the session-3 build for the paired dataset.

## Issues

${renderIssueTable(result.issues)}
`;
    writeDataset("aip-a17-inpa-closures", {
      "entries.json": stableJson(result.entries),
      "manifest.json": stableJson(manifest),
      "reconciliation.md": report,
    });
  } else {
    const ratag = readDump<RatagDump>("ratag.json");
    const geo = buildInpaGeo(result, ratag);
    const manifest: DatasetManifest = {
      layerKey: "aip-a17-inpa-closures",
      title: "AIP א'-17 appendix ה' — INPA closures (parks/reserves/nesting sites) — geometry from INPA RATAG KMZ, code-paired",
      sourceFiles: [sha256(A17_PDF), sha256("data-sources/gis/RATAG_kmz.zip")],
      aipUpdateStamp: `${A17_STAMP}; KMZ geometry stamped 07-09-2020 (inner ${ratag.innerKmz})`,
      extractedAt,
      extractionTools: TOOLS,
      featureCount: geo.collection.features.length,
      importable: true,
      verified: false,
      notes:
        "Pairing is EXACT appendix-ה'-code ↔ KMZ-Code match; appendix text governs names and AGL ceilings; KMZ values cross-checked and mismatches reported. AGL ceilings live in properties.aglCeilingFt — never in the AMSL columns (ratified 2026-07-11). Appendix entries with no KMZ geometry are EXCLUDED (listed in the report), never fuzzy-matched. KMZ vintage 07-09-2020 — currency caveat like the ZONE gdb; text governs.",
    };
    const report = `# Reconciliation — aip-a17-inpa-closures — ${extractedAt}

**Sources:** א'-17 appendix ה' tables (pages 30–49) — **governs** — ⊕ INPA \`RATAG_kmz.zip\` (inner \`${ratag.innerKmz}\`, stamped 07-09-2020) for geometry, paired by exact code.

## Counts

- appendix ה' entries (governing list): **${geo.stats.appendixEntries}** (raw rows ${result.stats.rawRows}, duplicates merged/dropped ${result.stats.duplicatesDropped})
- KMZ placemarks: **${geo.stats.kmzPlacemarks}** (duplicate codes dropped: ${geo.stats.kmzDuplicatesDropped})
- **paired & imported: ${geo.stats.paired}**
- appendix-only — NO geometry, NOT imported: **${geo.stats.appendixOnlyExcluded}** (post-2020 additions; need a newer INPA layer or manual geometry)
- KMZ-only — no governing appendix row, NOT imported: **${geo.stats.kmzOnlyIgnored}**
- AGL-ceiling cross-check: **${geo.stats.altitudeMismatches}** mismatches (appendix kept) · **${geo.stats.kmzAltitudeWhereAppendixNull}** KMZ-only values (noted, not adopted)
- site-name cross-check mismatches (code-paired regardless): **${geo.stats.nameMismatches}**
- entries with no AGL ceiling published: **${result.stats.missingAgl}** · with no name: **${result.stats.missingName}**

## Issue summary

${issueCounts([...result.issues, ...geo.issues])}

## Issues (text governs — nothing averaged, fuzzy-matched, or guessed)

${renderIssueTable([...result.issues, ...geo.issues])}
_Everything ships \`verified=false\` until Jonathan's visual check (GB-06 Gate 3). The KMZ's 2020 vintage makes the ב'-08 / official-map cross-look especially relevant for this layer._
`;
    writeDataset("aip-a17-inpa-closures", {
      "zones.geojson": stableJson(geo.collection),
      "entries.json": stableJson(result.entries),
      "manifest.json": stableJson(manifest),
      "reconciliation.md": report,
    });
  }
}

// ── 5. OSM airport gap-filler (points; buffers from the Ruleset at import) ──
{
  const snapshotPath = path.join(zonesRoot, "osm-airport-buffers", "overpass-raw.json");
  if (!fs.existsSync(snapshotPath)) {
    console.warn("osm-airport-buffers: overpass-raw.json snapshot missing — dataset skipped");
  } else {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    const result = buildOsmAirports(snapshot);
    const manifest: DatasetManifest = {
      layerKey: "osm-airport-buffers",
      title: "OSM gap-filler — aerodrome locations; buffer circles generated at import from Ruleset airport_buffer_km",
      sourceFiles: [sha256("data-sources/zones/osm-airport-buffers/overpass-raw.json")],
      aipUpdateStamp: `OpenStreetMap via Overpass API, data timestamp ${result.stats.osmTimestamp ?? "unknown"}`,
      extractedAt,
      extractionTools: [...TOOLS, "Overpass API (aeroway=aerodrome, bbox 29.4,34.2,33.5,36.0)"],
      circleSegments: CIRCLE_SEGMENTS,
      featureCount: result.collection.features.length,
      importable: true,
      verified: false,
      notes:
        "Gap-filler per Gate 1 (amended): OSM aerodrome locations only. Buffer radius is NOT stored here — the import pipeline reads Ruleset rule airport_buffer_km (fail-closed) and generates the circles at import time (FR-C3/NFR-5).",
    };
    const report = `# Reconciliation — osm-airport-buffers — ${extractedAt}

**Source:** raw Overpass API snapshot (committed beside this file), aeroway=aerodrome within bbox (29.4, 34.2, 33.5, 36.0), OSM data timestamp **${result.stats.osmTimestamp ?? "unknown"}**.

## Counts

- Overpass elements: **${result.stats.elements}** · converted to buffer-anchor points: **${result.stats.converted}** · skipped (no coordinates): **${result.stats.skippedNoCenter}**

## Notes for verification

- Includes military airbases and foreign fields near the borders (Aqaba, Taba) — conservative by default; prune with Jonathan during the visual check.
- Buffer circles are generated at import from the Ruleset (\`airport_buffer_km\`) — currently an UNVERIFIED seed value; the zone import inherits that unverified status independently of this dataset's own OSM provenance.
- Airport list (name · ICAO):
${result.collection.features.map((f) => `  - ${f.properties.nameEn ?? f.properties.nameHe ?? f.properties.code}${f.properties.icao ? ` · ${f.properties.icao}` : ""}`).join("\n")}

## Issues

${renderIssueTable(result.issues)}
`;
    writeDataset("osm-airport-buffers", {
      "zones.geojson": stableJson(result.collection),
      "manifest.json": stableJson(manifest),
      "reconciliation.md": report,
    });
  }
}

console.log("done");
