# Drone Operations App

A locally run, offline-capable web app for drone operators in Israel: compliance tracking, fleet
registry, airspace checks, pre-flight checklists, maintenance, and flight logs.

Product contract: `Drone-Ops-App_PRD.md`. Planning/methodology record: `work/`
(see `work/AGENT_CONVENTIONS.md` before opening any development session).

## Prerequisites

- **Node.js ≥ 20** (npm included)

## Setup

```
npm install
```

## Commands (from repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Starts client (Vite, http://localhost:5173) and server (Express, http://127.0.0.1:3001) together |
| `npm run test` | Runs Vitest suites in both packages |
| `npm run lint` | ESLint over both packages |
| `npm run typecheck` | Strict TypeScript check, both packages |

The client proxies `/api/*` to the server in dev. The server binds to `127.0.0.1` only — this is a
local, single-machine app by design.

## Layout

```
client/   React + Vite + TypeScript, Tailwind CSS + shadcn/ui
server/   Node + Express + TypeScript
work/     Planning docs: goal briefs, intent docs, session logs, decision log
```

## Data & backup

All app data lives in `app-data/` at the repo root (gitignored): the SQLite database
(`drone-ops.db`) and the document vault (`documents/`). This single directory is the unit of
backup.

**Backup** (Settings → Backup): enter a destination folder → the app writes a timestamped
`drone-ops-backup_YYYY-MM-DD_HHmm.zip` containing a consistent DB snapshot (safe while the app
runs), all documents, and a manifest recording the schema migration state.

**Restore** (Settings → Restore): enter an archive path → explicit confirmation → **all current
data is replaced** by the archive's contents and the app reloads. Restore refuses archives whose
schema state doesn't match the running app (protects against version drift). Restores are
full-replacement — there is no merge.

**Documents:** uploaded files are stored by the app under `app-data/documents/<entity-type>/<uuid>.<ext>`
with their metadata in the database. Allowed types: PDF, PNG, JPG; size limit 25 MB per file.
Files and metadata are created and deleted together — never move or delete files in
`app-data/documents/` by hand.

## Airspace zone data (DO-013)

Zone datasets (AIP prohibited/restricted/danger areas, drone-specific LLU
closures, OSM airport buffer anchors) are generated from the read-only source
snapshots in `data-sources/aip/` + `data-sources/gis/` and committed under
`data-sources/zones/` with per-dataset provenance manifests and reconciliation
reports. Load them into the local database with:

```
npm run zones:import -w server
```

Re-importing a dataset replaces its layer cleanly. Airport buffer radii are
read from the Regulations Ruleset at import time (edit the rule → re-import to
regenerate). **All imported layers are `verified=false`** until visually
verified against the official charts (release blocker, GB-06 Gate 3) — the
data is operator-maintained information, not an authoritative airspace source.
See `server/docs/zones-api.md` (consumer contract + regeneration steps) and
`data-sources/zones/README.md` (dataset inventory).

## PIN login

On first launch the app asks you to set a **PIN (4–12 digits)**. Every later launch requires it
before any data is shown. This is a local convenience lock for a single-user machine — it is not
encryption and not internet-facing security (the server only listens on `127.0.0.1`).

**Forgot the PIN?** Stop the app, then run from the repo root:

```
npm run auth:reset-pin -w server
```

This clears only the stored PIN hash — all data stays intact — and the app asks for a new PIN on
the next launch. Anyone with access to this machine's files could do the same; that is by design
for lockout recovery (the data was never encrypted with the PIN).

## Engineering conventions

*(Placeholder — grows with the codebase. Methodology-level conventions live in `work/AGENT_CONVENTIONS.md`.)*
