# Reconciliation — caai-ctr-atz-cta — 2026-07-19

**Source:** `TLV_FIR.zip` → `TLV_FIR.lpk` (7-zip) → `v101/new_file_geodatabase_ctr.gdb` layer `CTR`, EPSG:32636→WGS-84.

## Counts

- source features: **39** · imported: **39**
- **ATZ**: 16
- **CTA**: 4
- **CTR**: 19
- civil: **24** · military: **15**
- dual/multi ceilings (envelope max adopted): **1** · unparseable ceilings (null): **0**
- repeated source codes disambiguated (variant/expansion polygons): **10**

## Caveats for the visual check (GB-06 Gate 3)

- **Altitude unit/datum is NOT stated in the source** — values adopted as ft AMSL per the producer's sibling files (F_Limited matched א'-17's AMSL text). Confirm against the AIP.
- The פמ"ת GIS tab labeled this download "FIR תל אביב כולל CTR ים, מסלולים, TMA ו-ACC" — **the file contains only the CTR/ATZ/CTA layer**; TMA/ACC/runways absent. If needed, that is a new source hunt.
- Editor stamps 2020–2023 — fresher than the ZONE gdb, still not current-edition; governing publications win on any conflict found in the visual check.
- Weekend/weekday variants imported as separate zones (schedule text preserved in notes) — both render; time-based activation is NOT modeled.

## Issue summary

altitude-multi-value: 1 · note: 10

## Issues

| Code | Kind | Detail |
|---|---|---|
| ATZ-LLBO-2 | note | code ATZ-LLBO repeats in the source ("הבונים סופש" — variant/expansion polygon); imported as its own zone per checkpoint |
| ATZ-LLBO-3 | note | code ATZ-LLBO repeats in the source ("הבונים אמצע שבוע" — variant/expansion polygon); imported as its own zone per checkpoint |
| ATZ-LLMG-2 | note | code ATZ-LLMG repeats in the source ("מגידו דרומי" — variant/expansion polygon); imported as its own zone per checkpoint |
| CTA-LLHS-2 | note | code CTA-LLHS repeats in the source ("חצור מזרחי (CTA)" — variant/expansion polygon); imported as its own zone per checkpoint |
| CTR-LL59-2 | note | code CTR-LL59 repeats in the source ("פלמחים - צפוני" — variant/expansion polygon); imported as its own zone per checkpoint |
| CTR-LLEK-2 | note | code CTR-LLEK repeats in the source ("תל נוף-בח"א 8 דרומי" — variant/expansion polygon); imported as its own zone per checkpoint |
| CTR-LLER-2 | note | code CTR-LLER repeats in the source ("אילן ואסף רמון - דרומי" — variant/expansion polygon); imported as its own zone per checkpoint |
| CTR-LLHA | altitude-multi-value | ceiling "3000/3500" — envelope max 3500 adopted (conservative); raw preserved in notes |
| CTR-LLNV-2 | note | code CTR-LLNV repeats in the source ("נבטים-כנף 28" — variant/expansion polygon); imported as its own zone per checkpoint |
| CTR-LLOV-2 | note | code CTR-LLOV repeats in the source ("עובדה מזרח" — variant/expansion polygon); imported as its own zone per checkpoint |
| CTR-LLRD-2 | note | code CTR-LLRD repeats in the source ("רמת דוד-כנף 1" — variant/expansion polygon); imported as its own zone per checkpoint |

_Everything ships `verified=false` until Jonathan's visual check (GB-06 Gate 3)._
