// DO-045 — client presentation of the AIP ב'-08 weekend fly-bubbles.
//
// Fixtures are the REAL notes strings the importer writes, taken from the
// committed dataset rather than hand-typed — the DO-041 lesson about fixtures
// that assert against invented input applies directly here, since every surface
// in this file keys off a notes segment.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectSchedule,
  getZoneStyle,
  isAllWeekBubble,
  isBubbleScheduleInferred,
  isHandTracedGeometry,
  isLayerVisible,
  WEEKEND_BUBBLE_ZONE_TYPE,
} from "@/lib/zone-display";
import { orderLayersForDraw, ZONE_LAYER_DRAW_ORDER } from "@/lib/zone-layer-order";
import en from "@/i18n/locales/en";
import he from "@/i18n/locales/he";

const DATASET = path.resolve(
  __dirname,
  "../../../data-sources/zones/caai-weekend-bubbles/zones.geojson",
);

interface Zone { properties: { code: string; nameHe: string; zoneTypeCode: string; notes: string; ceilingAmslFt: number | null; floorAmslFt: number | null } }
const zones: Zone[] = JSON.parse(fs.readFileSync(DATASET, "utf8")).features;
const weekendOnly = zones.filter((z) => isAllWeekBubble(z.properties.notes) === false);
const allWeek = zones.filter((z) => isAllWeekBubble(z.properties.notes) === true);

describe("reading the importer's structured notes segments", () => {
  it("classifies every shipped bubble as weekend-only or all-week", () => {
    expect(zones.length).toBeGreaterThan(0);
    expect(weekendOnly.length + allWeek.length).toBe(zones.length);
    expect(allWeek.length).toBeGreaterThan(0);
    expect(weekendOnly.length).toBeGreaterThan(0);
  });

  it("returns null rather than a guess for a zone that carries no such segment", () => {
    expect(isAllWeekBubble(null)).toBeNull();
    expect(isAllWeekBubble("CTR | אזרחי | source stamp 2022-01-11")).toBeNull();
  });

  it("detects an inferred schedule, and does not cry inference on a published one", () => {
    // The published ones are exactly the bubbles Jonathan named plus any the
    // trace flagged; the rest were defaulted. Both must be distinguishable.
    const inferred = zones.filter((z) => isBubbleScheduleInferred(z.properties.notes));
    expect(inferred.length).toBeGreaterThan(0);
    expect(inferred.length).toBeLessThan(zones.length);
    expect(isBubbleScheduleInferred("weekendOnly: false")).toBe(false);
    expect(isBubbleScheduleInferred(null)).toBe(false);
  });

  it("flags every bubble's geometry as hand-traced", () => {
    for (const z of zones) {
      expect(isHandTracedGeometry(z.properties.notes), z.properties.code).toBe(true);
    }
    expect(isHandTracedGeometry("CTR | אזרחי")).toBe(false);
  });
});

describe("DO-041 reuse — the schedule chip, with no new detection code", () => {
  it("types weekend-only bubbles as weekend so the weekend view emphasises them", () => {
    for (const z of weekendOnly) {
      const s = detectSchedule(z.properties.nameHe, z.properties.notes);
      expect(s?.type, z.properties.code).toBe("weekend");
      expect(s?.text, z.properties.code).toBe('סופ"ש');
    }
  });

  it("shows all-week bubbles verbatim and never de-emphasises them", () => {
    // "other" matters: only `weekday` de-emphasises in the weekend view, so an
    // all-week bubble stays fully drawn — "shown as always-on", per the AC.
    for (const z of allWeek) {
      const s = detectSchedule(z.properties.nameHe, z.properties.notes);
      expect(s?.type, z.properties.code).toBe("other");
      expect(s?.text, z.properties.code).toBe("כל השבוע");
      expect(s?.type).not.toBe("weekday");
    }
  });
});

describe("the WEEKEND_BUBBLE style treatment (DO-040 Amendment 1 grammar)", () => {
  const weekend = getZoneStyle("CLEAR", WEEKEND_BUBBLE_ZONE_TYPE, { isAllWeek: false });
  const week = getZoneStyle("CLEAR", WEEKEND_BUBBLE_ZONE_TYPE, { isAllWeek: true });

  it("uses a hue no other class uses", () => {
    const others = [
      "AIP_PROHIBITED", "AIP_RESTRICTED", "AIP_DANGER", "LLU_DRONE", "AIRPORT",
      "CTR", "ATZ", "CTA", "NATURE_RESERVE", "CVFR_LANE",
    ];
    for (const code of others) {
      for (const verdict of ["RESTRICTED", "NEEDS_PERMIT", "CLEAR"]) {
        expect(getZoneStyle(verdict, code).color, `${code}/${verdict}`).not.toBe(weekend.color);
      }
    }
  });

  it("is not green — Amendment 1 forbids it, and it must not read as 'cleared'", () => {
    // Hand-traced ±500 m geometry must not be coloured like a guarantee.
    const [, r, g, b] = /^#(\w{2})(\w{2})(\w{2})$/.exec(weekend.color)!;
    const [red, green, blue] = [r, g, b].map((h) => parseInt(h, 16));
    expect(green > red && green > blue && green > 120).toBe(false);
  });

  it("distinguishes weekend-only from all-week WITHOUT relying on hue", () => {
    expect(weekend.color).toBe(week.color); // same hue by design
    expect(weekend.dashArray).toBeDefined(); // dashed = scheduled/conditional
    expect(week.dashArray).toBeUndefined(); // solid = in force all week
    expect(weekend.dashArray).not.toBe(week.dashArray);
  });

  it("keeps fills light so a restriction underneath still reads (Amendment 1: ≤ ~22%)", () => {
    for (const s of [weekend, week]) {
      expect(s.fillOpacity).toBeGreaterThan(0);
      expect(s.fillOpacity).toBeLessThanOrEqual(0.22);
    }
  });

  it("stays data-driven: a verdict edit restyles it, no code change (NFR-5)", () => {
    // The layer seeds CLEAR, but the mapping is editable data like every other.
    const asRestricted = getZoneStyle("RESTRICTED", WEEKEND_BUBBLE_ZONE_TYPE);
    expect(asRestricted.color).not.toBe(weekend.color);
  });

  it("survives the weekend view without changing hue or the schedule distinction", () => {
    const emphasised = getZoneStyle("CLEAR", WEEKEND_BUBBLE_ZONE_TYPE, { isAllWeek: false, isEmphasized: true });
    expect(emphasised.color).toBe(weekend.color);
    expect(emphasised.dashArray).toBe(weekend.dashArray);
    expect(emphasised.weight).toBeGreaterThan(weekend.weight);
  });

  it("de-emphasis fades but never hides (honesty stance)", () => {
    const faded = getZoneStyle("CLEAR", WEEKEND_BUBBLE_ZONE_TYPE, { isDeemphasized: true });
    expect(faded.fillOpacity).toBeGreaterThan(0);
    expect(faded.fill).not.toBe(false);
  });
});

describe("the draw-order slot (DO-043 policy extended)", () => {
  it("puts the bubbles at the very bottom of the stack", () => {
    // A permissive layer must never paint over a restriction. Bottom placement
    // makes that structurally impossible rather than merely unlikely.
    expect(ZONE_LAYER_DRAW_ORDER[0]).toBe("caai-weekend-bubbles");
    const order = orderLayersForDraw([...ZONE_LAYER_DRAW_ORDER].reverse());
    expect(order[0]).toBe("caai-weekend-bubbles");
    for (const other of ZONE_LAYER_DRAW_ORDER.slice(1)) {
      expect(order.indexOf(other)).toBeGreaterThan(order.indexOf("caai-weekend-bubbles"));
    }
  });

  it("keeps DO-043's toggle-order invariance with the new layer present", () => {
    const names = [...ZONE_LAYER_DRAW_ORDER];
    const expected = orderLayersForDraw(names);
    for (let i = 0; i < names.length; i++) {
      const rotated = [...names.slice(i), ...names.slice(0, i)];
      expect(orderLayersForDraw(rotated)).toEqual(expected);
    }
  });
});

describe("default visibility (Jonathan's call, 2026-07-29)", () => {
  it("starts hidden until the operator turns it on", () => {
    expect(isLayerVisible({}, "caai-weekend-bubbles")).toBe(false);
  });

  it("still honours an explicit stored choice in both directions", () => {
    expect(isLayerVisible({ "caai-weekend-bubbles": true }, "caai-weekend-bubbles")).toBe(true);
    expect(isLayerVisible({ "caai-weekend-bubbles": false }, "caai-weekend-bubbles")).toBe(false);
  });

  it("does NOT weaken the default-ON rule for anything that can restrict", () => {
    // The rule it overrides is a safety rule: a newly imported dataset must
    // never silently hide a restriction. Only permissive layers may opt out, so
    // every other shipped layer — and any future one — must still default ON.
    for (const layer of ZONE_LAYER_DRAW_ORDER) {
      if (layer === "caai-weekend-bubbles") continue;
      expect(isLayerVisible({}, layer), layer).toBe(true);
    }
    expect(isLayerVisible({}, "some-future-restriction-layer")).toBe(true);
  });
});

describe("bilingual copy", () => {
  const KEYS = [
    "map.zones.class.WEEKEND_BUBBLE",
    "map.zones.popup.tracedTitle",
    "map.zones.popup.tracedBody",
    "map.zones.popup.scheduleInferred",
    "map.check.memberships.title",
    "map.check.memberships.hint",
  ];

  it("defines every new key in both locales", () => {
    for (const k of KEYS) {
      expect(en, `EN ${k}`).toHaveProperty(k);
      expect(he, `HE ${k}`).toHaveProperty(k);
    }
  });

  it("marks the new Hebrew coinage with [HE?] — these terms are not yet reviewed", () => {
    // The convention's live half: a NEW term is marked until Jonathan reviews it.
    // (The retired half — requiring the marker forever — was removed in #22.)
    for (const k of KEYS) {
      expect((he as Record<string, string>)[k], `HE ${k}`).toContain("[HE?]");
    }
  });

  it("states the two facts the traced-provenance note exists to state", () => {
    const body = (en as Record<string, string>)["map.zones.popup.tracedBody"];
    expect(body).toMatch(/500\s*m/);
    expect(body).toMatch(/approximate/i);
  });

  it("says plainly that a membership did not restrict the location", () => {
    const hint = (en as Record<string, string>)["map.check.memberships.hint"];
    expect(hint).toMatch(/did not restrict/i);
  });
});
