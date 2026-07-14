// DO-012 — offline map + elevation tests (FR-C1, FR-C5).
// Fixtures are generated on the fly: a real (tiny) MBTiles SQLite file and a
// real (tiny) GeoTIFF raster — the same file formats the user's one-time
// downloads produce. All values are arbitrary test geometry, never regulatory.
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import { writeArrayBuffer } from "geotiff";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createDemService } from "../map/dem.js";
import { createMbtilesStore } from "../map/tiles.js";
import { authedAgent, makeApp } from "./helpers.js";

// A valid 1×1 PNG — what a raster tile package stores per tile.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const cleanups: Array<() => Promise<void> | void> = [];
afterAll(async () => {
  for (const fn of cleanups.reverse()) await fn();
});

/** Build a real MBTiles file (SQLite) holding one tile at z8 x156 y105 (XYZ). */
async function makeMbtilesFixture(): Promise<string> {
  const file = path.join(os.tmpdir(), `drone-ops-tiles-${randomUUID()}.mbtiles`);
  const client = new PrismaClient({ datasourceUrl: `file:${file.replaceAll("\\", "/")}` });
  await client.$executeRawUnsafe(`CREATE TABLE metadata (name text, value text)`);
  await client.$executeRawUnsafe(
    `CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)`,
  );
  const metadata: Array<[string, string]> = [
    ["name", "test-package"],
    ["format", "png"],
    ["minzoom", "0"],
    ["maxzoom", "14"],
    ["bounds", "34.2,29.4,35.9,33.4"],
    ["attribution", "test attribution"],
  ];
  for (const [name, value] of metadata) {
    await client.$executeRawUnsafe(`INSERT INTO metadata (name, value) VALUES (?, ?)`, name, value);
  }
  // XYZ y=105 at z=8 → TMS row 255-105=150 (MBTiles stores TMS).
  await client.$executeRawUnsafe(
    `INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)`,
    8,
    156,
    150,
    TINY_PNG,
  );
  await client.$disconnect();
  cleanups.push(() => fs.rmSync(file, { force: true }));
  return file;
}

/**
 * Build a real GeoTIFF DEM fixture: 4×4 pixels over lon 35–36, lat 31–32
 * (0.25°/pixel), value(x, y) = 100 + 10x + 40y. Being linear, the bilinear
 * expectation at (lat, lng) is exactly:
 *   100 + 10·((lng−35)·4 − 0.5) + 40·((32−lat)·4 − 0.5)
 */
async function makeDemFixtureDir(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drone-ops-dem-"));
  const width = 4;
  const height = 4;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) values[y * width + x] = 100 + x * 10 + y * 40;
  const buf = await writeArrayBuffer(values, {
    width,
    height,
    ModelPixelScale: [0.25, 0.25, 0],
    ModelTiepoint: [0, 0, 0, 35, 32, 0],
    GeographicTypeGeoKey: 4326,
  });
  fs.writeFileSync(path.join(dir, "Copernicus_test_DEM.tif"), Buffer.from(buf));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function expectedFixtureElevation(lat: number, lng: number): number {
  const px = (lng - 35) * 4 - 0.5;
  const py = (32 - lat) * 4 - 0.5;
  return 100 + 10 * px + 40 * py;
}

async function makeMapApp(opts: { tiles?: string; demDir?: string } = {}) {
  const missing = path.join(os.tmpdir(), `drone-ops-absent-${randomUUID()}`);
  const tileStore = createMbtilesStore(opts.tiles ?? path.join(missing, "tiles.mbtiles"));
  const demService = createDemService(opts.demDir ?? path.join(missing, "dem"));
  cleanups.push(async () => {
    await tileStore.close();
    await demService.close();
  });
  const app = makeApp({ map: { tileStore, demService } });
  return { app, agent: await authedAgent(app) };
}

describe("auth gate", () => {
  it("rejects unauthenticated map requests", async () => {
    const { app } = await makeMapApp();
    const res = await request(app).get("/api/map/status");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/map/status", () => {
  it("reports missing package and missing DEM without crashing", async () => {
    const { agent } = await makeMapApp();
    const res = await agent.get("/api/map/status");
    expect(res.status).toBe(200);
    expect(res.body.tiles).toEqual({ available: false, reason: "PACKAGE_MISSING" });
    expect(res.body.dem).toEqual({ available: false, tileCount: 0 });
  });

  it("reports package metadata and DEM tile count when installed", async () => {
    const { agent } = await makeMapApp({
      tiles: await makeMbtilesFixture(),
      demDir: await makeDemFixtureDir(),
    });
    const res = await agent.get("/api/map/status");
    expect(res.status).toBe(200);
    expect(res.body.tiles).toMatchObject({
      available: true,
      format: "png",
      minzoom: 0,
      maxzoom: 14,
      bounds: "34.2,29.4,35.9,33.4",
      attribution: "test attribution",
    });
    expect(res.body.dem).toEqual({ available: true, tileCount: 1 });
  });
});

describe("GET /api/map/tiles/:z/:x/:y", () => {
  it("serves a stored tile with its raster content type", async () => {
    const { agent } = await makeMapApp({ tiles: await makeMbtilesFixture() });
    const res = await agent.get("/api/map/tiles/8/156/105");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(res.body as Buffer, TINY_PNG)).toBe(0);
  });

  it("returns a plain 404 for a hole in the package", async () => {
    const { agent } = await makeMapApp({ tiles: await makeMbtilesFixture() });
    const res = await agent.get("/api/map/tiles/8/1/1");
    expect(res.status).toBe(404);
  });

  it("returns structured 503 when the package is missing", async () => {
    const { agent } = await makeMapApp();
    const res = await agent.get("/api/map/tiles/8/156/105");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("TILE_PACKAGE_MISSING");
    expect(res.body.message.en).toBeTruthy();
    expect(res.body.message.he).toBeTruthy();
  });

  it("rejects malformed tile coordinates", async () => {
    const { agent } = await makeMapApp({ tiles: await makeMbtilesFixture() });
    for (const bad of ["/api/map/tiles/8/abc/105", "/api/map/tiles/8/300/105"]) {
      const res = await agent.get(bad);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MAP_BAD_REQUEST");
    }
  });
});

describe("GET /api/map/elevation", () => {
  it("returns bilinear elevations, flagged approximate, for known fixture points", async () => {
    const { agent } = await makeMapApp({ demDir: await makeDemFixtureDir() });
    // Points chosen inside the raster's interior (away from edge clamping).
    const points = [
      { lat: 31.5, lng: 35.5 },
      { lat: 31.3, lng: 35.7 },
      { lat: 31.71, lng: 35.42 },
    ];
    for (const p of points) {
      const res = await agent.get(`/api/map/elevation?lat=${p.lat}&lng=${p.lng}`);
      expect(res.status).toBe(200);
      expect(res.body.approximate).toBe(true);
      expect(res.body.source).toBe("copernicus-glo30-dem");
      const expected = Math.round(expectedFixtureElevation(p.lat, p.lng) * 10) / 10;
      expect(res.body.elevationM).toBeCloseTo(expected, 1);
    }
  });

  it("fails with a structured error when no DEM is installed — never a default value", async () => {
    const { agent } = await makeMapApp();
    const res = await agent.get("/api/map/elevation?lat=31.5&lng=35.5");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("DEM_NOT_AVAILABLE");
    expect(res.body.elevationM).toBeUndefined();
    expect(res.body.message.en).toBeTruthy();
    expect(res.body.message.he).toBeTruthy();
  });

  it("distinguishes out-of-coverage from missing DEM", async () => {
    const { agent } = await makeMapApp({ demDir: await makeDemFixtureDir() });
    const res = await agent.get("/api/map/elevation?lat=29.5&lng=34.5");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("DEM_OUT_OF_COVERAGE");
  });

  it("rejects missing or out-of-range coordinates", async () => {
    const { agent } = await makeMapApp({ demDir: await makeDemFixtureDir() });
    for (const qs of ["", "?lat=31.5", "?lat=abc&lng=35.5", "?lat=99&lng=35.5"]) {
      const res = await agent.get(`/api/map/elevation${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MAP_BAD_REQUEST");
    }
  });
});

describe("GET /api/map/elevation/crosscheck", () => {
  it("returns the provider's elevation on success", async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({ results: [{ elevation: 812.25 }] }),
    });
    const app = makeApp({
      map: {
        tileStore: createMbtilesStore(path.join(os.tmpdir(), "none.mbtiles")),
        demService: createDemService(path.join(os.tmpdir(), "none-dem")),
        crosscheckFetch: fakeFetch,
      },
    });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/map/elevation/crosscheck?lat=31.5&lng=35.5");
    expect(res.status).toBe(200);
    expect(res.body.elevationM).toBe(812.25);
    expect(res.body.approximate).toBe(true);
    expect(res.body.provider).toContain("Open Topo Data");
  });

  it("fails structured (not a default) when the provider is unreachable — the offline case", async () => {
    const offlineFetch = async () => {
      throw new Error("network unreachable");
    };
    const app = makeApp({
      map: {
        tileStore: createMbtilesStore(path.join(os.tmpdir(), "none.mbtiles")),
        demService: createDemService(path.join(os.tmpdir(), "none-dem")),
        crosscheckFetch: offlineFetch,
      },
    });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/map/elevation/crosscheck?lat=31.5&lng=35.5");
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("CROSSCHECK_FAILED");
    expect(res.body.elevationM).toBeUndefined();
  });
});

describe("GET /api/map/search", () => {
  it("fails with 400 if q parameter is missing or empty", async () => {
    const { agent } = await makeMapApp();
    const res1 = await agent.get("/api/map/search");
    expect(res1.status).toBe(400);
    expect(res1.body.code).toBe("MAP_BAD_REQUEST");

    const res2 = await agent.get("/api/map/search?q=");
    expect(res2.status).toBe(400);
    expect(res2.body.code).toBe("MAP_BAD_REQUEST");
  });

  it("proxies results on success", async () => {
    const mockResults = [
      { place_id: 123, display_name: "Test Place", lat: "32.1", lon: "34.8" },
    ];
    const fakeFetch = async () => ({
      ok: true,
      json: async () => mockResults,
    } as unknown as Response);

    const app = makeApp({
      map: {
        tileStore: createMbtilesStore(path.join(os.tmpdir(), "none.mbtiles")),
        demService: createDemService(path.join(os.tmpdir(), "none-dem")),
        searchFetch: fakeFetch,
      },
    });
    const agent = await authedAgent(app);

    const res = await agent.get("/api/map/search?q=test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResults);
  });

  it("triggers 429 rate limit if requests are under 1000ms apart", async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    const app = makeApp({
      map: {
        tileStore: createMbtilesStore(path.join(os.tmpdir(), "none.mbtiles")),
        demService: createDemService(path.join(os.tmpdir(), "none-dem")),
        searchFetch: fakeFetch,
      },
    });
    const agent = await authedAgent(app);

    const res1 = await agent.get("/api/map/search?q=test1");
    expect(res1.status).toBe(200);

    const res2 = await agent.get("/api/map/search?q=test2");
    expect(res2.status).toBe(429);
    expect(res2.body.code).toBe("SEARCH_RATE_LIMIT");
  });

  it("fails with 503 SEARCH_OFFLINE when network is down", async () => {
    const offlineFetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const app = makeApp({
      map: {
        tileStore: createMbtilesStore(path.join(os.tmpdir(), "none.mbtiles")),
        demService: createDemService(path.join(os.tmpdir(), "none-dem")),
        searchFetch: offlineFetch,
      },
    });
    const agent = await authedAgent(app);
    const res = await agent.get("/api/map/search?q=test");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SEARCH_OFFLINE");
  });

  // Regression (DO-034): Nominatim's usage policy blocks User-Agents carrying a
  // placeholder contact (e.g. example.com) with a 403, which surfaced as an
  // opaque 502 SEARCH_SERVICE_ERROR and broke every search. Guard the header we
  // send so a placeholder contact can never ship again.
  it("sends a Nominatim-compliant User-Agent with a real contact", async () => {
    let sentUserAgent: string | undefined;
    const capturingFetch = async (_url: string, init?: { headers?: Record<string, string> }) => {
      sentUserAgent = init?.headers?.["User-Agent"];
      return { ok: true, json: async () => [] } as unknown as Response;
    };

    const app = makeApp({
      map: {
        tileStore: createMbtilesStore(path.join(os.tmpdir(), "none.mbtiles")),
        demService: createDemService(path.join(os.tmpdir(), "none-dem")),
        searchFetch: capturingFetch,
      },
    });
    const agent = await authedAgent(app);

    const res = await agent.get("/api/map/search?q=tel+aviv");
    expect(res.status).toBe(200);

    // Policy requires an identifying UA; a placeholder/example contact is rejected.
    expect(sentUserAgent, "search proxy must send a User-Agent").toBeTruthy();
    expect(sentUserAgent).not.toMatch(/example\.(com|org|net)/i);
    expect(sentUserAgent).not.toMatch(/\byour[-_.]?(email|domain|contact)\b/i);
    // Must carry a concrete contact (a URL or email) so OSM can reach the operator.
    expect(sentUserAgent).toMatch(/@|https?:\/\//);
  });
});
