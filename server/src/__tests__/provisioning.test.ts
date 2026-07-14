import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { writeArrayBuffer } from "geotiff";
import { runSeeding } from "../provisioning/pipeline.js";
import { validateDemFile } from "../provisioning/dem-downloader.js";
import { authedAgent, makeApp } from "./helpers.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "do033-provision-test-"));
const dbFile = path.join(tmp, "provision-test.db");
let prisma: PrismaClient;

async function applyMigrations(client: PrismaClient) {
  const migrationsDir = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));
  const folders = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const folder of folders) {
    const sql = fs.readFileSync(path.join(migrationsDir, folder, "migration.sql"), "utf8");
    for (const statement of sql.split(";")) {
      if (statement.trim().length > 0) await client.$executeRawUnsafe(statement);
    }
  }
}

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
  await applyMigrations(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("DEM validation", () => {
  it("rejects non-existent or invalid/empty file", async () => {
    const emptyFile = path.join(tmp, "empty.tif");
    fs.writeFileSync(emptyFile, "");
    expect(await validateDemFile(emptyFile)).toBe(false);
    expect(await validateDemFile(path.join(tmp, "absent.tif"))).toBe(false);
  });

  it("accepts a valid GeoTIFF file", async () => {
    const width = 2;
    const height = 2;
    const values = new Float32Array(width * height);
    values.fill(100);
    const buf = await writeArrayBuffer(values, {
      width,
      height,
      ModelPixelScale: [0.25, 0.25, 0],
      ModelTiepoint: [0, 0, 0, 35, 32, 0],
      GeographicTypeGeoKey: 4326,
    });
    const tifFile = path.join(tmp, "valid.tif");
    fs.writeFileSync(tifFile, Buffer.from(buf));
    expect(await validateDemFile(tifFile)).toBe(true);
  });
});

describe("Seeding pipeline", () => {
  it("seeds RegulationRule and ZoneType records idempotently", async () => {
    await runSeeding(prisma);
    const ruleCount = await prisma.regulationRule.count();
    const typeCount = await prisma.zoneType.count();
    expect(ruleCount).toBeGreaterThan(0);
    expect(typeCount).toBeGreaterThan(0);

    // Double seed is a no-op
    await runSeeding(prisma);
    expect(await prisma.regulationRule.count()).toBe(ruleCount);
    expect(await prisma.zoneType.count()).toBe(typeCount);
  });
});

describe("API endpoints", () => {
  it("GET /api/provisioning/status returns status structure", async () => {
    const app = makeApp({ prisma });
    const agent = await authedAgent(app);

    const res = await agent.get("/api/provisioning/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("database");
    expect(res.body.database.status).toBe("completed");
    expect(res.body).toHaveProperty("ruleset");
    expect(res.body).toHaveProperty("zones");
    expect(res.body).toHaveProperty("dem");
    expect(res.body.dem.status).toBeDefined();
  });
});
