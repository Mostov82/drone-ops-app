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

export function tempAppDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "drone-ops-test-"));
}

export function makeApp(overrides: AppDeps = {}) {
  return createApp({
    pinStore: memoryPinStore(),
    sessions: new SessionStore(),
    settingsStore: memorySettingsStore(),
    documentMetaStore: memoryDocumentMetaStore(),
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
