# Drone Operations App

A locally run, offline-capable web app for drone operators in Israel: compliance tracking, fleet
registry, airspace checks, pre-flight checklists, maintenance, and flight logs.

## Prerequisites

- **Node.js ≥ 20** (npm included)

## Setup

```
npm install
```

## Commands (from repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Starts client (Vite, http://localhost:5173) and server (Express, http://127.0.0.1:3001) together |
| `npm run test` | Runs Vitest suites in both packages |
| `npm run lint` | ESLint over both packages |
| `npm run typecheck` | Strict TypeScript check, both packages |

The client proxies `/api/*` to the server in dev. The server binds to `127.0.0.1` only — this is a
local, single-machine app by design.

## Layout

```
client/   React + Vite + TypeScript, Tailwind CSS + shadcn/ui
server/   Node + Express + TypeScript
```

## Data & backup

All app data lives in `app-data/` at the repo root (gitignored): the SQLite database
(`drone-ops.db`) and the document vault (`documents/`). This single directory is the unit of
backup.

**Backup** (Settings → Backup): enter a destination folder → the app writes a timestamped
`drone-ops-backup_YYYY-MM-DD_HHmm.zip` containing a consistent DB snapshot (safe while the app
runs), all documents, and a manifest recording the schema migration state.

**Restore** (Settings → Restore): enter an archive path → explicit confirmation → **all current
data is replaced** by the archive's contents and the app reloads. Restore refuses archives whose
schema state doesn't match the running app (protects against version drift). Restores are
full-replacement — there is no merge.

**Documents:** uploaded files are stored by the app under `app-data/documents/<entity-type>/<uuid>.<ext>`
with their metadata in the database. Allowed types: PDF, PNG, JPG; size limit 25 MB per file.
Files and metadata are created and deleted together — never move or delete files in
`app-data/documents/` by hand.

## Airspace zone data (DO-013)

Zone datasets (AIP prohibited/restricted/danger areas, drone-specific LLU
closures, OSM airport buffer anchors) are generated from the read-only source
snapshots in `data-sources/aip/` + `data-sources/gis/` and committed under
`data-sources/zones/` with per-dataset provenance manifests and reconciliation
reports.

These datasets are loaded and updated in the database **automatically on server boot**
if they are missing or if the source files are newer than the imported layer.
Manual re-imports (e.g. for development) can still be run via:

```
npm run zones:import -w server
```

Re-importing a dataset replaces its layer cleanly. Airport buffer radii are
read from the Regulations Ruleset at import time. **All imported layers are `verified=false`** until visually
verified against the official charts (release blocker, GB-06 Gate 3) — the
data is operator-maintained information, not an authoritative airspace source.
See `server/docs/zones-api.md` (consumer contract + regeneration steps) and
`data-sources/zones/README.md` (dataset inventory).

## Offline map & elevation data (optional setup / field mode)

The Airspace map runs in two modes:
1. **Online mode (default fallback):** If an internet connection is available, the map automatically loads OpenTopoMap topographic tiles (free, keyless).
2. **Offline mode (recommended for field use):** For reliability in areas with no internet connection, you can install the offline map tile package. When the offline package is present, the app always uses it automatically.

Install the offline packages under `app-data/map/` (gitignored, like all app data). The app re-checks for them on every request — drop the files in place and the map will automatically load them (or press "Check again" on the Map page); no restart needed. To **replace or remove** an already-installed package, stop the app first (Windows keeps the files locked while they are in use).

| File | What it is |
|---|---|
| `app-data/map/tiles.mbtiles` | Raster map tiles of Israel (zoom 0–14), built once from an OpenStreetMap extract |
| `app-data/map/dem/*.tif` | Copernicus GLO-30 elevation tiles (GeoTIFF), downloaded once |

> **Licensing note:** never bulk-download tiles from `tile.openstreetmap.org` — the OSM tile
> usage policy prohibits it and blocks offenders. The steps below render tiles locally from a
> Geofabrik data extract, which the ODbL license fully permits (with attribution, which the app
> shows on the map).

### 1. Map tiles (`tiles.mbtiles`)

One-time build on this computer, ~1–3 hours mostly unattended. Primary path — **QGIS** (free,
no Docker):

1. Download the OSM extract (~115 MB):
   <https://download.geofabrik.de/asia/israel-and-palestine-latest.osm.pbf>
2. Install **QGIS LTR** (free): <https://qgis.org>
3. Convert the extract to a GeoPackage once (from the **OSGeo4W Shell** installed with QGIS):

   ```
   ogr2ogr -f GPKG israel.gpkg israel-and-palestine-latest.osm.pbf
   ```

4. In QGIS, open `israel.gpkg` (drag it in; add the `multipolygons`, `lines`, `points` layers in
   that order) and style them as a basemap. Ready-made styling guides:
   <https://docs.mapeo.app/complete-reference-guide/customization-options/custom-base-maps/creating-custom-maps/creating-mbtiles>
   and <https://jacopofarina.eu/posts/static-maps-part-1-qgis-raster/>
5. Processing Toolbox → **Raster tools → Generate XYZ tiles (MBTiles)**:
   extent = the map canvas (framed on Israel), zoom **0 to 14**, format **PNG**, tile size 256.
   Save the output as `app-data/map/tiles.mbtiles`.
   Tip: test with zoom 0–8 first (minutes) to check the styling before the full 0–14 run.

Fallback path (better cartography, more moving parts — Docker Desktop with WSL2 required):
build vector tiles with [tilemaker](https://github.com/systemed/tilemaker)
(`tilemaker israel-and-palestine-latest.osm.pbf --output israel.mbtiles`), serve them rendered
with `docker run --rm -v ${PWD}:/data -p 8080:8080 maptiler/tileserver-gl`, then capture
`http://localhost:8080/styles/<style>/{z}/{x}/{y}.png` for the Israel extent into an MBTiles
atlas with [MOBAC](https://mobac.sourceforge.io/) (custom XML map source pointing at
**localhost only**).

### 2. Elevation data (Copernicus GLO-30 DEM)

Ten 1°×1° GeoTIFF tiles cover Israel (~300 MB total), served from the public AWS Open Data
bucket.

These files are **downloaded automatically by the app in the background** on boot if they are missing and internet connectivity is available. Progress and status can be tracked directly in the app.

For offline setup or pre-downloading before first launch, you can run the following PowerShell script from the repo root:

```powershell
New-Item -ItemType Directory -Force app-data\map\dem
$tiles = "N29_00_E034_00","N29_00_E035_00","N30_00_E034_00","N30_00_E035_00",
         "N31_00_E034_00","N31_00_E035_00","N32_00_E034_00","N32_00_E035_00",
         "N33_00_E034_00","N33_00_E035_00"
foreach ($t in $tiles) {
  $n = "Copernicus_DSM_COG_10_${t}_DEM"
  Invoke-WebRequest "https://copernicus-dem-30m.s3.amazonaws.com/$n/$n.tif" -OutFile "app-data\map\dem\$n.tif"
}
```

Elevation lookups then work offline (values are ~30 m grid, typically ±4 m — the app always
marks them **approximate**). The optional "Cross-check online" button on the Map page queries the
free, keyless Open Topo Data public API (SRTM 30 m; limits: 1 call/sec, 1,000 calls/day) and is
never called automatically.

Copernicus DEM license: free use with credit — *"produced using Copernicus WorldDEM-30 © DLR
e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the
European Union and ESA; all rights reserved."*

## PIN login

On first launch the app asks you to set a **PIN (4–12 digits)**. Every later launch requires it
before any data is shown. This is a local convenience lock for a single-user machine — it is not
encryption and not internet-facing security (the server only listens on `127.0.0.1`).

**Forgot the PIN?** Stop the app, then run from the repo root:

```
npm run auth:reset-pin -w server
```

This clears only the stored PIN hash — all data stays intact — and the app asks for a new PIN on
the next launch. Anyone with access to this machine's files could do the same; that is by design
for lockout recovery (the data was never encrypted with the PIN).

## Engineering conventions

*(Placeholder — grows with the codebase.)*
