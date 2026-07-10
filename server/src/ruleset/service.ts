// Regulations Ruleset service (DO-010, FR-A5).
//
// Two faces:
//  - The EDITOR operations (list, update value, mark verified, history) used
//    by the routes in ./routes.ts.
//  - The READ API — the contract consumed by the zone verdict engine (DO-015)
//    and the mission compliance checks (DO-017). Documented in
//    server/docs/ruleset-api.md. It FAILS CLOSED (GB-02 Gate 1): a missing
//    rule, an unset value, or a type mismatch throws a structured
//    RulesetError. There are no defaults — the app must never authorize a
//    flight on missing regulatory data.
import { ApiError } from "../api-error.js";

export type RuleValueType = "NUMBER" | "BOOLEAN" | "TEXT";

export interface RuleRecord {
  id: string;
  key: string;
  category: string;
  label: string;
  valueType: string;
  numberValue: number | null;
  boolValue: boolean | null;
  textValue: string | null;
  unit: string | null;
  description: string | null;
  lastVerifiedAt: Date | null;
}

export interface RuleChangeRecord {
  id: string;
  ruleId: string;
  changedAt: Date;
  previousValue: string; // JSON snapshot {numberValue,boolValue,textValue,unit}
  newValue: string; // JSON snapshot
  note: string | null;
}

/** Value snapshot stored in RegulationRuleChange rows (schema, DO-002). */
export interface RuleValueSnapshot {
  numberValue: number | null;
  boolValue: boolean | null;
  textValue: string | null;
  unit: string | null;
}

/**
 * Storage seam, matching the settings/documents pattern: production is
 * Prisma-backed; tests inject an in-memory implementation.
 */
export interface RulesetStore {
  list(): Promise<RuleRecord[]>;
  getByKey(key: string): Promise<RuleRecord | null>;
  /** Atomically update the rule's value AND append the change row. */
  applyValueChange(change: {
    ruleId: string;
    data: Pick<RuleRecord, "numberValue" | "boolValue" | "textValue">;
    previousValue: string;
    newValue: string;
    note: string | null;
  }): Promise<RuleRecord>;
  setVerified(ruleId: string, when: Date): Promise<RuleRecord>;
  history(ruleId: string): Promise<RuleChangeRecord[]>;
}

export function createPrismaRulesetStore(): RulesetStore {
  return {
    async list() {
      const { prisma } = await import("../db.js");
      return prisma.regulationRule.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
    },
    async getByKey(key) {
      const { prisma } = await import("../db.js");
      return prisma.regulationRule.findUnique({ where: { key } });
    },
    async applyValueChange({ ruleId, data, previousValue, newValue, note }) {
      const { prisma } = await import("../db.js");
      const [updated] = await prisma.$transaction([
        prisma.regulationRule.update({ where: { id: ruleId }, data }),
        prisma.regulationRuleChange.create({
          data: { ruleId, previousValue, newValue, note },
        }),
      ]);
      return updated;
    },
    async setVerified(ruleId, when) {
      const { prisma } = await import("../db.js");
      return prisma.regulationRule.update({
        where: { id: ruleId },
        data: { lastVerifiedAt: when },
      });
    },
    async history(ruleId) {
      const { prisma } = await import("../db.js");
      return prisma.regulationRuleChange.findMany({
        where: { ruleId },
        orderBy: { changedAt: "desc" },
      });
    },
  };
}

// ─────────────────────────── Errors (fail-closed) ───────────────────────────

export type RulesetErrorCode = "RULE_NOT_FOUND" | "RULE_VALUE_UNSET" | "RULE_TYPE_MISMATCH";

export class RulesetError extends ApiError {
  constructor(
    status: number,
    code: RulesetErrorCode,
    public ruleKey: string,
    messages: { en: string; he: string },
  ) {
    super(status, code, messages);
  }
}

function notFound(key: string): RulesetError {
  return new RulesetError(404, "RULE_NOT_FOUND", key, {
    en: `Regulation rule "${key}" does not exist.`,
    he: `כלל הרגולציה "${key}" אינו קיים.`,
  });
}

function unset(key: string): RulesetError {
  return new RulesetError(409, "RULE_VALUE_UNSET", key, {
    en: `Regulation rule "${key}" has no value yet. It must be set (and verified) before it can be used.`,
    he: `לכלל הרגולציה "${key}" טרם נקבע ערך. יש לקבוע (ולאמת) ערך לפני שניתן להשתמש בו.`,
  });
}

function typeMismatch(key: string, expected: RuleValueType, actual: string): RulesetError {
  return new RulesetError(400, "RULE_TYPE_MISMATCH", key, {
    en: `Regulation rule "${key}" is of type ${actual}, not ${expected}.`,
    he: `כלל הרגולציה "${key}" הוא מסוג ${actual}, לא ${expected}.`,
  });
}

// ───────────────────────── Read API — the contract ─────────────────────────

export interface NumberRuleValue {
  key: string;
  value: number;
  unit: string | null;
  lastVerifiedAt: Date | null;
}

export interface BooleanRuleValue {
  key: string;
  value: boolean;
  lastVerifiedAt: Date | null;
}

export interface TextRuleValue {
  key: string;
  value: string;
  lastVerifiedAt: Date | null;
}

export interface RulesetReader {
  getNumberRule(key: string): Promise<NumberRuleValue>;
  getBooleanRule(key: string): Promise<BooleanRuleValue>;
  getTextRule(key: string): Promise<TextRuleValue>;
}

async function requireRule(
  store: RulesetStore,
  key: string,
  expected: RuleValueType,
): Promise<RuleRecord> {
  const rule = await store.getByKey(key);
  if (rule === null) throw notFound(key);
  if (rule.valueType !== expected) throw typeMismatch(key, expected, rule.valueType);
  return rule;
}

export function createRulesetReader(store: RulesetStore): RulesetReader {
  return {
    async getNumberRule(key) {
      const rule = await requireRule(store, key, "NUMBER");
      if (rule.numberValue === null) throw unset(key);
      return {
        key,
        value: rule.numberValue,
        unit: rule.unit,
        lastVerifiedAt: rule.lastVerifiedAt,
      };
    },
    async getBooleanRule(key) {
      const rule = await requireRule(store, key, "BOOLEAN");
      if (rule.boolValue === null) throw unset(key);
      return { key, value: rule.boolValue, lastVerifiedAt: rule.lastVerifiedAt };
    },
    async getTextRule(key) {
      const rule = await requireRule(store, key, "TEXT");
      if (rule.textValue === null) throw unset(key);
      return { key, value: rule.textValue, lastVerifiedAt: rule.lastVerifiedAt };
    },
  };
}

// ─────────────────────────── Editor operations ───────────────────────────

function snapshot(rule: RuleRecord): string {
  const snap: RuleValueSnapshot = {
    numberValue: rule.numberValue,
    boolValue: rule.boolValue,
    textValue: rule.textValue,
    unit: rule.unit,
  };
  return JSON.stringify(snap);
}

function invalidValue(key: string, valueType: string): RulesetError {
  return new RulesetError(400, "RULE_TYPE_MISMATCH", key, {
    en: `Value for "${key}" must be of type ${valueType}.`,
    he: `הערך של "${key}" חייב להיות מסוג ${valueType}.`,
  });
}

/**
 * Update a rule's value, appending a RegulationRuleChange row with
 * before/after snapshots (append-only history, GB-01 Gate 2 pattern).
 */
export async function updateRuleValue(
  store: RulesetStore,
  key: string,
  rawValue: unknown,
  note?: string,
): Promise<RuleRecord> {
  const rule = await store.getByKey(key);
  if (rule === null) throw notFound(key);

  const data: Pick<RuleRecord, "numberValue" | "boolValue" | "textValue"> = {
    numberValue: null,
    boolValue: null,
    textValue: null,
  };
  switch (rule.valueType) {
    case "NUMBER":
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue))
        throw invalidValue(key, rule.valueType);
      data.numberValue = rawValue;
      break;
    case "BOOLEAN":
      if (typeof rawValue !== "boolean") throw invalidValue(key, rule.valueType);
      data.boolValue = rawValue;
      break;
    case "TEXT":
      if (typeof rawValue !== "string" || rawValue.length === 0)
        throw invalidValue(key, rule.valueType);
      data.textValue = rawValue;
      break;
    default:
      throw invalidValue(key, rule.valueType);
  }

  const previousValue = snapshot(rule);
  const newValue = snapshot({ ...rule, ...data });
  return store.applyValueChange({
    ruleId: rule.id,
    data,
    previousValue,
    newValue,
    note: note ?? null,
  });
}

/** Set lastVerifiedAt = now. Verification does not change the value, so no history row. */
export async function markRuleVerified(store: RulesetStore, key: string): Promise<RuleRecord> {
  const rule = await store.getByKey(key);
  if (rule === null) throw notFound(key);
  return store.setVerified(rule.id, new Date());
}

export async function getRuleHistory(
  store: RulesetStore,
  key: string,
): Promise<RuleChangeRecord[]> {
  const rule = await store.getByKey(key);
  if (rule === null) throw notFound(key);
  return store.history(rule.id);
}
