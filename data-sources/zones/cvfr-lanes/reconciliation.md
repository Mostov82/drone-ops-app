# Reconciliation — cvfr-lanes — 2026-07-10

**Source:** `CVFR_caai.zip` → `CVFR_ROUTES2023` (265 segments) + `CVFR_POINTS2023` (201 waypoints), EPSG:32636→WGS-84. Governing publication: **פמ"ת ב'-03** (cross-check target for Jonathan's verification; the chart sheets are `aip_b-03_cvfr-north/south.pdf`).

## Counts

- route segments converted: **265** (expected 265 — MATCH)
- waypoints converted: **201** (expected 201 — MATCH)
- altitude strings that are not a single integer (raw carried, per-direction parsed null): **10**
- segments whose option-A envelope used a dual/multi-number string: **9**
- segments with NO published altitude — null band, never guessed: **0**

## Option-A altitude modeling (trigger 6 resolved 2026-07-11)

One Zone row per segment; `floorAmslFt` = minimum and `ceilingAmslFt` = maximum of every
published directional altitude number on the segment (dual values like `2000/1000` contribute
both numbers — the conservative envelope). Raw directional strings are preserved verbatim in the
feature properties and carried onto `Zone.notes`. Partially published segments (one direction
`<Null>`) take the envelope of what IS published. See `work/decision-log.md`, DECISION 2026-07-11.

## Directional altitude value inventory (trigger 6 evidence)

- **N_A**: `X`×92, `4000`×26, `3500`×24, `1200`×22, `3000`×21, `2500`×20, `2000`×18, `1500`×17, `4500`×6, `800`×5, `1600`×5, `1000`×4, `400`×1, `2200`×1, `1200, 2000`×1, `2500/3500`×1, `4000/5000`×1
- **S_A**: `X`×87, `3000`×41, `3500`×25, `800`×24, `2000`×24, `2500`×18, `1500`×16, `1200`×9, `4000`×6, `500`×4, `5000`×2, `2000/2500`×2, `<null>`×2, `1000`×1, `1600`×1, `4500`×1, `2000/1000`×1, `1000/2000`×1
- **W_Alt**: `X`×190, `2000`×17, `3000`×12, `4000`×11, `<null>`×7, `1200`×6, `3500`×5, `2500`×3, `5000`×3, `500`×2, `800`×2, `1600`×2, `4500`×2, `2300`×1, `3300`×1, `2000/1000`×1
- **E_Alt**: `X`×183, `1500`×12, `3500`×12, `2500`×10, `<null>`×8, `800`×7, `1200`×7, `2000`×7, `4000`×6, `3000`×4, `4500`×3, `1000`×2, `1800`×1, `2800`×1, `<Null>`×1, `3000/2500`×1

## Issues

| Code | Kind | Detail |
|---|---|---|
| LLHAGALIM | altitude-multi-value | W_Alt = "2000/1000" — not a single integer; all published numbers (2000, 1000) enter the option-A envelope; raw carried, per-direction parsed value null |
| NSHRMLLBG | altitude-multi-value | N_A = "1200, 2000" — not a single integer; all published numbers (1200, 2000) enter the option-A envelope; raw carried, per-direction parsed value null |
| MMORRARRAD | altitude-not-published | E_Alt = "<Null>" — no published number; excluded from the envelope; raw carried |
| DAROMGALIM | altitude-multi-value | S_A = "2000/1000" — not a single integer; all published numbers (2000, 1000) enter the option-A envelope; raw carried, per-direction parsed value null |
| HOTRMDAROM | altitude-multi-value | S_A = "1000/2000" — not a single integer; all published numbers (1000, 2000) enter the option-A envelope; raw carried, per-direction parsed value null |
| SOVALMINGV | altitude-multi-value | S_A = "2000/2500" — not a single integer; all published numbers (2000, 2500) enter the option-A envelope; raw carried, per-direction parsed value null |
| ALUMTDESHE | altitude-multi-value | N_A = "2500/3500" — not a single integer; all published numbers (2500, 3500) enter the option-A envelope; raw carried, per-direction parsed value null |
| HOVAVLLNV | altitude-multi-value | E_Alt = "3000/2500" — not a single integer; all published numbers (3000, 2500) enter the option-A envelope; raw carried, per-direction parsed value null |
| YRIHOMIHMS | altitude-multi-value | N_A = "4000/5000" — not a single integer; all published numbers (4000, 5000) enter the option-A envelope; raw carried, per-direction parsed value null |
| MINGVNASIH | altitude-multi-value | S_A = "2000/2500" — not a single integer; all published numbers (2000, 2500) enter the option-A envelope; raw carried, per-direction parsed value null |

_In-session ב'-03 spot-checks: `spot-checks_2026-07-10.md` beside this file. Everything ships `verified=false` until Jonathan's visual check (GB-06 Gate 3)._
