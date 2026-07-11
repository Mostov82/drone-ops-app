// DO-015 — read-only data seam for the verdict engine.
//
// Same storage-seam pattern as ruleset/service.ts: production is
// Prisma-backed; tests inject an in-memory implementation built from
// fixtures. The engine only ever READS zone data (modifying importers,
// datasets, or verdict-mapping values is out of scope — intent doc OUT list).

export interface VerdictLayer {
  id: string;
  name: string;
  importedAt: Date;
  /** Jonathan's ב'-08 visual check (GB-06 Gate 3). False = unverified data. */
  verified: boolean;
}

export interface VerdictZone {
  id: string;
  name: string;
  zoneTypeCode: string;
  zoneTypeName: string;
  /** Editable Gate 3 mapping — read at check time, never cached or constant. */
  defaultVerdict: string;
  /** GeoJSON geometry, WGS-84 [lng, lat]. */
  geometryJson: string;
  /** ft AMSL exactly as published; null = not published (zones-api.md). */
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  notes: string | null;
  mapLayerId: string | null;
}

export interface VerdictDataStore {
  listLayers(): Promise<VerdictLayer[]>;
  listZones(): Promise<VerdictZone[]>;
}

export function createPrismaVerdictStore(): VerdictDataStore {
  return {
    async listLayers() {
      const { prisma } = await import("../db.js");
      const layers = await prisma.mapLayer.findMany({ orderBy: { name: "asc" } });
      return layers.map((l) => ({
        id: l.id,
        name: l.name,
        importedAt: l.importedAt,
        verified: l.verified,
      }));
    },
    async listZones() {
      const { prisma } = await import("../db.js");
      const zones = await prisma.zone.findMany({
        include: { zoneType: true },
        orderBy: { name: "asc" },
      });
      return zones.map((z) => ({
        id: z.id,
        name: z.name,
        zoneTypeCode: z.zoneType.code,
        zoneTypeName: z.zoneType.name,
        defaultVerdict: z.zoneType.defaultVerdict,
        geometryJson: z.geometryJson,
        floorAmslFt: z.floorAmslFt,
        ceilingAmslFt: z.ceilingAmslFt,
        notes: z.notes,
        mapLayerId: z.mapLayerId,
      }));
    },
  };
}
