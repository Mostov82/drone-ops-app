// DO-013 — option-A lane altitude envelope (trigger 6 resolved, decision log
// 2026-07-11). Fixture altitudes are arbitrary test data shaped like the
// gdb's real value patterns, never regulatory values.
import { describe, it, expect } from "vitest";
import { buildCvfr, publishedAltitudesFt, LANE_ZONE_TYPE } from "../builders/cvfr.js";
import type { GdbDump } from "../gdb.js";

function dump(features: Record<string, string | number | null>[]): GdbDump {
  return {
    source: { zip: "test.zip", gdb: "test.gdb", layer: "TEST", crs: "EPSG:32636" },
    fields: [],
    featureCount: features.length,
    features: features.map((properties, i) => ({
      fid: i + 1,
      properties,
      geometryWgs84: { type: "LineString", coordinates: [[35, 32], [35.1, 32.1]] },
    })),
  };
}

const EMPTY_POINTS = dump([]);

function segment(alts: Partial<Record<"N_A" | "S_A" | "W_Alt" | "E_Alt", string>>, code = "TESTLANE") {
  return { NAME_UNIT: code, N_A: "X", S_A: "X", W_Alt: "X", E_Alt: "X", ...alts };
}

describe("publishedAltitudesFt", () => {
  it("extracts every published number; X / <Null> / null publish none", () => {
    expect(publishedAltitudesFt("3500")).toEqual([3500]);
    expect(publishedAltitudesFt("2000/1000")).toEqual([2000, 1000]);
    expect(publishedAltitudesFt("1200, 2000")).toEqual([1200, 2000]);
    expect(publishedAltitudesFt("X")).toEqual([]);
    expect(publishedAltitudesFt("<Null>")).toEqual([]);
    expect(publishedAltitudesFt(null)).toEqual([]);
  });
});

describe("option-A envelope", () => {
  it("floor = min, ceiling = max of a plain directional pair", () => {
    const result = buildCvfr(dump([segment({ N_A: "3500", S_A: "3000" })]), EMPTY_POINTS);
    const props = result.lanes.features[0].properties;
    expect(props.zoneTypeCode).toBe(LANE_ZONE_TYPE);
    expect(props.floorAmslFt).toBe(3000);
    expect(props.ceilingAmslFt).toBe(3500);
    expect(props.aglCeilingFt).toBeNull();
    expect(props.notes).toContain("N 3500 / S 3000");
    expect(props.notes).toContain("option-A");
  });

  it("dual values contribute both numbers to the envelope", () => {
    const result = buildCvfr(
      dump([segment({ W_Alt: "2000/1000", E_Alt: "1500" })]),
      EMPTY_POINTS,
    );
    const props = result.lanes.features[0].properties;
    expect(props.floorAmslFt).toBe(1000);
    expect(props.ceilingAmslFt).toBe(2000);
    // Raw string preserved; per-direction parsed twin stays null (not a single integer).
    expect(props.altitudeWestRaw).toBe("2000/1000");
    expect(props.altitudeWestFt).toBeNull();
    expect(result.stats.envelopeFromMultiValue).toBe(1);
    expect(result.issues.some((i) => i.kind === "altitude-multi-value")).toBe(true);
  });

  it("partially published pair takes the envelope of what is published", () => {
    const result = buildCvfr(
      dump([segment({ N_A: "2500", S_A: "<Null>" })]),
      EMPTY_POINTS,
    );
    const props = result.lanes.features[0].properties;
    expect(props.floorAmslFt).toBe(2500);
    expect(props.ceilingAmslFt).toBe(2500);
    expect(result.issues.some((i) => i.kind === "altitude-not-published")).toBe(true);
  });

  it("no published altitude at all → null band, flagged, never guessed", () => {
    const result = buildCvfr(dump([segment({})]), EMPTY_POINTS);
    const props = result.lanes.features[0].properties;
    expect(props.floorAmslFt).toBeNull();
    expect(props.ceilingAmslFt).toBeNull();
    expect(result.stats.nullBandSegments).toBe(1);
    expect(result.issues.some((i) => i.kind === "altitude-null-band")).toBe(true);
  });
});
