// DO-012 — DMS/decimal coordinate parser tests (FR-C2 as amended).
// Acceptance criterion: entered coordinates move the pin to within a meter.
// Test fixtures are arbitrary geometry, not regulatory values.
import { describe, expect, it } from "vitest";
import {
  formatDecimal,
  formatDms,
  formatDmsAxis,
  parseCoordinates,
  type LatLng,
} from "../lib/coords";

/** Rough meters between two nearby points (small-angle, good under ~1 km). */
function metersApart(a: LatLng, b: LatLng): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

describe("parseCoordinates — decimal input", () => {
  it("parses comma-separated decimal degrees", () => {
    expect(parseCoordinates("31.771959, 35.217018")).toEqual({
      lat: 31.771959,
      lng: 35.217018,
    });
  });

  it("parses whitespace-separated decimal degrees", () => {
    expect(parseCoordinates("31.771959 35.217018")).toEqual({
      lat: 31.771959,
      lng: 35.217018,
    });
  });

  it("parses slash-separated decimal degrees", () => {
    expect(parseCoordinates("29.55 / 34.95")).toEqual({ lat: 29.55, lng: 34.95 });
  });

  it("parses negative decimals as south/west", () => {
    expect(parseCoordinates("-31.5, -35.25")).toEqual({ lat: -31.5, lng: -35.25 });
  });

  it("applies hemisphere letters on decimal values", () => {
    expect(parseCoordinates("31.771959 N, 35.217018 E")).toEqual({
      lat: 31.771959,
      lng: 35.217018,
    });
    expect(parseCoordinates("31.5 S, 35.25 W")).toEqual({ lat: -31.5, lng: -35.25 });
  });

  it("reorders when hemisphere letters put longitude first", () => {
    expect(parseCoordinates("35.217018 E, 31.771959 N")).toEqual({
      lat: 31.771959,
      lng: 35.217018,
    });
  });
});

describe("parseCoordinates — DMS input (AIP notation)", () => {
  it("parses the AIP's style: 35° 35' 13.44\" E", () => {
    const p = parseCoordinates(`31° 46' 19.05" N, 35° 13' 1.26" E`);
    expect(p).not.toBeNull();
    expect(p!.lat).toBeCloseTo(31 + 46 / 60 + 19.05 / 3600, 9);
    expect(p!.lng).toBeCloseTo(35 + 13 / 60 + 1.26 / 3600, 9);
  });

  it("parses unicode prime/double-prime marks without spaces", () => {
    const p = parseCoordinates("31°46′19.05″N 35°13′1.26″E");
    expect(p).not.toBeNull();
    expect(p!.lat).toBeCloseTo(31 + 46 / 60 + 19.05 / 3600, 9);
    expect(p!.lng).toBeCloseTo(35 + 13 / 60 + 1.26 / 3600, 9);
  });

  it("parses degrees + decimal minutes", () => {
    const p = parseCoordinates("31° 46.3175' N, 35° 13.021' E");
    expect(p).not.toBeNull();
    expect(p!.lat).toBeCloseTo(31 + 46.3175 / 60, 9);
    expect(p!.lng).toBeCloseTo(35 + 13.021 / 60, 9);
  });

  it("parses whole degrees with hemisphere only", () => {
    expect(parseCoordinates("31° N, 35° E")).toEqual({ lat: 31, lng: 35 });
  });

  it("parses DMS with double single-quote seconds mark", () => {
    const p = parseCoordinates("29° 33' 30'' N, 34° 57' 0'' E");
    expect(p).not.toBeNull();
    expect(p!.lat).toBeCloseTo(29 + 33 / 60 + 30 / 3600, 9);
  });

  it("parses mixed decimal latitude with DMS longitude", () => {
    const p = parseCoordinates(`31.771959, 35° 13' 1.26" E`);
    expect(p).not.toBeNull();
    expect(p!.lat).toBe(31.771959);
    expect(p!.lng).toBeCloseTo(35 + 13 / 60 + 1.26 / 3600, 9);
  });
});

describe("parseCoordinates — rejected input", () => {
  const bad = [
    "",
    "hello",
    "31.5", // one value only
    "31.5, 35.2, 33.1", // three values
    "31° 61' 0\" N, 35° E", // minutes ≥ 60
    "31° 46' 60.5\" N, 35° E", // seconds ≥ 60
    "91.1, 35.2", // latitude out of range
    "31.5, 181.0", // longitude out of range
    "31° N, 35° S", // two latitude letters
    "35° E, 34° W", // two longitude letters
    "-31.5 S, 34.9 E", // minus sign AND hemisphere letter
    "31.5° 20' N, 34.9 E", // decimal degrees combined with minutes
  ];
  for (const text of bad) {
    it(`rejects ${JSON.stringify(text)}`, () => {
      expect(parseCoordinates(text)).toBeNull();
    });
  }
});

describe("round trips — within a meter", () => {
  const points: LatLng[] = [
    { lat: 31.771959, lng: 35.217018 },
    { lat: 29.501234, lng: 34.912345 },
    { lat: 33.28075, lng: 35.57466 },
    { lat: 32.000001, lng: 34.999999 },
  ];

  for (const p of points) {
    it(`formatDms → parse stays within 1 m for ${p.lat},${p.lng}`, () => {
      const parsed = parseCoordinates(formatDms(p));
      expect(parsed).not.toBeNull();
      expect(metersApart(p, parsed!)).toBeLessThan(1);
    });

    it(`formatDecimal → parse stays within 1 m for ${p.lat},${p.lng}`, () => {
      const parsed = parseCoordinates(formatDecimal(p));
      expect(parsed).not.toBeNull();
      expect(metersApart(p, parsed!)).toBeLessThan(1);
    });
  }
});

describe("formatDmsAxis", () => {
  it("renders the AIP style", () => {
    expect(formatDmsAxis(35 + 35 / 60 + 13.44 / 3600, "lng")).toBe(`35° 35' 13.44" E`);
  });

  it("uses S/W for negative values", () => {
    expect(formatDmsAxis(-31.5, "lat")).toBe(`31° 30' 0.00" S`);
    expect(formatDmsAxis(-0.25, "lng")).toBe(`0° 15' 0.00" W`);
  });

  it("carries seconds that round to 60.00", () => {
    expect(formatDmsAxis(31.9999999, "lat")).toBe(`32° 0' 0.00" N`);
    expect(formatDmsAxis(31 + 59.99999 / 60, "lat")).toBe(`32° 0' 0.00" N`);
  });

  it("formatDecimal renders six decimals", () => {
    expect(formatDecimal({ lat: 31.7719591, lng: 35.2170185 })).toBe("31.771959, 35.217019");
  });
});
