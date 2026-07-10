// DO-012 — where the offline map artifacts live. Tile + DEM packages are
// user-downloaded one-time artifacts (README "Offline map & elevation data")
// and belong beside the DB in app-data/ (GB-01 Gate 3 pattern) — never in the
// repo.
import * as path from "node:path";
import { resolvePaths } from "../backup/service.js";

export interface MapPaths {
  /** app-data/map */
  mapDir: string;
  /** app-data/map/tiles.mbtiles — the Israel raster tile package */
  mbtilesFile: string;
  /** app-data/map/dem — Copernicus GLO-30 GeoTIFF tiles */
  demDir: string;
}

export function resolveMapPaths(appDataDir = resolvePaths().appDataDir): MapPaths {
  const mapDir = path.join(appDataDir, "map");
  return {
    mapDir,
    mbtilesFile: path.join(mapDir, "tiles.mbtiles"),
    demDir: path.join(mapDir, "dem"),
  };
}
