import { describe, expect, it } from "vitest";
import request from "supertest";
import { authedAgent, makeApp } from "./helpers.js";

describe("GET /api/hello (smoke test)", () => {
  it("requires the PIN session like every API route (DO-005)", async () => {
    const res = await request(makeApp()).get("/api/hello");
    expect(res.status).toBe(401);
  });

  it("returns the alive message when authenticated", async () => {
    const agent = await authedAgent(makeApp());
    const res = await agent.get("/api/hello");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("alive");
    expect(typeof res.body.time).toBe("string");
  });
});
