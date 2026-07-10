// DO-010: read-API contract (fail-closed) + editor operations + routes.
// All rule values in this file are arbitrary test data, never regulatory.
import { describe, it, expect } from "vitest";
import {
  createRulesetReader,
  getRuleHistory,
  markRuleVerified,
  updateRuleValue,
  RulesetError,
  type RuleValueSnapshot,
} from "../ruleset/service.js";
import { authedAgent, makeApp, memoryRulesetStore, ruleFixture } from "./helpers.js";

function storeWithFixtures() {
  return memoryRulesetStore([
    ruleFixture({ key: "test_number", valueType: "NUMBER", numberValue: 123, unit: "m" }),
    ruleFixture({ key: "test_bool", valueType: "BOOLEAN", boolValue: true }),
    ruleFixture({ key: "test_text", valueType: "TEXT", textValue: "hello" }),
    ruleFixture({ key: "test_unset_number", valueType: "NUMBER", unit: "g" }),
  ]);
}

describe("read API — typed access", () => {
  it("returns the typed value, unit, and verification date for each type", async () => {
    const reader = createRulesetReader(storeWithFixtures());
    const num = await reader.getNumberRule("test_number");
    expect(num).toMatchObject({ key: "test_number", value: 123, unit: "m", lastVerifiedAt: null });
    const bool = await reader.getBooleanRule("test_bool");
    expect(bool).toMatchObject({ key: "test_bool", value: true });
    const text = await reader.getTextRule("test_text");
    expect(text).toMatchObject({ key: "test_text", value: "hello" });
  });
});

describe("read API — fails closed, never defaults", () => {
  it("throws RULE_NOT_FOUND for an unknown key", async () => {
    const reader = createRulesetReader(storeWithFixtures());
    const err = await reader.getNumberRule("does_not_exist").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RulesetError);
    expect((err as RulesetError).code).toBe("RULE_NOT_FOUND");
    expect((err as RulesetError).ruleKey).toBe("does_not_exist");
    expect((err as RulesetError).messages.he).toBeTruthy();
  });

  it("throws RULE_VALUE_UNSET for a rule whose value is not set", async () => {
    const reader = createRulesetReader(storeWithFixtures());
    const err = await reader.getNumberRule("test_unset_number").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RulesetError);
    expect((err as RulesetError).code).toBe("RULE_VALUE_UNSET");
  });

  it("throws RULE_TYPE_MISMATCH when accessed through the wrong typed accessor", async () => {
    const reader = createRulesetReader(storeWithFixtures());
    const err = await reader.getBooleanRule("test_number").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RulesetError);
    expect((err as RulesetError).code).toBe("RULE_TYPE_MISMATCH");
  });
});

describe("editor operations", () => {
  it("updating a value appends a change row with before/after snapshots", async () => {
    const store = storeWithFixtures();
    const updated = await updateRuleValue(store, "test_number", 456, "test note");
    expect(updated.numberValue).toBe(456);

    const history = await getRuleHistory(store, "test_number");
    expect(history).toHaveLength(1);
    const prev = JSON.parse(history[0].previousValue) as RuleValueSnapshot;
    const next = JSON.parse(history[0].newValue) as RuleValueSnapshot;
    expect(prev.numberValue).toBe(123);
    expect(next.numberValue).toBe(456);
    expect(history[0].note).toBe("test note");

    // Append-only: a second edit adds a row, never rewrites.
    await updateRuleValue(store, "test_number", 789);
    expect(await getRuleHistory(store, "test_number")).toHaveLength(2);
  });

  it("rejects a value whose type does not match the rule", async () => {
    const store = storeWithFixtures();
    const err = await updateRuleValue(store, "test_number", "not a number").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RulesetError);
    expect((err as RulesetError).code).toBe("RULE_TYPE_MISMATCH");
    expect(store.changes).toHaveLength(0); // nothing written
  });

  it("mark verified sets lastVerifiedAt for that rule only and writes no history row", async () => {
    const store = storeWithFixtures();
    const updated = await markRuleVerified(store, "test_number");
    expect(updated.lastVerifiedAt).toBeInstanceOf(Date);
    expect((await store.getByKey("test_bool"))?.lastVerifiedAt).toBeNull();
    expect(store.changes).toHaveLength(0);
  });
});

describe("routes", () => {
  it("lists rules, edits a value, shows history, and verifies — behind the PIN", async () => {
    const store = storeWithFixtures();
    const app = makeApp({ rulesetStore: store });
    const agent = await authedAgent(app);

    const list = await agent.get("/api/ruleset");
    expect(list.status).toBe(200);
    expect(list.body.rules).toHaveLength(4);

    const edit = await agent
      .put("/api/ruleset/test_number/value")
      .send({ value: 321, note: "via route" });
    expect(edit.status).toBe(200);
    expect(edit.body.rule.numberValue).toBe(321);

    const history = await agent.get("/api/ruleset/test_number/history");
    expect(history.status).toBe(200);
    expect(history.body.changes).toHaveLength(1);
    expect(history.body.changes[0].previousValue.numberValue).toBe(123);
    expect(history.body.changes[0].newValue.numberValue).toBe(321);

    const verify = await agent.post("/api/ruleset/test_number/verify");
    expect(verify.status).toBe(200);
    expect(verify.body.rule.lastVerifiedAt).not.toBeNull();
  });

  it("returns structured bilingual errors on bad input and unknown keys", async () => {
    const app = makeApp({ rulesetStore: storeWithFixtures() });
    const agent = await authedAgent(app);

    const missing = await agent.put("/api/ruleset/nope/value").send({ value: 1 });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("RULE_NOT_FOUND");
    expect(missing.body.message.en).toBeTruthy();
    expect(missing.body.message.he).toBeTruthy();

    const badBody = await agent.put("/api/ruleset/test_number/value").send({});
    expect(badBody.status).toBe(400);

    const badType = await agent.put("/api/ruleset/test_bool/value").send({ value: 7 });
    expect(badType.status).toBe(400);
    expect(badType.body.code).toBe("RULE_TYPE_MISMATCH");
  });

  it("is closed to unauthenticated requests (PIN middleware)", async () => {
    const app = makeApp({ rulesetStore: storeWithFixtures() });
    const request = (await import("supertest")).default;
    const res = await request(app).get("/api/ruleset");
    expect(res.status).toBe(401);
  });
});
