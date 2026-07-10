# Offline map & elevation — API contract (DO-012)

**Consumers:** the map page (this ticket), DO-014 (zone overlays draw on this map), and **DO-015 (vertical-separation engine — the elevation endpoint is its AGL↔AMSL input)**. All routes sit behind the PIN middleware like every `/api` route.

Artifacts these routes serve are **user-installed, one-time downloads** (README → "Offline map & elevation data"): the tile package at `app-data/map/tiles.mbtiles` and Copernicus GLO-30 GeoTIFF tiles in `app-data/map/dem/`. Neither ships in the repo. Both are re-checked per request — dropping the files in place needs no server restart.

## `GET /api/map/status`

One call tells a client which empty states to render.

```json
{
  "tiles": { "available": true, "format": "png", "minzoom": 0, "maxzoom": 14,
             "bounds": "34.2,29.4,35.9,33.4", "attribution": "…" },
  "dem":   { "available": true, "tileCount": 10 }
}
```

When unavailable: `tiles: { available: false, reason: "PACKAGE_MISSING" | "FORMAT_UNSUPPORTED" }` (the latter when the package holds vector `pbf` tiles — only raster packages are served; trigger 1 keeps Leaflet's raster `TileLayer` the baseline), `dem: { available: false, tileCount: 0 }`.

## `GET /api/map/tiles/:z/:x/:y`

Raster tile in XYZ addressing (the TMS y-flip to MBTiles rows happens server-side). Responses:

| Status | Meaning |
|---|---|
| 200 | Tile bytes, `Content-Type` per the package's `format` (png/jpg/webp) |
| 404 (empty body) | Package installed but has no tile there — Leaflet leaves it blank |
| 503 `TILE_PACKAGE_MISSING` | No package installed (structured, bilingual) |
| 400 `MAP_BAD_REQUEST` | Malformed z/x/y |

## `GET /api/map/elevation?lat=…&lng=…` — the DO-015 contract

Offline lookup from the local Copernicus GLO-30 DEM (bilinear over the 2×2 pixel neighborhood).

```json
{ "elevationM": 754.3, "approximate": true, "source": "copernicus-glo30-dem", "resolutionM": 30 }
```

**Semantics DO-015 must honor:**

1. **`approximate` is always `true` and must be surfaced.** GLO-30 is a ~30 m *surface* model (~±4 m vertical, decision log 2026-07-10 — it measures canopy/rooftops, not bare ground). Any UI showing this value or a verdict derived from it renders the approximate marker (client: `components/map/ApproximateBadge.tsx`, the sibling of DO-010's `UnverifiedBadge`); vertical-separation math **rounds conservatively**.
2. **Fail-closed, like the Ruleset read API.** Errors are structured and bilingual; there is **never a default elevation**. A missing DEM must abort the computation that needed it — never catch-and-default (mirrors `ruleset-api.md` consumer obligation 1).

| Status | Code | When |
|---|---|---|
| 503 | `DEM_NOT_AVAILABLE` | No DEM tiles installed |
| 404 | `DEM_OUT_OF_COVERAGE` | Point outside the installed tiles |
| 400 | `MAP_BAD_REQUEST` | Missing/malformed/out-of-range lat/lng |

3. **Units:** meters AMSL (EGM2008 geoid, as published by Copernicus). Altitude bands in zone data are ft AMSL as the AIP publishes them — conversion is display/consumer-side.

## `GET /api/map/elevation/crosscheck?lat=…&lng=…` — optional, online

Explicit-user-action only; the app never calls it automatically (offline-first, NFR-1). Provider: **Open Topo Data public instance** (`api.opentopodata.org`, dataset `srtm30m`) — free, **keyless** (trigger 5), limits 1 call/sec and 1,000 calls/day, fine for a manual spot check. No keyless public API serves GLO-30 itself, so this is an **independent-dataset sanity check** (SRTM 30 m vs. GLO-30), not same-source verification.

```json
{ "elevationM": 812.25, "approximate": true, "provider": "Open Topo Data (srtm30m)" }
```

Failure (offline, timeout ≤ 8 s, provider error): 502 `CROSSCHECK_FAILED`, structured — the offline lookup remains authoritative and the app remains fully functional without this route.
