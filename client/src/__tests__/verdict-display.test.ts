// DO-015 (session 2) — pure display logic for the location-check verdict card.
// No regulatory value is asserted here: these tests cover presentation tokens
// and the data-quality caveat predicate only. The verdict values themselves
// arrive from the engine (server/docs/verdict-api.md).
import { describe, expect, it } from "vitest";
import {
  hasDataQualityCaveats,
  isKnownVerdict,
  reasonKindKey,
  verdictTone,
  verticalStatusKey,
} from "../lib/verdict-display";
import { VerdictRequestError } from "../lib/verdict-api";

describe("verdictTone — data-driven card styling", () => {
  it("gives each known verdict tier a distinct tone", () => {
    const tones = ["RESTRICTED", "NEEDS_PERMIT", "CLEAR"].map((v) => verdictTone(v).container);
    expect(new Set(tones).size).toBe(3);
    expect(isKnownVerdict("RESTRICTED")).toBe(true);
    expect(isKnownVerdict("CLEAR")).toBe(true);
  });

  it("falls back to a neutral tone for an unknown verdict value (editable data must never disappear)", () => {
    const tone = verdictTone("SOME_FUTURE_TIER");
    expect(tone.container).toBeTruthy();
    expect(tone.heading).toBeTruthy();
    expect(isKnownVerdict("SOME_FUTURE_TIER")).toBe(false);
  });
});

describe("i18n key helpers", () => {
  it("maps a vertical status to a stable key suffix", () => {
    expect(verticalStatusKey("BELOW_FLOOR")).toBe("map.check.vertical.status.BELOW_FLOOR");
    expect(verticalStatusKey("NO_CLAIM")).toBe("map.check.vertical.status.NO_CLAIM");
  });

  it("maps a reason kind to a stable key suffix", () => {
    expect(reasonKindKey("POINT_IN_ZONE")).toBe("map.check.reasonKind.POINT_IN_ZONE");
    expect(reasonKindKey("WITHIN_AIRPORT_BUFFER_RULE")).toBe(
      "map.check.reasonKind.WITHIN_AIRPORT_BUFFER_RULE",
    );
  });
});

describe("hasDataQualityCaveats — the verdict is never authoritative", () => {
  it("is true when any layer is unverified", () => {
    expect(
      hasDataQualityCaveats({
        unverifiedLayers: ["aip-zones"],
        unverifiedRuleKeys: [],
        elevationApproximate: false,
      }),
    ).toBe(true);
  });

  it("is true when any rule is unverified", () => {
    expect(
      hasDataQualityCaveats({
        unverifiedLayers: [],
        unverifiedRuleKeys: ["airport_buffer_km"],
        elevationApproximate: false,
      }),
    ).toBe(true);
  });

  it("is true when elevation is approximate", () => {
    expect(
      hasDataQualityCaveats({
        unverifiedLayers: [],
        unverifiedRuleKeys: [],
        elevationApproximate: true,
      }),
    ).toBe(true);
  });

  it("is false only when nothing is caveated", () => {
    expect(
      hasDataQualityCaveats({
        unverifiedLayers: [],
        unverifiedRuleKeys: [],
        elevationApproximate: false,
      }),
    ).toBe(false);
  });
});

describe("VerdictRequestError — fail-closed surface", () => {
  it("carries the server's bilingual message and code", () => {
    const err = new VerdictRequestError({
      code: "VERDICT_NO_ZONE_DATA",
      message: { en: "No zone data.", he: "אין נתוני אזורים." },
    });
    expect(err.code).toBe("VERDICT_NO_ZONE_DATA");
    expect(err.bilingual).toEqual({ en: "No zone data.", he: "אין נתוני אזורים." });
    expect(err.message).toBe("No zone data.");
  });

  it("degrades gracefully when the server sent no structured body", () => {
    const err = new VerdictRequestError(null);
    expect(err.code).toBeNull();
    expect(err.bilingual).toBeNull();
  });
});
