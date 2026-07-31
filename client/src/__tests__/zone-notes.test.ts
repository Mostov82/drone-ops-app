// DO-035 item 2 — the zone-notes presentation contract.
//
// The safety-relevant property under test is NEGATIVE: this module must never
// manufacture a "coordination contact". The imported datasets are full of long
// digit runs (OSM node ids, ISO timestamps, DMS coordinates, KMZ stamps) and a
// loose phone regex would render one of them as a phone number the operator
// could try to call. The false-positive cases below are copied verbatim from
// data-sources/zones/**/zones.geojson.
import { describe, expect, it } from "vitest";
import {
  detectPhoneNumbers,
  splitSegmentParts,
  splitZoneNotes,
  toTelHref,
} from "@/lib/zone-notes";

describe("detectPhoneNumbers — must NOT invent contacts", () => {
  const realNotesWithoutPhones = [
    // osm-airport-buffers: an OSM node id is a long digit run, not a phone.
    "OSM gap-filler (Gate 1): aerodrome location from OpenStreetMap node/1042045384; buffer circle generated at import from Ruleset airport_buffer_km",
    "OSM gap-filler (Gate 1): aerodrome location from OpenStreetMap node/12064839451; buffer circle generated at import from Ruleset airport_buffer_km",
    // aip-a17-llp-llr-danger: gdb editor stamps are ISO timestamps.
    "not in א'-17 appendix ב' — source: gdb only (A17 flag X) | gdb editor stamp: AMI 2023-04-24T00:00:00.000",
    // aip-a17-llu-drone: DMS coordinates and radii.
    "circle: center 31°56'06\"N 34°52'50\"E, radius 1000 m (published)",
    "א'-17 definition note: מעגל שרדיוסו 6.5 ק \" מ ומרכזו בנקודה : 31° 44' 14.00\" N 34° 18' 12.00\" E | gdb editor stamp: AGL AVIATION 2016-07-06T20:46:37.000",
    // aip-a17-inpa-closures: KMZ file stamp.
    "אתרי קינון עיטים בסכנת הכחדה - דצמבר עד יוני | geometry: INPA RATAG KMZ (RATAG_kmz_07092020) — appendix ה' text governs attributes",
    // cvfr-lanes: directional altitudes.
    "CVFR lane; directional altitudes ft AMSL as published: N 1500 / S 2000 | band = option-A min/max envelope of published directional altitudes (decision 2026-07-11) | class=CIVIL | byRequest=OPEN",
  ];

  it.each(realNotesWithoutPhones)("finds no phone in real imported note: %s", (notes) => {
    expect(detectPhoneNumbers(notes)).toEqual([]);
  });

  it("returns nothing for null/empty notes rather than a placeholder", () => {
    expect(detectPhoneNumbers(null)).toEqual([]);
    expect(detectPhoneNumbers(undefined)).toEqual([]);
    expect(detectPhoneNumbers("")).toEqual([]);
    expect(detectPhoneNumbers("no contact here")).toEqual([]);
  });
});

describe("detectPhoneNumbers — genuine published numbers", () => {
  it.each([
    ["coordination: 03-9774300", "03-9774300", "039774300"],
    ["tel 08-9787777 during hours", "08-9787777", "089787777"],
    ["תיאום מראש בטלפון 02-6222222", "02-6222222", "026222222"],
    ["call +972-3-9774300", "+972-3-9774300", "+97239774300"],
    ["mobile 052-1234567", "052-1234567", "0521234567"],
    ["no separator 039774300", "039774300", "039774300"],
    ["spaced 03 977 4300", "03 977 4300", "039774300"],
    ["toll free 1-800-123456", "1-800-123456", "1800123456"],
  ])("detects a phone in %s", (notes, raw, tel) => {
    const found = detectPhoneNumbers(notes);
    expect(found).toHaveLength(1);
    expect(found[0].raw).toBe(raw);
    expect(found[0].tel).toBe(tel);
  });

  it("preserves the published formatting verbatim and de-duplicates by number", () => {
    const found = detectPhoneNumbers("call 03-9774300 or 03-9774300 or 08-9787777");
    expect(found.map((p) => p.raw)).toEqual(["03-9774300", "08-9787777"]);
  });

  it("does not match a phone-shaped run embedded in a longer digit sequence", () => {
    expect(detectPhoneNumbers("id 9903977430012345")).toEqual([]);
  });
});

describe("toTelHref", () => {
  it("strips separators and preserves a leading +", () => {
    expect(toTelHref("03-977 4300")).toBe("039774300");
    expect(toTelHref("+972-3-9774300")).toBe("+97239774300");
  });
});

describe("splitZoneNotes", () => {
  it("splits on the note's own | fragments, verbatim, dropping empties", () => {
    const segments = splitZoneNotes("first fragment | second fragment ||  third  ");
    expect(segments.map((s) => s.text)).toEqual([
      "first fragment",
      "second fragment",
      "third",
    ]);
  });

  it("returns no segments for absent notes (the caller states absence honestly)", () => {
    expect(splitZoneNotes(null)).toEqual([]);
    expect(splitZoneNotes("")).toEqual([]);
  });

  it("flags only the fragment that actually carries a contact", () => {
    const segments = splitZoneNotes("provenance note | coordination: 03-9774300");
    expect(segments.map((s) => s.hasContact)).toEqual([false, true]);
  });

  it("does not alter Hebrew prose it passes through", () => {
    const hebrew = "אתרי קינון עיטים בסכנת הכחדה - דצמבר עד יוני";
    expect(splitZoneNotes(hebrew)[0].text).toBe(hebrew);
  });
});

describe("splitSegmentParts", () => {
  it("wraps only the phone run, leaving every other character untouched", () => {
    const parts = splitSegmentParts("coordination: 03-9774300 before flight");
    expect(parts).toEqual([
      { kind: "text", text: "coordination: " },
      { kind: "phone", text: "03-9774300", tel: "039774300" },
      { kind: "text", text: " before flight" },
    ]);
  });

  it("round-trips the original text exactly", () => {
    const original = "call 03-9774300 or +972-8-9787777 today";
    expect(splitSegmentParts(original).map((p) => p.text).join("")).toBe(original);
  });

  it("yields a single text part when there is no phone", () => {
    expect(splitSegmentParts("plain provenance note")).toEqual([
      { kind: "text", text: "plain provenance note" },
    ]);
  });
});
