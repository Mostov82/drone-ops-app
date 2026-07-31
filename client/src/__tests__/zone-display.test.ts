// DO-014 — verdict→style mapping, altitude-band semantics and note parsing
// (the zones-api.md contract), and layer-visibility persistence.
// Zone codes/altitudes below mirror real published shapes (LLD42, LLP15,
// INPA aglCeilingFt) purely as display-semantics fixtures — no regulatory
// value is asserted or embedded as a limit.
import { describe, expect, it } from "vitest";
import {
  aglCeilingFromNotes,
  describeAltitudeBand,
  isKnownVerdict,
  isLayerVisible,
  laneDirectionalAltitudes,
  laneStyle,
  loadLayerVisibility,
  saveLayerVisibility,
  verdictStyle,
  getZoneStyle,
  bufferLine,
} from "../lib/zone-display";

describe("verdictStyle — data-driven styling", () => {
  it("gives each known verdict tier a distinct style", () => {
    const restricted = verdictStyle("RESTRICTED");
    const needsPermit = verdictStyle("NEEDS_PERMIT");
    const clear = verdictStyle("CLEAR");
    expect(new Set([restricted.color, needsPermit.color, clear.color]).size).toBe(3);
    expect(isKnownVerdict("RESTRICTED")).toBe(true);
  });

  it("falls back to a neutral style for an unknown verdict value (editable data must never crash styling)", () => {
    const style = verdictStyle("SOME_FUTURE_TIER");
    expect(style.color).toBeTruthy();
    expect(style.color).not.toBe(verdictStyle("RESTRICTED").color);
    expect(isKnownVerdict("SOME_FUTURE_TIER")).toBe(false);
  });

  it("styles lanes as dashed, unfilled lines in the verdict color", () => {
    const style = laneStyle("RESTRICTED");
    expect(style.color).toBe(verdictStyle("RESTRICTED").color);
    expect(style.fillOpacity).toBe(0);
    expect(style.dashArray).toBeTruthy();
  });
});

describe("aglCeilingFromNotes — the notes-borne AGL ceiling (import contract)", () => {
  it("parses an aglCeilingFt segment appended by the importer", () => {
    expect(
      aglCeilingFromNotes("appendix ה' text governs attributes | aglCeilingFt=500"),
    ).toBe(500);
  });

  it("parses a notes value that is only the AGL segment", () => {
    expect(aglCeilingFromNotes("aglCeilingFt=300")).toBe(300);
  });

  it("returns null when notes carry no AGL ceiling", () => {
    expect(aglCeilingFromNotes(null)).toBeNull();
    expect(aglCeilingFromNotes("gdb editor stamp: AMI 2022-01-23")).toBeNull();
  });
});

describe("laneDirectionalAltitudes — raw directional strings preserved in notes", () => {
  const laneNotes =
    "CVFR lane; directional altitudes ft AMSL as published: N 1500 / S 2000 | " +
    "band = option-A min/max envelope of published directional altitudes (decision 2026-07-11) | class=CIVIL";

  it("extracts the published fragment exactly", () => {
    expect(laneDirectionalAltitudes(laneNotes)).toBe("N 1500 / S 2000");
  });

  it("returns null when the lane published nothing", () => {
    expect(
      laneDirectionalAltitudes("CVFR lane; directional altitudes ft AMSL as published: none | band = …"),
    ).toBeNull();
    expect(laneDirectionalAltitudes(null)).toBeNull();
  });
});

describe("describeAltitudeBand — zones-api.md semantics", () => {
  it("shows a GND floor and an UNL ceiling on a P/R/D zone (null = unbounded, P/R/D only)", () => {
    // LLP15-shaped fixture: floor stored 0 (GND), ceiling null (UNL).
    const band = describeAltitudeBand({
      zoneTypeCode: "AIP_PROHIBITED",
      floorAmslFt: 0,
      ceilingAmslFt: null,
      notes: "ceiling UNL (unlimited) per א'-17 — stored null",
    });
    expect(band).toEqual({
      kind: "band",
      floor: { kind: "ground" },
      ceiling: { kind: "unbounded" },
    });
  });

  it("renders a below-sea-level ceiling as published (LLD42: GND to −530 ft AMSL)", () => {
    const band = describeAltitudeBand({
      zoneTypeCode: "AIP_DANGER",
      floorAmslFt: 0,
      ceilingAmslFt: -530,
      notes: null,
    });
    expect(band).toEqual({
      kind: "band",
      floor: { kind: "ground" },
      ceiling: { kind: "amsl", ft: -530 },
    });
  });

  it("treats INPA null AMSL columns as NOT PUBLISHED — never unbounded (Amendment 1)", () => {
    const band = describeAltitudeBand({
      zoneTypeCode: "NATURE_RESERVE",
      floorAmslFt: null,
      ceilingAmslFt: null,
      notes: "geometry: INPA RATAG KMZ — appendix ה' text governs attributes",
    });
    expect(band).toEqual({
      kind: "band",
      floor: { kind: "notPublished" },
      ceiling: { kind: "notPublished" },
    });
  });

  it("surfaces an INPA AGL ceiling from notes, labeled AGL, never converted", () => {
    const band = describeAltitudeBand({
      zoneTypeCode: "NATURE_RESERVE",
      floorAmslFt: null,
      ceilingAmslFt: null,
      notes: "אתרי קינון | geometry: INPA RATAG KMZ | aglCeilingFt=500",
    });
    expect(band).toEqual({
      kind: "band",
      floor: { kind: "notPublished" },
      ceiling: { kind: "agl", ft: 500 },
    });
  });

  it("surfaces the LLU drone-zone AGL ceiling from notes", () => {
    const band = describeAltitudeBand({
      zoneTypeCode: "LLU_DRONE",
      floorAmslFt: null,
      ceilingAmslFt: null,
      notes: "circle: center …, radius 1000 m (published) | aglCeilingFt=300",
    });
    expect(band).toEqual({
      kind: "band",
      floor: { kind: "notPublished" },
      ceiling: { kind: "agl", ft: 300 },
    });
  });

  it("makes NO vertical claim for a lane with a blank published band", () => {
    const band = describeAltitudeBand({
      zoneTypeCode: "CVFR_LANE",
      floorAmslFt: null,
      ceilingAmslFt: null,
      notes: "CVFR lane; directional altitudes ft AMSL as published: none",
    });
    expect(band).toEqual({ kind: "noVerticalClaim" });
  });

  it("shows a lane's option-A envelope as ft AMSL values", () => {
    const band = describeAltitudeBand({
      zoneTypeCode: "CVFR_LANE",
      floorAmslFt: 1500,
      ceilingAmslFt: 2000,
      notes: "CVFR lane; directional altitudes ft AMSL as published: N 1500 / S 2000",
    });
    expect(band).toEqual({
      kind: "band",
      floor: { kind: "amsl", ft: 1500 },
      ceiling: { kind: "amsl", ft: 2000 },
    });
  });

  it("renders null bands on non-P/R/D zones (airport gap-filler) as not published", () => {
    const band = describeAltitudeBand({
      zoneTypeCode: "AIRPORT",
      floorAmslFt: null,
      ceilingAmslFt: null,
      notes: "OSM gap-filler",
    });
    expect(band).toEqual({
      kind: "band",
      floor: { kind: "notPublished" },
      ceiling: { kind: "notPublished" },
    });
  });
});

describe("layer-visibility persistence", () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      dump: () => Object.fromEntries(map),
    };
  }

  it("round-trips toggle state", () => {
    const storage = fakeStorage();
    saveLayerVisibility({ "cvfr-lanes": false, "aip-a17-llp-llr-danger": true }, storage);
    expect(loadLayerVisibility(storage)).toEqual({
      "cvfr-lanes": false,
      "aip-a17-llp-llr-danger": true,
    });
  });

  it("defaults unknown layers to VISIBLE (a new dataset must never be silently hidden)", () => {
    expect(isLayerVisible({}, "aip-a17-inpa-closures")).toBe(true);
    expect(isLayerVisible({ "cvfr-lanes": false }, "cvfr-lanes")).toBe(false);
  });

  it("survives corrupted persistence without breaking the map", () => {
    const storage = fakeStorage({ "droneops.zoneLayerVisibility": "{not json" });
    expect(loadLayerVisibility(storage)).toEqual({});
    const nonObject = fakeStorage({ "droneops.zoneLayerVisibility": '"a string"' });
    expect(loadLayerVisibility(nonObject)).toEqual({});
  });

  it("filters non-boolean values out of persisted state", () => {
    const storage = fakeStorage({
      "droneops.zoneLayerVisibility": '{"a": true, "b": "yes", "c": 1, "d": false}',
    });
    expect(loadLayerVisibility(storage)).toEqual({ a: true, d: false });
  });
});

describe("getZoneStyle — zone class × verdict styling", () => {
  it("resolves specific styling for Prohibited restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "AIP_PROHIBITED");
    expect(style.color).toBe("#b3261e");
    expect(style.weight).toBe(2.6);
    expect(style.fillColor).toBe("url(#crosshatch-restricted)");
  });

  it("resolves specific styling for Restricted restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "AIP_RESTRICTED");
    expect(style.color).toBe("#d64500");
    expect(style.weight).toBe(2.2);
    expect(style.dashArray).toBe("8 4");
  });

  it("resolves specific styling for Danger restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "AIP_DANGER");
    expect(style.color).toBe("#c77b00");
    expect(style.weight).toBe(2.0);
    expect(style.dashArray).toBe("10 3 2 3");
    expect(style.fillColor).toBe("url(#hatch-restricted)");
  });

  it("resolves specific styling for LLU Drone restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "LLU_DRONE");
    expect(style.color).toBe("#c2185b");
    expect(style.weight).toBe(2.6);
  });

  it("resolves LLU Drone inner ring styling", () => {
    const style = getZoneStyle("RESTRICTED", "LLU_DRONE", { isInner: true });
    expect(style.weight).toBe(1.5);
    expect(style.dashArray).toBe("1 3");
    expect(style.fill).toBe(false);
  });

  it("resolves specific styling for Airport restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "AIRPORT");
    expect(style.color).toBe("#d64500");
    expect(style.weight).toBe(1.4);
    expect(style.fillOpacity).toBe(0.08);
  });

  it("resolves specific styling for CTR restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "CTR");
    expect(style.color).toBe("#8c4a2f");
    expect(style.weight).toBe(2.2);
    expect(style.dashArray).toBe("12 4");
  });

  it("resolves specific styling for ATZ restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "ATZ");
    expect(style.color).toBe("#8c4a2f");
    expect(style.weight).toBe(1.2);
    expect(style.dashArray).toBe("5 3");
  });

  it("resolves specific styling for CTA restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "CTA");
    expect(style.color).toBe("#8c4a2f");
    expect(style.weight).toBe(1.6);
    expect(style.dashArray).toBe("2 2");
    expect(style.fill).toBe(false);
  });

  it("resolves specific styling for Nature Reserve restricted family", () => {
    const style = getZoneStyle("RESTRICTED", "NATURE_RESERVE");
    expect(style.color).toBe("#9c7a00");
    expect(style.weight).toBe(1.8);
    expect(style.dashArray).toBe("1.5 3.5");
  });

  it("resolves specific styling for CVFR Lane", () => {
    const centerline = getZoneStyle("RESTRICTED", "CVFR_LANE");
    expect(centerline.color).toBe("#3f51b5");
    expect(centerline.weight).toBe(1.4);
    expect(centerline.dashArray).toBe("7 5");

    const corridor = getZoneStyle("RESTRICTED", "CVFR_LANE", { isCorridor: true });
    expect(corridor.color).toBe("#3f51b5");
    expect(corridor.weight).toBe(1.0);
    expect(corridor.fillOpacity).toBe(0.08);
  });

  it("resolves Needs Permit overrides (dotted border and color shift)", () => {
    const style = getZoneStyle("NEEDS_PERMIT", "AIP_PROHIBITED");
    expect(style.color).toBe("#c77b00");
    expect(style.weight).toBe(1.6);
    expect(style.dashArray).toBe("2 4");
    expect(style.fillColor).toBe("url(#crosshatch-needs-permit)");
  });

  it("resolves Clear overrides (color shift and no green)", () => {
    const style = getZoneStyle("CLEAR", "AIP_PROHIBITED");
    expect(style.color).toBe("#475569");
    expect(style.weight).toBe(1.2);
    expect(style.dashArray).toBe("4 4");
    expect(style.fillColor).toBe("url(#crosshatch-clear)");
    expect(style.color).not.toContain("green");
  });
});

describe("bufferLine — centerline corridor generation", () => {
  it("buffers a simple line segment into a corridor polygon", () => {
    const line: [number, number][] = [
      [35.0, 32.0],
      [35.1, 32.1],
    ];
    const polygon = bufferLine(line, 1000); // 1km buffer
    expect(polygon.length).toBe(5); // 2 left points + 2 right points + closed loop
    // Start and end points should form a closed loop
    expect(polygon[0]).toEqual(polygon[4]);
  });

  it("handles empty or single point lines gracefully", () => {
    expect(bufferLine([], 1000)).toEqual([]);
    expect(bufferLine([[35.0, 32.0]], 1000)).toEqual([]);
  });
});
