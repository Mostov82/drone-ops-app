# Research — Flight-lane (נתיבי טיסה) data sources

**Date:** 2026-07-10 · **For:** GB-03 Gate 4 + DO-013 research subtask · **By:** research agent (Cowork session), findings verified against the live gov.il פמ"ת page

## Headline findings

1. **The lanes publication is פמ"ת פרק ב'-03** — "טיסה בנתיבי תובלה נמוכים לפי כללי טיסת ראייה מבוקרת (CVFR)" — text PDF plus chart sheets (CVFR צפוני / דרומי / אחורי) and נספח ה' (helicopter routes to rigs). Related: ב'-01 (ATS ROUTES + chart), ב'-04 (transitions between ATS and low routes), ב'-09 (UAV/כטב"מ flight-area chart — נספח א'). All downloadable from the official פמ"ת page.
2. **The CAAI GIS layers named in א'-17 are real** and live on the פמ"ת page's "מידע תעופתי נוסף" tab (https://www.gov.il/he/pages/aip?chapterIndex=11):
   - נתיבי תובלה נמוכים CVFR → `CVFR.zip`
   - נתיבי גובה נמוך לתעופה ספורטיבית → `שכבות ספורטיבית.zip`
   - ATS ROUTES → `ATS.zip`
   - FIR תל אביב (CTR/TMA/ACC) → `TLV_FIR.zip` (Esri layer package)
   - **אזורים אסורים/מוגבלים/מסוכנים → `New_File_Geodatabase_ZONE.gdb_.zip` (Esri file geodatabase)** — potentially replaces manual א'-17 table extraction (DO-013 trigger 2!)
   - INPA restrictions → `RATAG_kmz.zip` (KMZ, CAAI-hosted; INPA's own download page is terms-gated)
   - מפה אווירית לניווט print sheets: `Navigation-North 2026.pdf` / `Navigation-south 2026.pdf`
3. **Best machine-readable lane source: data.gov.il dataset `cvfr` ("נתיבי טיסה")**, Ministry of Transport, sourced from CAAI. Resources: `cvfr_mot.zip` (SHP+LYR), `cvfr_mot_kmz.zip`, `cvfr_mot.csv`, `cvfr_mot_metadata.xlsx`. License listed "אחר (פתוח)". Last modified 2026-03. SHP zip ~100 KB — whether floor/ceiling altitudes are attributed is UNVERIFIED until the metadata XLSX is inspected.

## Caveats

- Every GIS layer carries an on-page warning: layers are **לנוחות המשתמשים בלבד** — the binding source is the official publications (חוק הטיס, תקנות, פמ"ת). App implication: layers may be used as geometry sources but stay `verified=false` until cross-checked against the governing PDFs, and the disclaimer stance (PRD §10) covers them.
- פמ"ת content copyright: "מפה – מיפוי והוצאה לאור בע"מ"; page terms mention personal, non-commercial use. Fine for a personal/local tool; flag if the app's distribution ever widens.
- DronesIL's backend feed: not publicly documented (unconfirmed).
- Not inspected (downloads need owner approval): internal contents/fields of `CVFR.zip`, `ATS.zip`, `שכבות ספורטיבית.zip`, `cvfr_mot.zip`.

## Key URLs

- פמ"ת main page: https://www.gov.il/he/departments/guides/aip (chapter ב' tab: `?chapterIndex=5`; GIS tab: `?chapterIndex=11`)
- Chapter files pattern: `https://www.gov.il/BlobFolder/guide/aip/he/<filename>` (URL-encode Hebrew)
- Whole-פמ"ת PDF: `.../פמת מלא 2-25.pdf`
- data.gov.il CVFR dataset (CKAN): https://data.gov.il/api/3/action/package_search?q=נתיבי+טיסה
- INPA: restrictions https://www.parks.org.il/new/tisa/ · GIS hub https://www.parks.org.il/gis/ (downloads terms-gated)

## Open items

1. Inspect `cvfr_mot_metadata.xlsx` → does the SHP carry altitude attributes? (fastest check)
2. Inspect `New_File_Geodatabase_ZONE.gdb_.zip` → could it replace manual appendix ב'/ג' extraction?
3. INPA direct downloads (behind terms form; CAAI-hosted KMZ is the shortcut).
4. Whether ב'-02 exists in the current edition (not visible in the rendered list).

*Current פמ"ת edition at research time: עדכון 02-2025 (in force 02-Oct-2025); page last updated 05.07.2026.*
