# Location-check verdict engine — API contract (DO-015)

**Consumers:** the map location-check panel (DO-015 session 2) and **DO-017 —
GB-04 mission compliance checks reuse this engine verbatim**. This document is
written so DO-017 can consume the engine without reading its source.

**This is the safety-critical decision path.** Three standing properties every
consumer can rely on — and must not undermine:

1. **Fail closed.** A check that cannot be completed honestly throws/returns a
   structured bilingual error (table below) — it never degrades to a silent
   "clear". Never catch-and-default (same obligation as `ruleset-api.md`).
2. **Data-driven, read at check time.** The verdict mapping
   (`ZoneType.defaultVerdict`) and every Ruleset value are read fresh on every
   check — editing them changes verdicts with **no code change** (NFR-5).
   Nothing regulatory is a constant.
3. **Never authoritative** (PRD §10). Every response carries data-quality
   flags (unverified layers, approximate elevation, import dates, unverified
   rules). Consumers **must badge at point of use** (`UnverifiedBadge` /
   `ApproximateBadge` precedents) and **snapshot the values they acted on**
   into their own records (Gate 1 versioning decision).

---

## Service contract (what DO-017 consumes)

```ts
import { createVerdictEngine } from "../verdict/engine.js";
import { createPrismaVerdictStore } from "../verdict/store.js";
import { createPrismaRulesetStore, createRulesetReader } from "../ruleset/service.js";
import { createDemService } from "../map/dem.js";
import { resolveMapPaths } from "../map/paths.js";

const engine = createVerdictEngine({
  store: createPrismaVerdictStore(),
  rulesetReader: createRulesetReader(createPrismaRulesetStore()),
  demService: createDemService(resolveMapPaths().demDir),
});

const result = await engine.check({
  lat: 32.15,
  lng: 35.15,
  plannedAltitudeAglM: 50, // optional — METERS above ground level
});
```

All three dependencies are seams; tests inject in-memory implementations (see
`verdict/__tests__/engine.test.ts` for ready-made fixtures).

## HTTP route (mounted in session 2)

`createVerdictRouter()` (`verdict/routes.ts`) exposes:

```
GET /api/verdict/check?lat=<num>&lng=<num>[&aglM=<num>]
```

`aglM` = planned altitude, **meters AGL** (the Ruleset's altitude unit; ft
conversion is display-only elsewhere). The router is built but **not yet
mounted** — `app.ts` belongs to the DO-014 parallel window; session 2 mounts
it at `/api/verdict` behind the PIN middleware like every `/api` route.
Success responses are the `VerdictResult` JSON below; errors are the standard
`{ code, message: { en, he } }` shape.

---

## Response shape (`VerdictResult`)

```jsonc
{
  "verdict": "RESTRICTED",              // RESTRICTED | NEEDS_PERMIT | CLEAR
  "point": { "lat": 32.15, "lng": 35.15 },

  // Triggered zones, worst verdict first. Empty array ⇔ verdict CLEAR.
  "reasons": [
    {
      "kind": "POINT_IN_ZONE",          // or WITHIN_AIRPORT_BUFFER_RULE
      "verdict": "RESTRICTED",          // the zone type's EDITABLE mapping (Gate 3 data)
      "zone": {
        "id": "…", "name": "LLP99 — אזור בדיקה",
        "zoneTypeCode": "AIP_PROHIBITED", "zoneTypeName": "AIP prohibited area (LLP)",
        "floorAmslFt": 0, "ceilingAmslFt": null,   // ft AMSL as published; null = not published
        "notes": "…"                    // provenance / raw lane altitudes / aglCeilingFt=N verbatim
      },
      "layer": { "name": "aip-zones", "importedAt": "2026-07-11T…", "verified": false },
      "vertical": { /* VerticalFinding, only when aglM was given — see below */ }
      // WITHIN_AIRPORT_BUFFER_RULE and WITHIN_LANE_CORRIDOR reasons additionally carry:
      //   "distanceM": 2832, "rule": { "key": "airport_buffer_km" /* or cvfr_lane_halfwidth_km */, "value": 1, "unit": "km", "lastVerifiedAt": null }
      // CVFR_OVERHEAD reasons additionally carry:
      //   "allowedAglM": 48.4 (meters, rounded/clamped, null = no height claim)
    }
  ],

  // FR-C3 — always present (the check FAILS if no airport zones are imported)
  "distance": {
    "nearestAirport": {
      "zoneId": "…", "name": "OSM-node-1 — Test Field",
      "distanceM": 941,                 // to the airport reference point, rounded DOWN
      "insideImportedBuffer": true      // inside the imported buffer polygon (may lag the Ruleset)
    },
    "bufferWarning": {                  // null when outside the LIVE Ruleset buffer
      "ruleKey": "airport_buffer_km", "bufferM": 2000,
      "airportZoneId": "…", "airportName": "…", "distanceM": 941,
      "ruleLastVerifiedAt": null
    }
  },

  // FR-C6 — CVFR lanes. Corridor containment per the live Ruleset half-width
  // (see "Lanes"); a contained lane ALSO appears in reasons (WITHIN_LANE_CORRIDOR).
  "lanes": {
    "nearest": {
      "zoneId": "…", "name": "ROUTE1 — …",
      "horizontalDistanceM": 512,       // to the lane CENTERLINE, rounded down
      "withinCorridor": true,           // floor(distance) <= live half-width
      "floorAmslFt": 1000, "ceilingAmslFt": 3500,   // Option A min/max envelope
      "notes": "CVFR lane; directional altitudes ft AMSL as published: N 1000 / S 3500 | …",
      "layer": { "name": "cvfr-lanes", "importedAt": "…", "verified": false },
      "vertical": { "status": "BELOW_FLOOR", "clearanceFt": 494, … }, // when aglM given
      "allowedAglM": 48.4                                            // when within corridor, has published floor and no conflict
    },
    "laneCount": 265,
    "corridor": {                       // null when no lane zones are imported
      "ruleKey": "cvfr_lane_halfwidth_km", "halfWidthM": 1000, "ruleLastVerifiedAt": null
    }
  },

  // FR-C5 — null when no aglM was requested
  "vertical": {
    "plannedAltitudeAglM": 50,
    "elevation": { "elevationM": 100, "approximate": true, "source": "copernicus-glo30-dem", "resolutionM": 30 },
    "uncertaintyM": 4,
    "plannedAmslFt": { "minFt": 479, "maxFt": 506 }   // the WIDENED interval actually compared
  },

  // Gate 3: a CLEAR still shows the standard Ruleset limits. Read fail-closed
  // at check time; snapshot-friendly (key, value, unit, lastVerifiedAt).
  "context": {
    "numberLimits": [
      { "key": "max_altitude_agl_m", "value": 50, "unit": "m", "lastVerifiedAt": null },
      { "key": "min_distance_people_structures_m", "value": 250, "unit": "m", "lastVerifiedAt": null },
      { "key": "airport_buffer_km", "value": 2, "unit": "km", "lastVerifiedAt": null }
    ],
    "booleanLimits": [
      { "key": "vlos_required", "value": true, "lastVerifiedAt": null },
      { "key": "daylight_only", "value": true, "lastVerifiedAt": null }
    ]
  },

  // Badge all of this at point of use. A CLEAR over unverified layers is
  // itself unverified.
  "dataQuality": {
    "layers": [ { "name": "aip-zones", "importedAt": "…", "verified": false }, … ],
    "unverifiedLayers": ["aip-zones", "cvfr-lanes", …],
    "elevationApproximate": true,       // true whenever an elevation contributed
    "unverifiedRuleKeys": ["airport_buffer_km", …]
  },

  "checkedAt": "2026-07-11T12:00:00.000Z"
}
```

---

## Semantics

### Verdict aggregation (FR-C2, Gate 3)

- **Triggered = horizontally containing.** Point-in-polygon over every
  imported area zone (Polygon/MultiPolygon), **boundary inclusive** — a point
  exactly on a zone edge counts as inside (conservative, tested).
- **Verdict = worst of the triggered zones' mapped verdicts**, precedence
  `RESTRICTED > NEEDS_PERMIT > CLEAR`. The mapping is the editable
  `ZoneType.defaultVerdict` (Gate 3 data) — never a constant.
- No zones triggered → `CLEAR`, standard limits echoed in `context`.
- A planned altitude **never downgrades** a horizontally triggered zone: a
  zone whose floor is above the planned altitude still yields its mapped
  verdict, with the clearance visible in `reasons[].vertical`
  (`BELOW_FLOOR`, `clearanceFt`). **Ratified** — decision log 2026-07-13
  (DO-015 escalation 2 resolution): over-strict is the accepted failure
  direction; a permissive under-floor interpretation is a regulatory
  judgment nobody has authority to make here.
  **Exception (Amendment 2 — 2026-07-13; supersedes Amendment 1):** For `CVFR_LANE` zones,
  proven clearance below the floor (status `BELOW_FLOOR` after applying the ±4 m vertical uncertainty)
  or a horizontal-only check **does not trigger a restriction** — instead, it yields a
  warning-free `"CLEAR"` overall verdict (if no other restrictions trigger) accompanied by
  the `"CVFR_OVERHEAD"` reason kind carrying the computed `allowedAglM` headroom cap.
  Planned flight at or above the floor remains `RESTRICTED` w/ reason `WITHIN_LANE_CORRIDOR`.
  P/R/D and INPA zones never trigger overhead/allowed-height findings and never downgrade.

### Distance helpers (FR-C3)

- **Airport reference point** = centroid of the AIRPORT-type zone geometry.
  The airports layer stores buffer circles generated at import around the
  airport point (`zones-api.md`), so the centroid recovers that point.
- `nearestAirport.distanceM` = geodesic distance to that reference point,
  **rounded down** (never overstate distance from an airport).
- **Buffer proximity is read from the Ruleset at check time**
  (`airport_buffer_km`, fail-closed; km/m units only — anything else is a
  structured error, never a guessed conversion). If the point is within the
  live buffer, `bufferWarning` is set AND the airport's mapped verdict
  triggers (reason kind `WITHIN_AIRPORT_BUFFER_RULE`) even when the imported
  (possibly stale) polygon does not contain the point. Stale-vs-live
  discrepancies therefore always resolve conservatively: the imported polygon
  and the live radius both trigger. **This is the NFR-5 story**: edit
  `airport_buffer_km`, and the next check flips with no code change and no
  re-import (proven by test).

### Vertical separation (FR-C5/C6) — the conservative rounding rule

Planned altitude is supplied in **meters AGL**; zone bands are **ft AMSL as
published**. The engine converts via the terrain elevation at the point
(DO-012 DEM service — offline, always `approximate`, ~±4 m; decision log
2026-07-10; the engine never calls the online cross-check).

**The exact rule** (uncertainty *widens* conflicts, never narrows —
`vertical.ts`, tested):

```
minFt = floor((elevationM − 4 + aglM) / 0.3048)
maxFt = ceil ((elevationM + 4 + aglM) / 0.3048)
```

- 4 m = GLO-30 vertical uncertainty (decision log 2026-07-10). 0.3048 m/ft is
  the exact international-foot definition (unit conversion, not regulatory).
- A band **conflicts** iff `[minFt, maxFt]` overlaps the effective band,
  **inclusive at both edges** — touching a band edge counts as conflict.
- Clearances are the **smallest values consistent with the uncertainty**:
  `BELOW_FLOOR.clearanceFt = floor − maxFt`;
  `ABOVE_CEILING.clearanceFt = minFt − ceiling`.

**Band semantics, exactly as ratified** (decision log 2026-07-11;
`zones-api.md`), keyed by `zoneTypeCode`:

| Zone type | Floor | Ceiling |
|---|---|---|
| `AIP_PROHIBITED` / `AIP_RESTRICTED` / `AIP_DANGER` | `floorAmslFt <= 0` = **ground-reaching**, incl. below-sea-level terrain (Dead Sea): airspace between the terrain and 0 ft AMSL is **inside** the zone. Null floor (not expected in the data) = conservatively ground-reaching, flagged in `assumptions`. | **Null = unbounded above** (UNL). |
| `CVFR_LANE` | Option A min/max envelope of every published directional altitude (raw strings preserved in `notes`). | Same envelope. **Blank band (null/null) = NO vertical claim** (`NO_CLAIM`) — never "probably low". |
| Everything else (INPA, LLU, AIRPORT, …) | Null = **not published** — no claim on that side (the null=unbounded rule is P/R/D-only). A published floor with an unpublished ceiling yields a conservative `CONFLICT` at/above the floor, flagged in `assumptions`. | Same. AGL-published ceilings riding in `notes` (`aglCeilingFt=N`) are **not evaluated** — AGL→AMSL conversion awaits a modeling decision (`zones-api.md`); display them as published from `notes`. |

`VerticalFinding`:

```ts
{
  status: "CONFLICT" | "BELOW_FLOOR" | "ABOVE_CEILING" | "NO_CLAIM",
  clearanceFt: number | null,     // BELOW_FLOOR / ABOVE_CEILING only
  groundReaching: boolean,
  unboundedCeiling: boolean,      // P/R/D UNL only
  assumptions: string[]           // conservative assumptions applied (each widens, never narrows)
}
```

`NO_CLAIM` is not "clear" — it means the data makes no vertical statement.
Consumers must present it as such.

### Lanes (FR-C6) — corridor containment (ratified)

CVFR lanes are centerlines in the imported data; the corridor width is the
**editable Ruleset value `cvfr_lane_halfwidth_km`** (decision log 2026-07-13,
DO-015 escalation 1 resolution / Amendment 1), seeded from the governing ב'-03 text —
§2.ב (page ב-03-2, עדכון 2/25): *"רוחב הנתיבים הינו 2 ק"מ (1 ק"מ מכל צד
של מרכז הנתיב) אלא אם מצוין אחרת"* — route width 2 km, **1 km each side of
the centerline**, unless stated otherwise.

- The rule is read **fail-closed at check time whenever lane zones are
  imported** (missing/unset rule aborts the check; a lane-free install does
  not require it). Units km/m only — anything else errors, never a guessed
  conversion.
- **Containment rule (conservative rounding):** `floor(distanceM) <=
  halfWidthM` — flooring the measured centerline distance can only pull a
  point INTO the corridor, never push it out (the horizontal sibling of the
  vertical widening rule; touching the edge counts as inside).
- A contained lane **triggers its Gate 3 mapped verdict** (reason kind
  `WITHIN_LANE_CORRIDOR`, carrying `distanceM` and the `rule` used) and
  participates in worst-of if it conflicts vertically (planned flight at/above floor)
  or lacks a published floor.
- **Overhead lanes (Amendment 2):** containing lanes with a published floor and proven clearance
  (flight planned below floor or horizontal-only check) trigger `"CVFR_OVERHEAD"` (verdict: `"CLEAR"`)
  and carry `allowedAglM` (min over overlapping lanes of: floor AMSL - elevation - 4 m margin, clamped
  to 0 and capped by ruleset `max_altitude_agl_m`, fail-closed read).
- Vertical findings: Option A envelope; a **blank published band still makes NO vertical claim** (`NO_CLAIM`)
  even when the lane triggers horizontally — the two ratified rules compose (vertical stays NO_CLAIM,
  verdict remains `RESTRICTED` under `WITHIN_LANE_CORRIDOR`).
- **Not modeled (badge-relevant):** the source text's "אלא אם מצוין אחרת"
  ("unless stated otherwise") — per-lane width exceptions on the chart
  sheets are not captured; the seeded value is the published default. This
  is on the ב'-03 visual-check list (GB-06 Gate 3), and the rule seeds
  unverified like every regulatory value.

---

## Errors (all structured, bilingual `{ code, message: { en, he } }`)

The engine **throws `ApiError`s**; the router maps them to HTTP responses.
Errors from the Ruleset and DEM contracts propagate unchanged.

| Status | Code | When |
|---|---|---|
| 400 | `VERDICT_BAD_REQUEST` | Missing/malformed/out-of-range lat/lng, negative or non-numeric `aglM` |
| 503 | `VERDICT_NO_ZONE_DATA` | Zero imported layers or zero zones — a verdict over nothing is not a verdict |
| 503 | `VERDICT_NO_AIRPORT_DATA` | No AIRPORT-type zones imported — FR-C3 cannot be answered |
| 409 | `VERDICT_UNMAPPED_ZONE_TYPE` | A triggered zone type's verdict mapping is not RESTRICTED/NEEDS_PERMIT/CLEAR (intent trigger 2 — no default assumed) |
| 409 | `VERDICT_GEOMETRY_UNSUPPORTED` | A zone geometry the engine cannot evaluate (it could hide a restriction — the check aborts rather than skip it) |
| 409 | `VERDICT_BAD_RULE_UNIT` | `airport_buffer_km` / `cvfr_lane_halfwidth_km` in a unit other than km/m — no conversion is guessed |
| 404/409/400 | `RULE_NOT_FOUND` / `RULE_VALUE_UNSET` / `RULE_TYPE_MISMATCH` | Propagated from the fail-closed Ruleset read (`ruleset-api.md`) — includes the rules echoed in `context` |
| 503/404 | `DEM_NOT_AVAILABLE` / `DEM_OUT_OF_COVERAGE` | Propagated from the elevation service when `aglM` was requested (`map-api.md`). **The whole check aborts** — there is never a horizontal-only verdict when an altitude was asked. Retry without `aglM` for a horizontal-only check. |
| 500 | `VERDICT_INTERNAL` | Anything unexpected (router-level catch) |

## Consumer obligations (DO-017, session 2 UI)

1. **Never catch-and-default.** Any error above aborts the consuming
   computation and surfaces (mirrors `ruleset-api.md` obligation 1).
2. **Snapshot what you used.** Persist the parts of the response you acted on
   (verdict, reasons, `context` limits, `checkedAt`, data-quality flags) into
   your own records — the engine deliberately does not cache or version
   verdicts (each check runs fresh; snapshots are the consumer's job).
3. **Badge at point of use.** `unverifiedLayers`, `unverifiedRuleKeys`,
   `elevationApproximate`, and per-layer `importedAt` (staleness) must be
   visible wherever a verdict or derived value is shown. The verdict is
   operator-maintained information, never legal advice (PRD §10).
