# Zone datasets & import pipeline — service contract (DO-013)

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
`pymupdf` (all user-level pip wheels; see the DO-013 session log tooling
decision). Deterministic: identical inputs → byte-identical datasets, except
the manifest's `extractedAt` date (the one documented timestamp).

## What DO-013 did NOT build (by design)

- No HTTP routes (DO-012 owns `app.ts`; DO-014/015 add read routes).
- No border-zone gap-filler — **resolved as won't-build** (trigger 4 closed,
  decision log 2026-07-11): the imported AIP P/R/D polygons are the
  border-closure source; no border-buffer rule was added to the catalog.
  Reopens only if the ב'-08 visual verification shows a coverage gap.
- No AGL→AMSL conversion for the ceilings riding in `notes` (see altitude
  semantics above) — awaits a modeling decision.

*(Two items originally listed here were delivered by later DO-013 sessions:
lane→Zone import — Session 2, trigger-6 Option A; INPA geometry — Session 3,
RATAG pairing, 542/544. See the dataset reconciliation reports.)*
