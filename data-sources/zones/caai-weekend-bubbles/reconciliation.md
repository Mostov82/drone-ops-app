# Reconciliation — caai-weekend-bubbles — 2026-07-28

**Source:** AIP ב'-08 *מפת גובה נמוך לתעופה ספורטיבית* 1:250,000, ed 2/25 (Oct 2025), datum WGS84,
northern + southern sheets → hand-traced to `data-sources/traced/b08_weekend_bubbles.geojson` → this dataset.

## Counts

- traced input features: **37** · imported: **37** · skipped: **0**
- weekend-only: **32** · all-week: **5**
- of the weekend-only figure, **30** were **inferred, not published** (see below)
- ceilings: **400–4000 ft AMSL**, floors GND (0)

## Caveats for the visual check (GB-06 Gate 3)

- **THE GEOMETRY IS HAND-TRACED, ~0.4′ (≈500 m).** It is not chart-authoritative and no surface may
  present it as such (PRD §10). This is the highest-priority eyeball in this dataset.
- **`weekendOnly` is inferred for 30 of 37 bubbles.** The traced input carries the key on only a
  minority of features. Jonathan ruled 2026-07-28 that absence means weekend-only; the intent doc
  independently names the all-week bubbles as a small set and the input flags exactly those
  `false`, which corroborates it. **It remains an inference** — each affected bubble is listed as
  a `note` issue below.
- **The input's `sheet` field was deliberately NOT carried into the database.** Every feature
  claims `sheet: "north"`, including bubbles unmistakably on the southern sheet (באר שבע, קציעות,
  פארן, חריף, שבטה, ירוחם, עין גדי, אלמוג, מיתר, להבים, זוהר, ניצנים, שדרות צפון/דרום).
  `extraction-method.md` records why: it is a **tracer-UI default**, not an observation. Shipping
  provenance known to be wrong is what the provenance-honesty rule forbids, so it is recorded here
  rather than asserted per-zone. Re-deriving the true sheet per bubble is a Gate 3 job.
- **Georeference and method: `extraction-method.md`, alongside this file.** Both sheets rendered
  at 150 dpi (4134 × 5906 px); axis-aligned affine off the 10′ graticule, anchored to labelled
  crossings and checked against known reporting points. North sheet
  `lon = 34.0763 + 0.00045028·px`, `lat = 33.43465 − 0.00038194·py`; south sheet
  `lon = 34.0432 + 0.00044111·px`, `lat = 31.6013 − 0.00038212·py`. Datum WGS84, VAR 5°E (2025).
  That record also documents the automation ceiling that forced hand-tracing: the green outline
  colour is shared by bubble outlines, mid-week sport routes **and** the ב'-09 UAV בראשית areas, so
  contour-tracing closed only 3 of 37 reliably.
- **Not all 37 bubbles are equally uncertain.** Per `extraction-method.md`, route-circuit bubbles
  (e.g. נעמה, אלמוג) were built from the back-page reporting-point table and cross-checked
  leg-by-leg (bearing ±~1°, distance ±~0.1 NM); the area bubbles are the hand-traced ones. The
  dataset does not yet distinguish them per-zone — every zone carries the conservative
  hand-traced caveat, which under-claims for the route-circuit few. Worth splitting at Gate 3.
- **Ceilings are ft AMSL, ingested with no conversion** (trigger 3, resolved 2026-07-28, same as
  DO-044's ב'-09 source). Re-surface only if a bubble's published value plainly contradicts an AMSL
  reading.
- **Codes `WBnn` are dataset-scoped ordinals** in traced-file order. The chart labels bubbles by
  name only; do not read `WB07` as a published designator.

## Issue summary

note: 30

## Issues

| Code | Kind | Detail |
|---|---|---|
| WB01 | note | "בועת כנרת" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB02 | note | "בועת רמת הגולן" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB03 | note | "בועת מגידו א' מזרח" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB04 | note | "בועת מגידו ב' מזרח" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB07 | note | "בועת חרוד" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB08 | note | "בועת אורן" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB09 | note | "בועת ערה" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB10 | note | "בועת השרון צפון" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB11 | note | "בועת החולה" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB12 | note | "בועת כרמיאל" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB13 | note | "בועת נעמה" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB14 | note | "בועת גוברין (דרומי)" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB15 | note | "בועת גוברין (צפונית)" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB16 | note | "בועת שדרות צפון" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB17 | note | "בועת שדרות דרום" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB18 | note | "בועת להבים" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB19 | note | "בועת ים המלח" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB20 | note | "בועת שלם" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB21 | note | "בועת עין גדי" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB22 | note | "בועת מיתר" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB23 | note | "בועת ניצנים" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB24 | note | "בועת באר שבע" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB25 | note | "בועת שבטה" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB26 | note | "בועת זוהר" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB27 | note | "בועת ירוחם" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB28 | note | "בועת קציעות" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB29 | note | "בועת פארן" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB30 | note | "בועת חריף" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB31 | note | "בועת שיטים" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |
| WB32 | note | "בועת צניפים" carries no weekendOnly in the traced input — defaulted to true per Jonathan's ruling 2026-07-28 (inferred, NOT published) |

_Everything ships `verified=false` until Jonathan's visual check (GB-06 Gate 3)._
