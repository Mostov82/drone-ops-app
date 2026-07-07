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

*(Placeholder — filled in by DO-004/DO-005: database location, documents folder, backup/restore.)*

## Engineering conventions

*(Placeholder — grows with the codebase. Methodology-level conventions live in `work/AGENT_CONVENTIONS.md`.)*
