import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("GET /api/hello (smoke test)", () => {
  it("returns the alive message", async () => {
    const res = await request(createApp()).get("/api/hello");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("alive");
    expect(typeof res.body.time).toBe("string");
  });
});
