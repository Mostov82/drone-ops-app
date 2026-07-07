import { describe, expect, it } from "vitest";
import { authedAgent, makeApp, memorySettingsStore } from "./helpers.js";

// All requests run through an authenticated agent — the routes sit behind the
// PIN middleware since DO-005 (unauthenticated behavior is covered in auth.test.ts).
describe("/api/settings", () => {
  it("returns an empty settings object initially", async () => {
    const agent = await authedAgent(makeApp());
    const res = await agent.get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: {} });
  });

  it("round-trips written settings", async () => {
    const agent = await authedAgent(makeApp());
    const put = await agent
      .put("/api/settings")
      .send({ settings: { language: "he", "alertLeadTimes.first": "60" } });
    expect(put.status).toBe(200);
    expect(put.body.settings.language).toBe("he");

    const get = await agent.get("/api/settings");
    expect(get.body.settings).toEqual({ language: "he", "alertLeadTimes.first": "60" });
  });

  it("merges partial updates instead of replacing", async () => {
    const agent = await authedAgent(makeApp());
    await agent.put("/api/settings").send({ settings: { language: "he" } });
    await agent.put("/api/settings").send({ settings: { units: "metric" } });
    const get = await agent.get("/api/settings");
    expect(get.body.settings).toEqual({ language: "he", units: "metric" });
  });

  it("rejects malformed bodies", async () => {
    const agent = await authedAgent(makeApp());
    for (const body of [
      {},
      { settings: null },
      { settings: [] },
      { settings: {} },
      { settings: { key: 42 } },
      { settings: { "": "value" } },
    ]) {
      const res = await agent.put("/api/settings").send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("rejects writes to reserved auth.* keys and never returns them", async () => {
    const settingsStore = memorySettingsStore();
    await settingsStore.setMany({ "auth.pinHash": "seeded", units: "metric" });
    const agent = await authedAgent(makeApp({ settingsStore }));

    const write = await agent.put("/api/settings").send({ settings: { "auth.pinHash": "x" } });
    expect(write.status).toBe(400);

    const read = await agent.get("/api/settings");
    expect(read.body.settings).toEqual({ units: "metric" });
  });
});
