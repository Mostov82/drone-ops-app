# CAAI AIP (פמ"ת פנים ארצי) — zone data sources

Added 2026-07-10 by Jonathan (see `work/decision-log.md`, GB-03 Gate 1 amendment). Primary source material for DO-013 (zone data model + import).

| File | Original name | Content | Update stamp |
|---|---|---|---|
| `aip_a-17_prohibited-restricted-danger-areas.pdf` | aip_א'-17.pdf | Chapter א'-17: prohibited (LLP), restricted (LLR), and danger areas — full text + coordinate appendices (49 pp.) | 2/25 (02 Oct 2025); some pages 3/24 (31 Oct 2024) |
| `aip_b-08_north-sheet.pdf` | aip_ב'-08 גיליון צפוני.pdf | Chart ב'-08, northern sheet — the official zone map | rev. Sep 2025 |
| `aip_b-08_south-sheet.pdf` | aip_ב'-08 גיליון דרומי.pdf | Chart ב'-08, southern sheet — the official zone map | rev. Sep 2025 |
| `aip_b-03_cvfr-routes.pdf` | aip_ב'-03.pdf | Chapter ב'-03: CVFR low transport routes (נתיבי תובלה נמוכים) — governing publication for flight lanes (added 2026-07-10, Gate 4) | current edition |
| `aip_b-03_cvfr-north.pdf` | aip_ב'-03 CVFR צפוני-.pdf | CVFR chart, northern sheet — lane cross-check | current edition |
| `aip_b-03_cvfr-south.pdf` | aip_ב'-03 CVFR דרומי.pdf | CVFR chart, southern sheet — lane cross-check | current edition |

## What's inside א'-17 (extraction targets for DO-013)

- **Main text:** LLP/LLR area definitions with altitude bands, activation windows, and coordination contacts.
- **Appendix ב':** polygon vertex coordinate tables (WGS-84 DMS, e.g. `35° 35' 13.44" E`) for prohibited/restricted/danger areas.
- **Appendix ג':** LLU zones **specifically for UAVs/drones (MTOW < 25 kg, VLOS)** — center coordinate + closure radius per zone. The most directly relevant table for this app.
- **Appendix ה':** INPA (רט"ג) closures — national parks, nature reserves, nesting sites, each with an LLP code.

## Key facts from the document itself

- **Precedence:** in case of contradiction between AIP publications, chapter א'-17 (the text) governs. Tables are primary; the ב'-08 sheets are the visual cross-check.
- **Downloadable GIS layers:** the text states geographic layers are available from the CAAI (רת"א) and INPA (רט"ג) websites — follow up in DO-013 (could replace manual table extraction for some layers).
- **Dynamic restrictions:** NOTAM/AIC publish temporary changes; a static import can never be current. Import date must be displayed (GB-03 constraint).

## Provenance rules

- Treat these files as **read-only source snapshots**. New AIP revisions get new files; do not overwrite.
- Every dataset generated from them must carry: source file name, AIP update stamp, extraction date, and the **unverified** flag until visually verified against the ב'-08 sheets (GB-03 Gate 1 / GB-06 Gate 3).
