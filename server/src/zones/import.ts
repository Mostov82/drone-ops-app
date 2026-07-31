// DO-013 — zone dataset import pipeline (FR-C4).
//
// Reads a generated dataset directory (manifest.json + zones.geojson) from
// data-sources/zones/ and loads it into the database:
//   MapLayer (name = manifest.layerKey, provenance in `source`,
//   verified = false — Jonathan's visual check is GB-06 Gate 3)
//   + one Zone row per feature (type, geometry, altitude band, notes).
//
// Re-import REPLACES the layer's zones atomically (same layerKey ⇒ the old
// rows are deleted in the same transaction; no orphans).
//
// Gap-filler datasets (point + bufferRuleKey) get their buffer radius from the
// Ruleset read API at import time — never a constant (conventions §4). The
// reader fails closed; a missing rule aborts that dataset's import (trigger 4).
//
// This pipeline is invoked via `npm run zones:import -w server`
// (server/scripts/zones/import-datasets.ts). It deliberately has NO HTTP
// route in DO-013 — server/src/app.ts belongs to DO-012 this cycle; a
// consumer-facing route is DO-014/DO-015 work (see server/docs/zones-api.md).

import * as fs from "node:fs";
import * as path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { RulesetReader } from "../ruleset/service.js";
import type { DatasetManifest, ZoneFeatureCollection } from "./dataset.js";
import { circlePolygon } from "./geometry.js";

/**
 * ZoneType rows the importer may create (upsert-with-empty-update: existing
 * rows — and any human edits to verdicts — are never overwritten).
 * Default verdicts derive from the GB-03 Gate 3 three-tier mapping,
 * conservatively extended to the AIP types: prohibited/restricted/danger and
 * the drone-specific LLU closures are no-go. The mapping is editable data;
 * revising it belongs to Jonathan (intent doc OUT list).
 */
export const ZONE_TYPE_SEEDS: Record<string, { name: string; defaultVerdict: string }> = {
  // GB-03 Gate 3 resolution (2026-07-07) — also seeded by prisma/seed.ts,
  // which imports this map so the mapping lives in exactly one place:
  AIRPORT: { name: "Airport / airfield buffer", defaultVerdict: "RESTRICTED" },
  BORDER_SECURITY: { name: "Border / security zone", defaultVerdict: "RESTRICTED" },
  NATURE_RESERVE: { name: "Nature reserve", defaultVerdict: "NEEDS_PERMIT" },
  POPULATED: { name: "Populated-area buffer", defaultVerdict: "NEEDS_PERMIT" },
  OTHER: { name: "Other", defaultVerdict: "NEEDS_PERMIT" },
  // DO-013 additions for the AIP datasets (conservative Gate 3 extension —
  // prohibited/restricted/danger and the drone-specific LLU closures are
  // no-go; the mapping is editable data and revising it is Jonathan's):
  AIP_PROHIBITED: { name: "AIP prohibited area (LLP)", defaultVerdict: "RESTRICTED" },
  AIP_RESTRICTED: { name: "AIP restricted area (LLR)", defaultVerdict: "RESTRICTED" },
  AIP_DANGER: { name: "AIP danger area (LLD)", defaultVerdict: "RESTRICTED" },
  LLU_DRONE: { name: "AIP drone no-fly zone (LLU, MTOW<25kg)", defaultVerdict: "RESTRICTED" },
  // Trigger 6 resolved (option A, DECISION 2026-07-11) — lanes import as
  // Zone rows with the min/max envelope band. RESTRICTED is the conservative
  // editable default; DO-015's vertical-separation logic refines the verdict
  // using the altitude band.
  CVFR_LANE: { name: "CVFR flight lane (low transport route)", defaultVerdict: "RESTRICTED" },
  // DO-036 findings checkpoint (DECISION 2026-07-19) — TLV_FIR controlled
  // airspace: all three classes RESTRICTED (editable). CTA gets NO overhead
  // advisory — the vertical ruling stays lanes-only.
  CTR: { name: "Control zone (CTR)", defaultVerdict: "RESTRICTED" },
  ATZ: { name: "Aerodrome traffic zone (ATZ)", defaultVerdict: "RESTRICTED" },
  CTA: { name: "Control area (CTA)", defaultVerdict: "RESTRICTED" },
};

export interface ImportResult {
  layerKey: string;
  layerId: string;
  zonesImported: number;
  replacedExisting: boolean;
}

export interface ImportDeps {
  prisma: PrismaClient;
  /** Required only for datasets that generate buffers from Ruleset values. */
  rulesetReader?: RulesetReader;
  now?: () => Date;
}

interface PointBufferProperties {
  code: string;
  nameHe: string | null;
  nameEn: string | null;
  zoneTypeCode: string;
  /** Ruleset key for the buffer radius; unit must be km or m. */
  bufferRuleKey: string;
  notes: string | null;
}

export async function importDataset(datasetDir: string, deps: ImportDeps): Promise<ImportResult> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(datasetDir, "manifest.json"), "utf8"),
  ) as DatasetManifest;

  if (!manifest.importable) {
    throw new Error(
      `Dataset ${manifest.layerKey} is marked importable=false (pending human decision — see its reconciliation report). Refusing to import.`,
    );
  }

  const collection = JSON.parse(
    fs.readFileSync(path.join(datasetDir, "zones.geojson"), "utf8"),
  ) as ZoneFeatureCollection;

  const now = deps.now ? deps.now() : new Date();
  const prisma = deps.prisma;

  // Resolve zone rows OUTSIDE the transaction (may hit the Ruleset reader).
  const rows: {
    name: string;
    zoneTypeCode: string;
    geometryJson: string;
    floorAmslFt: number | null;
    ceilingAmslFt: number | null;
    notes: string | null;
  }[] = [];

  for (const feature of collection.features) {
    const props = feature.properties;
    let geometry = feature.geometry;
    let notes = props.notes;

    if (geometry && (geometry as { type?: string }).type === "Point" && "bufferRuleKey" in props) {
      // Gap-filler: buffer radius from the Ruleset AT IMPORT TIME (fail-closed).
      if (!deps.rulesetReader) {
        throw new Error(
          `Dataset ${manifest.layerKey} needs a Ruleset reader for bufferRuleKey lookups — none provided`,
        );
      }
      const bufferProps = props as unknown as PointBufferProperties;
      const rule = await deps.rulesetReader.getNumberRule(bufferProps.bufferRuleKey); // throws RulesetError → aborts import
      const radiusM =
        rule.unit === "km" ? rule.value * 1000 : rule.unit === "m" ? rule.value : null;
      if (radiusM === null) {
        throw new Error(
          `Ruleset rule ${bufferProps.bufferRuleKey} has unit ${JSON.stringify(rule.unit)} — expected km or m; aborting import (no unit guessing)`,
        );
      }
      const [lng, lat] = (geometry as { coordinates: [number, number] }).coordinates;
      geometry = circlePolygon(lat, lng, radiusM);
      notes = [
        notes,
        `buffer generated at import: ${rule.value} ${rule.unit} from Ruleset rule ${bufferProps.bufferRuleKey}${rule.lastVerifiedAt ? "" : " (rule unverified)"}`,
      ]
        .filter(Boolean)
        .join(" | ");
    }

    const displayName = [props.code, props.nameHe ?? props.nameEn].filter(Boolean).join(" — ");
    rows.push({
      name: displayName,
      zoneTypeCode: props.zoneTypeCode,
      geometryJson: JSON.stringify(geometry),
      floorAmslFt: props.floorAmslFt ?? null,
      ceilingAmslFt: props.ceilingAmslFt ?? null,
      notes: props.aglCeilingFt !== null && props.aglCeilingFt !== undefined
        ? [notes, `aglCeilingFt=${props.aglCeilingFt}`].filter(Boolean).join(" | ")
        : notes,
    });
  }

  // Zone types: upsert with empty update — never clobbers verdict edits.
  const zoneTypeIds = new Map<string, string>();
  for (const code of new Set(rows.map((r) => r.zoneTypeCode))) {
    const seed = ZONE_TYPE_SEEDS[code];
    const existing = await prisma.zoneType.findUnique({ where: { code } });
    if (existing) {
      zoneTypeIds.set(code, existing.id);
    } else if (seed) {
      const created = await prisma.zoneType.create({ data: { code, ...seed } });
      zoneTypeIds.set(code, created.id);
    } else {
      throw new Error(
        `Dataset ${manifest.layerKey} references unknown ZoneType ${JSON.stringify(code)} with no seed definition — aborting`,
      );
    }
  }

  const provenance = JSON.stringify({
    title: manifest.title,
    sourceFiles: manifest.sourceFiles,
    aipUpdateStamp: manifest.aipUpdateStamp,
    extractedAt: manifest.extractedAt,
    extractionTools: manifest.extractionTools,
  });

  // Atomic replace: delete-old + upsert-layer + insert-new in one transaction.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.mapLayer.findFirst({ where: { name: manifest.layerKey } });
    let layerId: string;
    if (existing) {
      await tx.zone.deleteMany({ where: { mapLayerId: existing.id } });
      await tx.mapLayer.update({
        where: { id: existing.id },
        data: { source: provenance, importedAt: now, verified: false },
      });
      layerId = existing.id;
    } else {
      const created = await tx.mapLayer.create({
        data: { name: manifest.layerKey, source: provenance, importedAt: now, verified: false },
      });
      layerId = created.id;
    }

    for (const row of rows) {
      await tx.zone.create({
        data: {
          name: row.name,
          zoneTypeId: zoneTypeIds.get(row.zoneTypeCode)!,
          mapLayerId: layerId,
          geometryJson: row.geometryJson,
          floorAmslFt: row.floorAmslFt,
          ceilingAmslFt: row.ceilingAmslFt,
          notes: row.notes,
        },
      });
    }

    return {
      layerKey: manifest.layerKey,
      layerId,
      zonesImported: rows.length,
      replacedExisting: Boolean(existing),
    };
  });
}

/** Import every importable dataset directory under data-sources/zones/. */
export async function importAllDatasets(zonesRoot: string, deps: ImportDeps): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const skipped: string[] = [];
  for (const dir of fs.readdirSync(zonesRoot, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith(".") || dir.name.startsWith("_")) continue;
    const datasetDir = path.join(zonesRoot, dir.name);
    if (!fs.existsSync(path.join(datasetDir, "manifest.json"))) continue;
    const manifest = JSON.parse(
      fs.readFileSync(path.join(datasetDir, "manifest.json"), "utf8"),
    ) as DatasetManifest;
    if (!manifest.importable) {
      skipped.push(manifest.layerKey);
      continue;
    }
    results.push(await importDataset(datasetDir, deps));
  }
  if (skipped.length > 0) {
    console.warn(`Skipped non-importable dataset(s): ${skipped.join(", ")} (pending human decisions)`);
  }
  return results;
}
