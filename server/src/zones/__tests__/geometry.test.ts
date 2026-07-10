// DO-013: circle generation + polygon assembly (safety-critical geometry).
import { describe, expect, it } from "vitest";
import { ZoneParseError } from "../errors.js";
import { CIRCLE_SEGMENTS, circlePolygon, polygonFromVertices } from "../geometry.js";
import { lineToLogical } from "../hebrew.js";
import { isUnlimited, parseA17AltitudeFt, parseGdbAltitudeFt } from "../gdb.js";

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

describe("circlePolygon", () => {
  it("generates a closed ring of the documented segment count at the right radius", () => {
    // LLU01 published values: 31°56'06"N 34°52'50"E, radius 1000 m
    const lat = 31.935;
    const lng = 34.880555;
    const circle = circlePolygon(lat, lng, 1000);
    const ring = circle.coordinates[0];
    expect(ring).toHaveLength(CIRCLE_SEGMENTS + 1);
    expect(ring[0]).toEqual(ring[ring.length - 1]); // closed
    for (const [x, y] of ring) {
      expect(haversineM(lat, lng, y, x)).toBeCloseTo(1000, -1); // within ~5 m
    }
  });

  it("rejects non-positive radii (trigger 1: no guessed geometry)", () => {
    expect(() => circlePolygon(31.9, 34.9, 0)).toThrow(ZoneParseError);
    expect(() => circlePolygon(31.9, 34.9, -100)).toThrow(ZoneParseError);
    expect(() => circlePolygon(31.9, 34.9, Number.NaN)).toThrow(ZoneParseError);
  });
});

describe("polygonFromVertices", () => {
  it("closes an open ring (AIP vertex lists don't always repeat the first vertex)", () => {
    // LLU55 דור published rectangle
    const poly = polygonFromVertices([
      { lat: 32.595667, lng: 34.926667 },
      { lat: 32.604722, lng: 34.926667 },
      { lat: 32.604722, lng: 34.930278 },
      { lat: 32.595667, lng: 34.930278 },
    ]);
    expect(poly.coordinates[0]).toHaveLength(5);
    expect(poly.coordinates[0][0]).toEqual(poly.coordinates[0][4]);
  });

  it("keeps an already-closed ring closed without duplicating", () => {
    const poly = polygonFromVertices([
      { lat: 1, lng: 1 },
      { lat: 2, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 1, lng: 1 },
    ]);
    expect(poly.coordinates[0]).toHaveLength(4);
  });

  it("rejects fewer than 3 distinct vertices", () => {
    expect(() => polygonFromVertices([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }])).toThrow(ZoneParseError);
    expect(() =>
      polygonFromVertices([
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 1, lng: 1 },
      ]),
    ).toThrow(ZoneParseError);
  });
});

describe("altitude parsing fixtures (exact source values)", () => {
  it("gdb altitudes: plain integers only", () => {
    expect(parseGdbAltitudeFt("0")).toBe(0);
    expect(parseGdbAltitudeFt("3000")).toBe(3000);
    expect(parseGdbAltitudeFt("-530")).toBe(-530); // LLD42, Dead Sea
    expect(parseGdbAltitudeFt("12000/16000\r\n")).toBeNull(); // real dual value in the gdb — trigger 1
    expect(parseGdbAltitudeFt(null)).toBeNull();
    expect(parseGdbAltitudeFt("")).toBeNull();
  });

  it("א'-17 altitudes: GND/MSL floors, negative ceilings, UNL", () => {
    expect(parseA17AltitudeFt("GND")).toBe(0);
    expect(parseA17AltitudeFt("MSL/ GND")).toBe(0); // wraps across cell lines in the PDF
    expect(parseA17AltitudeFt("3000")).toBe(3000);
    expect(parseA17AltitudeFt("(-)530")).toBe(-530); // LLD42 published form
    expect(parseA17AltitudeFt("UNL")).toBeNull(); // unlimited — no numeric representation
    expect(isUnlimited("UNL")).toBe(true);
    expect(isUnlimited("3000")).toBe(false);
    expect(parseA17AltitudeFt("12000/16000")).toBeNull();
  });
});

describe("lineToLogical (RTL word reassembly)", () => {
  it("reassembles a Hebrew line right-to-left", () => {
    // words as positioned on the page (x ascending = visual left→right)
    const line = [
      { x: 10, text: "מעכה" },
      { x: 30, text: "בית" },
      { x: 50, text: "אבל" },
    ];
    expect(lineToLogical(line)).toBe("אבל בית מעכה");
  });

  it("keeps pure-LTR lines left-to-right", () => {
    const line = [
      { x: 10, text: "33°" },
      { x: 20, text: "07'" },
      { x: 30, text: `13.65"` },
      { x: 40, text: "N" },
    ];
    expect(lineToLogical(line)).toBe(`33° 07' 13.65" N`);
  });

  it("places single LTR tokens correctly inside an RTL line", () => {
    // "מרחב אווירי מס' 2" as positioned: 2 leftmost, מרחב rightmost
    const line = [
      { x: 10, text: "2" },
      { x: 20, text: "מס'" },
      { x: 40, text: "אווירי" },
      { x: 60, text: "מרחב" },
    ];
    expect(lineToLogical(line)).toBe("מרחב אווירי מס' 2");
  });
});
