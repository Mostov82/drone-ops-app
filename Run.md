# Run the demo

Quick-start for showing the app end to end (Ruleset editor → offline map → zone overlays → location-check verdicts). Windows, from the repo root.

## 1. Setup

```bash
npm install
```

On first run, database migrations, Ruleset seeding, and zone layers will provision themselves automatically. The Copernicus GLO-30 DEM elevation data downloads in the background when connected to the internet.

Optional map tile package:
- **Map tiles** (`app-data/map/tiles.mbtiles`) — optional offline map tiles. If missing, the map automatically falls back to online OpenTopoMap topographic tiles (when connected). If offline, it surfaces a clean "Map unavailable" status state.

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
- `[HE?]`-prefixed Hebrew terms are awaiting terminology review.
