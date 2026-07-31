# Changelog

All notable changes to this project are documented here. Entries are keyed to the
project's ticket IDs (`DO-XXX`). Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses date-based release sections.

## [Unreleased]

### Added
- **DO-035** — Map UX pass: collapsible sidebar sections, per-zone
  notes with coordination contacts, and a muted base-map option.

## [0.1.0] — 2026-07-15

Initial public release: an offline-first, bilingual (Hebrew/English, RTL) single-operator
drone-operations app for checking a location against Israeli airspace and drone rules.

### Added
- **DO-001–005** — Project scaffold, SQLite/Prisma schema, bilingual app shell with RTL,
  backup & restore, and PIN-gated local access with file storage.
- **DO-010** — Editable Regulations Ruleset (regulatory values live as data, never hard-coded),
  with a point-of-use "unverified" marker.
- **DO-012** — Offline map with local tiles and offline elevation (DEM), including an
  "approximate" marker on elevation-derived values and manual coordinate entry.
- **DO-013 / DO-014** — Zone data model and import pipeline (AIP P/R/D areas, CVFR lanes,
  airport buffers), plus zone overlays with per-layer provenance (source + import date).
- **DO-015** — Location-check verdict engine (the safety-critical decision path): fail-closed
  verdicts, conservative vertical math, CVFR lane-corridor handling with an advisory
  overhead allowed-height.
- **DO-032** — Online map mode (OpenTopoMap fallback) with a source indicator and override.
- **DO-033** — Zero-touch provisioning pipeline with a background elevation-data downloader
  and client progress card.
- **DO-034** — Place search via a Nominatim geocoding proxy.

### Notes
- View-only license (see `LICENSE`).
- Regulatory values are surfaced with provenance and are not legal advice.
