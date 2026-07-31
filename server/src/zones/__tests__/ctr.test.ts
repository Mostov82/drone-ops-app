// DO-036 — TLV_FIR controlled-airspace builder (CTR/ATZ/CTA).

import { describe, expect, it } from "vitest";
import { buildCtr, parseCeilingEnvelopeFt } from "../builders/ctr.js";
import type { GdbDump } from "../gdb.js";

const POLY = { type: "MultiPolygon", coordinates: [[[[35.0, 32.0], [35.1, 32.0], [35.1, 32.1], [35.0, 32.0]]]] };

function dump(features: { fid: number; props: Record<string, string | number | null>; geometry?: unknown }[]): GdbDump {
  return {
    source: { zip: "data-sources/gis/TLV_FIR.zip", gdb: "TLV_FIR.lpk!v101/new_file_geodatabase_ctr.gdb", layer: "CTR", crs: "EPSG:32636" },
    fields: ["Name", "Code", "Civ_Mil", "TYPE", "Min_Alt", "Max_Alt", "Comment", "Modified"],
    featureCount: features.length,
    features: features.map((f) => ({
      fid: f.fid,
      properties: f.props,
      geometryWgs84: f.geometry === undefined ? POLY : f.geometry,
    })),
  };
}

const base = { Name: "נתבג", Code: "LLBG", Civ_Mil: "אזרחי", TYPE: "CTR", Min_Alt: 0, Max_Alt: "2000", Comment: null, Modified: "2022-01-01T00:00:00+00:00" };

describe("parseCeilingEnvelopeFt", () => {
  it("plain integer", () => expect(parseCeilingEnvelopeFt("2000")).toEqual({ value: 2000, parts: [2000] }));
  it("dual value takes the max (conservative)", () =>
    expect(parseCeilingEnvelopeFt("3000/3500")).toEqual({ value: 3500, parts: [3000, 3500] }));
  it("junk → null, never guessed", () => expect(parseCeilingEnvelopeFt("UNL-ish").value).toBeNull());
  it("null → null", () => expect(parseCeilingEnvelopeFt(null).value).toBeNull());
});

describe("buildCtr", () => {
  it("maps classes to their ZoneTypes with bands and the unit caveat in notes", () => {
    const result = buildCtr(
      dump([
        { fid: 1, props: { ...base } },
        { fid: 2, props: { ...base, Name: "ערד", Code: "ARAD", TYPE: "ATZ", Max_Alt: "3000" } },
        { fid: 3, props: { ...base, Name: "נגב", Code: "LLNV", TYPE: "CTA", Min_Alt: 2800, Max_Alt: "4000" } },
      ]),
    );
    expect(result.stats.perClass).toEqual({ CTR: 1, ATZ: 1, CTA: 1 });
    const cta = result.collection.features.find((f) => f.properties.zoneTypeCode === "CTA")!;
    expect(cta.properties.floorAmslFt).toBe(2800);
    expect(cta.properties.ceilingAmslFt).toBe(4000);
    expect(cta.properties.aglCeilingFt).toBeNull();
    for (const f of result.collection.features) expect(f.properties.notes).toContain("adopted ft AMSL");
  });

  it("dual ceiling: envelope max in the column, raw preserved in notes, issue reported", () => {
    const result = buildCtr(dump([{ fid: 1, props: { ...base, Name: "חיפה", Code: "LLHA", Max_Alt: "3000/3500", Comment: "סופש/רגיל" } }]));
    const f = result.collection.features[0];
    expect(f.properties.ceilingAmslFt).toBe(3500);
    expect(f.properties.notes).toContain("3000/3500");
    expect(f.properties.notes).toContain("סופש/רגיל");
    expect(result.issues.some((i) => i.kind === "altitude-multi-value")).toBe(true);
  });

  it("repeated codes disambiguate deterministically as separate zones", () => {
    const result = buildCtr(
      dump([
        { fid: 1, props: { ...base, Name: "רמת דוד-כנף 1", Code: "LLRD", Civ_Mil: "צבאי" } },
        { fid: 2, props: { ...base, Name: "רמת דוד-כנף 1", Code: "LLRD", Civ_Mil: "צבאי", Comment: "הרחבה סופש" } },
      ]),
    );
    const codes = result.collection.features.map((f) => f.properties.code).sort();
    expect(codes).toEqual(["CTR-LLRD", "CTR-LLRD-2"]);
    expect(result.stats.disambiguatedCodes).toBe(1);
  });

  it("unknown TYPE and missing geometry are excluded and reported", () => {
    const result = buildCtr(
      dump([
        { fid: 1, props: { ...base, TYPE: "TMA" } },
        { fid: 2, props: { ...base, Name: "בלי גאומטריה" }, geometry: null },
        { fid: 3, props: { ...base } },
      ]),
    );
    expect(result.stats.features).toBe(1);
    expect(result.issues.some((i) => i.kind === "parse-failure")).toBe(true);
    expect(result.issues.some((i) => i.kind === "no-geometry")).toBe(true);
  });

  it("unparseable ceiling → null band + issue; determinism on identical input", () => {
    const d = dump([{ fid: 1, props: { ...base, Max_Alt: "unknown" } }]);
    const a = buildCtr(d);
    expect(a.collection.features[0].properties.ceilingAmslFt).toBeNull();
    expect(a.issues.some((i) => i.kind === "altitude-unparseable")).toBe(true);
    expect(JSON.stringify(buildCtr(d))).toBe(JSON.stringify(a));
  });
});
