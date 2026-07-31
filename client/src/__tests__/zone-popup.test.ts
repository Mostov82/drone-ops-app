// DO-014 — popup content: band text per the zones-api.md semantics, lane
// directional altitudes, provenance/staleness/unverified, HTML escaping.
// Uses the real English locale strings as the translator so the asserted
// texts are what the operator actually sees.
import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en";
import type { TranslateFn } from "../lib/zone-popup-helpers";
import { buildZonePopupHtml, escapeHtml, verdictLabel } from "../lib/zone-popup";
import type { ZoneFeatureProperties, ZoneLayerSummary } from "../lib/zones-api";

const t: TranslateFn = (key, options) => {
  let text: string = (en as Record<string, string>)[key] ?? key;
  for (const [name, value] of Object.entries(options ?? {})) {
    text = text.replaceAll(`{{${name}}}`, String(value));
  }
  return text;
};

const ctx = { t, language: "en", dir: "ltr" };

function props(partial: Partial<ZoneFeatureProperties>): ZoneFeatureProperties {
  return {
    id: "zone-1",
    name: "TST01 — אזור בדיקה",
    zoneTypeCode: "AIP_RESTRICTED",
    zoneTypeName: "AIP restricted area (LLR)",
    verdict: "RESTRICTED",
    floorAmslFt: null,
    ceilingAmslFt: null,
    notes: null,
    ...partial,
  };
}

function layer(partial: Partial<ZoneLayerSummary> = {}): ZoneLayerSummary {
  return {
    id: "layer-1",
    name: "test-layer",
    importedAt: "2026-07-11T10:00:00.000Z",
    verified: false,
    zoneCount: 1,
    provenance: { title: "Test dataset", extractedAt: "2026-07-10" },
    ...partial,
  };
}

describe("buildZonePopupHtml", () => {
  it("shows name, verdict, band, and the owning layer's provenance + unverified badge", () => {
    const html = buildZonePopupHtml(
      props({ floorAmslFt: 0, ceilingAmslFt: null, notes: "ceiling UNL per א'-17" }),
      layer(),
      ctx,
    );
    expect(html).toContain("TST01 — אזור בדיקה");
    expect(html).toContain("Restricted (no-fly)");
    // GND floor + null ceiling on a P/R/D zone = unbounded (UNL).
    expect(html).toContain("GND (surface) – Unbounded (UNL)");
    expect(html).toContain("Test dataset");
    expect(html).toContain("Imported");
    expect(html).toContain("Unverified");
  });

  it("drops the unverified badge once the layer is verified", () => {
    const html = buildZonePopupHtml(props({}), layer({ verified: true }), ctx);
    expect(html).not.toContain("Unverified");
  });

  it("renders LLD42's below-sea-level ceiling as published", () => {
    const html = buildZonePopupHtml(
      props({ zoneTypeCode: "AIP_DANGER", floorAmslFt: 0, ceilingAmslFt: -530 }),
      layer(),
      ctx,
    );
    expect(html).toContain("GND (surface) – -530 ft AMSL");
    expect(html).not.toContain("Unbounded");
  });

  it("shows a lane's raw directional altitudes and the envelope note", () => {
    const html = buildZonePopupHtml(
      props({
        zoneTypeCode: "CVFR_LANE",
        floorAmslFt: 1500,
        ceilingAmslFt: 2000,
        notes:
          "CVFR lane; directional altitudes ft AMSL as published: N 1500 / S 2000 | band = option-A min/max envelope",
      }),
      layer(),
      ctx,
    );
    expect(html).toContain("1500 ft AMSL – 2000 ft AMSL");
    expect(html).toContain("Directional altitudes (as published)");
    expect(html).toContain("N 1500 / S 2000");
    expect(html).toContain("min/max envelope");
  });

  it("INPA: null AMSL renders as not published (never unbounded) and AGL ceilings stay AGL", () => {
    const html = buildZonePopupHtml(
      props({
        zoneTypeCode: "NATURE_RESERVE",
        floorAmslFt: null,
        ceilingAmslFt: null,
        notes: "אתרי קינון עיטים | geometry: INPA RATAG KMZ | aglCeilingFt=500",
      }),
      layer(),
      ctx,
    );
    expect(html).toContain("Not published – 500 ft AGL (as published)");
    expect(html).not.toContain("Unbounded");
    expect(html).not.toContain("AMSL");
  });

  it("marks the popup with the active direction and language (HE-RTL support)", () => {
    const html = buildZonePopupHtml(props({}), layer(), { t, language: "he", dir: "rtl" });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
  });

  it("escapes untrusted data in names and provenance", () => {
    const html = buildZonePopupHtml(
      props({ name: '<img src=x onerror="x">' }),
      layer({ provenance: { title: "<script>alert(1)</script>" } }),
      ctx,
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("verdictLabel", () => {
  it("translates the known tiers", () => {
    expect(verdictLabel("NEEDS_PERMIT", t)).toBe("Needs permit");
  });

  it("shows an unknown verdict value raw — honestly, never guessed into a tier", () => {
    expect(verdictLabel("SOME_FUTURE_TIER", t)).toBe("SOME_FUTURE_TIER");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-special characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });
});

// DO-041 — schedule chip in the popup. Real imported strings (see
// schedule.test.ts for provenance); the chip is display-only and must never
// disturb the verdict or band lines around it.
describe("buildZonePopupHtml — schedule chip", () => {
  const RAMAT_DAVID_NOTES =
    "CTR | צבאי | schedule: הרחבה סופש | source stamp 2023-02-19 | altitude unit unstated in source";

  it("renders the chip and the published text verbatim for notes-derived schedules", () => {
    const html = buildZonePopupHtml(
      props({ name: "רמת דוד-כנף 1", notes: RAMAT_DAVID_NOTES }),
      layer(),
      ctx,
    );
    expect(html).toContain("Schedule");
    expect(html).toContain("סופש");
    expect(html).toContain("הרחבה סופש");
  });

  it("does not repeat the zone name when the schedule came from the name", () => {
    const html = buildZonePopupHtml(props({ name: "הבונים סופש", notes: null }), layer(), ctx);
    expect(html).toContain("Schedule");
    // The name renders once, as the heading — not a second time as verbatim text.
    expect(html.match(/הבונים סופש/g)).toHaveLength(1);
  });

  it("omits the schedule row entirely for zones with no schedule clue", () => {
    const html = buildZonePopupHtml(props({ name: "גלילות", notes: null }), layer(), ctx);
    expect(html).not.toContain("Schedule");
  });

  it("leaves the verdict and band lines untouched when a chip is present", () => {
    const scheduled = buildZonePopupHtml(
      props({ name: "רמת דוד-כנף 1", notes: RAMAT_DAVID_NOTES, floorAmslFt: 0 }),
      layer(),
      ctx,
    );
    expect(scheduled).toContain("Restricted (no-fly)");
    expect(scheduled).toContain("GND (surface)");
  });

  it("escapes schedule text like every other untrusted field", () => {
    const html = buildZonePopupHtml(
      props({ name: "x", notes: "CTR | schedule: <img src=x> סופש | end" }),
      layer(),
      ctx,
    );
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img");
  });
});
