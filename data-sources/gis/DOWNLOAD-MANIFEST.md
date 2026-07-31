# Gate 4 download manifest — flight lanes + GIS layers

**Status: RECEIVED 2026-07-10** — Jonathan downloaded items 1–6 (checksums verified in-session); Gate 4 resolved and Gate 1 re-amended same day. Contents confirmed: `CVFR_caai.zip` = file gdb with `CVFR_ROUTES2023` (265 segments, per-direction `N_A`/`S_A` altitudes ft) + `CVFR_POINTS2023` (201 waypoints); `ZONE_gdb.zip` = file gdb with `F_Limited` (103 LLP/LLR/danger polygons, `AltMin`/`AltMax`) + `Limited_Edges` (9,765 DMS vertices); `cvfr_mot.zip` = single dissolved polygon, no altitudes — **rejected as lane source**, kept as CC-BY coverage sanity check. **Item 7 (INPA `RATAG_kmz.zip`) received 2026-07-11** (md5 `48aa2142d01577949e4f0b5b20e647eb`; inner KMZ stamped **07-09-2020** — currency caveat; paired into `data-sources/zones/aip-a17-inpa-closures/` by DO-013 session 3). Treat all files as read-only snapshots; new editions get new files.

## Priority 1 — decides Gate 4

| # | What | URL | Save as |
|---|---|---|---|
| 1 | CVFR metadata (does the shapefile carry altitudes?) | https://e.data.gov.il/dataset/360fb8b4-ea71-4485-b80b-c5b996d25cae/resource/014a091d-e85c-4ba0-b4f4-dbf621c65b9d/download/cvfr_mot_metadata.xlsx | `gis/cvfr_mot_metadata.xlsx` |
| 2 | CVFR lanes shapefile (data.gov.il, open license) | https://e.data.gov.il/dataset/360fb8b4-ea71-4485-b80b-c5b996d25cae/resource/e5436712-2829-4079-982f-576195277766/download/cvfr_mot.zip | `gis/cvfr_mot.zip` |
| 3 | CAAI CVFR layer (פמ"ת GIS tab) | https://www.gov.il/BlobFolder/guide/aip/he/CVFR.zip | `gis/CVFR_caai.zip` |
| 4 | פמ"ת ב'-03 text (governing publication for lanes) | via https://www.gov.il/he/pages/aip?chapterIndex=5 → ב'-03 | `aip/aip_b-03_cvfr-routes.pdf` |
| 5 | ב'-03 chart sheets (צפוני / דרומי) | same page, ב'-03 attachments | `aip/aip_b-03_cvfr-north.pdf`, `aip/aip_b-03_cvfr-south.pdf` |

## Priority 1b — DO-036 (CTR/TMA layer, added 2026-07-14)

| # | What | URL | Save as |
|---|---|---|---|
| 8 | CAAI TLV FIR package: CTR ים, מסלולים, TMA, ACC (Esri layer package) | https://www.gov.il/BlobFolder/guide/aip/he/TLV_FIR.zip | `gis/TLV_FIR.zip` |

## Priority 2 — high value for DO-013 (zones)

| # | What | URL | Save as |
|---|---|---|---|
| 6 | CAAI zones file-geodatabase (may replace manual א'-17 extraction) | https://www.gov.il/BlobFolder/guide/aip/he/New_File_Geodatabase_ZONE.gdb_.zip | `gis/ZONE_gdb.zip` |
| 7 | INPA restrictions KMZ (CAAI-hosted) | https://www.gov.il/BlobFolder/guide/aip/he/RATAG_kmz.zip | `gis/RATAG_kmz.zip` |

All links are from the official פמ"ת page (https://www.gov.il/he/pages/aip — GIS layers under the "מידע תעופתי נוסף" tab) and the data.gov.il `cvfr` dataset. If a link 404s, navigate from the פמ"ת page itself — filenames occasionally shift with editions.

After the files land here, the Cowork session inspects contents (fields, altitude attributes, geometry) and brings the Gate 4 source recommendation.
