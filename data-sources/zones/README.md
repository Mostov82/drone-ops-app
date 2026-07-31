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
| `aip-a17-llp-llr-danger` | `ZONE_gdb.zip` (geometry) ⊕ א'-17 appendix ב' (governs: presence/names/altitudes) | 113 (103 gdb + 10 built from text — zones newer than the gdb) | yes — **coordination contacts** (DO-036 s2): published תיאום sentences on 20 zones' notes, exact-code only |
| `aip-a17-llu-drone` | א'-17 appendix ג' (drone-specific LLU closures, MTOW < 25 kg) | 73 (71 circles + LLU22/LLU55 polygons) | yes — **coordination contacts** (DO-036 s2): published תיאום sentences on 17 zones' notes, exact-code only |
| `osm-airport-buffers` | committed Overpass snapshot (aerodromes); **buffer radius from the Ruleset at import** | 53 anchor points | yes |
| `cvfr-lanes` | `CVFR_caai.zip` (265 segments + 201 waypoints) vs ב'-03 | 265 + 201 | yes — option-A envelope (trigger 6 resolved 2026-07-11) |
| `aip-a17-inpa-closures` | א'-17 appendix ה' (governs) ⊕ `RATAG_kmz.zip` geometry, exact-code-paired (session 3, 2026-07-11) | 542 paired (2 appendix-only excluded — post-2020, no geometry; `entries.json` keeps all 544) | yes — **KMZ vintage 07-09-2020**, text governs |
| `caai-ctr-atz-cta` | `TLV_FIR.zip` → lpk gdb layer `CTR` (DO-036, checkpoint 2026-07-19) | 39 (CTR 19 · ATZ 16 · CTA 4), all RESTRICTED; variant polygons separate, dual ceilings take max | yes — **altitude unit unstated (adopted ft AMSL — verify)**; TMA/ACC absent despite page label |

Import: `npm run zones:import -w server` (see `server/docs/zones-api.md`).
Regeneration from the snapshots (offline, deterministic): see the same doc.

Do not hand-edit generated files — fix the extraction scripts
(`server/scripts/zones/`) and rebuild; new source editions get new snapshot
files first (provenance rules in `data-sources/aip/README.md`).
