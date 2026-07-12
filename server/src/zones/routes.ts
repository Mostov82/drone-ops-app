// DO-014 — additive READ-ONLY zone routes (the consumer surface zones-api.md
// says DO-014/DO-015 add on top of DO-013's models; escalation trigger 3
// keeps this strictly read-only — the import pipeline stays the only writer).
// Mounted behind the PIN middleware in app.ts like every /api route.
//
// The map client styles zones by the verdict returned HERE, read at request
// time from ZoneType.defaultVerdict — the editable Gate 3 mapping. Editing a
// verdict in the DB changes the next fetch, with zero client code involved
// (the FR-C1 data-driven-styling acceptance criterion).
import { Router } from "express";
import { ApiError, sendApiError } from "../api-error.js";
import { prisma } from "../db.js";

/** MapLayer.source is a JSON provenance blob written by the importer. */
export interface LayerProvenance {
  title?: string;
  sourceFiles?: { path: string; sha256: string }[];
  aipUpdateStamp?: string;
  extractedAt?: string;
  extractionTools?: string[];
}

export interface ZoneLayerRecord {
  id: string;
  name: string;
  source: string;
  importedAt: Date;
  verified: boolean;
  zoneCount: number;
}

export interface ZoneRecord {
  id: string;
  name: string;
  geometryJson: string;
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  notes: string | null;
  zoneType: { code: string; name: string; defaultVerdict: string };
}

/** Read-only view over MapLayer/Zone — injectable for tests (helpers pattern). */
export interface ZonesReadStore {
  listLayers(): Promise<ZoneLayerRecord[]>;
  getLayer(id: string): Promise<ZoneLayerRecord | null>;
  listZones(mapLayerId: string): Promise<ZoneRecord[]>;
}

export function createPrismaZonesReadStore(): ZonesReadStore {
  return {
    async listLayers() {
      const layers = await prisma.mapLayer.findMany({
        include: { _count: { select: { zones: true } } },
        orderBy: { name: "asc" },
      });
      return layers.map((l) => ({
        id: l.id,
        name: l.name,
        source: l.source,
        importedAt: l.importedAt,
        verified: l.verified,
        zoneCount: l._count.zones,
      }));
    },
    async getLayer(id) {
      const l = await prisma.mapLayer.findUnique({
        where: { id },
        include: { _count: { select: { zones: true } } },
      });
      if (!l) return null;
      return {
        id: l.id,
        name: l.name,
        source: l.source,
        importedAt: l.importedAt,
        verified: l.verified,
        zoneCount: l._count.zones,
      };
    },
    async listZones(mapLayerId) {
      const zones = await prisma.zone.findMany({
        where: { mapLayerId },
        include: { zoneType: true },
        orderBy: { name: "asc" },
      });
      return zones.map((z) => ({
        id: z.id,
        name: z.name,
        geometryJson: z.geometryJson,
        floorAmslFt: z.floorAmslFt,
        ceilingAmslFt: z.ceilingAmslFt,
        notes: z.notes,
        zoneType: {
          code: z.zoneType.code,
          name: z.zoneType.name,
          defaultVerdict: z.zoneType.defaultVerdict,
        },
      }));
    },
  };
}

function parseProvenance(source: string): LayerProvenance {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (parsed && typeof parsed === "object") return parsed as LayerProvenance;
  } catch {
    // Fall through — pre-DO-013 layers could hold a plain string.
  }
  return { title: source };
}

function layerJson(layer: ZoneLayerRecord) {
  return {
    id: layer.id,
    name: layer.name,
    importedAt: layer.importedAt,
    verified: layer.verified,
    zoneCount: layer.zoneCount,
    provenance: parseProvenance(layer.source),
  };
}

function handleError(res: Parameters<typeof sendApiError>[0], err: unknown): void {
  if (err instanceof ApiError) {
    sendApiError(res, err);
    return;
  }
  sendApiError(
    res,
    new ApiError(500, "ZONES_INTERNAL", {
      en: "Zone data read failed.",
      he: "קריאת נתוני האזורים נכשלה.",
    }),
  );
}

export function createZonesRouter(store: ZonesReadStore = createPrismaZonesReadStore()) {
  const router = Router();

  /** Layer catalog with provenance — feeds toggles + staleness/unverified UI. */
  router.get("/layers", async (_req, res) => {
    try {
      const layers = await store.listLayers();
      res.json({ layers: layers.map(layerJson) });
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * One layer's zones as a GeoJSON FeatureCollection. Geometry is passed
   * through EXACTLY as imported (no simplification — precision is
   * safety-critical, decision-logged); verdict comes from the live ZoneType
   * mapping at request time.
   */
  router.get("/layers/:id/geojson", async (req, res) => {
    try {
      const layer = await store.getLayer(req.params.id);
      if (!layer) {
        sendApiError(
          res,
          new ApiError(404, "ZONES_LAYER_NOT_FOUND", {
            en: "No zone layer with this id.",
            he: "אין שכבת אזורים עם מזהה זה.",
          }),
        );
        return;
      }
      const zones = await store.listZones(layer.id);
      res.json({
        layer: layerJson(layer),
        geojson: {
          type: "FeatureCollection",
          features: zones.map((z) => ({
            type: "Feature",
            properties: {
              id: z.id,
              name: z.name,
              zoneTypeCode: z.zoneType.code,
              zoneTypeName: z.zoneType.name,
              verdict: z.zoneType.defaultVerdict,
              floorAmslFt: z.floorAmslFt,
              ceilingAmslFt: z.ceilingAmslFt,
              notes: z.notes,
            },
            geometry: JSON.parse(z.geometryJson) as unknown,
          })),
        },
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}
