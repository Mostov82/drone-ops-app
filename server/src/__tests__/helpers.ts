// Shared test doubles: in-memory stores + a temp app-data dir, so no test
// depends on a migrated database or the real documents folder.
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp, type AppDeps } from "../app.js";
import { SessionStore, type PinStore } from "../auth/service.js";
import type { SettingsStore } from "../routes/settings.js";
import type {
  RuleChangeRecord,
  RuleRecord,
  RulesetStore,
} from "../ruleset/service.js";
import type { DocumentMeta, DocumentMetaStore } from "../storage/documents.js";

export function memoryPinStore(): PinStore {
  let hash: string | null = null;
  return {
    getHash: async () => hash,
    setHash: async (value) => {
      hash = value;
    },
  };
}

export function memorySettingsStore(): SettingsStore {
  const map = new Map<string, string>();
  return {
    getAll: async () => Object.fromEntries(map),
    setMany: async (entries) => {
      for (const [key, value] of Object.entries(entries)) map.set(key, value);
    },
  };
}

export function memoryDocumentMetaStore(): DocumentMetaStore {
  const rows = new Map<string, DocumentMeta>();
  return {
    async create(data) {
      const meta: DocumentMeta = { ...data, id: randomUUID(), uploadedAt: new Date() };
      rows.set(meta.id, meta);
      return meta;
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async list() {
      return [...rows.values()];
    },
    async delete(id) {
      if (!rows.delete(id)) throw new Error("Record to delete does not exist");
    },
  };
}

/** Build a RuleRecord fixture. Values here are arbitrary test data, never regulatory. */
export function ruleFixture(partial: Partial<RuleRecord> & { key: string }): RuleRecord {
  return {
    id: randomUUID(),
    category: "TEST",
    label: partial.key,
    valueType: "NUMBER",
    numberValue: null,
    boolValue: null,
    textValue: null,
    unit: null,
    description: null,
    lastVerifiedAt: null,
    ...partial,
  };
}

export function memoryRulesetStore(
  rules: RuleRecord[] = [],
): RulesetStore & { changes: RuleChangeRecord[] } {
  const rows = new Map(rules.map((r) => [r.key, { ...r }]));
  const changes: RuleChangeRecord[] = [];
  const byId = (ruleId: string) => {
    const rule = [...rows.values()].find((r) => r.id === ruleId);
    if (!rule) throw new Error("Rule to update does not exist");
    return rule;
  };
  return {
    changes,
    async list() {
      return [...rows.values()].map((r) => ({ ...r }));
    },
    async getByKey(key) {
      const rule = rows.get(key);
      return rule ? { ...rule } : null;
    },
    async applyValueChange({ ruleId, data, previousValue, newValue, note }) {
      const rule = byId(ruleId);
      Object.assign(rule, data);
      changes.push({ id: randomUUID(), ruleId, changedAt: new Date(), previousValue, newValue, note });
      return { ...rule };
    },
    async setVerified(ruleId, when) {
      const rule = byId(ruleId);
      rule.lastVerifiedAt = when;
      return { ...rule };
    },
    async history(ruleId) {
      return changes
        .filter((c) => c.ruleId === ruleId)
        .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
        .map((c) => ({ ...c }));
    },
  };
}

export function tempAppDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "drone-ops-test-"));
}

export function makeApp(overrides: AppDeps = {}) {
  return createApp({
    pinStore: memoryPinStore(),
    sessions: new SessionStore(),
    settingsStore: memorySettingsStore(),
    documentMetaStore: memoryDocumentMetaStore(),
    rulesetStore: memoryRulesetStore(),
    appDataDir: tempAppDataDir(),
    ...overrides,
  });
}

/** A supertest agent (cookie-keeping) that has completed PIN setup. */
export async function authedAgent(
  app: ReturnType<typeof createApp>,
  pin = "1234",
): Promise<InstanceType<typeof TestAgent>> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/setup").send({ pin });
  if (res.status !== 201) throw new Error(`PIN setup failed in test helper: ${res.status}`);
  return agent;
}
