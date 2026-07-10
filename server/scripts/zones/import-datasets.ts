// DO-013 — zone dataset import CLI (npm run zones:import -w server).
//
// Imports every importable dataset under data-sources/zones/ into the local
// database (MapLayer + Zone rows, verified=false, clean replace-on-reimport).
// Buffer radii for gap-filler datasets come from the Ruleset read API —
// fail-closed; a missing/unset rule aborts that dataset (never a constant).
//
// Usage:
//   npm run zones:import -w server              # all importable datasets
//   npm run zones:import -w server -- <dir>     # one dataset directory

import * as path from "node:path";
import { prisma } from "../../src/db.js";
import { createPrismaRulesetStore, createRulesetReader } from "../../src/ruleset/service.js";
import { importAllDatasets, importDataset } from "../../src/zones/import.js";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const zonesRoot = path.join(repoRoot, "data-sources", "zones");

async function main() {
  const deps = {
    prisma,
    rulesetReader: createRulesetReader(createPrismaRulesetStore()),
  };
  const target = process.argv[2];
  const results = target
    ? [await importDataset(path.resolve(target), deps)]
    : await importAllDatasets(zonesRoot, deps);
  for (const r of results) {
    console.log(
      `${r.layerKey}: ${r.zonesImported} zones ${r.replacedExisting ? "(replaced existing layer)" : "(new layer)"} — verified=false`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
