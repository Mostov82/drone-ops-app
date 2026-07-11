// DO-013 session 3 — INPA geometry pairing (appendix ה' entries ⊕ RATAG KMZ).
// Pairing is exact-code only; the appendix governs; nothing fuzzy or guessed.

import { describe, expect, it } from "vitest";
import { buildInpaGeo, INPA_ZONE_TYPE, type InpaResult, type RatagDump } from "../builders/inpa.js";

const POLY = { type: "Polygon", coordinates: [[[35.0, 32.0], [35.1, 32.0], [35.1, 32.1], [35.0, 32.0]]] };

function inpaResult(entries: Partial<InpaResult["entries"][number]>[]): InpaResult {
  return {
    entries: entries.map((e) => ({
      code: e.code ?? "LLP2000",
      nameHe: e.nameHe ?? null,
      typeHe: e.typeHe ?? null,
      maxAglFt: e.maxAglFt ?? null,
      page: e.page ?? 30,
    })),
    issues: [],
    stats: {
      rawRows: entries.length,
      unique: entries.length,
      duplicatesDropped: 0,
      parks: 0,
      reserves: 0,
      missingAgl: 0,
      missingName: 0,
    },
  };
}

function ratag(placemarks: { code?: string | null; place?: string | null; maxAlt?: string | null; geometry?: unknown | null }[]): RatagDump {
  return {
    sourceZip: "RATAG_kmz.zip",
    innerKmz: "RATAG_kmz_07092020/RATAG_kmz_07092020.kmz",
    placemarks: placemarks.map((p, i) => ({
      id: `ID_${i}`,
      fields: {
        Name: "שמורות טבע",
        Code: p.code === undefined ? "LLP2000" : p.code,
        Place: p.place ?? null,
        minAlt: "0",
        maxAlt: p.maxAlt === undefined ? null : p.maxAlt,
        Alt: "מעל פני השטח",
      },
      geometry: p.geometry === undefined ? POLY : p.geometry,
    })),
  };
}

describe("buildInpaGeo", () => {
  it("pairs by exact code and takes attributes from the governing appendix", () => {
    const result = buildInpaGeo(
      inpaResult([{ code: "LLP2001", nameHe: "שמורת בדיקה", typeHe: "שמורת טבע", maxAglFt: 300 }]),
      ratag([{ code: "LLP2001", place: "שמורת בדיקה", maxAlt: "300" }]),
    );
    expect(result.stats.paired).toBe(1);
    expect(result.issues).toHaveLength(0);
    const props = result.collection.features[0].properties;
    expect(props.code).toBe("LLP2001");
    expect(props.nameHe).toBe("שמורת בדיקה");
    expect(props.zoneTypeCode).toBe(INPA_ZONE_TYPE);
    expect(props.aglCeilingFt).toBe(300);
    // AGL never leaks into the AMSL columns (ratified 2026-07-11)
    expect(props.floorAmslFt).toBeNull();
    expect(props.ceilingAmslFt).toBeNull();
    expect(result.collection.features[0].geometry).toEqual(POLY);
  });

  it("excludes appendix entries with no KMZ geometry and reports them (never fuzzy-matches)", () => {
    const result = buildInpaGeo(
      inpaResult([
        { code: "LLP2333", nameHe: "חדשה 2025" },
        { code: "LLP2001", nameHe: "קיימת" },
      ]),
      ratag([{ code: "LLP2001", place: "קיימת" }]),
    );
    expect(result.stats.paired).toBe(1);
    expect(result.stats.appendixOnlyExcluded).toBe(1);
    const issue = result.issues.find((i) => i.code === "LLP2333");
    expect(issue?.kind).toBe("no-geometry");
    expect(result.collection.features.map((f) => f.properties.code)).toEqual(["LLP2001"]);
  });

  it("ignores KMZ-only placemarks — nothing governs them", () => {
    const result = buildInpaGeo(
      inpaResult([{ code: "LLP2001", nameHe: "קיימת" }]),
      ratag([
        { code: "LLP2001", place: "קיימת" },
        { code: "LLP9999", place: "לא ברשימה" },
      ]),
    );
    expect(result.stats.paired).toBe(1);
    expect(result.stats.kmzOnlyIgnored).toBe(1);
    expect(result.issues.find((i) => i.code === "LLP9999")?.kind).toBe("kmz-only");
  });

  it("keeps the appendix AGL ceiling on conflict and reports the mismatch", () => {
    const result = buildInpaGeo(
      inpaResult([{ code: "LLP2001", nameHe: "א", maxAglFt: 500 }]),
      ratag([{ code: "LLP2001", place: "א", maxAlt: "300" }]),
    );
    const props = result.collection.features[0].properties;
    expect(props.aglCeilingFt).toBe(500);
    expect(result.stats.altitudeMismatches).toBe(1);
    expect(result.issues.find((i) => i.kind === "altitude-mismatch")?.detail).toContain("appendix kept");
    expect(props.notes).toContain("kmz maxAlt=300");
  });

  it("does NOT adopt a KMZ ceiling when the appendix publishes none", () => {
    const result = buildInpaGeo(
      inpaResult([{ code: "LLP2001", nameHe: "א", maxAglFt: null }]),
      ratag([{ code: "LLP2001", place: "א", maxAlt: "1000" }]),
    );
    const props = result.collection.features[0].properties;
    expect(props.aglCeilingFt).toBeNull();
    expect(result.stats.kmzAltitudeWhereAppendixNull).toBe(1);
    expect(props.notes).toContain("not adopted");
  });

  it("flags a site-name mismatch but keeps the code-based pairing and appendix name", () => {
    const result = buildInpaGeo(
      inpaResult([{ code: "LLP2001", nameHe: "שם מהנספח" }]),
      ratag([{ code: "LLP2001", place: "שם אחר לגמרי" }]),
    );
    expect(result.stats.paired).toBe(1);
    expect(result.stats.nameMismatches).toBe(1);
    expect(result.collection.features[0].properties.nameHe).toBe("שם מהנספח");
    expect(result.issues.find((i) => i.kind === "name-mismatch")?.detail).toContain("code-paired");
  });

  it("tolerates punctuation/whitespace differences in the name cross-check", () => {
    const result = buildInpaGeo(
      inpaResult([{ code: "LLP2001", nameHe: 'מכתש גדול , מצלעות המכתש' }]),
      ratag([{ code: "LLP2001", place: 'מכתש גדול, מצלעות המכתש' }]),
    );
    expect(result.stats.nameMismatches).toBe(0);
  });

  it("drops duplicate KMZ codes (first kept) and flags them", () => {
    const result = buildInpaGeo(
      inpaResult([{ code: "LLP2001", nameHe: "א", maxAglFt: 300 }]),
      ratag([
        { code: "LLP2001", place: "א", maxAlt: "300" },
        { code: "LLP2001", place: "א כפולה", maxAlt: "999" },
      ]),
    );
    expect(result.stats.paired).toBe(1);
    expect(result.stats.kmzDuplicatesDropped).toBe(1);
    expect(result.collection.features[0].properties.aglCeilingFt).toBe(300);
  });

  it("is deterministic — identical inputs yield identical output", () => {
    const entries = inpaResult([
      { code: "LLP1001", nameHe: "נחל", maxAglFt: 500 },
      { code: "LLP2001", nameHe: "שמורה", maxAglFt: 300 },
    ]);
    const dump = ratag([
      { code: "LLP2001", place: "שמורה", maxAlt: "300" },
      { code: "LLP1001", place: "נחל", maxAlt: "500" },
    ]);
    const a = JSON.stringify(buildInpaGeo(entries, dump));
    const b = JSON.stringify(buildInpaGeo(entries, dump));
    expect(a).toBe(b);
  });
});
