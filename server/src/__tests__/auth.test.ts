import { describe, expect, it } from "vitest";
import request from "supertest";
import { authedAgent, makeApp, memoryPinStore, memorySettingsStore } from "./helpers.js";

describe("PIN auth", () => {
  it("reports uninitialized (with UI language) before any PIN is set", async () => {
    const res = await request(makeApp()).get("/api/auth/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "uninitialized", language: "en" });
  });

  it("rejects every unauthenticated API route with 401 (settings, hello, documents, backup)", async () => {
    const app = makeApp();
    for (const [method, url] of [
      ["get", "/api/settings"],
      ["put", "/api/settings"],
      ["get", "/api/hello"],
      ["get", "/api/documents"],
      ["post", "/api/documents"],
      ["post", "/api/backup"],
      ["post", "/api/restore"],
      ["post", "/api/auth/change-pin"],
      ["post", "/api/auth/logout"],
    ] as const) {
      const res = await request(app)[method](url);
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(401);
      expect(res.body.code, url).toBe("UNAUTHENTICATED");
      expect(res.body.message.en, url).toBeTypeOf("string");
      expect(res.body.message.he, url).toBeTypeOf("string");
    }
  });

  it("rejects malformed PINs at setup", async () => {
    const app = makeApp();
    for (const pin of ["123", "1234567890123", "12ab", "", undefined]) {
      const res = await request(app).post("/api/auth/setup").send({ pin });
      expect(res.status, String(pin)).toBe(400);
      expect(res.body.code).toBe("INVALID_PIN_FORMAT");
    }
  });

  it("setup runs once: authenticates the client and refuses a second setup", async () => {
    const app = makeApp();
    const agent = await authedAgent(app, "4321");

    const hello = await agent.get("/api/hello");
    expect(hello.status).toBe(200);

    const again = await request(app).post("/api/auth/setup").send({ pin: "9999" });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ALREADY_INITIALIZED");
  });

  it("reports locked without a session and authenticated with one", async () => {
    const app = makeApp();
    const agent = await authedAgent(app);

    const anonymous = await request(app).get("/api/auth/status");
    expect(anonymous.body.status).toBe("locked");

    const authed = await agent.get("/api/auth/status");
    expect(authed.body.status).toBe("authenticated");
  });

  it("login rejects a wrong PIN and grants access with the right one", async () => {
    const app = makeApp();
    await authedAgent(app, "246810");

    const wrong = await request(app).post("/api/auth/login").send({ pin: "111111" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe("WRONG_PIN");

    const agent = request.agent(app);
    const ok = await agent.post("/api/auth/login").send({ pin: "246810" });
    expect(ok.status).toBe(200);
    expect((await agent.get("/api/settings")).status).toBe(200);
  });

  it("change-PIN requires the current PIN, invalidates the old PIN and old sessions", async () => {
    const app = makeApp();
    const agent = await authedAgent(app, "1111");

    const otherSession = request.agent(app);
    await otherSession.post("/api/auth/login").send({ pin: "1111" });

    const badCurrent = await agent
      .post("/api/auth/change-pin")
      .send({ currentPin: "0000", newPin: "2222" });
    expect(badCurrent.status).toBe(401);

    const changed = await agent
      .post("/api/auth/change-pin")
      .send({ currentPin: "1111", newPin: "2222" });
    expect(changed.status).toBe(200);

    // Old PIN dead, new PIN works.
    expect((await request(app).post("/api/auth/login").send({ pin: "1111" })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ pin: "2222" })).status).toBe(200);

    // Every pre-change session is revoked; the changing client got a fresh one.
    expect((await otherSession.get("/api/hello")).status).toBe(401);
    expect((await agent.get("/api/hello")).status).toBe(200);
  });

  it("logout revokes the session", async () => {
    const app = makeApp();
    const agent = await authedAgent(app);
    await agent.post("/api/auth/logout");
    expect((await agent.get("/api/hello")).status).toBe(401);
  });

  it("stores a salted argon2 hash — never the plaintext PIN", async () => {
    const pinStore = memoryPinStore();
    const app = makeApp({ pinStore });
    await authedAgent(app, "13579");

    const stored = await pinStore.getHash();
    expect(stored).toBeTypeOf("string");
    expect(stored).toMatch(/^\$argon2/);
    expect(stored).not.toContain("13579");
  });

  it("keeps auth.* out of the settings API in both directions", async () => {
    // In production the PIN hash lives in the same Setting table the settings
    // API reads — seed one to prove the filter actually strips it.
    const settingsStore = memorySettingsStore();
    await settingsStore.setMany({ "auth.pinHash": "$argon2-seeded", language: "he" });
    const app = makeApp({ settingsStore });
    const agent = await authedAgent(app);

    const read = await agent.get("/api/settings");
    expect(read.body.settings).toEqual({ language: "he" });

    const write = await agent
      .put("/api/settings")
      .send({ settings: { "auth.pinHash": "attacker" } });
    expect(write.status).toBe(400);
  });
});
