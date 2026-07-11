// DO-015 — HTTP surface (GET /check). The router is exercised on a minimal
// express app here because mounting into server/src/app.ts is session 2's
// wiring (parallel-run protocol; it will sit behind the PIN middleware like
// every /api route).
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { circle } from "@turf/turf";
import { createRulesetReader } from "../../ruleset/service.js";
import { memoryRulesetStore, ruleFixture } from "../../__tests__/helpers.js";
import type { DemService } from "../../map/dem.js";
import { createVerdictRouter } from "../routes.js";
import type { VerdictDataStore } from "../store.js";

const airportCircle = JSON.stringify(circle([35.03, 32.0], 2, { steps: 64, units: "kilometers" }).geometry);

function store(withData = true): VerdictDataStore {
  if (!withData) return { listLayers: async () => [], listZones: async () => [] };
  return {
    listLayers: async () => [
      { id: "L1", name: "osm-airport-buffers", importedAt: new Date("2026-07-11T00:00:00Z"), verified: false },
    ],
    listZones: async () => [
      {
        id: "Z-a",
        name: "OSM-node-1 — Test Field",
        zoneTypeCode: "AIRPORT",
        zoneTypeName: "Airport / airfield buffer",
        defaultVerdict: "RESTRICTED",
        geometryJson: airportCircle,
        floorAmslFt: null,
        ceilingAmslFt: null,
        notes: null,
        mapLayerId: "L1",
      },
    ],
  };
}

const dem: DemService = {
  status: async () => ({ available: true, tileCount: 1 }),
  lookup: async () => ({ elevationM: 100, approximate: true, source: "copernicus-glo30-dem", resolutionM: 30 }),
  close: async () => {},
};

function makeApp(withData = true) {
  const app = express();
  app.use(
    "/api/verdict",
    createVerdictRouter({
      store: store(withData),
      demService: dem,
      rulesetReader: createRulesetReader(
        memoryRulesetStore([
          ruleFixture({ key: "airport_buffer_km", numberValue: 2, unit: "km" }),
          ruleFixture({ key: "max_altitude_agl_m", numberValue: 50, unit: "m" }),
          ruleFixture({ key: "min_distance_people_structures_m", numberValue: 250, unit: "m" }),
          ruleFixture({ key: "vlos_required", valueType: "BOOLEAN", boolValue: true }),
          ruleFixture({ key: "daylight_only", valueType: "BOOLEAN", boolValue: true }),
        ]),
      ),
    }),
  );
  return app;
}

describe("GET /api/verdict/check", () => {
  it("returns a full verdict for lat/lng", async () => {
    const res = await request(makeApp()).get("/api/verdict/check?lat=32.0&lng=35.02");
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("RESTRICTED");
    expect(res.body.reasons).toHaveLength(1);
    expect(res.body.dataQuality.unverifiedLayers).toEqual(["osm-airport-buffers"]);
    expect(res.body.vertical).toBeNull();
  });

  it("accepts aglM (planned altitude, meters AGL) and returns the vertical report", async () => {
    const res = await request(makeApp()).get("/api/verdict/check?lat=31.5&lng=34.7&aglM=50");
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("CLEAR");
    expect(res.body.vertical.plannedAltitudeAglM).toBe(50);
    expect(res.body.vertical.elevation.approximate).toBe(true);
    expect(res.body.vertical.plannedAmslFt).toEqual({ minFt: 479, maxFt: 506 });
  });

  it("missing lat/lng → 400 VERDICT_BAD_REQUEST, bilingual", async () => {
    const res = await request(makeApp()).get("/api/verdict/check?lat=32.0");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VERDICT_BAD_REQUEST");
    expect(res.body.message.en).toBeTruthy();
    expect(res.body.message.he).toBeTruthy();
  });

  it("non-numeric aglM → 400", async () => {
    const res = await request(makeApp()).get("/api/verdict/check?lat=32.0&lng=35.0&aglM=high");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VERDICT_BAD_REQUEST");
  });

  it("no zone data imported → 503 VERDICT_NO_ZONE_DATA (fail closed, never clear)", async () => {
    const res = await request(makeApp(false)).get("/api/verdict/check?lat=32.0&lng=35.0");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("VERDICT_NO_ZONE_DATA");
    expect(res.body.message.he).toBeTruthy();
  });
});
