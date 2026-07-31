// DO-045 — builder for the AIP ב'-08 weekend fly-bubbles (בועות טיסת סופ"ש).
//
// UNLIKE EVERY OTHER BUILDER IN THIS DIRECTORY, the input is not a machine dump
// of an official file. AIP ב'-08 (מפת גובה נמוך לתעופה ספורטיבית, 1:250,000,
// ed 2/25) is a native-vector chart whose bubbles share an outline colour with
// the midweek routes AND the ב'-09 UAV בראשית areas, so auto-tracing could not
// separate them. The 37 polygons were therefore **hand-traced** over a
// georeferenced render at roughly 0.4′ (≈500 m). That provenance is not a
// footnote — it is the single most important thing about this dataset, it rides
// on every zone's notes, and the layer ships `verified: false` (PRD §10).
//
// This builder does NOT re-extract; the traced GeoJSON is the delivered INPUT
// (DO-045 intent doc, READ FIRST §3). It converts that input into the project's
// dataset shape, and nothing else.
//
// Display-only by design (DO-045 scope): the WEEKEND_BUBBLE ZoneType seeds
// `CLEAR`, and nothing here may change a verdict. Time-aware activation stays
// the deferred, gated decision it was for DO-041.

import { stableJson, type DatasetManifest, type ZoneFeature, type ZoneFeatureCollection } from "../dataset.js";
import { issueCounts, renderIssueTable } from "../report.js";
import type { ReconIssue } from "./aip-zones.js";

/** One feature of the delivered hand-traced GeoJSON. */
export interface TracedBubbleFeature {
  type: "Feature";
  properties: {
    name_he: string;
    zoneType?: string;
    altFloor?: number | null;
    altCeiling?: number | null;
    /** Present on only a minority of features — see WEEKEND_ONLY_DEFAULT. */
    weekendOnly?: boolean;
    layer?: string;
    verified?: boolean;
    confidence?: string;
    sheet?: string;
  };
  geometry: { type: string; coordinates: unknown };
}

export interface TracedBubbleCollection {
  type: "FeatureCollection";
  features: TracedBubbleFeature[];
}

/**
 * Jonathan's ruling, 2026-07-28: a feature
 * with **no** `weekendOnly` key is weekend-only.
 *
 * This is a resolved escalation, not a builder-side guess, and it is not a free
 * inference either — the intent doc independently states the all-week bubbles
 * are a small named set, and the delivered file flags exactly those explicitly
 * `false`. Every feature that relies on this default is still counted and
 * listed in the reconciliation report, so the inferred values can never be
 * mistaken for published ones.
 */
export const WEEKEND_ONLY_DEFAULT = true;

export const WEEKEND_BUBBLE_ZONE_TYPE = "WEEKEND_BUBBLE";

/** Published schedule tokens. DO-041's `detectSchedule` reads these verbatim. */
const SCHEDULE_WEEKEND = 'סופ"ש';
const SCHEDULE_ALL_WEEK = "כל השבוע";

const TRACE_CAVEAT =
  'hand-traced from AIP ב\'-08 at ~0.4′ (≈500 m) — NOT chart-authoritative geometry; verify against the published chart';

export interface WeekendBubblesResult {
  collection: ZoneFeatureCollection;
  issues: ReconIssue[];
  stats: {
    features: number;
    weekendOnly: number;
    allWeek: number;
    /** How many of `weekendOnly` came from WEEKEND_ONLY_DEFAULT, not the file. */
    weekendOnlyInferred: number;
    ceilings: { min: number; max: number } | null;
    skipped: number;
  };
}

/**
 * Dataset-scoped code. The chart labels bubbles by name only — there is no
 * published designator to carry — so codes are ordinals in the delivered file's
 * order, zero-padded for stable sorting. Deterministic for a given input;
 * documented in the reconciliation report so nobody reads `WB07` as something
 * the AIP prints.
 */
export function bubbleCode(index: number): string {
  return `WB${String(index + 1).padStart(2, "0")}`;
}

export function buildWeekendBubbles(input: TracedBubbleCollection): WeekendBubblesResult {
  const issues: ReconIssue[] = [];
  const features: ZoneFeature[] = [];
  let weekendOnly = 0;
  let allWeek = 0;
  let weekendOnlyInferred = 0;
  let skipped = 0;
  const ceilingValues: number[] = [];
  const seenNames = new Set<string>();

  input.features.forEach((feature, index) => {
    const p = feature.properties;
    const code = bubbleCode(index);
    const nameHe = typeof p.name_he === "string" ? p.name_he.trim() : "";

    if (!nameHe) {
      skipped += 1;
      issues.push({
        code,
        kind: "parse-failure",
        detail: "feature has no name_he — NOT imported (a bubble with no published name is not identifiable)",
      });
      return;
    }
    if (!feature.geometry || !feature.geometry.coordinates) {
      skipped += 1;
      issues.push({ code, kind: "no-geometry", detail: `"${nameHe}" has no geometry — NOT imported` });
      return;
    }
    if (seenNames.has(nameHe)) {
      // Not fatal — codes are ordinals, so duplicates still import distinctly.
      issues.push({
        code,
        kind: "name-mismatch",
        detail: `name "${nameHe}" repeats in the traced input — imported as its own zone; confirm they are genuinely two bubbles in the visual check`,
      });
    }
    seenNames.add(nameHe);

    if (p.zoneType && p.zoneType !== WEEKEND_BUBBLE_ZONE_TYPE) {
      issues.push({
        code,
        kind: "note",
        detail: `input zoneType ${JSON.stringify(p.zoneType)} is not ${WEEKEND_BUBBLE_ZONE_TYPE} — imported as ${WEEKEND_BUBBLE_ZONE_TYPE} per the dataset's scope`,
      });
    }

    // Floor. 0 = GND per the ratified encoding (zones-api.md). Anything else is
    // reported rather than silently accepted — the chart draws these GND-up.
    const rawFloor = p.altFloor;
    const floorAmslFt = typeof rawFloor === "number" && Number.isFinite(rawFloor) ? Math.trunc(rawFloor) : null;
    if (floorAmslFt === null) {
      issues.push({
        code,
        kind: "altitude-not-published",
        detail: `altFloor ${JSON.stringify(rawFloor)} not numeric — floor null (never guessed)`,
      });
    } else if (floorAmslFt !== 0) {
      issues.push({
        code,
        kind: "note",
        detail: `altFloor ${floorAmslFt} is not 0/GND — carried as published; confirm in the visual check`,
      });
    }

    // Ceiling. ft AMSL, ingested directly with NO conversion — DO-045 trigger 3
    // resolved 2026-07-28 (same as DO-044's ב'-09 source). Do not reinterpret.
    const rawCeiling = p.altCeiling;
    const ceilingAmslFt =
      typeof rawCeiling === "number" && Number.isFinite(rawCeiling) ? Math.trunc(rawCeiling) : null;
    if (ceilingAmslFt === null) {
      issues.push({
        code,
        kind: "altitude-not-published",
        detail: `altCeiling ${JSON.stringify(rawCeiling)} not numeric — ceiling null (never guessed)`,
      });
    } else {
      ceilingValues.push(ceilingAmslFt);
    }

    const published = typeof p.weekendOnly === "boolean";
    const isWeekendOnly = published ? (p.weekendOnly as boolean) : WEEKEND_ONLY_DEFAULT;
    if (!published) {
      weekendOnlyInferred += 1;
      issues.push({
        code,
        kind: "note",
        detail: `"${nameHe}" carries no weekendOnly in the traced input — defaulted to ${WEEKEND_ONLY_DEFAULT} per Jonathan's ruling 2026-07-28 (inferred, NOT published)`,
      });
    }
    if (isWeekendOnly) weekendOnly += 1;
    else allWeek += 1;

    // Notes are `|`-separated segments, house convention. `schedule:` is read by
    // DO-041's detectSchedule — a weekend-only bubble therefore gets the same
    // chip and the same weekend-view emphasis as the ATZ weekend variants, with
    // no new detection code. `weekendOnly:` carries the boolean structurally so
    // the client never has to parse Hebrew to know which it is (and so no Zone
    // schema change is needed — DO-045 trigger 4 avoided).
    const notes = [
      'weekend fly-bubble (AIP ב\'-08 sport aviation, ed 2/25)',
      `schedule: ${isWeekendOnly ? SCHEDULE_WEEKEND : SCHEDULE_ALL_WEEK}`,
      `weekendOnly: ${isWeekendOnly}${published ? "" : " (inferred — not published in the traced input)"}`,
      `confidence: ${p.confidence ?? "manual-trace"}`,
      TRACE_CAVEAT,
    ].join(" | ");

    features.push({
      type: "Feature",
      properties: {
        code,
        nameHe,
        nameEn: null,
        zoneTypeCode: WEEKEND_BUBBLE_ZONE_TYPE,
        floorAmslFt,
        ceilingAmslFt,
        aglCeilingFt: null,
        notes,
      },
      geometry: feature.geometry,
    });
  });

  return {
    collection: { type: "FeatureCollection", features },
    issues,
    stats: {
      features: features.length,
      weekendOnly,
      allWeek,
      weekendOnlyInferred,
      ceilings: ceilingValues.length
        ? { min: Math.min(...ceilingValues), max: Math.max(...ceilingValues) }
        : null,
      skipped,
    },
  };
}

// ── Dataset assembly ────────────────────────────────────────────────────────
//
// Every other dataset assembles its manifest and reconciliation report inline in
// `build-datasets.ts`. This one does it here instead, for a reason specific to
// DO-045: its input is a committed file rather than a Python dump, so the
// dataset can be rebuilt with no external tooling — and that makes the
// deterministic-rebuild acceptance criterion something a unit test can actually
// prove, by regenerating all three files and diffing them against the committed
// ones. Keeping the assembly in the CLI would have left the test asserting
// against a re-implementation of it.

export const WEEKEND_BUBBLES_LAYER_KEY = "caai-weekend-bubbles";

export interface WeekendBubblesDatasetInput {
  traced: TracedBubbleCollection;
  /** The one documented timestamp exception (dataset.ts). */
  extractedAt: string;
  /** Repo-relative paths + SHA-256, computed by the caller (no fs in here). */
  sourceFiles: { path: string; sha256: string }[];
  /** Repo-relative path of the traced input, for the report's provenance line. */
  tracedPath: string;
}

/** The three dataset files, keyed by filename — byte-identical for equal input. */
export function assembleWeekendBubblesDataset(input: WeekendBubblesDatasetInput): {
  files: Record<string, string>;
  result: WeekendBubblesResult;
} {
  const { traced, extractedAt, sourceFiles, tracedPath } = input;
  const result = buildWeekendBubbles(traced);
  const s = result.stats;

  const manifest: DatasetManifest = {
    layerKey: WEEKEND_BUBBLES_LAYER_KEY,
    title:
      'AIP ב\'-08 — weekend fly-bubbles (בועות טיסת סופ"ש, sport aviation); display-only, hand-traced ≈500 m',
    sourceFiles,
    aipUpdateStamp:
      "ב'-08 מפת גובה נמוך לתעופה ספורטיבית 1:250,000, ed 2/25 (Oct 2025), WGS84; northern + southern sheets",
    extractedAt,
    extractionTools: [
      "manual trace over a georeferenced render (bubble_tracer.html — delivered instrument, not app code)",
      "server/src/zones builders (DO-013)",
    ],
    featureCount: result.collection.features.length,
    importable: true,
    verified: false,
    notes:
      "DISPLAY-ONLY (DO-045): WEEKEND_BUBBLE seeds CLEAR and must not change any verdict; time-aware activation stays deferred. GEOMETRY IS HAND-TRACED at ~0.4′ (≈500 m) and is NOT chart-authoritative. Ceilings are ft AMSL ingested with no conversion (trigger 3, resolved 2026-07-28). Codes WBnn are dataset-scoped ordinals — the chart publishes no designator. Features lacking weekendOnly default to true per Jonathan's ruling 2026-07-28; every inferred one is listed in the reconciliation report. The input's `sheet` field was NOT carried (a tracer-UI default) — see reconciliation.md, and extraction-method.md for the georeference and method.",
  };

  const report = `# Reconciliation — ${WEEKEND_BUBBLES_LAYER_KEY} — ${extractedAt}

**Source:** AIP ב'-08 *מפת גובה נמוך לתעופה ספורטיבית* 1:250,000, ed 2/25 (Oct 2025), datum WGS84,
northern + southern sheets → hand-traced to \`${tracedPath}\` → this dataset.

## Counts

- traced input features: **${traced.features.length}** · imported: **${s.features}** · skipped: **${s.skipped}**
- weekend-only: **${s.weekendOnly}** · all-week: **${s.allWeek}**
- of the weekend-only figure, **${s.weekendOnlyInferred}** were **inferred, not published** (see below)
- ceilings: **${s.ceilings ? `${s.ceilings.min}–${s.ceilings.max} ft AMSL` : "none parsed"}**, floors GND (0)

## Caveats for the visual check (GB-06 Gate 3)

- **THE GEOMETRY IS HAND-TRACED, ~0.4′ (≈500 m).** It is not chart-authoritative and no surface may
  present it as such (PRD §10). This is the highest-priority eyeball in this dataset.
- **\`weekendOnly\` is inferred for ${s.weekendOnlyInferred} of ${s.features} bubbles.** The traced input carries the key on only a
  minority of features. Jonathan ruled 2026-07-28 that absence means weekend-only; the intent doc
  independently names the all-week bubbles as a small set and the input flags exactly those
  \`false\`, which corroborates it. **It remains an inference** — each affected bubble is listed as
  a \`note\` issue below.
- **The input's \`sheet\` field was deliberately NOT carried into the database.** Every feature
  claims \`sheet: "north"\`, including bubbles unmistakably on the southern sheet (באר שבע, קציעות,
  פארן, חריף, שבטה, ירוחם, עין גדי, אלמוג, מיתר, להבים, זוהר, ניצנים, שדרות צפון/דרום).
  \`extraction-method.md\` records why: it is a **tracer-UI default**, not an observation. Shipping
  provenance known to be wrong is what the provenance-honesty rule forbids, so it is recorded here
  rather than asserted per-zone. Re-deriving the true sheet per bubble is a Gate 3 job.
- **Georeference and method: \`extraction-method.md\`, alongside this file.** Both sheets rendered
  at 150 dpi (4134 × 5906 px); axis-aligned affine off the 10′ graticule, anchored to labelled
  crossings and checked against known reporting points. North sheet
  \`lon = 34.0763 + 0.00045028·px\`, \`lat = 33.43465 − 0.00038194·py\`; south sheet
  \`lon = 34.0432 + 0.00044111·px\`, \`lat = 31.6013 − 0.00038212·py\`. Datum WGS84, VAR 5°E (2025).
  That record also documents the automation ceiling that forced hand-tracing: the green outline
  colour is shared by bubble outlines, mid-week sport routes **and** the ב'-09 UAV בראשית areas, so
  contour-tracing closed only 3 of 37 reliably.
- **Not all 37 bubbles are equally uncertain.** Per \`extraction-method.md\`, route-circuit bubbles
  (e.g. נעמה, אלמוג) were built from the back-page reporting-point table and cross-checked
  leg-by-leg (bearing ±~1°, distance ±~0.1 NM); the area bubbles are the hand-traced ones. The
  dataset does not yet distinguish them per-zone — every zone carries the conservative
  hand-traced caveat, which under-claims for the route-circuit few. Worth splitting at Gate 3.
- **Ceilings are ft AMSL, ingested with no conversion** (trigger 3, resolved 2026-07-28, same as
  DO-044's ב'-09 source). Re-surface only if a bubble's published value plainly contradicts an AMSL
  reading.
- **Codes \`WBnn\` are dataset-scoped ordinals** in traced-file order. The chart labels bubbles by
  name only; do not read \`WB07\` as a published designator.

## Issue summary

${issueCounts(result.issues)}

## Issues

${renderIssueTable(result.issues)}
_Everything ships \`verified=false\` until Jonathan's visual check (GB-06 Gate 3)._
`;

  return {
    files: {
      "zones.geojson": stableJson(result.collection),
      "manifest.json": stableJson(manifest),
      "reconciliation.md": report,
    },
    result,
  };
}
