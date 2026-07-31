// DO-015 — vertical separation: the ratified altitude semantics + the
// conservative rounding rule (DECISION 2026-07-11 GND/UNL ratification;
// Option A lane envelope; ±4 m elevation uncertainty widens, never narrows).
import { describe, expect, it } from "vitest";
import { ELEVATION_UNCERTAINTY_M, evaluateBand, plannedAmslEnvelope } from "../vertical.js";

describe("plannedAmslEnvelope — conservative rounding rule", () => {
  it("widens by the elevation uncertainty in both directions and rounds outward", () => {
    // elev 100 m ±4, planned 50 m AGL:
    //   min = floor((100-4+50)/0.3048) = floor(479.0026) = 479
    //   max = ceil ((100+4+50)/0.3048) = ceil (505.2493) = 506
    const env = plannedAmslEnvelope(100, 50);
    expect(env.minFt).toBe(479);
    expect(env.maxFt).toBe(506);
    expect(env.uncertaintyM).toBe(ELEVATION_UNCERTAINTY_M);
    // The unwidened point value (~492 ft) sits strictly inside the interval.
    expect(env.minFt).toBeLessThan(150 / 0.3048);
    expect(env.maxFt).toBeGreaterThan(150 / 0.3048);
  });

  it("supports below-sea-level terrain (negative AMSL envelopes)", () => {
    const env = plannedAmslEnvelope(-430, 50); // Dead Sea shore
    expect(env.minFt).toBe(-1260);
    expect(env.maxFt).toBe(-1233);
  });
});

describe("evaluateBand — ratified semantics", () => {
  it("floor <= 0 on a P/R/D zone is ground-reaching: conflicts from the surface up", () => {
    const finding = evaluateBand("AIP_PROHIBITED", 0, 1000, plannedAmslEnvelope(100, 50));
    expect(finding.status).toBe("CONFLICT");
    expect(finding.groundReaching).toBe(true);
    expect(finding.assumptions).toEqual([]);
  });

  it("Dead Sea: below-sea-level flight is NOT outside a ground-reaching zone", () => {
    // Planned envelope is entirely below 0 ft AMSL (-1260..-1233), yet the
    // zone starts at the surface — the ratified semantics forbid concluding
    // that airspace between the terrain and 0 ft AMSL is outside the zone.
    const finding = evaluateBand("AIP_PROHIBITED", 0, 1000, plannedAmslEnvelope(-430, 50));
    expect(finding.status).toBe("CONFLICT");
    expect(finding.groundReaching).toBe(true);
  });

  it("null ceiling on a P/R/D zone is unbounded: conflict at ANY altitude", () => {
    const finding = evaluateBand("AIP_RESTRICTED", 0, null, plannedAmslEnvelope(100, 10000));
    expect(finding.status).toBe("CONFLICT");
    expect(finding.unboundedCeiling).toBe(true);
  });

  it("under a lane floor with margin: certain clearance, conservatively reported", () => {
    // Lane envelope 1000–3500; widened planned max 506 → 494 ft of clearance
    // (the SMALLEST clearance consistent with the ±4 m uncertainty).
    const finding = evaluateBand("CVFR_LANE", 1000, 3500, plannedAmslEnvelope(100, 50));
    expect(finding.status).toBe("BELOW_FLOOR");
    expect(finding.clearanceFt).toBe(494);
    expect(finding.groundReaching).toBe(false);
  });

  it("inside a lane band: conflict", () => {
    // Widened planned interval 1299..1326 sits inside 1000–3500.
    const finding = evaluateBand("CVFR_LANE", 1000, 3500, plannedAmslEnvelope(100, 300));
    expect(finding.status).toBe("CONFLICT");
  });

  it("above a published ceiling: certain clearance, conservatively reported", () => {
    const finding = evaluateBand("CVFR_LANE", 1000, 1200, plannedAmslEnvelope(100, 300));
    expect(finding.status).toBe("ABOVE_CEILING");
    expect(finding.clearanceFt).toBe(99); // widened min 1299 − ceiling 1200
  });

  it("blank lane band makes NO vertical claim — never 'probably low'", () => {
    const finding = evaluateBand("CVFR_LANE", null, null, plannedAmslEnvelope(100, 50));
    expect(finding.status).toBe("NO_CLAIM");
    expect(finding.clearanceFt).toBeNull();
  });

  it("null bounds on a non-P/R/D zone mean 'not published', never 'unbounded' (INPA rule)", () => {
    const finding = evaluateBand("NATURE_RESERVE", null, null, plannedAmslEnvelope(100, 50));
    expect(finding.status).toBe("NO_CLAIM");
    expect(finding.unboundedCeiling).toBe(false);
  });

  it("published floor + unpublished ceiling on a non-P/R/D zone: conflict above the floor cannot be excluded", () => {
    const finding = evaluateBand("NATURE_RESERVE", 0, null, plannedAmslEnvelope(100, 50));
    expect(finding.status).toBe("CONFLICT");
    expect(finding.unboundedCeiling).toBe(false); // NOT the P/R/D unbounded rule
    expect(finding.assumptions.join(" ")).toMatch(/ceiling not published/);
  });

  it("unpublished floor on a P/R/D zone is conservatively ground-reaching, flagged", () => {
    const finding = evaluateBand("AIP_DANGER", null, 1000, plannedAmslEnvelope(100, 50));
    expect(finding.status).toBe("CONFLICT");
    expect(finding.groundReaching).toBe(true);
    expect(finding.assumptions.join(" ")).toMatch(/floor not published/);
  });

  it("uncertainty WIDENS conflicts, never narrows: a floor above the unwidened altitude still conflicts", () => {
    // Unwidened planned ≈ 492 ft < floor 500, but the widened max is 506 —
    // the uncertainty makes this a conflict. Rounding must never shrink it.
    const finding = evaluateBand("CVFR_LANE", 500, 3500, plannedAmslEnvelope(100, 50));
    expect(finding.status).toBe("CONFLICT");
  });

  it("touching a band edge counts as conflict (inclusive comparison)", () => {
    const env = plannedAmslEnvelope(100, 50); // max 506
    expect(evaluateBand("CVFR_LANE", 506, 3500, env).status).toBe("CONFLICT");
    const below = evaluateBand("CVFR_LANE", 507, 3500, env);
    expect(below.status).toBe("BELOW_FLOOR");
    expect(below.clearanceFt).toBe(1);
  });
});
