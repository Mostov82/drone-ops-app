// Seed scaffold (DO-002). Real seed data ships with DO-029 (GB-06);
// Ruleset baseline values ship with DO-010 (GB-02).
// Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";
import { seedRuleset } from "../src/ruleset/seed-catalog.js";

const prisma = new PrismaClient();

async function main() {
  // Zone-type → verdict mapping (GB-03 Gate 3 resolution + DO-013's AIP zone
  // types) — structural reference data, editable in the app later. Single
  // source of truth: src/zones/import.ts (the zone importer upserts the same
  // map, so seed order vs import order doesn't matter; upserts never clobber
  // in-app verdict edits).
  const { ZONE_TYPE_SEEDS } = await import("../src/zones/import.js");
  for (const [code, zt] of Object.entries(ZONE_TYPE_SEEDS)) {
    await prisma.zoneType.upsert({ where: { code }, update: {}, create: { code, ...zt } });
  }

  // Regulations Ruleset baseline (DO-010; GB-02 Gate 1 catalog).
  await seedRuleset(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
