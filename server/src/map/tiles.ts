// DO-012 — MBTiles tile store (FR-C1, GB-03 Gate 2).
// MBTiles is a SQLite file; we read it with a second PrismaClient pointed at
// the package via datasourceUrl + raw SQL. Prisma is the project's locked
// SQLite access layer — no new database dependency is introduced for this.
// The package itself (app-data/map/tiles.mbtiles) is a user-built artifact;
// with it absent this store reports "unavailable" and the client renders the
// instructive empty state — never a crash (acceptance criterion).
import * as fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/** Raster formats a Leaflet TileLayer can display (trigger 1: raster is the sanctioned baseline). */
const RASTER_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export interface TilesStatus {
  available: boolean;
  /** Why unavailable: no package file, or a non-raster (e.g. vector pbf) package. */
  reason?: "PACKAGE_MISSING" | "FORMAT_UNSUPPORTED";
  format?: string;
  minzoom?: number;
  maxzoom?: number;
  /** "west,south,east,north" per the MBTiles spec, when the package declares it. */
  bounds?: string;
  attribution?: string;
}

export interface Tile {
  data: Buffer;
  contentType: string;
}

export interface TileStore {
  status(): Promise<TilesStatus>;
  /** null = package has no tile at z/x/y (a plain 404 for Leaflet). Throws if the package is missing. */
  getTile(z: number, x: number, y: number): Promise<Tile | null>;
  close(): Promise<void>;
}

export class TilePackageMissingError extends Error {
  constructor() {
    super("Tile package missing");
  }
}

interface OpenPackage {
  client: PrismaClient;
  metadata: Map<string, string>;
  contentType: string;
}

export function createMbtilesStore(mbtilesFile: string): TileStore {
  let open: OpenPackage | null = null;

  async function openPackage(): Promise<OpenPackage | null> {
    // Existence is re-checked per call so the operator can drop the package in
    // (or replace it) without restarting the server.
    if (!fs.existsSync(mbtilesFile)) {
      if (open) {
        await open.client.$disconnect();
        open = null;
      }
      return null;
    }
    if (open) return open;

    const url = `file:${mbtilesFile.replaceAll("\\", "/")}`;
    const client = new PrismaClient({ datasourceUrl: url });
    const rows = await client.$queryRawUnsafe<{ name: string; value: string }[]>(
      "SELECT name, value FROM metadata",
    );
    const metadata = new Map(rows.map((r) => [r.name, r.value]));
    const format = (metadata.get("format") ?? "png").toLowerCase();
    open = {
      client,
      metadata,
      contentType: RASTER_CONTENT_TYPES[format] ?? "",
    };
    return open;
  }

  return {
    async status() {
      let pkg: OpenPackage | null;
      try {
        pkg = await openPackage();
      } catch {
        // Unreadable/corrupt file — treat as missing rather than crash.
        return { available: false, reason: "PACKAGE_MISSING" };
      }
      if (!pkg) return { available: false, reason: "PACKAGE_MISSING" };
      const format = (pkg.metadata.get("format") ?? "png").toLowerCase();
      if (!pkg.contentType) {
        return { available: false, reason: "FORMAT_UNSUPPORTED", format };
      }
      const num = (key: string): number | undefined => {
        const raw = pkg.metadata.get(key);
        const value = raw === undefined ? NaN : Number(raw);
        return Number.isFinite(value) ? value : undefined;
      };
      return {
        available: true,
        format,
        minzoom: num("minzoom"),
        maxzoom: num("maxzoom"),
        bounds: pkg.metadata.get("bounds"),
        attribution: pkg.metadata.get("attribution"),
      };
    },

    async getTile(z, x, y) {
      const pkg = await openPackage();
      if (!pkg || !pkg.contentType) throw new TilePackageMissingError();
      // MBTiles stores rows in TMS order; the XYZ y from Leaflet flips.
      const tmsRow = Math.pow(2, z) - 1 - y;
      const rows = await pkg.client.$queryRawUnsafe<{ tile_data: Buffer }[]>(
        "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1",
        z,
        x,
        tmsRow,
      );
      if (rows.length === 0) return null;
      return { data: Buffer.from(rows[0].tile_data), contentType: pkg.contentType };
    },

    async close() {
      if (open) {
        await open.client.$disconnect();
        open = null;
      }
    },
  };
}
