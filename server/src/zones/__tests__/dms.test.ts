// DO-013: DMS parsing — unit-tested against EXACT strings from the sources
// (Limited_Edges / א'-17 appendices), per the acceptance criteria. Fail-closed:
// anything ambiguous throws; nothing is guessed.
import { describe, expect, it } from "vitest";
import { parseDms, parseDmsPair, parseDmsParts, stripBidi } from "../dms.js";
import { ZoneParseError } from "../errors.js";

describe("parseDms — exact source notations", () => {
  it("parses Limited_Edges / appendix ב' long form (edge seconds like 13.44)", () => {
    // exact strings from Limited_Edges EAST/NORTH fields (LLP07)
    expect(parseDms(`34° 53' 12.775" E`)).toBeCloseTo(34 + 53 / 60 + 12.775 / 3600, 12);
    expect(parseDms(`32° 27' 40.861" N`)).toBeCloseTo(32 + 27 / 60 + 40.861 / 3600, 12);
    // exact strings from appendix ב' page 13 (LLP01, the intent doc's example seconds)
    expect(parseDms(`35° 35' 13.44" E`)).toBeCloseTo(35 + 35 / 60 + 13.44 / 3600, 12);
    expect(parseDms(`33° 07' 13.65" N`)).toBeCloseTo(33 + 7 / 60 + 13.65 / 3600, 12);
  });

  it("parses appendix ג' compact form", () => {
    // exact strings from appendix ג' (LLU01)
    expect(parseDms(`31°56'06"N`)).toBeCloseTo(31 + 56 / 60 + 6 / 3600, 12);
    expect(parseDms(`34°52'50"E`)).toBeCloseTo(34 + 52 / 60 + 50 / 3600, 12);
  });

  it("parses the source's drifted-apostrophe quirk (LLP11, page 14)", () => {
    // the minutes apostrophe drifted onto the seconds token in the PDF
    expect(parseDms(`31° 46 '41.00" N`)).toBeCloseTo(31 + 46 / 60 + 41 / 3600, 12);
  });

  it("S/W hemispheres are negative", () => {
    expect(parseDms(`10° 30' 00" S`)).toBeCloseTo(-10.5, 12);
    expect(parseDms(`10° 30' 00" W`)).toBeCloseTo(-10.5, 12);
  });

  it("strips PDF bidi control characters", () => {
    expect(stripBidi("‫‪31°56'06\"N‬")).toBe(`31°56'06"N`);
    expect(parseDms("‪31°56'06\"N‬")).toBeCloseTo(31 + 56 / 60 + 6 / 3600, 12);
  });

  it("rejects the mangled LLD29 cell exactly as published (trigger 1)", () => {
    // real string from page 17 — seconds token broken beyond unambiguous repair
    expect(() => parseDms(`31° 17' . 13 00" N`)).toThrow(ZoneParseError);
  });

  it("rejects out-of-range and malformed values", () => {
    expect(() => parseDms(`31° 60' 00" N`)).toThrow(ZoneParseError); // minutes
    expect(() => parseDms(`31° 10' 60.0" N`)).toThrow(ZoneParseError); // seconds
    expect(() => parseDms(`91° 10' 10" N`)).toThrow(ZoneParseError); // degrees > 90 lat
    expect(() => parseDms(`31 10' 10" N`)).toThrow(ZoneParseError); // no degree sign
    expect(() => parseDms(``)).toThrow(ZoneParseError);
    expect(() => parseDms(`GND`)).toThrow(ZoneParseError);
  });

  it("parseDmsPair enforces axis hemispheres", () => {
    const { lat, lng } = parseDmsPair(`31°56'06"N`, `34°52'50"E`);
    expect(lat).toBeCloseTo(31.935, 6);
    expect(lng).toBeCloseTo(34.88055555, 6);
    expect(() => parseDmsPair(`34°52'50"E`, `31°56'06"N`)).toThrow(ZoneParseError);
  });

  it("exposes structured parts", () => {
    expect(parseDmsParts(`33° 07' 13.65" N`)).toEqual({ degrees: 33, minutes: 7, seconds: 13.65, hemisphere: "N" });
  });
});
