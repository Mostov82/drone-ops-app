// DO-045 — the AIP ב'-08 weekend fly-bubbles dataset.
//
// Three things are worth proving here and one of them is the whole ticket:
//
//  1. the builder converts the delivered hand-trace faithfully, and every value
//     it did NOT get from the input is counted as inferred rather than passed
//     off as published;
//  2. the dataset rebuilds byte-identically — asserted against the COMMITTED
//     files, through the same `assembleWeekendBubblesDataset` the build CLI
//     calls, so this is a real determinism check and not a re-implementation
//     agreeing with itself;
//  3. **the layer changes no verdict.** That is the ticket's central promise and
//     the reason the ZoneType seeds CLEAR. It is tested through the real engine.
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createRulesetReader } from "../../ruleset/service.js";
import { memoryRulesetStore, ruleFixture } from "../../__tests__/helpers.js";
import { createVerdictEngine, type VerdictEngineDeps } from "../../verdict/engine.js";
import type { VerdictDataStore, VerdictLayer, VerdictZone } from "../../verdict/store.js";
import { ZONE_TYPE_SEEDS } from "../import.js";
import {
  assembleWeekendBubblesDataset,
  buildWeekendBubbles,
  bubbleCode,
  WEEKEND_BUBBLE_ZONE_TYPE,
  WEEKEND_BUBBLES_LAYER_KEY,
  WEEKEND_ONLY_DEFAULT,
  type TracedBubbleCollection,
} from "../builders/weekend-bubbles.js";

const REPO = path.resolve(import.meta.dirname, "../../../..");
const TRACED_REL = "data-sources/traced/b08_weekend_bubbles.geojson";
const DATASET_DIR = path.join(REPO, "data-sources/zones", WEEKEND_BUBBLES_LAYER_KEY);

function traced(): TracedBubbleCollection {
  return JSON.parse(fs.readFileSync(path.join(REPO, TRACED_REL), "utf8")) as TracedBubbleCollection;
}
/**
 * Reads a committed dataset file with line endings normalised to LF.
 *
 * The repo's `.gitattributes` sets `* text=auto`, so on a Windows checkout with
 * `core.autocrlf=true` git materialises these files with CRLF while the builder
 * emits LF. Comparing raw bytes therefore passes on Linux CI and fails on a
 * Windows working copy — which is exactly what happened once. The determinism
 * guarantee is about CONTENT; EOL is git's business, not the builder's, so the
 * comparison normalises it rather than pretending the platform difference is a
 * drift in the data.
 */
const toLf = (text: string): string => text.split("\r\n").join("\n");

function committed(name: string): string {
  return toLf(fs.readFileSync(path.join(DATASET_DIR, name), "utf8"));
}
function sha256(rel: string) {
  return {
    path: rel,
    sha256: createHash("sha256").update(fs.readFileSync(path.join(REPO, rel))).digest("hex"),
  };
}
/** Exactly what the build CLI passes, minus the wall clock. */
function assemble(extractedAt: string, input: TracedBubbleCollection = traced()) {
  return assembleWeekendBubblesDataset({
    traced: input,
    extractedAt,
    tracedPath: TRACED_REL,
    sourceFiles: [
      sha256("data-sources/aip/aip_b-08_north-sheet.pdf"),
      sha256("data-sources/aip/aip_b-08_south-sheet.pdf"),
      sha256(TRACED_REL),
    ],
  });
}

/** Reads `extractedAt` back out of the committed manifest — no hardcoded date. */
function committedExtractedAt(): string {
  return (JSON.parse(committed("manifest.json")) as { extractedAt: string }).extractedAt;
}

// ─────────────────────────── The builder ───────────────────────────

describe("buildWeekendBubbles — the delivered hand-trace", () => {
  const result = buildWeekendBubbles(traced());

  it("imports every traced bubble and drops none", () => {
    expect(result.stats.features).toBe(traced().features.length);
    expect(result.stats.skipped).toBe(0);
  });

  it("carries ceilings as ft AMSL with NO conversion (trigger 3, resolved 2026-07-28)", () => {
    // The single most dangerous thing this builder could do is quietly reinterpret
    // an altitude. Every ceiling must equal its input exactly.
    const input = traced().features;
    result.collection.features.forEach((f, i) => {
      expect(f.properties.ceilingAmslFt, f.properties.code).toBe(input[i].properties.altCeiling);
      expect(f.properties.floorAmslFt, f.properties.code).toBe(input[i].properties.altFloor);
      expect(f.properties.aglCeilingFt).toBeNull();
    });
  });

  it("counts inferred weekendOnly values instead of passing them off as published", () => {
    const input = traced().features;
    const publishedCount = input.filter((f) => typeof f.properties.weekendOnly === "boolean").length;
    expect(result.stats.weekendOnlyInferred).toBe(input.length - publishedCount);
    expect(result.stats.weekendOnly + result.stats.allWeek).toBe(result.stats.features);
    // and every inferred one is individually reported, not just totalled
    const inferredNotes = result.issues.filter((i) => /inferred, NOT published/.test(i.detail));
    expect(inferredNotes).toHaveLength(result.stats.weekendOnlyInferred);
  });

  it("marks an inferred value in the zone's own notes, not only in the report", () => {
    // A reader looking at one zone must be able to tell whether its schedule was
    // published or inferred, without going back to reconciliation.md.
    const input = traced().features;
    result.collection.features.forEach((f, i) => {
      const published = typeof input[i].properties.weekendOnly === "boolean";
      expect(/weekendOnly: (true|false)/.test(f.properties.notes ?? ""), f.properties.code).toBe(true);
      expect(/\(inferred — not published/.test(f.properties.notes ?? ""), f.properties.code).toBe(!published);
    });
  });

  it("honours a published weekendOnly rather than overwriting it with the default", () => {
    const input: TracedBubbleCollection = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name_he: "all-week", weekendOnly: false, altFloor: 0, altCeiling: 1000 }, geometry: { type: "Polygon", coordinates: [[[0, 0]]] } },
        { type: "Feature", properties: { name_he: "unflagged", altFloor: 0, altCeiling: 1000 }, geometry: { type: "Polygon", coordinates: [[[0, 0]]] } },
      ],
    };
    const r = buildWeekendBubbles(input);
    expect(r.stats.allWeek).toBe(1);
    expect(r.stats.weekendOnly).toBe(1);
    expect(r.stats.weekendOnlyInferred).toBe(1);
    expect(WEEKEND_ONLY_DEFAULT).toBe(true);
  });

  it("puts the hand-traced caveat on EVERY zone (PRD §10; trigger 5)", () => {
    for (const f of result.collection.features) {
      expect(f.properties.notes, f.properties.code).toMatch(/hand-traced/);
      expect(f.properties.notes, f.properties.code).toMatch(/NOT chart-authoritative/);
    }
  });

  it("emits a `schedule:` segment DO-041's chip can read, without new detection code", () => {
    // The reuse this ticket is built on: weekend-only bubbles must carry the
    // published weekend token so detectSchedule types them "weekend" (and the
    // weekend view emphasises them); all-week bubbles must NOT.
    for (const f of result.collection.features) {
      const notes = f.properties.notes ?? "";
      const allWeek = /weekendOnly: false/.test(notes);
      expect(/\| schedule: /.test(notes), f.properties.code).toBe(true);
      expect(/schedule: סופ"ש/.test(notes), f.properties.code).toBe(!allWeek);
      expect(/schedule: כל השבוע/.test(notes), f.properties.code).toBe(allWeek);
    }
  });

  it("assigns deterministic, dataset-scoped ordinal codes", () => {
    expect(bubbleCode(0)).toBe("WB01");
    expect(bubbleCode(36)).toBe("WB37");
    const codes = result.collection.features.map((f) => f.properties.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(buildWeekendBubbles(traced()).collection.features.map((f) => f.properties.code));
  });

  it("passes geometry through untouched — no simplification (locked 2026-07-11)", () => {
    const input = traced().features;
    result.collection.features.forEach((f, i) => {
      expect(f.geometry).toEqual(input[i].geometry);
    });
  });

  it("skips a nameless or geometry-less feature rather than inventing one", () => {
    const r = buildWeekendBubbles({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name_he: "" }, geometry: { type: "Polygon", coordinates: [[[0, 0]]] } },
        { type: "Feature", properties: { name_he: "no geom" }, geometry: null as never },
      ],
    });
    expect(r.stats.features).toBe(0);
    expect(r.stats.skipped).toBe(2);
  });
});

// ─────────────────────── Deterministic rebuild (AC #1) ───────────────────────

describe("the dataset rebuilds deterministically", () => {
  it("produces byte-identical files on a repeat run", () => {
    const a = assemble("2026-07-28").files;
    const b = assemble("2026-07-28").files;
    expect(a).toEqual(b);
  });

  it("reproduces the COMMITTED dataset byte for byte", () => {
    // Guards the whole chain: traced input → builder → manifest/report/geojson.
    // If the input or the builder drifts, this fails in CI rather than on the map.
    const { files } = assemble(committedExtractedAt());
    for (const name of ["zones.geojson", "manifest.json", "reconciliation.md"]) {
      expect(toLf(files[name]), name).toBe(committed(name));
    }
  });

  it("ships verified=false and importable, with the trace in its provenance", () => {
    const manifest = JSON.parse(committed("manifest.json")) as {
      verified: boolean; importable: boolean; featureCount: number;
      sourceFiles: { path: string }[]; layerKey: string;
    };
    expect(manifest.verified).toBe(false);
    expect(manifest.importable).toBe(true);
    expect(manifest.layerKey).toBe(WEEKEND_BUBBLES_LAYER_KEY);
    expect(manifest.featureCount).toBe(traced().features.length);
    expect(manifest.sourceFiles.map((s) => s.path)).toContain(TRACED_REL);
  });

  it("records the inference and the dropped `sheet` field in the reconciliation report", () => {
    const report = committed("reconciliation.md");
    expect(report).toMatch(/inferred, not published/i);
    expect(report).toMatch(/sheet` field was deliberately NOT carried/);
    expect(report).toMatch(/HAND-TRACED/);
    // Escalation B closed 2026-07-29: the extraction record now exists on disk,
    // so the report cites it and carries the real georeference constants rather
    // than stating they are unavailable.
    expect(report).toMatch(/extraction-method\.md/);
    expect(report).toMatch(/34\.0763/); // north-sheet affine
    expect(report).toMatch(/34\.0432/); // south-sheet affine
    expect(report).not.toMatch(/unavailable/);
    expect(report).not.toMatch(/source_b08_weekend_bubbles/);
  });
});

describe("the extraction record (DO-045 escalation B, closed 2026-07-29)", () => {
  // This escalation existed because a file the intent doc named as required
  // reading did not exist, and a whole session stopped on it. Now that it does,
  // pin it: a provenance record that can silently vanish is not a provenance
  // record. Cheap test, real failure mode — it already happened once.
  const RECORD = path.join(DATASET_DIR, "extraction-method.md");

  it("exists alongside the dataset it documents", () => {
    expect(fs.existsSync(RECORD)).toBe(true);
  });

  it("carries the georeference constants for BOTH sheets", () => {
    const text = fs.readFileSync(RECORD, "utf8");
    for (const constant of ["34.0763", "0.00045028", "33.43465", "34.0432", "0.00044111", "31.6013"]) {
      expect(text, constant).toContain(constant);
    }
    expect(text).toMatch(/WGS84/);
  });

  it("states the hand-traced status and the automation ceiling that forced it", () => {
    const text = fs.readFileSync(RECORD, "utf8");
    expect(text).toMatch(/hand-traced/i);
    expect(text).toMatch(/NOT chart-authoritative/i);
    expect(text).toMatch(/3 of 37/); // the automation ceiling, in its own words
  });
});

// ─────────────────────── The ZoneType seed ───────────────────────

describe("the WEEKEND_BUBBLE ZoneType", () => {
  it("seeds CLEAR — the layer is display-only", () => {
    expect(ZONE_TYPE_SEEDS[WEEKEND_BUBBLE_ZONE_TYPE]).toBeDefined();
    expect(ZONE_TYPE_SEEDS[WEEKEND_BUBBLE_ZONE_TYPE].defaultVerdict).toBe("CLEAR");
  });

  it("is the ONLY CLEAR seed — so this ticket introduces the first such zone type", () => {
    // Recorded deliberately: it is why `reasons` can now be non-empty on a CLEAR
    // verdict for the first time. See the engine-contract test below.
    const clear = Object.entries(ZONE_TYPE_SEEDS).filter(([, v]) => v.defaultVerdict === "CLEAR");
    expect(clear.map(([k]) => k)).toEqual([WEEKEND_BUBBLE_ZONE_TYPE]);
  });
});

// ─────────────────── Verdicts provably unchanged (AC #3) ───────────────────

const LAYERS: VerdictLayer[] = [
  { id: "L-aip", name: "aip-a17-llp-llr-danger", importedAt: new Date("2026-07-11T00:00:00Z"), verified: false },
  { id: "L-air", name: "osm-airport-buffers", importedAt: new Date("2026-07-11T00:00:00Z"), verified: false },
  { id: "L-bub", name: WEEKEND_BUBBLES_LAYER_KEY, importedAt: new Date("2026-07-28T00:00:00Z"), verified: false },
];

function square(lngMin: number, latMin: number, lngMax: number, latMax: number): string {
  return JSON.stringify({
    type: "Polygon",
    coordinates: [[[lngMin, latMin], [lngMax, latMin], [lngMax, latMax], [lngMin, latMax], [lngMin, latMin]]],
  });
}

function zone(p: Partial<VerdictZone> & Pick<VerdictZone, "id" | "name" | "zoneTypeCode" | "defaultVerdict" | "geometryJson">): VerdictZone {
  return { zoneTypeName: p.zoneTypeCode, floorAmslFt: null, ceilingAmslFt: null, notes: null, mapLayerId: "L-aip", ...p };
}

/** An airport zone is mandatory — the engine fails closed without one (FR-C3). */
const AIRPORT = zone({
  id: "Z-air", name: "AIRPORT — far away", zoneTypeCode: "AIRPORT", defaultVerdict: "RESTRICTED",
  geometryJson: square(34.0, 30.0, 34.01, 30.01), mapLayerId: "L-air",
});
const RESTRICTED = zone({
  id: "Z-p", name: "LLP01 — test", zoneTypeCode: "AIP_PROHIBITED", defaultVerdict: "RESTRICTED",
  geometryJson: square(35.0, 32.0, 35.2, 32.2),
});
/** Overlaps the restricted zone exactly, as real bubbles overlap real zones. */
const BUBBLE_OVER_RESTRICTED = zone({
  id: "Z-b1", name: "WB01 — בועת test", zoneTypeCode: WEEKEND_BUBBLE_ZONE_TYPE, defaultVerdict: "CLEAR",
  geometryJson: square(35.0, 32.0, 35.2, 32.2), mapLayerId: "L-bub", floorAmslFt: 0, ceilingAmslFt: 2000,
});
/** Sits alone in open country. */
const BUBBLE_ALONE = zone({
  id: "Z-b2", name: "WB02 — בועת open", zoneTypeCode: WEEKEND_BUBBLE_ZONE_TYPE, defaultVerdict: "CLEAR",
  geometryJson: square(34.5, 31.0, 34.7, 31.2), mapLayerId: "L-bub", floorAmslFt: 0, ceilingAmslFt: 2000,
});

function memoryStore(zones: VerdictZone[]): VerdictDataStore {
  const layers = LAYERS.filter((l) => zones.some((z) => z.mapLayerId === l.id));
  return { listLayers: async () => layers, listZones: async () => zones };
}

function engine(zones: VerdictZone[]) {
  const rules = [
    ruleFixture({ key: "airport_buffer_km", numberValue: 2, unit: "km" }),
    ruleFixture({ key: "cvfr_lane_halfwidth_km", numberValue: 1, unit: "km" }),
    ruleFixture({ key: "max_altitude_agl_m", numberValue: 50, unit: "m" }),
    ruleFixture({ key: "min_distance_people_structures_m", numberValue: 250, unit: "m" }),
    ruleFixture({ key: "vlos_required", valueType: "BOOLEAN", boolValue: true }),
    ruleFixture({ key: "daylight_only", valueType: "BOOLEAN", boolValue: true }),
  ];
  const deps: VerdictEngineDeps = {
    store: memoryStore(zones),
    rulesetReader: createRulesetReader(memoryRulesetStore(rules)),
    demService: {
      status: async () => ({ available: true, tileCount: 1 }),
      lookup: async () => ({ elevationM: 100, source: "test" }) as never,
      close: async () => {},
    },
    now: () => new Date("2026-07-28T12:00:00Z"),
  };
  return createVerdictEngine(deps);
}

const IN_RESTRICTED = { lat: 32.1, lng: 35.1 };
const IN_BUBBLE_ONLY = { lat: 31.1, lng: 34.6 };
const OPEN = { lat: 30.5, lng: 33.0 };

describe("weekend bubbles change no verdict (the ticket's central promise)", () => {
  const WITHOUT = [AIRPORT, RESTRICTED];
  const WITH = [AIRPORT, RESTRICTED, BUBBLE_OVER_RESTRICTED, BUBBLE_ALONE];

  it("a pin inside a restricted zone reads identically with the bubbles present", async () => {
    const before = await engine(WITHOUT).check(IN_RESTRICTED);
    const after = await engine(WITH).check(IN_RESTRICTED);
    expect(after.verdict).toBe(before.verdict);
    expect(after.verdict).toBe("RESTRICTED");
    // the restriction's own reason is untouched — same zone, same verdict, same order position
    expect(after.reasons[0].zone.id).toBe(before.reasons[0].zone.id);
    expect(after.reasons[0].verdict).toBe(before.reasons[0].verdict);
  });

  it("a pin inside ONLY a bubble is still CLEAR", async () => {
    const before = await engine(WITHOUT).check(IN_BUBBLE_ONLY);
    const after = await engine(WITH).check(IN_BUBBLE_ONLY);
    expect(before.verdict).toBe("CLEAR");
    expect(after.verdict).toBe("CLEAR");
  });

  it("open country is unaffected", async () => {
    const before = await engine(WITHOUT).check(OPEN);
    const after = await engine(WITH).check(OPEN);
    expect(after.verdict).toBe(before.verdict);
    expect(after.reasons).toEqual(before.reasons);
  });

  it("a bubble never outranks a real restriction in the worst-of ordering", async () => {
    const result = await engine(WITH).check(IN_RESTRICTED);
    expect(result.reasons[0].verdict).toBe("RESTRICTED");
    const bubbleIndex = result.reasons.findIndex((r) => r.zone.id === "Z-b1");
    expect(bubbleIndex).toBeGreaterThan(0); // present, but sorted below
  });
});

describe("engine contract: membership IS surfaced for a CLEAR bubble", () => {
  // A DO-045 design question: whether surfacing bubble membership needs an
  // engine change. It does not — `reasons` is built from every containing zone
  // regardless of verdict, so the pin panel gets the bubble for free.
  //
  // The side effect is real and is flagged in the PR: this is the
  // FIRST CLEAR-verdict zone type in the project, so `VerdictResult.reasons` can
  // now be non-empty while `verdict` is "CLEAR". The engine's own doc comment
  // still says "Empty ⇔ verdict CLEAR". That comment is now wrong, and correcting
  // it is a DO-015-owned edit this ticket deliberately did not make.
  it("emits a POINT_IN_ZONE reason for a bubble the pin is inside", async () => {
    const result = await engine([AIRPORT, BUBBLE_ALONE]).check(IN_BUBBLE_ONLY);
    const bubble = result.reasons.find((r) => r.zone.id === "Z-b2");
    expect(bubble).toBeDefined();
    expect(bubble?.kind).toBe("POINT_IN_ZONE");
    expect(bubble?.verdict).toBe("CLEAR");
    expect(bubble?.layer?.name).toBe(WEEKEND_BUBBLES_LAYER_KEY);
  });

  it("documents the broken invariant: CLEAR with a non-empty reasons list", async () => {
    const result = await engine([AIRPORT, BUBBLE_ALONE]).check(IN_BUBBLE_ONLY);
    expect(result.verdict).toBe("CLEAR");
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
