# Reconciliation — aip-a17-llp-llr-danger — 2026-07-10

**Sources:** `ZONE_gdb.zip` → `F_Limited` (geometry + attributes) vs **א'-17 appendix ב' text (governs)**.

## Counts

- gdb zones: **103** (all imported)
- א'-17 appendix ב' entries parsed: **77**
- matched (gdb ∩ text): **66**
- gdb-only (not in א'-17 — ENR-referenced etc.): **37** (imported, flagged; altitudes from gdb)
- text-only (in א'-17, missing from the gdb — the gdb's editor stamps are 2016–2020 vs the text's עדכון 2/25): **11**, of which **10** built from the governing text (pure vertex list / explicit circle, flagged `text-built`) and **1** NOT imported (definition not strictly parseable; listed below)
- text vertex spot-checks: **266/342** matched a gdb polygon vertex within ±2 m (prose-defined zones' centers/arc-points legitimately don't — see per-zone notes)
- total features in dataset: **113**

## Issue summary

altitude-mismatch: 1 · gdb-only: 37 · name-mismatch: 27 · note: 46 · parse-failure: 1 · text-built: 10 · text-only: 1 · vertex-issue: 2 · vertex-mismatch: 22

## Issues (every mismatch listed; text governs — nothing averaged or guessed)

| Code | Kind | Detail |
|---|---|---|
| LLD101 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD102 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD233 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD234 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD235 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD236 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD237 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD238 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD239 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD240 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD241 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD242 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLD28 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD29 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD29 | vertex-issue | unparseable coordinate cell in text: "31° 17' . 13 00\" N" |
| LLD29 | vertex-issue | unparseable coordinate cell in text: "34° 43' . 22 00\" E" |
| LLD30 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 vertex list (15 published vertices); needs ב'-08 visual check |
| LLD31 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 vertex list (7 published vertices); needs ב'-08 visual check |
| LLD34 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD35 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 circle (radius 1 ק"מ around 31° 35' 47.00" N 34° 47' 22.00" E); needs ב'-08 visual check |
| LLD36 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD37 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/2 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD38 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 1/2 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD39 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD41 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V) — altitudes from gdb, flagged unverified |
| LLD42 | name-mismatch | text "הטסת רחפנים ים המלח" vs gdb "הטסת רחפנים מפעלי ים המלח" |
| LLD43 | vertex-mismatch | text vertex 32° 40' 55.20" N / 34° 52' 05.40" E not found in gdb polygon (±2 m) |
| LLD44 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 9/10 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLD45 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V) — altitudes from gdb, flagged unverified |
| LLD46 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 vertex list (6 published vertices); needs ב'-08 visual check |
| LLD47 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 vertex list (4 published vertices); needs ב'-08 visual check |
| LLD48 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 vertex list (6 published vertices); needs ב'-08 visual check |
| LLD49 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 circle (radius 300 מטר around 31° 52' 28.20" N 34° 55' 16.10" E); needs ב'-08 visual check |
| LLD50 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 vertex list (6 published vertices); needs ב'-08 visual check |
| LLL1 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLL2 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLP01 | name-mismatch | text "החולה" vs gdb "שמורת טבע החולה" |
| LLP02 | name-mismatch | text "גמלא" vs gdb "שמורת טבע גמלא" |
| LLP03 | name-mismatch | text "מכון דוד" vs gdb "קריות" |
| LLP04 | name-mismatch | text "בתי הזיקוק" vs gdb "בתי הזיקוק חיפה" |
| LLP07 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP09 | name-mismatch | text "מכון למחקר ביולוגי - נ " צ" vs gdb "מכון למחקר ביולוגי נס ציונה" |
| LLP09 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP10 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP11 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP12 | name-mismatch | text "שטח אש 209" vs gdb "שטח אש 209 עתידי" |
| LLP13 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP15 | note | ceiling published as UNL (unlimited) — stored null (gdb: 99000) |
| LLP15 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 12/12 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP16 | name-mismatch | text "עין עבדת" vs gdb "שמורת טבע עין עבדת" |
| LLP16 | vertex-mismatch | text vertex 30° 50' 28.29" N / 34° 45' 23.22" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 30.28" N / 34° 45' 22.22" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 00.28" N / 34° 45' 52.22" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 22.39" N / 34° 46' 51.27" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 05.00" N / 34° 48' 36.53" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 06.06" N / 34° 50' 46.32" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 12.93" N / 34° 50' 59.77" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 22.30" N / 34° 50' 59.70" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 51' 15.45" N / 34° 49' 48.72" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 51' 48.45" N / 34° 49' 48.21" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 52' 12.52" N / 34° 49' 11.48" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 52' 16.52" N / 34° 48' 48.48" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 51' 16.29" N / 34° 46' 39.22" E not found in gdb polygon (±2 m) |
| LLP16 | vertex-mismatch | text vertex 30° 49' 02.33" N / 34° 50' 11.06" E not found in gdb polygon (±2 m) |
| LLP171 | vertex-mismatch | text vertex 32° 03' 57.08" N / 35° 22' 52.42" E not found in gdb polygon (±2 m) |
| LLP172 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/21 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP172 | parse-failure | p22: page-break continuation merged into the p21 entry — verify vertex order manually |
| LLP173 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/15 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP19 | name-mismatch | text "רצועת עזה" vs gdb "עזה" |
| LLP19 | note | ceiling published as UNL (unlimited) — stored null (gdb: 99000) |
| LLP20 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP22 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP23 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP24 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 circle (radius 500 מטר around 31° 53' 56.94" N 34° 42' 09.00" E); needs ב'-08 visual check |
| LLP25 | altitude-mismatch | ceiling: text 3000 ft vs gdb 10000 — text wins |
| LLP25 | name-mismatch | text "תמר / ים טטיס" vs gdb "אסדת תמר/ים טטיס" |
| LLP25 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP26 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP27 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP28 | name-mismatch | text "אסדת לוויתן """ vs gdb "לויתן" |
| LLP28 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP30 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP3000 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP3001 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP3002 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP3003 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP3004 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP3005 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP3006 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP3007 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: null; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLP31 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLP32 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLP33 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLP40 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLP42 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/3 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP43 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/1 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLP44 | text-built | NOT in the gdb (added after its 2016–2020 editor stamps?) — geometry built from the א'-17 circle (radius 100 מטר around 31° 50' 16.80" N 34° 39' 32.76" E); needs ב'-08 visual check |
| LLR036 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: V, X) — altitudes from gdb, flagged unverified |
| LLR1 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLR100 | name-mismatch | text "שטח אש 100" vs gdb "שטחי אש 100" |
| LLR100 | note | ceiling published as UNL (unlimited) — stored null (gdb: 99000) |
| LLR107 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLR120 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLR2 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: X; ENR refs: V) — altitudes from gdb, flagged unverified |
| LLR20 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 3/4 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR24 | name-mismatch | text "שטח אש 24" vs gdb "מטווח 24" |
| LLR24 | note | ceiling published as UNL (unlimited) — stored null (gdb: 99000) |
| LLR24 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR27 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 6/6 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR30 | note | ceiling published as UNL (unlimited) — stored null (gdb: 99000) |
| LLR309 | name-mismatch | text "שטח אש 309" vs gdb "שטחי אש 309" |
| LLR309 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR35 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLR36 | text-only | in א'-17 appendix ב' (p22, "שטחי אש 36") but NOT in the gdb, and its text definition is not a strictly-parseable vertex list/circle — zone NOT imported; definition: קואורדינטות מפורטות בפרק ENR5.1 ב - AIP |
| LLR500 | name-mismatch | text "שטח אש 500" vs gdb "שטחי אש 500" |
| LLR500 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR502 | name-mismatch | text "שטח אש 502" vs gdb "שטחי אש 502" |
| LLR502 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR504 | name-mismatch | text "שטח אש 504" vs gdb "שטחי אש 504" |
| LLR504 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR520 | name-mismatch | text "שטח אש 520" vs gdb "שטחי אש 520" |
| LLR520 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR589 | name-mismatch | text "שטח אש 589" vs gdb "שטחי אש 589" |
| LLR589 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR601 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLR602 | gdb-only | not in א'-17 appendix ב' (gdb A17 flag: V; ENR refs: X) — altitudes from gdb, flagged unverified |
| LLR618 | name-mismatch | text "שטח אש 618" vs gdb "שטח אש דרום 618" |
| LLR618 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR802 | name-mismatch | text "מטווח 80 צפון" vs gdb "מטווח 80 מזרח" |
| LLR803 | name-mismatch | text "מטווח 80 צפון" vs gdb "מטווח 80 דרום" |
| LLR804 | name-mismatch | text "מטווח 80 דרום" vs gdb "שטח אש 80 דרום א" |
| LLR804 | note | ceiling published as UNL (unlimited) — stored null (gdb: 99000) |
| LLR804 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR805 | name-mismatch | text "מטווח 80 דרום" vs gdb "שטח אש 80 דרום ב" |
| LLR805 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR82 | name-mismatch | text "שטח אש 82" vs gdb "מטווח 82" |
| LLR82 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |
| LLR83 | vertex-mismatch | text vertex 32° 33' 02.00" N / 35° 20' 54.00" E not found in gdb polygon (±2 m) |
| LLR83 | vertex-mismatch | text vertex 32° 30' 43.00" N / 35° 28' 18.00" E not found in gdb polygon (±2 m) |
| LLR83 | vertex-mismatch | text vertex 32° 05' 02.00" N / 35° 26' 42.00" E not found in gdb polygon (±2 m) |
| LLR83 | vertex-mismatch | text vertex 32° 11' 18.00" N / 35° 13' 45.00" E not found in gdb polygon (±2 m) |
| LLR83 | vertex-mismatch | text vertex 32° 15' 40.00" N / 35° 02' 56.00" E not found in gdb polygon (±2 m) |
| LLR83 | vertex-mismatch | text vertex 32° 17' 26.00" N / 35° 03' 24.00" E not found in gdb polygon (±2 m) |
| LLR900 | name-mismatch | text "שטח אש 900" vs gdb "שטחי אש 900" |
| LLR900 | note | ceiling published as UNL (unlimited) — stored null (gdb: 99000) |
| LLR921 | name-mismatch | text "שטח אש 921" vs gdb "שטחי אש 921" |
| LLR921 | note | text defines geometry partly by prose (circle/arc/border) — gdb geometry used; 0/0 text coordinates coincide with outline vertices (centers/arc-points expectedly don't); ב'-08 visual check covers it |

_Everything ships `verified=false` until Jonathan's visual check against the ב'-08 sheets (GB-06 Gate 3)._
