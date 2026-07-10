// DO-012 — map + elevation routes (FR-C1, FR-C5). Mounted behind the PIN
// middleware in app.ts like every /api route; Leaflet's tile <img> requests
// carry the same-origin session cookie, so the gate holds for tiles too.
import { Router, type Response } from "express";
import { ApiError, sendApiError } from "../api-error.js";
import { crosscheckElevation, type FetchLike } from "./crosscheck.js";
import { createDemService, type DemService } from "./dem.js";
import { resolveMapPaths } from "./paths.js";
import { createMbtilesStore, TilePackageMissingError, type TileStore } from "./tiles.js";

export interface MapRouterDeps {
  tileStore?: TileStore;
  demService?: DemService;
  crosscheckFetch?: FetchLike;
}

function tilePackageMissingApiError(): ApiError {
  return new ApiError(503, "TILE_PACKAGE_MISSING", {
    en: "No offline tile package installed. Follow the README's one-time map setup.",
    he: "לא מותקנת חבילת אריחי מפה לשימוש לא מקוון. יש לבצע את הגדרת המפה החד-פעמית המתועדת ב-README.",
  });
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof ApiError) {
    sendApiError(res, err);
    return;
  }
  sendApiError(
    res,
    new ApiError(500, "MAP_INTERNAL", {
      en: "Map operation failed.",
      he: "פעולת המפה נכשלה.",
    }),
  );
}

function badRequest(detail: string): ApiError {
  return new ApiError(400, "MAP_BAD_REQUEST", {
    en: `Invalid request: ${detail}.`,
    he: `בקשה שגויה: ${detail}.`,
  });
}

/** Parse an integer path segment; null when malformed. */
function intSegment(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function parseLatLng(query: Record<string, unknown>): { lat: number; lng: number } {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw badRequest("lat and lng query parameters are required numbers");
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw badRequest("lat/lng out of range");
  }
  return { lat, lng };
}

export function createMapRouter(deps: MapRouterDeps = {}) {
  const paths = resolveMapPaths();
  const tiles = deps.tileStore ?? createMbtilesStore(paths.mbtilesFile);
  const dem = deps.demService ?? createDemService(paths.demDir);
  const router = Router();

  // One status call tells the client which empty states to render.
  router.get("/status", async (_req, res) => {
    try {
      res.json({ tiles: await tiles.status(), dem: await dem.status() });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/tiles/:z/:x/:y", async (req, res) => {
    const z = intSegment(req.params.z);
    const x = intSegment(req.params.x);
    const y = intSegment(req.params.y);
    if (z === null || x === null || y === null || z > 22 || x >= 2 ** (z ?? 0) || y >= 2 ** (z ?? 0)) {
      sendApiError(res, badRequest("tile coordinates must be integers within the zoom range"));
      return;
    }
    try {
      const tile = await tiles.getTile(z, x, y);
      if (!tile) {
        // A hole in the package is a plain 404 — Leaflet just leaves it blank.
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", tile.contentType);
      // Package content only changes when the operator replaces the file.
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(tile.data);
    } catch (err) {
      if (err instanceof TilePackageMissingError) {
        sendApiError(res, tilePackageMissingApiError());
        return;
      }
      handleError(res, err);
    }
  });

  router.get("/elevation", async (req, res) => {
    try {
      const { lat, lng } = parseLatLng(req.query as Record<string, unknown>);
      res.json(await dem.lookup(lat, lng));
    } catch (err) {
      handleError(res, err);
    }
  });

  // Explicit user action only — never called automatically (offline-first).
  router.get("/elevation/crosscheck", async (req, res) => {
    try {
      const { lat, lng } = parseLatLng(req.query as Record<string, unknown>);
      res.json(await crosscheckElevation(lat, lng, deps.crosscheckFetch));
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}
