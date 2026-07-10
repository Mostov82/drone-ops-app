// DO-010: seed integrity — the database ends up with exactly the approved
// Gate 1 catalog, idempotently. Expected values are imported from the seed
// catalog module (the sanctioned provisioning point), never restated here.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { RULESET_SEED, seedRuleset } from "../ruleset/seed-catalog.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "do010-seed-test-"));
const dbFile = path.join(tmp, "seed-test.db");
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

describe("ruleset seed", () => {
  it("populates exactly the approved catalog, all unverified", async () => {
    await seedRuleset(prisma);
    const rows = await prisma.regulationRule.findMany();
    expect(rows).toHaveLength(RULESET_SEED.length);

    for (const seed of RULESET_SEED) {
      const row = rows.find((r) => r.key === seed.key);
      expect(row, seed.key).toBeDefined();
      expect(row).toMatchObject({
        category: seed.category,
        valueType: seed.valueType,
        numberValue: seed.numberValue ?? null,
        boolValue: seed.boolValue ?? null,
        textValue: seed.textValue ?? null,
        unit: seed.unit ?? null,
        lastVerifiedAt: null,
      });
    }
  });

  it("declares exactly one rule with no value: registration_weight_threshold_g (Gate 1)", () => {
    const unset = RULESET_SEED.filter(
      (s) => s.numberValue === undefined && s.boolValue === undefined && s.textValue === undefined,
    );
    expect(unset.map((s) => s.key)).toEqual(["registration_weight_threshold_g"]);
  });

  it("re-seeding is idempotent and never clobbers app edits", async () => {
    // Simulate a human edit through the app (arbitrary test value).
    const edited = await prisma.regulationRule.update({
      where: { key: RULESET_SEED[0].key },
      data: { numberValue: 999999 },
    });

    await seedRuleset(prisma);

    const rows = await prisma.regulationRule.findMany();
    expect(rows).toHaveLength(RULESET_SEED.length); // no duplicates
    const stillEdited = await prisma.regulationRule.findUnique({
      where: { key: RULESET_SEED[0].key },
    });
    expect(stillEdited?.numberValue).toBe(edited.numberValue); // edit survives
  });
});
