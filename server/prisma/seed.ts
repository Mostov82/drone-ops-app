// Seed scaffold (DO-002). Real seed data ships with DO-029 (GB-06);
// Ruleset baseline values ship with DO-010 (GB-02).
// Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Zone-type → verdict mapping (GB-03 Gate 3 resolution) — safe to seed now:
  // it is structural reference data, editable in the app later.
  const zoneTypes: { code: string; name: string; defaultVerdict: string }[] = [
    { code: "AIRPORT", name: "Airport / airfield buffer", defaultVerdict: "RESTRICTED" },
    { code: "BORDER_SECURITY", name: "Border / security zone", defaultVerdict: "RESTRICTED" },
    { code: "NATURE_RESERVE", name: "Nature reserve", defaultVerdict: "NEEDS_PERMIT" },
    { code: "POPULATED", name: "Populated-area buffer", defaultVerdict: "NEEDS_PERMIT" },
    { code: "OTHER", name: "Other", defaultVerdict: "NEEDS_PERMIT" },
  ];
  for (const zt of zoneTypes) {
    await prisma.zoneType.upsert({ where: { code: zt.code }, update: {}, create: zt });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
