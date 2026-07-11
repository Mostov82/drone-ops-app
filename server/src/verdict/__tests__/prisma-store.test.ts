// DO-015 — the Prisma-backed VerdictDataStore against a REAL migrated temp
// database (same pattern as zones/__tests__/import.test.ts): proves the
// zoneType join and column mapping the engine relies on.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { VerdictDataStore } from "../store.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "do015-store-test-"));
const dbFile = path.join(tmp, "store-test.db");
let prisma: PrismaClient;
let store: VerdictDataStore;

async function applyMigrations(client: PrismaClient) {
  const migrationsDir = fileURLToPath(new URL("../../../prisma/migrations", import.meta.url));
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
  process.env.DATABASE_URL = `file:${dbFile}`;
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
  await applyMigrations(prisma);

  // db.ts reads DATABASE_URL at import time; import the store factory only
  // after the env is pointed at the temp DB.
  const { createPrismaVerdictStore } = await import("../store.js");
  store = createPrismaVerdictStore();

  const zoneType = await prisma.zoneType.create({
    data: { code: "AIP_PROHIBITED", name: "AIP prohibited area (LLP)", defaultVerdict: "RESTRICTED" },
  });
  const layer = await prisma.mapLayer.create({
    data: {
      name: "aip-zones",
      source: JSON.stringify({ title: "test" }),
      importedAt: new Date("2026-07-11T00:00:00Z"),
      verified: false,
    },
  });
  await prisma.zone.create({
    data: {
      name: "LLP99 — אזור בדיקה",
      zoneTypeId: zoneType.id,
      mapLayerId: layer.id,
      geometryJson: JSON.stringify({
        type: "Polygon",
        coordinates: [[[35.1, 32.1], [35.2, 32.1], [35.2, 32.2], [35.1, 32.2], [35.1, 32.1]]],
      }),
      floorAmslFt: 0,
      ceilingAmslFt: null,
      notes: "ceiling UNL (unbounded)",
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  const { prisma: appPrisma } = await import("../../db.js");
  await appPrisma.$disconnect();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("createPrismaVerdictStore", () => {
  it("lists layers with the verification + provenance fields the engine flags", async () => {
    const layers = await store.listLayers();
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ name: "aip-zones", verified: false });
    expect(layers[0].importedAt.toISOString()).toBe("2026-07-11T00:00:00.000Z");
  });

  it("lists zones joined with their zone type's editable verdict mapping", async () => {
    const zones = await store.listZones();
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({
      name: "LLP99 — אזור בדיקה",
      zoneTypeCode: "AIP_PROHIBITED",
      zoneTypeName: "AIP prohibited area (LLP)",
      defaultVerdict: "RESTRICTED",
      floorAmslFt: 0,
      ceilingAmslFt: null,
    });
    expect(JSON.parse(zones[0].geometryJson).type).toBe("Polygon");
  });
});
