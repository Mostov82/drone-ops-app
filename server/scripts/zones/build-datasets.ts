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
import { buildInpa } from "../../src/zones/builders/inpa.js";
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

// ── 3. CVFR lanes (converted; import BLOCKED pending trigger 6) ──────────────
{
  const result = buildCvfr(cvfrRoutes, cvfrPoints);
  const manifest: DatasetManifest = {
    layerKey: "cvfr-lanes",
    title: "CVFR low transport routes (נתיבי תובלה נמוכים) — CONVERTED, import pending directional-altitude decision (trigger 6)",
    sourceFiles: [sha256("data-sources/gis/CVFR_caai.zip")],
    aipUpdateStamp: "CVFR_ROUTES2023 / CVFR_POINTS2023 (CAAI GIS layer); governing publication פמ\"ת ב'-03",
    extractedAt,
    extractionTools: TOOLS,
    featureCount: result.stats.segments,
    importable: false,
    verified: false,
    notes:
      "TRIGGER 6: lanes have per-direction altitudes (N_A/S_A/W_Alt/E_Alt incl. 'X', blanks and dual values) but Zone has one floor/ceiling pair. All published values carried verbatim in properties. Import deliberately blocked until the modeling decision (see reconciliation.md + session log DO-013_2026-07-10).",
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
- altitude strings that are not a single integer (raw carried, parsed null): **${result.stats.unparseableAltitudes}**

## Directional altitude value inventory (trigger 6 evidence)

${altitudeTable}

## Issues

${renderIssueTable(result.issues)}
**IMPORT BLOCKED (trigger 6):** how lanes map onto Zone's single floor/ceiling pair is a human decision. Options are surfaced in the DO-013 session log / PR. Once decided, set \`importable: true\` logic accordingly and re-run the import.
`;
  writeDataset("cvfr-lanes", {
    "zones.geojson": stableJson(result.lanes),
    "waypoints.geojson": stableJson(result.waypoints),
    "manifest.json": stableJson(manifest),
    "reconciliation.md": report,
  });
}

// ── 4. INPA closures (appendix ה' — attributes only; geometry blocked) ───────
{
  const result = buildInpa(a17);
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
      "Appendix ה' publishes code/name/type/max-height(ft AGL) but NO coordinates. Geometry requires RATAG_kmz.zip (download manifest item 7 — outstanding, optional) or an OSM gap-filler match (blocked this session — see reconciliation.md). Max heights are AGL and stay out of the AMSL columns.",
  };
  const report = `# Reconciliation — aip-a17-inpa-closures — ${extractedAt}

**Source:** א'-17 appendix ה' tables (pages 30–49).

## Counts

- raw table rows parsed: **${result.stats.rawRows}**
- unique codes: **${result.stats.unique}** (duplicates merged/dropped: ${result.stats.duplicatesDropped})
- גן לאומי / nesting (LLP1xxx): **${result.stats.parks}** · שמורת טבע (LLP2xxx): **${result.stats.reserves}**
- entries with no AGL ceiling extracted: **${result.stats.missingAgl}** · with no name: **${result.stats.missingName}**

## Geometry status — BLOCKED THREAD

No geometry is published in the appendix. Options, in provenance order:
1. **INPA \`RATAG_kmz.zip\`** — download manifest item 7 (\`https://www.gov.il/BlobFolder/guide/aip/he/RATAG_kmz.zip\`), still outstanding. Preferred: CAAI-hosted, code-matched.
2. **OSM gap-filler** — requires network fetch (Overpass) + fuzzy Hebrew-name matching of ~${result.stats.unique} entries; a wrong match places a no-fly polygon in the wrong place, so any non-exact match must be excluded. Not attempted without geometry to verify against (see session log escalations).

## Issue summary

${issueCounts(result.issues)}

## Issues

${renderIssueTable(result.issues)}
`;
  writeDataset("aip-a17-inpa-closures", {
    "entries.json": stableJson(result.entries),
    "manifest.json": stableJson(manifest),
    "reconciliation.md": report,
  });
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
