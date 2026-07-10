# Regulations Ruleset — read-API contract (DO-010)

**Consumers:** DO-015 (zone verdict engine), DO-017 (mission compliance checks), and any later module needing a regulatory value. **Regulatory values are never hard-coded (NFR-5, conventions §4) — this API is the only way code obtains them.**

## The contract

```ts
import { createPrismaRulesetStore, createRulesetReader } from "../ruleset/service.js";

const reader = createRulesetReader(createPrismaRulesetStore());

const altitude = await reader.getNumberRule("max_altitude_agl_m");
// → { key, value: number, unit: string | null, lastVerifiedAt: Date | null }

const vlos = await reader.getBooleanRule("vlos_required");
// → { key, value: boolean, lastVerifiedAt: Date | null }

const text = await reader.getTextRule(key);
// → { key, value: string, lastVerifiedAt: Date | null }
```

Tests inject any `RulesetStore` implementation (see `__tests__/helpers.ts` → `memoryRulesetStore`).

## Fail-closed semantics (GB-02 Gate 1, locked)

Every accessor **throws a `RulesetError`** — it never returns a default, `null`, or `undefined`:

| Code | When | HTTP status if surfaced |
|---|---|---|
| `RULE_NOT_FOUND` | No rule with that key exists | 404 |
| `RULE_VALUE_UNSET` | The rule exists but its value is null (e.g. `registration_weight_threshold_g` until Gate 2 research fills it) | 409 |
| `RULE_TYPE_MISMATCH` | Accessed through the wrong typed accessor | 400 |

`RulesetError extends ApiError`: carries `code`, `ruleKey`, and bilingual `messages { en, he }`.

**Consumer obligations:**

1. **Never catch-and-default.** A missing regulatory value must abort the computation and surface as an escalation — a verdict or compliance check can never silently pass without it. If fail-closed proves awkward for your consumer pattern, that is intent-doc escalation territory, not a workaround.
2. **Snapshot what you used.** Per the Gate 1 versioning decision, consumers denormalize the rule values they acted on into their own records (e.g. a checklist run stores the limits it checked against). The read API deliberately has no time-travel queries.
3. **Badge unverified values at point of use.** If `lastVerifiedAt` is null, any UI displaying the value or a verdict derived from it must show the unverified marker (client: `components/UnverifiedBadge.tsx`).

## Seeded keys (GB-02 Gate 1 catalog)

Values live in the database (seeded by `src/ruleset/seed-catalog.ts` via `npm run db:seed -w server`). Keys, by category:

- ALTITUDE: `max_altitude_agl_m`
- DISTANCE: `min_distance_people_structures_m`, `airport_buffer_km`
- OPERATIONAL: `vlos_required`, `daylight_only`
- LICENSING: `min_registration_age_years`, `moc_frequency_license_required`
- PERMITS: `permit_fee_recreational_nis`, `permit_turnaround_hours_min`, `permit_turnaround_hours_max`
- WEIGHT: `registration_weight_threshold_g` — **seeded with no value**; reads throw `RULE_VALUE_UNSET` until GB-02 Gate 2 research sets it

## Editor HTTP routes (not the consumer contract)

Behind the PIN middleware, for the Settings → Ruleset editor UI:

- `GET /api/ruleset` — all rules
- `GET /api/ruleset/:key/history` — append-only change rows, newest first, snapshots parsed
- `PUT /api/ruleset/:key/value` — body `{ value, note? }`; writes a `RegulationRuleChange` with before/after snapshots
- `POST /api/ruleset/:key/verify` — sets `lastVerifiedAt` to now (no history row; verification is not a value change)
