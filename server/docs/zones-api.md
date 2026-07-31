# Zone datasets & import pipeline — service contract (DO-013)

> **Addition 2026-07-11 (DO-014):** the read-only HTTP surface this document
> anticipated now exists — see [Read API](#read-api-do-014--read-only) below.
> The import pipeline remains the only writer.

**Consumers:** DO-014 (map overlays/legend), DO-015 (verdict engine, vertical separation), GB-04 mission compliance (via DO-015's API).

Zone data is imported from the generated, provenance-tagged datasets under
`data-sources/zones/` (FR-C4). This document is the service-level contract —
**there is deliberately no HTTP route in DO-013** (`server/src/app.ts` is
DO-012's file this cycle); DO-014/DO-015 add whatever route/read surface they
need on top of the Prisma models described here.

## Importing datasets

```
npm run zones:import -w server              # every importable dataset
npm run zones:import -w server -- <dir>     # one dataset directory
```

- Each dataset directory holds `manifest.json` (provenance: source files with
  SHA-256, AIP update stamp, extraction date/tools) + `zones.geojson` +
  `reconciliation.md`.
- Import creates/updates a `MapLayer` with `name = manifest.layerKey`,
  `source` = JSON provenance blob, `importedAt = now`, **`verified = false`**
  (Jonathan's ב'-08 visual check is GB-06 Gate 3; re-import RESETS the flag —
  changed data needs a fresh check).
- **Re-import replaces atomically**: the layer's old `Zone` rows are deleted
  and the new ones inserted in one transaction; layer identity (id) is stable;
  no orphan zones (FR-C4).
- Datasets with `importable: false` in the manifest are **refused** — they are
  conversions awaiting a human decision. Currently none: `cvfr-lanes` became
  importable with the trigger-6 Option A resolution (Session 2, 2026-07-11)
  and `aip-a17-inpa-closures` with the RATAG geometry pairing (Session 3,
  2026-07-11); all five datasets import.

## Zone rows

| Column | Content |
|---|---|
| `name` | `"<code> — <Hebrew name>"` (e.g. `LLP01 — החולה`) |
| `zoneTypeId` | → `ZoneType` upserted by code (`AIP_PROHIBITED`, `AIP_RESTRICTED`, `AIP_DANGER`, `LLU_DRONE`, `AIRPORT`, `NATURE_RESERVE`, …). Default verdicts derive from GB-03 Gate 3, conservatively extended (all AIP P/R/D + LLU → `RESTRICTED`); the mapping is editable data — upserts never overwrite verdict edits. |
| `geometryJson` | GeoJSON geometry, WGS-84 `[lng, lat]` |
| `floorAmslFt` / `ceilingAmslFt` | Altitude band, **ft AMSL exactly as published**; `null` = not published (never guessed). See caveats below. |
| `notes` | provenance + source oddities (definition prose, altitude conflicts, `aglCeilingFt=N` for AGL-published ceilings) |
| `mapLayerId` | owning dataset layer |

### Altitude semantics — READ THIS before writing verdict logic (DO-015)

- **`GND`/`MSL` floors are stored as `0`** (CAAI's own gdb encoding). Meaning:
  the zone starts at the surface. A verdict engine must treat `floorAmslFt <= 0`
  as "reaches the ground" — **including below-sea-level terrain (Dead Sea):**
  do NOT conclude that airspace between the terrain and 0 ft AMSL is outside
  the zone.
- **`UNL` (unlimited) ceilings are stored as `null`** with a note; the gdb
  encodes them as 99000. `null` ceiling on a P/R/D zone must be treated as
  unbounded above, not as "no restriction".
- **AGL-published ceilings** (LLU59–72's 300 ft מעפ"ש; appendix ה' max
  heights) are NOT in the AMSL columns — they ride in `notes`
  (`aglCeilingFt=N`) until a modeling decision. Converting them to AMSL
  requires the DO-012 elevation service and a human decision on rounding.
- **CVFR lanes use the Option A envelope** (trigger 6 resolution, decision
  log 2026-07-11): `floorAmslFt`/`ceilingAmslFt` = min/max of **every**
  published directional altitude (dual values contribute both numbers); the
  raw directional strings are preserved in `notes` for display. A lane with
  a blank published band has `null`/`null` and **makes no vertical claim** —
  never infer "probably low".
- Every value is **unverified** until the layer's `verified` flag is set by
  the human visual check; badge accordingly (same discipline as the Ruleset).

## Gap-filler buffers (conventions §4, NFR-5)

`osm-airport-buffers` features are POINTS carrying `bufferRuleKey:
"airport_buffer_km"`. The importer reads the value through the **fail-closed
Ruleset read API at import time** and generates the circle then. A missing or
unset rule aborts the dataset import (trigger 4) — there is no default radius
anywhere in code. Changing the Ruleset value and re-importing regenerates the
buffers (that is the NFR-5 story for zone buffers; DO-015's distance checks
read the Ruleset live).

## Regenerating datasets from the source snapshots (offline)

```
python server/scripts/zones/dump_gdb.py <repo-root> <dumps-dir>
python server/scripts/zones/dump_a17.py data-sources/aip/aip_a-17_prohibited-restricted-danger-areas.pdf <dumps-dir>/a17.json
npm run zones:build -w server -- <dumps-dir>
```

Requires Python ≥3.14 with `pyogrio` (vendors GDAL), `pyproj`, `shapely`,
`pymupdf` (all user-level pip wheels; see the DO-013 tooling notes). Deterministic: identical inputs → byte-identical datasets, except
the manifest's `extractedAt` date (the one documented timestamp).

## Read API (DO-014 — read-only)

Additive read-only routes in `server/src/zones/routes.ts`, mounted at
`/api/zones` behind the PIN middleware like every `/api` route. They expose
DO-013's models to the map UI (and any later consumer) **without any write
surface** — imports stay the only writer (DO-014).

### `GET /api/zones/layers`

Layer catalog for toggles and the provenance/staleness/unverified UI.

```json
{ "layers": [ {
    "id": "…", "name": "aip-a17-llp-llr-danger",
    "importedAt": "2026-07-11T18:43:12.000Z",
    "verified": false,
    "zoneCount": 113,
    "provenance": { "title": "…", "sourceFiles": [ { "path": "…", "sha256": "…" } ],
                    "aipUpdateStamp": "…", "extractedAt": "2026-07-10",
                    "extractionTools": ["…"] }
} ] }
```

- `provenance` is the parsed `MapLayer.source` blob the importer wrote; a
  non-JSON legacy value degrades to `{ "title": "<raw>" }`.
- Zero imported layers → `{ "layers": [] }` (HTTP 200) — the client renders
  the instructive empty state, never an error.

### `GET /api/zones/layers/:id/geojson`

One layer's zones as a GeoJSON FeatureCollection, plus the layer object above.

```json
{ "layer": { … }, "geojson": { "type": "FeatureCollection", "features": [ {
    "type": "Feature",
    "properties": { "id": "…", "name": "LLP15 — דימונה",
                    "zoneTypeCode": "AIP_PROHIBITED",
                    "zoneTypeName": "AIP prohibited area (LLP)",
                    "verdict": "RESTRICTED",
                    "floorAmslFt": 0, "ceilingAmslFt": null,
                    "notes": "…" },
    "geometry": { … }
} ] } }
```

**Consumer obligations:**

1. **`verdict` is read from `ZoneType.defaultVerdict` at request time** — the
   editable Gate 3 mapping. Style/behave off this value, never off zone-type
   constants; a DB verdict edit must change the next fetch's rendering with no
   code change (FR-C1 acceptance criterion, verified in DO-014).
2. **Geometry passes through exactly as imported** — no simplification
   (precision is safety-critical; ratified 2026-07-11).
3. Altitude columns follow the [altitude semantics](#altitude-semantics--read-this-before-writing-verdict-logic-do-015)
   above; `notes` carries the lane directional strings and `aglCeilingFt=N`
   AGL ceilings the UI must surface.
4. Unknown layer id → 404 `ZONES_LAYER_NOT_FOUND` (structured, bilingual);
   internal failures → 500 `ZONES_INTERNAL`.

## What DO-013 did NOT build (by design)

- No HTTP routes (DO-012 owns `app.ts`; DO-014/015 add read routes).
- No border-zone gap-filler — **resolved as won't-build** (trigger 4 closed,
  DECISION 2026-07-11): the imported AIP P/R/D polygons are the
  border-closure source; no border-buffer rule was added to the catalog.
  Reopens only if the ב'-08 visual verification shows a coverage gap.
- No AGL→AMSL conversion for the ceilings riding in `notes` (see altitude
  semantics above) — awaits a modeling decision.

*(Two items originally listed here were delivered by later DO-013 sessions:
lane→Zone import — Session 2, trigger-6 Option A; INPA geometry — Session 3,
RATAG pairing, 542/544. See the dataset reconciliation reports.)*
