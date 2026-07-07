import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import type { SettingsStore } from "../routes/settings.js";

// In-memory store so the suite does not depend on a migrated database.
function memoryStore(): SettingsStore {
  const map = new Map<string, string>();
  return {
    getAll: async () => Object.fromEntries(map),
    setMany: async (entries) => {
      for (const [key, value] of Object.entries(entries)) map.set(key, value);
    },
  };
}

describe("/api/settings", () => {
  it("returns an empty settings object initially", async () => {
    const res = await request(createApp({ settingsStore: memoryStore() })).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: {} });
  });

  it("round-trips written settings", async () => {
    const app = createApp({ settingsStore: memoryStore() });
    const put = await request(app)
      .put("/api/settings")
      .send({ settings: { language: "he", "alertLeadTimes.first": "60" } });
    expect(put.status).toBe(200);
    expect(put.body.settings.language).toBe("he");

    const get = await request(app).get("/api/settings");
    expect(get.body.settings).toEqual({ language: "he", "alertLeadTimes.first": "60" });
  });

  it("merges partial updates instead of replacing", async () => {
    const app = createApp({ settingsStore: memoryStore() });
    await request(app).put("/api/settings").send({ settings: { language: "he" } });
    await request(app).put("/api/settings").send({ settings: { units: "metric" } });
    const get = await request(app).get("/api/settings");
    expect(get.body.settings).toEqual({ language: "he", units: "metric" });
  });

  it("rejects malformed bodies", async () => {
    const app = createApp({ settingsStore: memoryStore() });
    for (const body of [
      {},
      { settings: null },
      { settings: [] },
      { settings: {} },
      { settings: { key: 42 } },
      { settings: { "": "value" } },
    ]) {
      const res = await request(app).put("/api/settings").send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});
