# Reconciliation — cvfr-lanes — 2026-07-10

**Source:** `CVFR_caai.zip` → `CVFR_ROUTES2023` (265 segments) + `CVFR_POINTS2023` (201 waypoints), EPSG:32636→WGS-84. Governing publication: **פמ"ת ב'-03** (cross-check target for Jonathan's verification; the chart sheets are `aip_b-03_cvfr-north/south.pdf`).

## Counts

- route segments converted: **265** (expected 265 — MATCH)
- waypoints converted: **201** (expected 201 — MATCH)
- altitude strings that are not a single integer (raw carried, parsed null): **10**

## Directional altitude value inventory (trigger 6 evidence)

- **N_A**: `X`×92, `4000`×26, `3500`×24, `1200`×22, `3000`×21, `2500`×20, `2000`×18, `1500`×17, `4500`×6, `800`×5, `1600`×5, `1000`×4, `400`×1, `2200`×1, `1200, 2000`×1, `2500/3500`×1, `4000/5000`×1
- **S_A**: `X`×87, `3000`×41, `3500`×25, `800`×24, `2000`×24, `2500`×18, `1500`×16, `1200`×9, `4000`×6, `500`×4, `5000`×2, `2000/2500`×2, `<null>`×2, `1000`×1, `1600`×1, `4500`×1, `2000/1000`×1, `1000/2000`×1
- **W_Alt**: `X`×190, `2000`×17, `3000`×12, `4000`×11, `<null>`×7, `1200`×6, `3500`×5, `2500`×3, `5000`×3, `500`×2, `800`×2, `1600`×2, `4500`×2, `2300`×1, `3300`×1, `2000/1000`×1
- **E_Alt**: `X`×183, `1500`×12, `3500`×12, `2500`×10, `<null>`×8, `800`×7, `1200`×7, `2000`×7, `4000`×6, `3000`×4, `4500`×3, `1000`×2, `1800`×1, `2800`×1, `<Null>`×1, `3000/2500`×1

## Issues

| Code | Kind | Detail |
|---|---|---|
| LLHAGALIM | altitude-unparseable | W_Alt = "2000/1000" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| NSHRMLLBG | altitude-unparseable | N_A = "1200, 2000" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| MMORRARRAD | altitude-unparseable | E_Alt = "<Null>" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| DAROMGALIM | altitude-unparseable | S_A = "2000/1000" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| HOTRMDAROM | altitude-unparseable | S_A = "1000/2000" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| SOVALMINGV | altitude-unparseable | S_A = "2000/2500" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| ALUMTDESHE | altitude-unparseable | N_A = "2500/3500" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| HOVAVLLNV | altitude-unparseable | E_Alt = "3000/2500" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| YRIHOMIHMS | altitude-unparseable | N_A = "4000/5000" — not a single integer; carried raw, parsed value null (trigger 6 material) |
| MINGVNASIH | altitude-unparseable | S_A = "2000/2500" — not a single integer; carried raw, parsed value null (trigger 6 material) |

**IMPORT BLOCKED (trigger 6):** how lanes map onto Zone's single floor/ceiling pair is a human decision. Options are surfaced in the DO-013 session log / PR. Once decided, set `importable: true` logic accordingly and re-run the import.
