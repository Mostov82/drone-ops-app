// DO-041 — schedule surfacing (display-only).
//
// Every fixture below is a VERBATIM string from the shipped importer output
// (`data-sources/zones/**/zones.geojson`), copied exactly — spellings, spacing
// and gershayim included. Detection is a text heuristic over producer prose, so
// a fixture that has been tidied up proves nothing; the last block re-runs
// detection over the whole real corpus so a false positive cannot slip in
// unnoticed.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { detectSchedule, getZoneStyle } from "@/lib/zone-display";
import en from "@/i18n/locales/en";
import he from "@/i18n/locales/he";

// caai-ctr-atz-cta/zones.geojson — the three הבונים ATZ variants.
const HABONIM_BASE = "הבונים";
const HABONIM_WEEKEND = "הבונים סופש";
const HABONIM_WEEKDAY = "הבונים אמצע שבוע";
const ATZ_NOTES =
  "ATZ | אזרחי | source stamp 2023-02-13 | altitude unit unstated in source — adopted ft AMSL per producer's sibling files (verify in visual check)";

// caai-ctr-atz-cta/zones.geojson — `schedule:` segments (ctr.ts builder).
const HATZOR_NOTES =
  "CTA | צבאי | schedule: סופש | source stamp 2023-02-19 | altitude unit unstated in source — adopted ft AMSL per producer's sibling files (verify in visual check)";
const HAIFA_NOTES =
  "CTR | אזרחי | ceiling raw 3000/3500 (envelope max adopted) | schedule: סופש/רגיל | source stamp 2022-01-11 | altitude unit unstated in source — adopted ft AMSL per producer's sibling files (verify in visual check)";
const RAMAT_DAVID_NOTES =
  "CTR | צבאי | schedule: הרחבה סופש | source stamp 2023-02-19 | altitude unit unstated in source — adopted ft AMSL per producer's sibling files (verify in visual check)";

// aip-a17-llp-llr-danger/zones.geojson — LLR20, a `gdb comment:` segment that
// sits between an א'-17 note and the DO-036 contacts block. Note the real
// spelling is סופ"ש WITH gershayim, unlike the ATZ variants' סופש.
const LLR20_NAME = 'גליל הצנחה הבונים ""';
const LLR20_NOTES =
  'א\'-17 definition note: מהנקודה הקודמת עוקב הגבול אחר קשת ברדיוס של 3 ק " מ שמרכזה בנקודה הבאה : · הקשת מסתיימת בנקודה הבאה : | gdb editor stamp: AMI 2022-11-30T00:00:00.000 | gdb comment: גובה רגיל/ סופ"ש | תיאום: לצורך תיאום טיסה בסגירה זו יש לפנות לפי הסדר עינב ליברמן סמנכ"ל תפעול 054-2518700 einavlib@gmail.com אור אלרון מפעיל מנחת 052-5365141 orelron12@gmail.com דן מוקדי מנכ"ל 054-2519100 danm@parardive.co.il.';

// cvfr-lanes/zones.geojson — סופרלנד (Superland) shares the prefix סופ with
// סופש but is a place name. The guard that matters most.
const SUPERLAND_NAME = "נטעים-סופרלנד";
const SUPERLAND_NOTES =
  "CVFR lane; directional altitudes ft AMSL as published: W 1200 / E 800 | band = option-A min/max envelope of published directional altitudes (decision 2026-07-11) | class=CIVIL | byRequest=OPEN";

describe("detectSchedule — הבונים ATZ variants (acceptance criterion)", () => {
  it("reads the weekend variant off its published name", () => {
    const result = detectSchedule(HABONIM_WEEKEND, ATZ_NOTES);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("weekend");
    expect(result?.source).toBe("name");
    // The chip carries the published token, not a normalised coinage.
    expect(result?.text).toBe("סופש");
  });

  it("reads the weekday variant off its published name", () => {
    const result = detectSchedule(HABONIM_WEEKDAY, ATZ_NOTES);
    expect(result?.type).toBe("weekday");
    expect(result?.source).toBe("name");
    expect(result?.text).toBe("אמצע שבוע");
  });

  it("leaves the unmarked base variant alone rather than guessing", () => {
    // The third variant carries no schedule token at all. Scope boundary:
    // unmatched zones show no chip and are never inferred into one.
    expect(detectSchedule(HABONIM_BASE, ATZ_NOTES)).toBeNull();
  });

  it("omits verbatim text for name-derived schedules", () => {
    // The name is already rendered on its own line by both the popup and the
    // panel; repeating it as "verbatim" text would print it twice.
    expect(detectSchedule(HABONIM_WEEKEND, ATZ_NOTES)?.verbatimText).toBeNull();
  });
});

describe("detectSchedule — `schedule:` notes segments", () => {
  it("reads a bare weekend schedule", () => {
    const result = detectSchedule("חצור מערבי (CTA)", HATZOR_NOTES);
    expect(result?.type).toBe("weekend");
    expect(result?.source).toBe("notes");
    expect(result?.text).toBe("סופש");
    expect(result?.verbatimText).toBe("סופש");
  });

  it("keeps the full published string verbatim while the chip stays short", () => {
    const result = detectSchedule("חיפה", HAIFA_NOTES);
    expect(result?.type).toBe("weekend");
    expect(result?.text).toBe("סופש");
    expect(result?.verbatimText).toBe("סופש/רגיל");
  });

  it("reads Ramat David's weekend expansion (acceptance criterion)", () => {
    const result = detectSchedule("רמת דוד-כנף 1", RAMAT_DAVID_NOTES);
    expect(result?.type).toBe("weekend");
    expect(result?.text).toBe("סופש");
    expect(result?.verbatimText).toBe("הרחבה סופש");
  });

  it("does not bleed past the segment separator into neighbouring notes", () => {
    expect(detectSchedule("חיפה", HAIFA_NOTES)?.verbatimText).not.toContain("source stamp");
  });

  it("surfaces an explicit schedule segment even with no weekend/weekday token", () => {
    const result = detectSchedule("Some zone", "CTR | schedule: H24 | source stamp 2023-01-01");
    expect(result?.type).toBe("other");
    expect(result?.text).toBe("H24");
  });
});

describe("detectSchedule — `gdb comment:` notes segments", () => {
  it("reads LLR20's סופ\"ש spelling, gershayim and all", () => {
    const result = detectSchedule(LLR20_NAME, LLR20_NOTES);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("weekend");
    expect(result?.source).toBe("notes");
    expect(result?.text).toBe('סופ"ש');
    expect(result?.verbatimText).toBe('גובה רגיל/ סופ"ש');
  });

  it("does not leak the DO-036 contacts block into the schedule text", () => {
    // תיאום: (coordination contacts, phone numbers, emails) follows the comment
    // in the same notes string and must stay out of the chip.
    const result = detectSchedule(LLR20_NAME, LLR20_NOTES);
    expect(result?.verbatimText).not.toContain("054-2518700");
    expect(result?.verbatimText).not.toContain("תיאום");
  });

  it("ignores free prose comments that carry no schedule token", () => {
    expect(
      detectSchedule("Some zone", "gdb comment: גבול משותף עם שדה תעופה | gdb editor stamp: AMI"),
    ).toBeNull();
  });
});

describe("detectSchedule — false positives", () => {
  it("does not read סופרלנד (Superland) as סופש", () => {
    expect(detectSchedule(SUPERLAND_NAME, SUPERLAND_NOTES)).toBeNull();
  });

  it("does not read the א'-17 document reference as the א'-ה' weekday range", () => {
    expect(detectSchedule("Some zone", "א'-17 definition note: מהנקודה הקודמת")).toBeNull();
  });

  it("returns null for an ordinary zone with neither clue", () => {
    expect(detectSchedule("LLU21 — גלילות", "circle: center 32, radius 500")).toBeNull();
  });
});

describe("detectSchedule — the real corpus", () => {
  // Guards the rules against the whole shipped dataset, not a chosen sample:
  // any new match or lost match fails here rather than surfacing on the map.
  const ROOT = path.resolve(__dirname, "../../../data-sources/zones");

  function detectAll(): { code: string; type: string; text: string }[] {
    const hits: { code: string; type: string; text: string }[] = [];
    for (const dir of fs.readdirSync(ROOT)) {
      const file = path.join(ROOT, dir, "zones.geojson");
      if (!fs.existsSync(file)) continue;
      for (const feature of JSON.parse(fs.readFileSync(file, "utf8")).features) {
        const props = feature.properties ?? {};
        const result = detectSchedule(props.nameHe || props.nameEn || "", props.notes ?? null);
        if (result) hits.push({ code: props.code, type: result.type, text: result.text });
      }
    }
    return hits.sort((a, b) => a.code.localeCompare(b.code));
  }

  it("matches exactly the six known scheduled zones and nothing else", () => {
    expect(detectAll()).toEqual([
      { code: "ATZ-LLBO-2", type: "weekend", text: "סופש" },
      { code: "ATZ-LLBO-3", type: "weekday", text: "אמצע שבוע" },
      { code: "CTA-LLHS", type: "weekend", text: "סופש" },
      { code: "CTR-LLHA", type: "weekend", text: "סופש" },
      { code: "CTR-LLRD-2", type: "weekend", text: "סופש" },
      { code: "LLR20", type: "weekend", text: 'סופ"ש' },
    ]);
  });
});

describe("weekend view does not change any verdict (acceptance criterion)", () => {
  // The weekend view is a viewing aid. It may re-weight strokes and fills, but
  // the verdict-bearing channels — hue and dash pattern, which is what a reader
  // decodes a zone by — must be byte-identical to the normal view.
  const VERDICTS = ["RESTRICTED", "CONDITIONAL", "ALLOWED", "SOMETHING_UNKNOWN"];
  const ZONE_TYPES = [
    "AIP_PROHIBITED",
    "AIP_RESTRICTED",
    "AIP_DANGER",
    "AIRPORT",
    "BORDER_SECURITY",
    "POPULATED",
    "LLU_DRONE",
    "CTR",
    "ATZ",
    "CTA",
    "CVFR_LANE",
    "OTHER",
  ];

  it("keeps colour, fill colour and dash pattern identical in both views", () => {
    for (const verdict of VERDICTS) {
      for (const zoneType of ZONE_TYPES) {
        const base = getZoneStyle(verdict, zoneType);
        const emphasized = getZoneStyle(verdict, zoneType, { isEmphasized: true });
        const deemphasized = getZoneStyle(verdict, zoneType, { isDeemphasized: true });
        for (const variant of [emphasized, deemphasized]) {
          expect(variant.color).toBe(base.color);
          expect(variant.fillColor).toBe(base.fillColor);
          expect(variant.dashArray).toBe(base.dashArray);
        }
      }
    }
  });

  it("never hides a zone — de-emphasis fades but keeps it drawn", () => {
    // Honesty stance: the weekend view de-emphasises, it never hides. Several
    // zone types are stroke-only by design, so the invariant is that fading
    // preserves whatever the base view drew — it cannot switch a fill off or
    // fade anything to fully transparent.
    for (const zoneType of ZONE_TYPES) {
      const base = getZoneStyle("RESTRICTED", zoneType);
      const faded = getZoneStyle("RESTRICTED", zoneType, { isDeemphasized: true });
      expect(faded.opacity).toBeGreaterThan(0);
      expect(faded.fill).toBe(base.fill);
      if (base.fillOpacity > 0) expect(faded.fillOpacity).toBeGreaterThan(0);
    }
  });

  it("omits `opacity` entirely unless de-emphasis set it", () => {
    // Regression guard. Leaflet copies every key of a style object over its
    // defaults, so an explicit `opacity: undefined` clobbers the default 1.0.
    // Its canvas renderer then runs `ctx.globalAlpha = options.opacity` right
    // after setting globalAlpha to fillOpacity for the fill; canvas ignores a
    // NaN alpha, so the stroke silently inherits the fill's opacity (~0.07 for
    // ATZ) and every zone outline on the map washes out.
    for (const zoneType of ZONE_TYPES) {
      for (const extra of [undefined, { isEmphasized: true }, { isInner: true }]) {
        const style = getZoneStyle("RESTRICTED", zoneType, extra);
        expect(Object.prototype.hasOwnProperty.call(style, "opacity")).toBe(false);
      }
      // De-emphasis is the one case that legitimately sets it.
      expect(getZoneStyle("RESTRICTED", zoneType, { isDeemphasized: true }).opacity).toBe(0.3);
    }
  });

  it("keeps every stroke at full opacity outside the weekend view", () => {
    // The palette depends on strokes drawing at Leaflet's default opacity 1.0.
    // `dashArray: undefined` is fine — Leaflet only reads it behind a falsy
    // check — but `opacity` is read unconditionally, so it is the one key that
    // must be absent rather than undefined.
    for (const zoneType of ZONE_TYPES) {
      const style = getZoneStyle("RESTRICTED", zoneType) as unknown as Record<string, unknown>;
      expect("opacity" in style).toBe(false);
      expect(style.fillOpacity).not.toBeUndefined();
      expect(style.weight).not.toBeUndefined();
      expect(style.color).not.toBeUndefined();
    }
  });

  it("emphasises weekend zones without saturating them into a different read", () => {
    const base = getZoneStyle("RESTRICTED", "CTR");
    const emphasized = getZoneStyle("RESTRICTED", "CTR", { isEmphasized: true });
    expect(emphasized.weight).toBeGreaterThan(base.weight);
    expect(emphasized.fillOpacity).toBeGreaterThan(base.fillOpacity);
    expect(emphasized.fillOpacity).toBeLessThanOrEqual(0.6);
  });
});

describe("weekend view caption + copy (acceptance criterion)", () => {
  // The caption is what keeps the view honest: it states that verdicts stay
  // conservative and that NOTAMs override schedules. MapPage renders it
  // unconditionally whenever the view is on, so what is checkable here is that
  // the copy exists, says both of those things, and is present in both locales.
  const KEYS = [
    "map.settings.weekendView.label",
    "map.settings.weekendView.hint",
    "map.settings.weekendView.caption.title",
    "map.settings.weekendView.caption.body",
    "map.zones.popup.schedule",
  ];

  it("defines every weekend-view key in both locales", () => {
    for (const key of KEYS) {
      expect(en, `EN missing ${key}`).toHaveProperty(key);
      expect(he, `HE missing ${key}`).toHaveProperty(key);
    }
  });

  it("states both the conservative-verdict and NOTAM-override facts", () => {
    const body = (en as Record<string, string>)["map.settings.weekendView.caption.body"];
    expect(body).toMatch(/conservative/i);
    expect(body).toMatch(/NOTAM/);
    expect(body).toMatch(/override/i);
  });

  it("marks the untranslated Hebrew coinage with [HE?] per convention", () => {
    for (const key of KEYS) {
      expect((he as Record<string, string>)[key], `HE ${key}`).toContain("[HE?]");
    }
  });
});
