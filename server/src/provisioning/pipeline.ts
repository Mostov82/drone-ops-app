import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { prisma as globalPrisma } from "../db.js";
import { seedRuleset } from "../ruleset/seed-catalog.js";
import { ZONE_TYPE_SEEDS, importDataset } from "../zones/import.js";
import { createRulesetReader } from "../ruleset/service.js";
import { createPrismaRulesetStore } from "../ruleset/service.js";

const execAsync = promisify(exec);

export async function runMigrations(): Promise<void> {
  const serverRoot = path.resolve(import.meta.dirname, "../..");
  console.log("[provisioning] Running database migrations...");
  try {
    const { stdout, stderr } = await execAsync("npx prisma migrate deploy", {
      cwd: serverRoot,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL ?? "file:../../app-data/drone-ops.db",
      },
    });
    console.log("[provisioning] Migration stdout:\n", stdout);
    if (stderr && stderr.trim().length > 0) {
      console.warn("[provisioning] Migration stderr:\n", stderr);
    }
  } catch (error: unknown) {
    console.error("[provisioning] Database migration failed!", error);
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Migration failed: ${msg}`);
  }
}

export async function runSeeding(prisma: PrismaClient = globalPrisma): Promise<void> {
  console.log("[provisioning] Seeding Regulation Ruleset and Zone Types...");
  for (const [code, zt] of Object.entries(ZONE_TYPE_SEEDS)) {
    await prisma.zoneType.upsert({
      where: { code },
      update: {},
      create: { code, ...zt },
    });
  }
  await seedRuleset(prisma);
}

export async function runZoneImportsIfNeeded(prisma: PrismaClient = globalPrisma): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const zonesRoot = path.join(repoRoot, "data-sources", "zones");

  if (!fs.existsSync(zonesRoot)) {
    console.warn(`[provisioning] Zones source root not found at ${zonesRoot}. Skipping auto-import.`);
    return;
  }

  const existingLayers = await prisma.mapLayer.findMany();
  const datasetDirs = fs
    .readdirSync(zonesRoot, { withFileTypes: true })
    .filter((dir) => dir.isDirectory() && !dir.name.startsWith(".") && !dir.name.startsWith("_"));

  const dirsToImport: string[] = [];

  for (const dir of datasetDirs) {
    const datasetDir = path.join(zonesRoot, dir.name);
    const manifestPath = path.join(datasetDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.importable) continue;

    const dbLayer = existingLayers.find((l) => l.name === manifest.layerKey);
    if (!dbLayer) {
      dirsToImport.push(datasetDir);
      console.log(`[provisioning] Zone layer ${manifest.layerKey} is missing in DB. Queueing import.`);
      continue;
    }

    let dbExtractedAt: string | null = null;
    try {
      const sourceBlob = JSON.parse(dbLayer.source);
      dbExtractedAt = sourceBlob.extractedAt;
    } catch {
      // ignore
    }

    if (!dbExtractedAt || manifest.extractedAt > dbExtractedAt) {
      dirsToImport.push(datasetDir);
      console.log(
        `[provisioning] Zone layer ${manifest.layerKey} has newer extractedAt date (${manifest.extractedAt} > ${dbExtractedAt || "none"}). Queueing import.`,
      );
    }
  }

  if (dirsToImport.length > 0) {
    console.log(`[provisioning] Importing ${dirsToImport.length} datasets...`);
    const deps = {
      prisma,
      rulesetReader: createRulesetReader(createPrismaRulesetStore(prisma)),
    };
    for (const dir of dirsToImport) {
      const result = await importDataset(dir, deps);
      console.log(`[provisioning] Imported ${result.layerKey}: ${result.zonesImported} zones.`);
    }
  } else {
    console.log("[provisioning] All zone layers are up to date.");
  }
}

export async function runBootPipeline(prisma: PrismaClient = globalPrisma): Promise<void> {
  console.log("[provisioning] Starting boot provisioning pipeline...");
  await runMigrations();
  await runSeeding(prisma);
  await runZoneImportsIfNeeded(prisma);
  console.log("[provisioning] Boot provisioning pipeline completed successfully.");
}
