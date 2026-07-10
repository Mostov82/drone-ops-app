// DO-013: import pipeline — round-trip into a REAL migrated temp database
// (migration integrity incl. the approved floorAmslFt/ceilingAmslFt columns),
// clean replace-on-reimport (FR-C4, no orphans), refusal of non-importable
// datasets, and fail-closed Ruleset-driven buffer generation (trigger 4).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRulesetReader } from "../../ruleset/service.js";
import { memoryRulesetStore, ruleFixture } from "../../__tests__/helpers.js";
import type { DatasetManifest } from "../dataset.js";
import { importDataset } from "../import.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "do013-import-test-"));
const dbFile = path.join(tmp, "import-test.db");
let prisma: PrismaClient;

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

/** Write a dataset directory fixture and return its path. */
function datasetDir(name: string, manifest: Partial<DatasetManifest>, features: unknown[]): string {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  const full: DatasetManifest = {
    layerKey: name,
    title: `test dataset ${name}`,
    sourceFiles: [{ path: "test", sha256: "0" }],
    aipUpdateStamp: "test",
    extractedAt: "2026-07-10",
    extractionTools: ["test"],
    featureCount: features.length,
    importable: true,
    verified: false,
    ...manifest,
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(full));
  fs.writeFileSync(
    path.join(dir, "zones.geojson"),
    JSON.stringify({ type: "FeatureCollection", features }),
  );
  return dir;
}

const square = {
  type: "Polygon",
  coordinates: [[[34.9, 31.9], [34.91, 31.9], [34.91, 31.91], [34.9, 31.91], [34.9, 31.9]]],
};

function zoneFeature(code: string, extra: Record<string, unknown> = {}) {
  return {
    type: "Feature",
    properties: {
      code,
      nameHe: `אזור ${code}`,
      nameEn: `Zone ${code}`,
      zoneTypeCode: "AIP_PROHIBITED",
      floorAmslFt: 0,
      ceilingAmslFt: 3000,
      aglCeilingFt: null,
      notes: "test",
      ...extra,
    },
    geometry: square,
  };
}

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
  await applyMigrations(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("importDataset", () => {
  it("imports zones into a MapLayer with verified=false and the altitude band columns", async () => {
    const dir = datasetDir("test-zones", {}, [
      zoneFeature("T01"),
      zoneFeature("T02", { floorAmslFt: null, ceilingAmslFt: null, aglCeilingFt: 300 }),
    ]);
    const result = await importDataset(dir, { prisma });
    expect(result).toMatchObject({ layerKey: "test-zones", zonesImported: 2, replacedExisting: false });

    const layer = await prisma.mapLayer.findFirst({ where: { name: "test-zones" }, include: { zones: true } });
    expect(layer).not.toBeNull();
    expect(layer!.verified).toBe(false);
    expect(layer!.zones).toHaveLength(2);

    const t01 = layer!.zones.find((z) => z.name.startsWith("T01"))!;
    expect(t01.floorAmslFt).toBe(0);
    expect(t01.ceilingAmslFt).toBe(3000);
    expect(JSON.parse(t01.geometryJson)).toEqual(square);

    // unpublished band stays null; AGL note lands in notes, never in the AMSL columns
    const t02 = layer!.zones.find((z) => z.name.startsWith("T02"))!;
    expect(t02.floorAmslFt).toBeNull();
    expect(t02.ceilingAmslFt).toBeNull();
    expect(t02.notes).toContain("aglCeilingFt=300");

    // zone type upserted with the Gate-3-derived default verdict
    const zoneType = await prisma.zoneType.findUnique({ where: { code: "AIP_PROHIBITED" } });
    expect(zoneType?.defaultVerdict).toBe("RESTRICTED");
  });

  it("re-import replaces the layer's zones cleanly — same layer, no orphans", async () => {
    const before = await prisma.mapLayer.findFirst({ where: { name: "test-zones" } });
    const dir = datasetDir("test-zones", {}, [zoneFeature("T03")]);
    const result = await importDataset(dir, { prisma });
    expect(result.replacedExisting).toBe(true);
    expect(result.layerId).toBe(before!.id); // stable layer identity

    const layers = await prisma.mapLayer.findMany({ where: { name: "test-zones" } });
    expect(layers).toHaveLength(1); // no duplicate layers
    const zones = await prisma.zone.findMany({ where: { mapLayerId: before!.id } });
    expect(zones.map((z) => z.name.slice(0, 3))).toEqual(["T03"]); // old rows gone
    expect(await prisma.zone.count()).toBe(1); // NO orphans anywhere
  });

  it("re-import resets verified to false (a changed dataset needs a fresh visual check)", async () => {
    const layer = await prisma.mapLayer.findFirst({ where: { name: "test-zones" } });
    await prisma.mapLayer.update({ where: { id: layer!.id }, data: { verified: true } });
    await importDataset(datasetDir("test-zones", {}, [zoneFeature("T04")]), { prisma });
    const after = await prisma.mapLayer.findFirst({ where: { name: "test-zones" } });
    expect(after!.verified).toBe(false);
  });

  it("refuses datasets marked importable=false (pending human decisions)", async () => {
    const dir = datasetDir("test-blocked", { importable: false }, [zoneFeature("T05")]);
    await expect(importDataset(dir, { prisma })).rejects.toThrow(/importable=false/);
    expect(await prisma.mapLayer.findFirst({ where: { name: "test-blocked" } })).toBeNull();
  });

  it("generates gap-filler buffers from the Ruleset at import time", async () => {
    const reader = createRulesetReader(
      memoryRulesetStore([ruleFixture({ key: "airport_buffer_km", numberValue: 2, unit: "km" })]),
    );
    const dir = datasetDir("test-airports", {}, [
      {
        type: "Feature",
        properties: {
          code: "OSM-node-1",
          nameHe: null,
          nameEn: "Test Field",
          zoneTypeCode: "AIRPORT",
          bufferRuleKey: "airport_buffer_km",
          notes: null,
        },
        geometry: { type: "Point", coordinates: [34.9, 31.9] },
      },
    ]);
    await importDataset(dir, { prisma, rulesetReader: reader });
    const layer = await prisma.mapLayer.findFirst({ where: { name: "test-airports" }, include: { zones: true } });
    const geometry = JSON.parse(layer!.zones[0].geometryJson) as { type: string; coordinates: number[][][] };
    expect(geometry.type).toBe("Polygon"); // point became a buffer circle
    expect(geometry.coordinates[0].length).toBeGreaterThan(10);
    expect(layer!.zones[0].notes).toContain("2 km from Ruleset rule airport_buffer_km");
  });

  it("aborts the dataset when the Ruleset value is unset — fail-closed, never a constant (trigger 4)", async () => {
    const reader = createRulesetReader(memoryRulesetStore([ruleFixture({ key: "airport_buffer_km" })]));
    const dir = datasetDir("test-airports-unset", {}, [
      {
        type: "Feature",
        properties: {
          code: "OSM-node-2",
          nameHe: null,
          nameEn: "Test Field 2",
          zoneTypeCode: "AIRPORT",
          bufferRuleKey: "airport_buffer_km",
          notes: null,
        },
        geometry: { type: "Point", coordinates: [34.9, 31.9] },
      },
    ]);
    await expect(importDataset(dir, { prisma, rulesetReader: reader })).rejects.toMatchObject({
      code: "RULE_VALUE_UNSET",
    });
    expect(await prisma.mapLayer.findFirst({ where: { name: "test-airports-unset" } })).toBeNull();
  });

  it("aborts on an unexpected buffer unit instead of guessing a conversion", async () => {
    const reader = createRulesetReader(
      memoryRulesetStore([ruleFixture({ key: "airport_buffer_km", numberValue: 2000, unit: "g" })]),
    );
    const dir = datasetDir("test-airports-unit", {}, [
      {
        type: "Feature",
        properties: {
          code: "OSM-node-3",
          nameHe: null,
          nameEn: "Test Field 3",
          zoneTypeCode: "AIRPORT",
          bufferRuleKey: "airport_buffer_km",
          notes: null,
        },
        geometry: { type: "Point", coordinates: [34.9, 31.9] },
      },
    ]);
    await expect(importDataset(dir, { prisma, rulesetReader: reader })).rejects.toThrow(/unit/);
  });

  it("aborts on an unknown zone type with no seed definition", async () => {
    const dir = datasetDir("test-unknown-type", {}, [zoneFeature("T06", { zoneTypeCode: "NO_SUCH_TYPE" })]);
    await expect(importDataset(dir, { prisma })).rejects.toThrow(/unknown ZoneType/);
  });
});
