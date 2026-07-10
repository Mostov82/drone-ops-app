# Database Schema — Design Notes (DO-002)

**Status:** awaiting Gate 2 review (GB-01) — Jonathan must approve before any Phase 1 ticket opens.
**Schema:** `server/prisma/schema.prisma` · **DB:** SQLite at `app-data/drone-ops.db` (repo root, gitignored) · **ORM:** Prisma 6

## Shape at a glance

27 models covering every entity in the modules outline §3, plus two pre-approved additions:
`Setting` (key-value, FR-S3 — approved in intent doc) and `RegulationRuleChange`
(Ruleset history — approved in acceptance criteria).

```
Operator ─┬─ License (CAAI_RECREATIONAL | CAAI_COMMERCIAL | MOC_FREQUENCY)
          ├─ InsurancePolicy
          └─ Drone ─┬─ RegistrationRecord / Battery / Payload / Accessory
                    ├─ MaintenanceRecord ── Part
                    ├─ MaintenanceSchedule (mandatory flag → grounding)
                    ├─ Mission ─┬─ ComplianceCheck (append-only)
                    │           └─ PermitApplication ── Document
                    ├─ ChecklistRun (→ ChecklistTemplate ── ChecklistItem)
                    └─ FlightLog ── Incident
ZoneType (verdict mapping) ── Zone ── MapLayer (provenance + verified flag)
RegulationRule ── RegulationRuleChange          Setting          Document (vault)
FlightLocation
```

## Decisions needing your eye (Gate 2)

1. **No enums, no Json columns.** SQLite's Prisma connector supports neither. Allowed
   values are documented in schema comments and enforced at app level; JSON payloads
   live in `*Json` string columns. This is also what keeps a Postgres move trivial (NFR-7).
2. **Checklist run results are denormalized snapshots** (`ChecklistRun.itemResultsJson`)
   rather than a `ChecklistRunItem` table. Rationale: immutability — later template edits
   can never rewrite what a past run showed. The outline's `ChecklistItem` entity is the
   template item *definition*. If you prefer a normalized run-item table, say so now;
   it's cheap to change today and expensive after GB-04.
3. **Append-only pattern:** `ComplianceCheck` rows are never updated; `FlightLog`
   corrections create a new row pointing at the original via `correctsLogId` (1:1).
   Nothing is ever edited or deleted (NFR-4).
4. **Document linking** uses explicit optional FKs (license/insurance/drone/permit/operator),
   one non-null at a time (app-enforced), instead of a polymorphic `entityType/entityId`
   pair — keeps referential integrity real.
5. **Zone verdict mapping lives in `ZoneType.defaultVerdict`** — the GB-03 Gate 3
   three-tier resolution stored as editable data, seeded by `prisma/seed.ts`.
6. **Money as whole ILS integers** (`coverageAmount`, `cost`) — no Decimal on SQLite;
   agorot precision not needed for V1.
7. **Derived-but-stored accruals:** `Drone.flightHours`, `Battery.cycleCount` are columns
   updated by flight-log writes (FR-G2), per intent-doc context note.
8. **Single operator:** `Operator` is a real entity with real relations; the app assumes
   one row but nothing in the schema enforces it (multi-user stays possible, PRD NFR-7).

## Verification performed

`prisma validate` clean · `prisma migrate dev` clean on empty DB · live round-trip
including Hebrew text (`בדיקה`) and relations · 27 model accessors present in generated client.

## How to use (after `npm install`)

`npm run db:migrate` (apply migrations) · `npm run db:seed` (zone types) ·
`npm run db:studio` (browse). `DATABASE_URL` is in `server/.env`.
