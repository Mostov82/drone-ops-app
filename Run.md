# Run the demo

Quick-start for showing the app end to end (Ruleset editor → offline map → zone overlays → location-check verdicts). Windows, from the repo root.

## 1. One-time setup (skip what you've already done)

```bash
npm install
npm run db:migrate -w server      # create/upgrade app-data/drone-ops.db
npm run db:seed -w server         # Ruleset catalog + zone-type verdicts (idempotent)
npm run zones:import -w server    # load all 5 zone layers (1,046 zones) from data-sources/zones/
```

Optional but worth it for a full demo — the two user-downloaded packages (see README for the step-by-step):

- **Map tiles** (`app-data/map/` MBTiles) — without them the map shows a bilingual "package missing" state; overlays and verdicts still work over blank tiles.
- **DEM** (GLO-30 GeoTIFFs) — without it, altitude checks return a deliberate `DEM_NOT_AVAILABLE` error (fail-closed by design); horizontal verdicts still work.

## 2. Start

```bash
npm run dev
```

Two processes start: server on `http://127.0.0.1:3001` (local only), client on the Vite URL it prints (typically `http://localhost:5173`). Open the client URL.

## 3. The PIN

**There is no preset PIN.** On first launch the app asks you to **set** one (4–12 digits) — whatever you choose is the demo PIN from then on (stored as a hash in the DB; nowhere in the repo).

- Fresh database → you'll be prompted to set a PIN; pick something like `1234` for demos.
- Existing database, PIN unknown/forgotten → stop the app and run:

  ```bash
  npm run auth:reset-pin -w server
  ```

  All data stays; next launch asks for a new PIN. (Local convenience lock only — not encryption; server listens on 127.0.0.1.)

## 4. Demo walkthrough

1. **Ruleset** — Settings → רישוי ורגולציה / Ruleset (`/settings/ruleset`): the regulatory limits as editable data, change history, unverified badges. Edit a value → watch it ripple (step 6).
2. **Map** — `/map`: five layers with verdict-colored overlays, legend, per-layer toggles, provenance + unverified indicators. Click a zone for its altitude band (try LLD42 — floor to −530 ft; an INPA reserve — AGL ceiling "as published").
3. **Location check** — click to pin (note the precise decimal + DMS coordinates), optionally type a planned altitude, run the check:
   - Ben Gurion area → **RESTRICTED** (airport buffer + lane corridor)
   - a Negev reserve → **NEEDS PERMIT**
   - Dead Sea shore → **CLEAR** (below-sea-level terrain handled)
   - Every verdict carries the data-quality banner (unverified layers, approximate elevation, "not authoritative" disclaimer) — that's a feature, not a bug.
4. **Prove it's data-driven** — bump `airport_buffer_km` in the Ruleset editor, re-run a check near an airport: the verdict flips with zero code changes. Change it back.
5. **Both languages** — switch to Hebrew in Settings: full RTL, including the map UI.

## Known demo caveats

- All zone layers are **unverified** (pending the ב'-08 visual check) — the badges say so honestly.
- Lane corridors/vertical downgrade per the 2026-07-13 decision land in the DO-015 follow-up session — until it merges, lanes report as nearest-lane facts + envelope bands.
- `[HE?]`-prefixed Hebrew terms are awaiting terminology review.
