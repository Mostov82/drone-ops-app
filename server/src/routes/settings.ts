import { Router, type Request } from "express";
import { AUTH_SETTING_PREFIX } from "../auth/service.js";

/**
 * Storage seam for settings. The production store is Prisma-backed (Setting
 * model, DO-002); tests inject an in-memory implementation so the suite does
 * not depend on a migrated database.
 */
export interface SettingsStore {
  getAll(): Promise<Record<string, string>>;
  setMany(entries: Record<string, string>): Promise<void>;
}

export function createPrismaSettingsStore(): SettingsStore {
  return {
    async getAll() {
      const { prisma } = await import("../db.js");
      const rows = await prisma.setting.findMany();
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
    async setMany(entries) {
      const { prisma } = await import("../db.js");
      await prisma.$transaction(
        Object.entries(entries).map(([key, value]) =>
          prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
        ),
      );
    },
  };
}

const MAX_ENTRIES = 100;
const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 1000;

/** Returns the validated entries map, or null if the body is not { settings: Record<string, string> }. */
function parseBody(req: Request): Record<string, string> | null {
  const settings: unknown = (req.body as { settings?: unknown } | undefined)?.settings;
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) return null;
  const entries = Object.entries(settings);
  if (entries.length === 0 || entries.length > MAX_ENTRIES) return null;
  for (const [key, value] of entries) {
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) return null;
    if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) return null;
  }
  return settings as Record<string, string>;
}

export function createSettingsRouter(store: SettingsStore) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      // auth.* keys (PIN hash, DO-005) are internal — never exposed here.
      const all = await store.getAll();
      const settings = Object.fromEntries(
        Object.entries(all).filter(([key]) => !key.startsWith(AUTH_SETTING_PREFIX)),
      );
      res.json({ settings });
    } catch {
      res.status(500).json({ error: "Failed to read settings" });
    }
  });

  router.put("/", async (req, res) => {
    const entries = parseBody(req);
    if (entries === null) {
      res.status(400).json({ error: "Body must be { settings: Record<string, string> }" });
      return;
    }
    if (Object.keys(entries).some((key) => key.startsWith(AUTH_SETTING_PREFIX))) {
      // Writing auth.* through this route would bypass the change-PIN flow.
      res.status(400).json({ error: "auth.* keys are reserved" });
      return;
    }
    try {
      await store.setMany(entries);
      res.json({ settings: await store.getAll() });
    } catch {
      res.status(500).json({ error: "Failed to write settings" });
    }
  });

  return router;
}
