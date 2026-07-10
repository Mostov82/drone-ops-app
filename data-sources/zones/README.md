# Generated zone datasets (DO-013)

Importable, provenance-tagged GeoJSON datasets generated from the read-only
source snapshots in `data-sources/aip/` and `data-sources/gis/` (GB-03 Gate 1
as amended 2026-07-10). **Everything here is UNVERIFIED until Jonathan's
visual check against the official ב'-08 / ב'-03 sheets (GB-06 Gate 3).**

Each dataset directory contains:

- `zones.geojson` — the features (WGS-84), or `entries.json` when no geometry exists yet
- `manifest.json` — provenance: layer key, source files + SHA-256, AIP update stamp, extraction date + tools, `importable` flag
- `reconciliation.md` — counts + every mismatch against the governing א'-17 text, for the visual verification

| Dataset | Source | Features | Importable |
|---|---|---|---|
| `aip-a17-llp-llr-danger` | `ZONE_gdb.zip` (geometry) ⊕ א'-17 appendix ב' (governs: presence/names/altitudes) | 113 (103 gdb + 10 built from text — zones newer than the gdb) | yes |
| `aip-a17-llu-drone` | א'-17 appendix ג' (drone-specific LLU closures, MTOW < 25 kg) | 73 (71 circles + LLU22/LLU55 polygons) | yes |
| `osm-airport-buffers` | committed Overpass snapshot (aerodromes); **buffer radius from the Ruleset at import** | 53 anchor points | yes |
| `cvfr-lanes` | `CVFR_caai.zip` (265 segments + 201 waypoints) vs ב'-03 | 265 + 201 | **no — trigger 6** (directional-altitude modeling decision pending) |
| `aip-a17-inpa-closures` | א'-17 appendix ה' (INPA codes/names/types/AGL ceilings) | 544 entries (207 LLP1xxx + 337 LLP2xxx), no geometry | **no — geometry source outstanding** (`RATAG_kmz.zip`) |

Import: `npm run zones:import -w server` (see `server/docs/zones-api.md`).
Regeneration from the snapshots (offline, deterministic): see the same doc.

Do not hand-edit generated files — fix the extraction scripts
(`server/scripts/zones/`) and rebuild; new source editions get new snapshot
files first (provenance rules in `data-sources/aip/README.md`).
