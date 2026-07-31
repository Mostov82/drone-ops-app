// DO-015 — verdict engine: known-point matrix, worst-of aggregation,
// NFR-5 (Ruleset edit + verdict-mapping edit flip verdicts, no code change),
// vertical cases through the engine, FAIL-CLOSED paths, and data-quality
// (unverified) propagation. Fixture-built in-memory stores per the project
// test pattern (see __tests__/helpers.ts); no dataset import required.
import { circle } from "@turf/turf";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../api-error.js";
import { demNotAvailableError, demOutOfCoverageError, type DemService, type ElevationResult } from "../../map/dem.js";
import { createRulesetReader, updateRuleValue, type RuleRecord } from "../../ruleset/service.js";
import { memoryRulesetStore, ruleFixture } from "../../__tests__/helpers.js";
import { corridorContains, createVerdictEngine, type VerdictEngineDeps } from "../engine.js";
import type { VerdictDataStore, VerdictLayer, VerdictZone } from "../store.js";

// ─────────────────────────── Fixtures ───────────────────────────

function square(lngMin: number, latMin: number, lngMax: number, latMax: number): string {
  return JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [lngMin, latMin],
        [lngMax, latMin],
        [lngMax, latMax],
        [lngMin, latMax],
        [lngMin, latMin],
      ],
    ],
  });
}

/** 2 km buffer circle around the airport point, as the importer generates. */
const AIRPORT_POINT = { lng: 35.03, lat: 32.0 };
const airportCircle = JSON.stringify(
  circle([AIRPORT_POINT.lng, AIRPORT_POINT.lat], 2, { steps: 64, units: "kilometers" }).geometry,
);

const LAYERS: VerdictLayer[] = [
  { id: "L-aip", name: "aip-zones", importedAt: new Date("2026-07-11T00:00:00Z"), verified: false },
  { id: "L-air", name: "osm-airport-buffers", importedAt: new Date("2026-07-11T00:00:00Z"), verified: false },
  { id: "L-lane", name: "cvfr-lanes", importedAt: new Date("2026-07-11T00:00:00Z"), verified: false },
];

function zone(partial: Partial<VerdictZone> & Pick<VerdictZone, "id" | "name" | "zoneTypeCode" | "defaultVerdict" | "geometryJson">): VerdictZone {
  return {
    zoneTypeName: partial.zoneTypeCode ?? "?",
    floorAmslFt: null,
    ceilingAmslFt: null,
    notes: null,
    mapLayerId: "L-aip",
    ...partial,
  };
}

function baseZones(): VerdictZone[] {
  return [
    // AIP prohibited zone, GND→UNL (floor 0, null ceiling), around [35.15, 32.15]
    zone({
      id: "Z-p",
      name: "LLP99 — אזור בדיקה",
      zoneTypeCode: "AIP_PROHIBITED",
      defaultVerdict: "RESTRICTED",
      geometryJson: square(35.1, 32.1, 35.2, 32.2),
      floorAmslFt: 0,
      ceilingAmslFt: null,
    }),
    // Nature reserve (no published band), around [34.92, 31.92]
    zone({
      id: "Z-r",
      name: "שמורת בדיקה",
      zoneTypeCode: "NATURE_RESERVE",
      defaultVerdict: "NEEDS_PERMIT",
      geometryJson: square(34.9, 31.9, 34.95, 31.95),
    }),
    // A second reserve overlapping the prohibited zone (worst-of test)
    zone({
      id: "Z-r2",
      name: "שמורה חופפת",
      zoneTypeCode: "NATURE_RESERVE",
      defaultVerdict: "NEEDS_PERMIT",
      geometryJson: square(35.1, 32.1, 35.2, 32.2),
    }),
    // Airport buffer circle (importer-generated), centered on AIRPORT_POINT
    zone({
      id: "Z-a",
      name: "OSM-node-1 — Test Field",
      zoneTypeCode: "AIRPORT",
      defaultVerdict: "RESTRICTED",
      geometryJson: airportCircle,
      mapLayerId: "L-air",
    }),
    // CVFR lane with the Option A envelope, near [35.4..35.5, 32.4..32.5]
    zone({
      id: "Z-lane",
      name: "ROUTE1 — נתיב בדיקה",
      zoneTypeCode: "CVFR_LANE",
      defaultVerdict: "RESTRICTED",
      geometryJson: JSON.stringify({ type: "LineString", coordinates: [[35.4, 32.4], [35.5, 32.5]] }),
      floorAmslFt: 1000,
      ceilingAmslFt: 3500,
      notes: "CVFR lane; directional altitudes ft AMSL as published: N 1000 / S 3500",
      mapLayerId: "L-lane",
    }),
    // CVFR lane with a BLANK published band (no vertical claim), far north
    zone({
      id: "Z-lane-blank",
      name: "ROUTE2 — נתיב ללא גובה",
      zoneTypeCode: "CVFR_LANE",
      defaultVerdict: "RESTRICTED",
      geometryJson: JSON.stringify({ type: "LineString", coordinates: [[35.9, 33.0], [36.0, 33.1]] }),
      notes: "CVFR lane; directional altitudes ft AMSL as published: none",
      mapLayerId: "L-lane",
    }),
  ];
}

function baseRules(): RuleRecord[] {
  return [
    ruleFixture({ key: "airport_buffer_km", numberValue: 2, unit: "km" }),
    ruleFixture({ key: "cvfr_lane_halfwidth_km", numberValue: 1, unit: "km" }),
    ruleFixture({ key: "max_altitude_agl_m", numberValue: 50, unit: "m" }),
    ruleFixture({ key: "min_distance_people_structures_m", numberValue: 250, unit: "m" }),
    ruleFixture({ key: "vlos_required", valueType: "BOOLEAN", boolValue: true }),
    ruleFixture({ key: "daylight_only", valueType: "BOOLEAN", boolValue: true }),
  ];
}

function memoryVerdictStore(layers: VerdictLayer[], zones: VerdictZone[]): VerdictDataStore {
  return {
    listLayers: async () => layers,
    listZones: async () => zones,
  };
}

function fakeDem(elevationM: number | (() => number)): DemService {
  return {
    status: async () => ({ available: true, tileCount: 1 }),
    lookup: async (): Promise<ElevationResult> => ({
      elevationM: typeof elevationM === "function" ? elevationM() : elevationM,
      approximate: true,
      source: "copernicus-glo30-dem",
      resolutionM: 30,
    }),
    close: async () => {},
  };
}

function failingDem(error: ApiError): DemService {
  return {
    status: async () => ({ available: false, tileCount: 0 }),
    lookup: async () => {
      throw error;
    },
    close: async () => {},
  };
}

interface Setup {
  deps: VerdictEngineDeps;
  rulesetStore: ReturnType<typeof memoryRulesetStore>;
  zones: VerdictZone[];
  layers: VerdictLayer[];
}

function setup(overrides: Partial<VerdictEngineDeps> & { zones?: VerdictZone[]; layers?: VerdictLayer[]; rules?: RuleRecord[]; elevationM?: number } = {}): Setup {
  const zones = overrides.zones ?? baseZones();
  const layers = overrides.layers ?? LAYERS;
  const rulesetStore = memoryRulesetStore(overrides.rules ?? baseRules());
  const deps: VerdictEngineDeps = {
    store: overrides.store ?? memoryVerdictStore(layers, zones),
    rulesetReader: overrides.rulesetReader ?? createRulesetReader(rulesetStore),
    demService: overrides.demService ?? fakeDem(overrides.elevationM ?? 100),
    now: () => new Date("2026-07-11T12:00:00Z"),
  };
  return { deps, rulesetStore, zones, layers };
}

// Known points
const OPEN_AREA = { lat: 31.5, lng: 34.7 }; // far from every fixture zone
const IN_RESERVE = { lat: 31.92, lng: 34.92 };
const IN_PROHIBITED = { lat: 32.15, lng: 35.15 };
const RESERVE_WEST_EDGE = { lat: 31.92, lng: 34.9 }; // exactly on the boundary
const IN_AIRPORT_BUFFER = { lat: 32.0, lng: 35.02 }; // ~940 m from the airport point
const NEAR_AIRPORT_3KM = { lat: 32.0, lng: 35.0 }; // ~2.8 km — outside the 2 km buffer

// ─────────────────────────── Known-point matrix ───────────────────────────

describe("verdict engine — known-point matrix (Gate 3)", () => {
  it("open area → CLEAR with no reasons and the standard limits echoed", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(OPEN_AREA);
    expect(result.verdict).toBe("CLEAR");
    expect(result.reasons).toEqual([]);
    expect(result.distance.bufferWarning).toBeNull();
    expect(result.context.numberLimits.map((r) => r.key)).toEqual([
      "max_altitude_agl_m",
      "min_distance_people_structures_m",
      "airport_buffer_km",
    ]);
    expect(result.context.booleanLimits.map((r) => r.key)).toEqual(["vlos_required", "daylight_only"]);
    expect(result.context.numberLimits[0].value).toBe(50);
  });

  it("inside the airport buffer → RESTRICTED, itemized, with distance facts", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(IN_AIRPORT_BUFFER);
    expect(result.verdict).toBe("RESTRICTED");
    expect(result.reasons.some((r) => r.zone.id === "Z-a" && r.kind === "POINT_IN_ZONE")).toBe(true);
    expect(result.distance.nearestAirport.zoneId).toBe("Z-a");
    expect(result.distance.nearestAirport.insideImportedBuffer).toBe(true);
    expect(result.distance.nearestAirport.distanceM).toBeGreaterThan(800);
    expect(result.distance.nearestAirport.distanceM).toBeLessThan(1100);
    expect(result.distance.bufferWarning).not.toBeNull();
    expect(result.distance.bufferWarning!.bufferM).toBe(2000);
  });

  it("inside a nature reserve → NEEDS_PERMIT with the zone itemized", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(IN_RESERVE);
    expect(result.verdict).toBe("NEEDS_PERMIT");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].zone.id).toBe("Z-r");
    expect(result.reasons[0].layer?.name).toBe("aip-zones");
  });

  it("a point exactly on a zone boundary counts as INSIDE (conservative)", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(RESERVE_WEST_EDGE);
    expect(result.verdict).toBe("NEEDS_PERMIT");
    expect(result.reasons.map((r) => r.zone.id)).toContain("Z-r");
  });

  it("overlapping zones → worst-of verdict, worst listed first, all itemized", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(IN_PROHIBITED);
    expect(result.verdict).toBe("RESTRICTED");
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0].verdict).toBe("RESTRICTED"); // worst first
    expect(result.reasons.map((r) => r.zone.id).sort()).toEqual(["Z-p", "Z-r2"]);
  });
});

// ─────────────────────────── NFR-5: data edits flip verdicts ───────────────────────────

describe("verdict engine — NFR-5 (no code change)", () => {
  it("editing the Ruleset airport buffer flips a verdict at the NEXT check", async () => {
    const { deps, rulesetStore } = setup();
    const engine = createVerdictEngine(deps);

    const before = await engine.check(NEAR_AIRPORT_3KM);
    expect(before.verdict).toBe("CLEAR");
    expect(before.distance.nearestAirport.distanceM).toBeGreaterThan(2500);
    expect(before.distance.nearestAirport.distanceM).toBeLessThan(3100);

    // The normal editor path (PUT /api/ruleset/:key/value goes through this).
    await updateRuleValue(rulesetStore, "airport_buffer_km", 5, "test edit");

    const after = await engine.check(NEAR_AIRPORT_3KM);
    expect(after.verdict).toBe("RESTRICTED");
    const reason = after.reasons.find((r) => r.kind === "WITHIN_AIRPORT_BUFFER_RULE");
    expect(reason).toBeDefined();
    expect(reason!.zone.id).toBe("Z-a");
    expect(reason!.rule!.value).toBe(5);
    expect(after.distance.bufferWarning!.bufferM).toBe(5000);
  });

  it("editing a ZoneType.defaultVerdict flips a verdict at the NEXT check", async () => {
    const { deps, zones } = setup();
    const engine = createVerdictEngine(deps);

    expect((await engine.check(IN_RESERVE)).verdict).toBe("NEEDS_PERMIT");

    // Simulates the DB edit of the editable Gate 3 mapping.
    for (const z of zones) if (z.zoneTypeCode === "NATURE_RESERVE") z.defaultVerdict = "RESTRICTED";

    expect((await engine.check(IN_RESERVE)).verdict).toBe("RESTRICTED");
  });
});

// ─────────────────────────── Vertical through the engine ───────────────────────────

describe("verdict engine — vertical separation (FR-C5/C6)", () => {
  it("ground-reaching GND→UNL prohibited zone conflicts at any planned altitude", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check({ ...IN_PROHIBITED, plannedAltitudeAglM: 5000 });
    const reason = result.reasons.find((r) => r.zone.id === "Z-p")!;
    expect(reason.vertical!.status).toBe("CONFLICT");
    expect(reason.vertical!.groundReaching).toBe(true);
    expect(reason.vertical!.unboundedCeiling).toBe(true);
    expect(result.vertical!.uncertaintyM).toBe(4);
    expect(result.vertical!.elevation.approximate).toBe(true);
  });

  it("Dead-Sea case: below-sea-level terrain is still inside a ground-reaching zone", async () => {
    const { deps } = setup({ elevationM: -430 });
    const result = await createVerdictEngine(deps).check({ ...IN_PROHIBITED, plannedAltitudeAglM: 50 });
    expect(result.vertical!.plannedAmslFt.maxFt).toBeLessThan(0); // entirely below 0 ft AMSL
    const reason = result.reasons.find((r) => r.zone.id === "Z-p")!;
    expect(reason.vertical!.status).toBe("CONFLICT");
  });

  it("nearest lane: centerline distance + BELOW_FLOOR clearance under the envelope", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check({ lat: 32.45, lng: 35.44, plannedAltitudeAglM: 50 });
    expect(result.lanes.laneCount).toBe(2);
    expect(result.lanes.nearest!.zoneId).toBe("Z-lane");
    expect(result.lanes.nearest!.horizontalDistanceM).toBeGreaterThanOrEqual(0);
    expect(result.lanes.nearest!.horizontalDistanceM).toBeLessThan(1000); // within the corridor
    expect(result.lanes.nearest!.withinCorridor).toBe(true);
    expect(result.lanes.nearest!.vertical!.status).toBe("BELOW_FLOOR");
    expect(result.lanes.nearest!.vertical!.clearanceFt).toBe(494); // elev 100, agl 50, floor 1000
    // Under Amendment 2, proven clearance below the floor triggers CVFR_OVERHEAD (verdict CLEAR).
    const reason = result.reasons.find((r) => r.kind === "CVFR_OVERHEAD");
    expect(reason).toBeDefined();
    expect(reason!.zone.id).toBe("Z-lane");
    expect(reason!.rule!.key).toBe("cvfr_lane_halfwidth_km");
    expect(reason!.verdict).toBe("CLEAR");
    expect(reason!.allowedAglM).toBe(50); // capped by max_altitude_agl_m
    expect(result.verdict).toBe("CLEAR");
  });

  it("vertical refinement: planned altitude with certain clearance yields CLEAR + advisory", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check({ lat: 32.45, lng: 35.44, plannedAltitudeAglM: 50 });
    expect(result.verdict).toBe("CLEAR");
    const reason = result.reasons.find((r) => r.zone.id === "Z-lane")!;
    expect(reason.verdict).toBe("CLEAR");
    expect(reason.kind).toBe("CVFR_OVERHEAD");
    expect(reason.vertical!.status).toBe("BELOW_FLOOR");
    expect(reason.allowedAglM).toBe(50);
  });

  it("allowed height: min over overlapping lanes, margin subtraction, zero-clamp", async () => {
    const zones = baseZones();
    zones.push(
      zone({
        id: "Z-lane-low",
        name: "ROUTE-LOW",
        zoneTypeCode: "CVFR_LANE",
        defaultVerdict: "RESTRICTED",
        geometryJson: JSON.stringify({ type: "LineString", coordinates: [[35.4, 32.4], [35.5, 32.5]] }),
        floorAmslFt: 600, // 600 * 0.3048 = 182.88 m
        ceilingAmslFt: 1500,
        mapLayerId: "L-lane",
      }),
    );
    const { deps } = setup({ zones, elevationM: 100 });
    const engine = createVerdictEngine(deps);

    // 1. Capped by Ruleset (max_altitude_agl_m is 50).
    const result1 = await engine.check({ lat: 32.45, lng: 35.44, plannedAltitudeAglM: 20 });
    expect(result1.verdict).toBe("CLEAR");
    expect(result1.reasons.find((r) => r.zone.id === "Z-lane-low")!.allowedAglM).toBe(50);

    // 2. Headroom binds (ruleset max is 100).
    const { deps: deps2, rulesetStore } = setup({ zones, elevationM: 100 });
    await updateRuleValue(rulesetStore, "max_altitude_agl_m", 100, "test edit");
    const result2 = await createVerdictEngine(deps2).check({ lat: 32.45, lng: 35.44, plannedAltitudeAglM: 20 });
    expect(result2.verdict).toBe("CLEAR");
    expect(result2.reasons.find((r) => r.zone.id === "Z-lane-low")!.allowedAglM).toBe(78.88);

    // 3. Zero-clamp: headroom is negative.
    const zonesNegative = baseZones();
    zonesNegative.push(
      zone({
        id: "Z-lane-negative",
        name: "ROUTE-NEG",
        zoneTypeCode: "CVFR_LANE",
        defaultVerdict: "RESTRICTED",
        geometryJson: JSON.stringify({ type: "LineString", coordinates: [[35.4, 32.4], [35.5, 32.5]] }),
        floorAmslFt: 300, // 300 * 0.3048 = 91.44
        ceilingAmslFt: 1500,
        mapLayerId: "L-lane",
      }),
    );
    const { deps: depsNeg } = setup({ zones: zonesNegative, elevationM: 100 });
    const resultNegHoriz = await createVerdictEngine(depsNeg).check({ lat: 32.45, lng: 35.44 });
    expect(resultNegHoriz.verdict).toBe("CLEAR");
    expect(resultNegHoriz.reasons.find((r) => r.zone.id === "Z-lane-negative")!.allowedAglM).toBe(0);
  });

  it("vertical refinement boundary: planned altitude overlap with floor (due to ±4m margin) does NOT downgrade", async () => {
    const { deps } = setup();
    // Z-lane floor is 1000 ft AMSL. At 100 m elevation, planned altitude of 201 m (659 ft)
    // results in [minFt: 974, maxFt: 1001], which overlaps floor 1000 ft (CONFLICT).
    // The verdict remains RESTRICTED.
    const result = await createVerdictEngine(deps).check({ lat: 32.45, lng: 35.44, plannedAltitudeAglM: 201 });
    expect(result.verdict).toBe("RESTRICTED");
    const reason = result.reasons.find((r) => r.zone.id === "Z-lane")!;
    expect(reason.verdict).toBe("RESTRICTED");
    expect(reason.vertical!.status).toBe("CONFLICT");
  });

  it("vertical refinement: P/R/D and INPA zones NEVER downgrade vertically", async () => {
    const zones = baseZones();
    const prohibitedZone = zones.find((z) => z.id === "Z-p")!;
    prohibitedZone.floorAmslFt = 1000;
    const reserveZone = zones.find((z) => z.id === "Z-r")!;
    reserveZone.floorAmslFt = 1000;

    const { deps } = setup({ zones });

    const resP = await createVerdictEngine(deps).check({ ...IN_PROHIBITED, plannedAltitudeAglM: 50 });
    const reasonP = resP.reasons.find((r) => r.zone.id === "Z-p")!;
    expect(reasonP.vertical!.status).toBe("BELOW_FLOOR");
    expect(reasonP.verdict).toBe("RESTRICTED"); // remains RESTRICTED

    const resR = await createVerdictEngine(deps).check({ ...IN_RESERVE, plannedAltitudeAglM: 50 });
    const reasonR = resR.reasons.find((r) => r.zone.id === "Z-r")!;
    expect(reasonR.vertical!.status).toBe("BELOW_FLOOR");
    expect(reasonR.verdict).toBe("NEEDS_PERMIT"); // remains NEEDS_PERMIT
  });

  it("inside a lane band within the corridor → CONFLICT + the lane's mapped verdict", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check({ lat: 32.45, lng: 35.44, plannedAltitudeAglM: 300 });
    expect(result.lanes.nearest!.vertical!.status).toBe("CONFLICT");
    expect(result.verdict).toBe("RESTRICTED");
  });

  it("blank lane band: corridor containment still triggers horizontally, but the band makes NO vertical claim", async () => {
    const { deps } = setup();
    // Point on the blank lane's centerline path.
    const result = await createVerdictEngine(deps).check({ lat: 33.05, lng: 35.95, plannedAltitudeAglM: 50 });
    expect(result.lanes.nearest!.zoneId).toBe("Z-lane-blank");
    expect(result.lanes.nearest!.withinCorridor).toBe(true);
    expect(result.lanes.nearest!.vertical!.status).toBe("NO_CLAIM"); // never "probably low"
    const reason = result.reasons.find((r) => r.kind === "WITHIN_LANE_CORRIDOR");
    expect(reason!.zone.id).toBe("Z-lane-blank");
    expect(reason!.vertical!.status).toBe("NO_CLAIM");
    expect(result.verdict).toBe("RESTRICTED"); // horizontal containment, per the mapping
  });

  it("no planned altitude → no vertical report, no elevation flag, lane distances still reported", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(OPEN_AREA);
    expect(result.vertical).toBeNull();
    expect(result.dataQuality.elevationApproximate).toBe(false);
    expect(result.lanes.nearest).not.toBeNull();
    expect(result.lanes.nearest!.withinCorridor).toBe(false); // far from every lane
    expect(result.lanes.nearest!.vertical).toBeNull();
  });
});

// ───────────────── Lane corridor (escalation 1 → option a, DECISION 2026-07-11) ─────────────────

describe("verdict engine — lane corridor containment", () => {
  it("corridorContains floors the distance — rounding WIDENS containment, never narrows it", () => {
    expect(corridorContains(999.99, 1000)).toBe(true);
    expect(corridorContains(1000, 1000)).toBe(true); // touching the edge counts as inside
    expect(corridorContains(1000.9, 1000)).toBe(true); // floors INTO the corridor
    expect(corridorContains(1001, 1000)).toBe(false);
  });

  it("outside the corridor: lane reported as facts only, no verdict participation", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(IN_RESERVE); // far from both lanes
    expect(result.lanes.corridor).toMatchObject({ ruleKey: "cvfr_lane_halfwidth_km", halfWidthM: 1000 });
    expect(result.lanes.nearest!.withinCorridor).toBe(false);
    expect(result.reasons.find((r) => r.kind === "WITHIN_LANE_CORRIDOR")).toBeUndefined();
    expect(result.verdict).toBe("NEEDS_PERMIT"); // the reserve only
  });

  it("editing the corridor width rule flips a verdict at the NEXT check (NFR-5)", async () => {
    const { deps, rulesetStore } = setup();
    const engine = createVerdictEngine(deps);
    const point = { lat: 32.45, lng: 35.44 }; // a few hundred meters from Z-lane's centerline

    const before = await engine.check(point);
    // Since plannedAltitudeAglM is not provided, Z-lane triggers horizontally as a CVFR_OVERHEAD (verdict CLEAR).
    expect(before.verdict).toBe("CLEAR");
    expect(before.reasons).toHaveLength(1);
    expect(before.reasons[0].kind).toBe("CVFR_OVERHEAD");
    expect(before.lanes.nearest!.withinCorridor).toBe(true);

    // The normal editor path — narrow the corridor below the point's distance.
    await updateRuleValue(rulesetStore, "cvfr_lane_halfwidth_km", 0.3, "test edit");

    const after = await engine.check(point);
    expect(after.verdict).toBe("CLEAR");
    expect(after.lanes.corridor!.halfWidthM).toBe(300);
    expect(after.lanes.nearest!.withinCorridor).toBe(false);
    expect(after.reasons).toEqual([]);
  });

  it("lanes imported + width rule missing → RULE_NOT_FOUND (fail closed, never a constant)", async () => {
    const { deps } = setup({ rules: baseRules().filter((r) => r.key !== "cvfr_lane_halfwidth_km") });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "RULE_NOT_FOUND",
      ruleKey: "cvfr_lane_halfwidth_km",
    });
  });

  it("lanes imported + width rule unset → RULE_VALUE_UNSET", async () => {
    const rules = baseRules().map((r) => (r.key === "cvfr_lane_halfwidth_km" ? { ...r, numberValue: null } : r));
    const { deps } = setup({ rules });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "RULE_VALUE_UNSET",
    });
  });

  it("width rule in an unexpected unit → VERDICT_BAD_RULE_UNIT (no guessed conversion)", async () => {
    const rules = baseRules().map((r) => (r.key === "cvfr_lane_halfwidth_km" ? { ...r, unit: "ft" } : r));
    const { deps } = setup({ rules });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "VERDICT_BAD_RULE_UNIT",
    });
  });

  it("no lane zones imported → the width rule is not required and corridor is null", async () => {
    const zones = baseZones().filter((z) => z.zoneTypeCode !== "CVFR_LANE");
    const rules = baseRules().filter((r) => r.key !== "cvfr_lane_halfwidth_km");
    const { deps } = setup({ zones, rules });
    const result = await createVerdictEngine(deps).check(OPEN_AREA);
    expect(result.verdict).toBe("CLEAR");
    expect(result.lanes).toEqual({ nearest: null, laneCount: 0, corridor: null });
  });
});

// ─────────────────────────── FAIL-CLOSED paths ───────────────────────────

describe("verdict engine — fail closed, never a silent clear", () => {
  it("zero imported layers → VERDICT_NO_ZONE_DATA", async () => {
    const { deps } = setup({ layers: [], zones: [] });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "VERDICT_NO_ZONE_DATA",
      status: 503,
    });
  });

  it("layers exist but zero zones → VERDICT_NO_ZONE_DATA", async () => {
    const { deps } = setup({ zones: [] });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "VERDICT_NO_ZONE_DATA",
    });
  });

  it("no airport zones → VERDICT_NO_AIRPORT_DATA (FR-C3 cannot be answered)", async () => {
    const zones = baseZones().filter((z) => z.zoneTypeCode !== "AIRPORT");
    const { deps } = setup({ zones });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "VERDICT_NO_AIRPORT_DATA",
      status: 503,
    });
  });

  it("missing Ruleset rule → RULE_NOT_FOUND propagates (never a default)", async () => {
    const { deps } = setup({ rules: baseRules().filter((r) => r.key !== "airport_buffer_km") });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "RULE_NOT_FOUND",
    });
  });

  it("unset Ruleset value → RULE_VALUE_UNSET propagates", async () => {
    const rules = baseRules().map((r) => (r.key === "airport_buffer_km" ? { ...r, numberValue: null } : r));
    const { deps } = setup({ rules });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "RULE_VALUE_UNSET",
    });
  });

  it("an unset ECHO rule also aborts an otherwise-clear check", async () => {
    const rules = baseRules().map((r) => (r.key === "max_altitude_agl_m" ? { ...r, numberValue: null } : r));
    const { deps } = setup({ rules });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "RULE_VALUE_UNSET",
    });
  });

  it("buffer rule in an unexpected unit → VERDICT_BAD_RULE_UNIT (no guessed conversion)", async () => {
    const rules = baseRules().map((r) => (r.key === "airport_buffer_km" ? { ...r, unit: "g" } : r));
    const { deps } = setup({ rules });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "VERDICT_BAD_RULE_UNIT",
    });
  });

  it("altitude asked + DEM missing → DEM_NOT_AVAILABLE aborts the WHOLE check", async () => {
    const { deps } = setup({ demService: failingDem(demNotAvailableError()) });
    await expect(
      createVerdictEngine(deps).check({ ...IN_PROHIBITED, plannedAltitudeAglM: 50 }),
    ).rejects.toMatchObject({ code: "DEM_NOT_AVAILABLE", status: 503 });
  });

  it("altitude asked + point outside DEM coverage → DEM_OUT_OF_COVERAGE", async () => {
    const { deps } = setup({ demService: failingDem(demOutOfCoverageError()) });
    await expect(
      createVerdictEngine(deps).check({ ...OPEN_AREA, plannedAltitudeAglM: 50 }),
    ).rejects.toMatchObject({ code: "DEM_OUT_OF_COVERAGE" });
  });

  it("no altitude asked → the DEM is not consulted at all", async () => {
    const { deps } = setup({ demService: failingDem(demNotAvailableError()) });
    const result = await createVerdictEngine(deps).check(OPEN_AREA);
    expect(result.verdict).toBe("CLEAR");
  });

  it("a triggered zone type with an unmapped verdict value → VERDICT_UNMAPPED_ZONE_TYPE (trigger 2)", async () => {
    const zones = baseZones();
    zones.find((z) => z.id === "Z-r")!.defaultVerdict = "MAYBE";
    const { deps } = setup({ zones });
    await expect(createVerdictEngine(deps).check(IN_RESERVE)).rejects.toMatchObject({
      code: "VERDICT_UNMAPPED_ZONE_TYPE",
      status: 409,
    });
  });

  it("a zone geometry the engine cannot evaluate → VERDICT_GEOMETRY_UNSUPPORTED", async () => {
    const zones = baseZones();
    zones.push(
      zone({
        id: "Z-bad",
        name: "corrupt",
        zoneTypeCode: "OTHER",
        defaultVerdict: "NEEDS_PERMIT",
        geometryJson: JSON.stringify({ type: "GeometryCollection", geometries: [] }),
      }),
    );
    const { deps } = setup({ zones });
    await expect(createVerdictEngine(deps).check(OPEN_AREA)).rejects.toMatchObject({
      code: "VERDICT_GEOMETRY_UNSUPPORTED",
    });
  });

  it("out-of-range coordinates / negative altitude → VERDICT_BAD_REQUEST", async () => {
    const { deps } = setup();
    const engine = createVerdictEngine(deps);
    await expect(engine.check({ lat: 999, lng: 35 })).rejects.toMatchObject({ code: "VERDICT_BAD_REQUEST" });
    await expect(engine.check({ lat: 32, lng: 35, plannedAltitudeAglM: -5 })).rejects.toMatchObject({
      code: "VERDICT_BAD_REQUEST",
    });
  });
});

// ─────────────────────────── Data-quality propagation ───────────────────────────

describe("verdict engine — data-quality flags (never authoritative)", () => {
  it("unverified layers and unverified rules are flagged on EVERY response, including CLEAR", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(OPEN_AREA);
    expect(result.dataQuality.layers).toHaveLength(3);
    expect(result.dataQuality.unverifiedLayers.sort()).toEqual(["aip-zones", "cvfr-lanes", "osm-airport-buffers"]);
    expect(result.dataQuality.layers[0].importedAt).toBe("2026-07-11T00:00:00.000Z");
    // Every fixture rule has lastVerifiedAt null → all flagged (incl. the
    // lane corridor width, read because lane zones are imported).
    expect(result.dataQuality.unverifiedRuleKeys.sort()).toEqual([
      "airport_buffer_km",
      "cvfr_lane_halfwidth_km",
      "daylight_only",
      "max_altitude_agl_m",
      "min_distance_people_structures_m",
      "vlos_required",
    ]);
  });

  it("verified layers and verified rules drop off the unverified lists", async () => {
    const layers = LAYERS.map((l) => ({ ...l, verified: true }));
    const rules = baseRules().map((r) => ({ ...r, lastVerifiedAt: new Date("2026-07-11T00:00:00Z") }));
    const { deps } = setup({ layers, rules });
    const result = await createVerdictEngine(deps).check(OPEN_AREA);
    expect(result.dataQuality.unverifiedLayers).toEqual([]);
    expect(result.dataQuality.unverifiedRuleKeys).toEqual([]);
    expect(result.context.numberLimits[0].lastVerifiedAt).toBe("2026-07-11T00:00:00.000Z");
  });

  it("elevation contribution is flagged approximate whenever an altitude was checked", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check({ ...OPEN_AREA, plannedAltitudeAglM: 50 });
    expect(result.dataQuality.elevationApproximate).toBe(true);
    expect(result.vertical!.elevation.approximate).toBe(true);
    expect(result.vertical!.elevation.source).toBe("copernicus-glo30-dem");
  });

  it("a reason carries its layer's verified flag for point-of-use badging", async () => {
    const { deps } = setup();
    const result = await createVerdictEngine(deps).check(IN_RESERVE);
    expect(result.reasons[0].layer).toMatchObject({ name: "aip-zones", verified: false });
  });
});
