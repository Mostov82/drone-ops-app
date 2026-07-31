# Extraction method & georeference — caai-weekend-bubbles

**Layer:** `caai-weekend-bubbles` — AIP ב'-08 weekend fly-bubbles (בועות טיסת סופ"ש, sport aviation)
**Produced:** 2026-07-28 · **Datum:** WGS84 · **Magnetic variation:** 5°E (2025)
**Status:** hand-traced, ~0.4′ (≈500 m); **NOT chart-authoritative** — `verified=false` pending GB-06 Gate 3 visual check (PRD §10).

This is the extraction record DO-045 and the dataset `reconciliation.md` refer to. It records the georeference and method so the trace is reproducible and auditable. It is **INPUT provenance**, not app code.

---

## Source

AIP **ב'-08** *מפת גובה נמוך לתעופה ספורטיבית* (low-altitude sport-aviation chart) 1:250,000, ed 2/25 (Oct 2025), northern + southern sheets. Native Adobe Illustrator vector PDFs:
- `data-sources/aip/aip_b-08_north-sheet.pdf`
- `data-sources/aip/aip_b-08_south-sheet.pdf`

The chart draws **37 weekend fly-bubbles** (the national master list, printed on the back of each sheet as a CODE→name table). Traced output: `data-sources/traced/b08_weekend_bubbles.geojson` → dataset `data-sources/zones/caai-weekend-bubbles/`.

---

## Georeference (pixel → WGS84)

Both sheets were rendered at **150 dpi → 4134 × 5906 px** raster. The graticule is a regular 10′ lat/lon grid; the transform is a plain axis-aligned affine (the chart's meridians are vertical, parallels horizontal), derived from the graticule lines in the vector layer and anchored to labelled crossings. Verified against known reporting points (e.g. אלמוג → 35.456°E vs published 35.457°E; נעמה on-node).

**NORTH sheet** (raster 4134 × 5906):
```
lon = 34.0763 + 0.00045028 * px
lat = 33.43465 - 0.00038194 * py
```
- Image bounds (for a Leaflet ImageOverlay): SW **[31.1789, 34.0763]**, NE **[33.43465, 35.937758]**.
- Anchors: meridian x = 984.8 pt = 35°00′E; parallel y = 1031.5 pt = 32°00′N; grid ≈ 177.7 pt/10′ lon, 209.5 pt/10′ lat.

**SOUTH sheet** (raster 4134 × 5906):
```
lon = 34.0432 + 0.00044111 * px
lat = 31.6013 - 0.00038212 * py
```
- Image bounds: SW **[29.3443, 34.0432]**, NE **[31.6013, 35.8668]**.
- Anchors: meridian x = 1041.2 pt = 35°00′E; parallel y = 2707.5 pt = 31°30′N; grid ≈ 181.4 pt/10′ lon, 209.4 pt/10′ lat.

Page-point ↔ raster: `px = pt * 150/72`; y flips at page height **H = 2834.65 pt** (`py = (H - y_pt) * 150/72`). Page-point affine (north): `lon = 34.0763 + (0.1667/177.7)*x_pt`, `lat = 31.1792 + (0.1667/209.5)*y_pt`.

---

## Method

1. **Vector extraction.** Parse each front-page PDF with pdfminer (text rendering disabled for speed) → the stroked path set with per-path colour. The graticule = long thin dark lines → the affine above.
2. **Two bubble kinds, two extraction paths:**
   - **Route-circuit bubbles** (e.g. נעמה, אלמוג) — boundary = named reporting points joined by brown weekend-route legs (colour `0.505,0.288,0.17`), each leg printed with a magnetic bearing + distance. Built **exactly** from the back-page reporting-point coordinate table (214 points, name→WGS84) and cross-checked leg-by-leg (bearing within ~1°, distance within ~0.1 NM at VAR 5°E). Highest fidelity.
   - **Area bubbles** (most; green/purple/thin-outline filled regions whose corners are **not** reporting points) — **hand-traced** over the georeferenced render.
3. **Automation ceiling (why hand-tracing was necessary).** The green outline colour (`0.0,0.589,0.253`) is **shared** by bubble outlines, mid-week sport routes, **and** the ב'-09 UAV בראשית area outlines; the Illustrator outlines are fragmented open strokes; the Dead-Sea bubbles are thin-outline. Automatic contour-tracing could not separate bubbles from routes/UAV-areas and reliably closed only 3 of 37. The remaining bubbles were traced by hand.

---

## Tooling

**`bubble_tracer.html`** — a self-contained two-map tracing instrument (Leaflet embedded, works offline; persisted as the desktop artifact `weekend-bubble-tracer`). Load a sheet image + its preset bounds (above) → the chart overlays georeferenced on OSM; click pins to trace a bubble, live polygon mirrored on the second map; snap-to-reporting-point (the 214 north points embedded); per-bubble name / floor / ceiling / `weekendOnly` / confidence / sheet; GeoJSON import/export. This is the **refinement instrument** for future GB-06 Gate 3 passes — it is delivered tooling, not part of the app.

---

## Output schema (per feature)

`name_he`, `zoneType:"WEEKEND_BUBBLE"`, `weekendOnly` (bool), `altFloor` (0 = GND), `altCeiling` (**ft AMSL** — resolved 2026-07-28, ingest with no conversion), `layer:"caai-weekend-bubbles"`, `verified:false`, `confidence` (`manual-trace`), `sheet`.

**Known provenance caveats (see the dataset `reconciliation.md` for the audit list):**
- Geometry is hand-traced ~500 m — not chart-authoritative.
- `weekendOnly` is carried on only the operator-touched features; absent = weekend-only per Jonathan's 2026-07-28 ruling (inferred, not published — each listed in the reconciliation).
- The `sheet` field in the traced input reads `"north"` for every feature (a tracer-UI default), including bubbles plainly on the southern sheet; it was deliberately **not** carried into the DB as provenance.
- Codes `WBnn` in the dataset are dataset-scoped ordinals in traced-file order — the chart publishes no per-bubble designator.
