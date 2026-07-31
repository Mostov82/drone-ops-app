// DO-014: the additive read-only zone routes (layer catalog + per-layer
// GeoJSON). Key contract points under test:
//   - verdict in feature properties comes from the ZoneType mapping AT READ
//     TIME (editable Gate 3 data — a mapping edit changes the response),
//   - provenance blob is parsed and surfaced (staleness/unverified UI input),
//   - geometry passes through unmodified (no simplification — ratified),
//   - 404 with the bilingual error contract for unknown layers,
//   - empty DB → empty layer list (the map page's zero-layers state).
// Fixture geometry/altitudes are arbitrary test data, never regulatory values.
import { describe, expect, it } from "vitest";
import { authedAgent, makeApp } from "../../__tests__/helpers.js";
import type { ZoneLayerRecord, ZoneRecord, ZonesReadStore } from "../routes.js";

const SQUARE = {
  type: "Polygon",
  coordinates: [
    [
      [35.0, 32.0],
      [35.1, 32.0],
      [35.1, 32.1],
      [35.0, 32.1],
      [35.0, 32.0],
    ],
  ],
};

function memoryZonesStore(
  layers: (ZoneLayerRecord & { zones: ZoneRecord[] })[],
): ZonesReadStore & { layers: (ZoneLayerRecord & { zones: ZoneRecord[] })[] } {
  return {
    layers,
    async listLayers() {
      return layers.map(({ zones, ...layer }) => ({ ...layer, zoneCount: zones.length }));
    },
    async getLayer(id) {
      const found = layers.find((l) => l.id === id);
      if (!found) return null;
      const { zones, ...layer } = found;
      return { ...layer, zoneCount: zones.length };
    },
    async listZones(mapLayerId) {
      return layers.find((l) => l.id === mapLayerId)?.zones ?? [];
    },
  };
}

const PROVENANCE = {
  title: "Test dataset",
  sourceFiles: [{ path: "data-sources/test", sha256: "0" }],
  aipUpdateStamp: "עדכון 2/25",
  extractedAt: "2026-07-10",
  extractionTools: ["test"],
};

function fixtureStore() {
  return memoryZonesStore([
    {
      id: "layer-1",
      name: "test-layer",
      source: JSON.stringify(PROVENANCE),
      importedAt: new Date("2026-07-11T10:00:00Z"),
      verified: false,
      zoneCount: 1,
      zones: [
        {
          id: "zone-1",
          name: "TST01 — אזור בדיקה",
          geometryJson: JSON.stringify(SQUARE),
          floorAmslFt: 0,
          ceilingAmslFt: null,
          notes: "ceiling UNL (unlimited) per א'-17 — stored null",
          zoneType: {
            code: "AIP_RESTRICTED",
            name: "AIP restricted area (LLR)",
            defaultVerdict: "RESTRICTED",
          },
        },
      ],
    },
  ]);
}

describe("GET /api/zones/layers", () => {
  it("lists layers with parsed provenance, import date, verified flag and count", async () => {
    const app = makeApp({ zonesStore: fixtureStore() });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/zones/layers");
    expect(res.status).toBe(200);
    expect(res.body.layers).toHaveLength(1);
    const layer = res.body.layers[0];
    expect(layer).toMatchObject({
      id: "layer-1",
      name: "test-layer",
      verified: false,
      zoneCount: 1,
      provenance: PROVENANCE,
    });
    expect(layer.importedAt).toBe("2026-07-11T10:00:00.000Z");
    // The raw source blob is not leaked alongside the parsed provenance.
    expect(layer.source).toBeUndefined();
  });

  it("returns an empty list (not an error) when nothing is imported", async () => {
    const app = makeApp({ zonesStore: memoryZonesStore([]) });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/zones/layers");
    expect(res.status).toBe(200);
    expect(res.body.layers).toEqual([]);
  });

  it("falls back to a title-only provenance for a non-JSON source blob", async () => {
    const store = fixtureStore();
    store.layers[0].source = "legacy plain-text source";
    const app = makeApp({ zonesStore: store });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/zones/layers");
    expect(res.status).toBe(200);
    expect(res.body.layers[0].provenance).toEqual({ title: "legacy plain-text source" });
  });

  it("sits behind the PIN middleware like every /api route", async () => {
    const app = makeApp({ zonesStore: fixtureStore() });
    const request = (await import("supertest")).default;
    const res = await request(app).get("/api/zones/layers");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/zones/layers/:id/geojson", () => {
  it("returns the layer's zones as GeoJSON with live-verdict properties", async () => {
    const app = makeApp({ zonesStore: fixtureStore() });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/zones/layers/layer-1/geojson");
    expect(res.status).toBe(200);
    expect(res.body.layer.name).toBe("test-layer");
    expect(res.body.geojson.type).toBe("FeatureCollection");
    expect(res.body.geojson.features).toHaveLength(1);
    const feature = res.body.geojson.features[0];
    expect(feature.properties).toEqual({
      id: "zone-1",
      name: "TST01 — אזור בדיקה",
      zoneTypeCode: "AIP_RESTRICTED",
      zoneTypeName: "AIP restricted area (LLR)",
      verdict: "RESTRICTED",
      floorAmslFt: 0,
      ceilingAmslFt: null,
      notes: "ceiling UNL (unlimited) per א'-17 — stored null",
    });
    // Geometry passes through untouched — no simplification, ever.
    expect(feature.geometry).toEqual(SQUARE);
  });

  it("reflects a ZoneType verdict edit on the next read (data-driven styling)", async () => {
    const store = fixtureStore();
    const app = makeApp({ zonesStore: store });
    const agent = await authedAgent(app);

    const before = await agent.get("/api/zones/layers/layer-1/geojson");
    expect(before.body.geojson.features[0].properties.verdict).toBe("RESTRICTED");

    // Simulate Jonathan editing the Gate 3 mapping in the DB.
    store.layers[0].zones[0].zoneType.defaultVerdict = "NEEDS_PERMIT";

    const after = await agent.get("/api/zones/layers/layer-1/geojson");
    expect(after.body.geojson.features[0].properties.verdict).toBe("NEEDS_PERMIT");
  });

  it("404s with the bilingual error contract for an unknown layer", async () => {
    const app = makeApp({ zonesStore: fixtureStore() });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/zones/layers/nope/geojson");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ZONES_LAYER_NOT_FOUND");
    expect(res.body.message.en).toBeTruthy();
    expect(res.body.message.he).toBeTruthy();
  });
});
