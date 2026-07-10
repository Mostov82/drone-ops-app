// DO-012 — offline elevation lookup (FR-C5) from Copernicus GLO-30 GeoTIFF
// tiles in app-data/map/dem/ (one-time documented download, README).
// Reads use the pre-approved `geotiff` library (intent doc context notes).
// Fail-closed like the Ruleset: a missing DEM raises a structured error —
// never a default elevation (acceptance criterion; mirrors GB-02 Gate 1).
// Every successful result is flagged approximate — GLO-30 is a ~30 m surface
// model, ~±4 m vertical (decision log 2026-07-10); DO-015 rounds conservatively.
import * as fs from "node:fs";
import * as path from "node:path";
import { fromFile, type GeoTIFF, type GeoTIFFImage } from "geotiff";
import { ApiError } from "../api-error.js";

export interface ElevationResult {
  elevationM: number;
  /** Always true: surface-model data, never survey-grade (FR-C5). */
  approximate: true;
  source: "copernicus-glo30-dem";
  /** Horizontal grid resolution of the source raster, meters (approximate). */
  resolutionM: 30;
}

export interface DemStatus {
  available: boolean;
  tileCount: number;
}

export interface DemService {
  status(): Promise<DemStatus>;
  /** Throws ApiError DEM_NOT_AVAILABLE (503) / DEM_OUT_OF_COVERAGE (404). */
  lookup(lat: number, lng: number): Promise<ElevationResult>;
  close(): Promise<void>;
}

export function demNotAvailableError(): ApiError {
  return new ApiError(503, "DEM_NOT_AVAILABLE", {
    en: "No elevation data installed. Follow the README's one-time DEM download to enable elevation.",
    he: "לא מותקנים נתוני גובה פני קרקע. יש לבצע את הורדת ה-DEM החד-פעמית המתועדת ב-README.",
  });
}

export function demOutOfCoverageError(): ApiError {
  return new ApiError(404, "DEM_OUT_OF_COVERAGE", {
    en: "The point is outside the installed elevation tiles.",
    he: "הנקודה נמצאת מחוץ לאריחי הגובה המותקנים.",
  });
}

interface OpenDemTile {
  file: string;
  tiff: GeoTIFF;
  image: GeoTIFFImage;
  /** [west, south, east, north] in degrees. */
  bbox: [number, number, number, number];
  width: number;
  height: number;
  noData: number | null;
}

export function createDemService(demDir: string): DemService {
  const openTiles = new Map<string, OpenDemTile>();

  function listTifFiles(): string[] {
    if (!fs.existsSync(demDir)) return [];
    return fs
      .readdirSync(demDir)
      .filter((f) => /\.tiff?$/i.test(f))
      .sort();
  }

  async function openTile(file: string): Promise<OpenDemTile | null> {
    const cached = openTiles.get(file);
    if (cached) return cached;
    try {
      const tiff = await fromFile(path.join(demDir, file));
      const image = await tiff.getImage();
      const bbox = image.getBoundingBox() as [number, number, number, number];
      const noDataRaw = image.getGDALNoData();
      const tile: OpenDemTile = {
        file,
        tiff,
        image,
        bbox,
        width: image.getWidth(),
        height: image.getHeight(),
        noData: noDataRaw === null ? null : Number(noDataRaw),
      };
      openTiles.set(file, tile);
      return tile;
    } catch {
      // Not a readable GeoTIFF — skip it rather than take the service down.
      return null;
    }
  }

  async function findCoveringTile(lat: number, lng: number): Promise<OpenDemTile | null> {
    for (const file of listTifFiles()) {
      const tile = await openTile(file);
      if (!tile) continue;
      const [west, south, east, north] = tile.bbox;
      if (lng >= west && lng < east && lat > south && lat <= north) return tile;
    }
    return null;
  }

  return {
    async status() {
      const files = listTifFiles();
      return { available: files.length > 0, tileCount: files.length };
    },

    async lookup(lat, lng) {
      const files = listTifFiles();
      if (files.length === 0) throw demNotAvailableError();
      const tile = await findCoveringTile(lat, lng);
      if (!tile) throw demOutOfCoverageError();

      const [west, south, east, north] = tile.bbox;
      // Fractional pixel position relative to pixel CENTERS (0.5 offset:
      // raster space treats a pixel's value as sitting at its center).
      const px = ((lng - west) / (east - west)) * tile.width - 0.5;
      const py = ((north - lat) / (north - south)) * tile.height - 0.5;
      const x0 = Math.min(Math.max(Math.floor(px), 0), tile.width - 1);
      const y0 = Math.min(Math.max(Math.floor(py), 0), tile.height - 1);
      const x1 = Math.min(x0 + 1, tile.width - 1);
      const y1 = Math.min(y0 + 1, tile.height - 1);

      const raster = await tile.image.readRasters({
        window: [x0, y0, x1 + 1, y1 + 1],
        samples: [0],
      });
      const band = raster[0] as ArrayLike<number>;
      const cols = x1 - x0 + 1;
      const sample = (x: number, y: number): number => {
        const v = Number(band[(y - y0) * cols + (x - x0)]);
        return tile.noData !== null && v === tile.noData ? NaN : v;
      };

      // Bilinear interpolation over the 2×2 neighborhood; invalid (no-data)
      // corners drop out of the weighting.
      const fx = Math.min(Math.max(px - x0, 0), 1);
      const fy = Math.min(Math.max(py - y0, 0), 1);
      const corners: Array<{ v: number; w: number }> = [
        { v: sample(x0, y0), w: (1 - fx) * (1 - fy) },
        { v: sample(x1, y0), w: fx * (1 - fy) },
        { v: sample(x0, y1), w: (1 - fx) * fy },
        { v: sample(x1, y1), w: fx * fy },
      ];
      let weight = 0;
      let sum = 0;
      for (const c of corners) {
        if (Number.isFinite(c.v)) {
          sum += c.v * c.w;
          weight += c.w;
        }
      }
      if (weight === 0) throw demOutOfCoverageError();

      return {
        elevationM: Math.round((sum / weight) * 10) / 10,
        approximate: true,
        source: "copernicus-glo30-dem",
        resolutionM: 30,
      };
    },

    async close() {
      for (const tile of openTiles.values()) {
        // geotiff keeps a file handle per source; close() releases it.
        await tile.tiff.close();
      }
      openTiles.clear();
    },
  };
}
