// Regulations Ruleset routes (DO-010, FR-A5). Mounted behind the PIN
// middleware in app.ts, like every /api route.
import { Router } from "express";
import { ApiError, sendApiError } from "../api-error.js";
import {
  getRuleHistory,
  markRuleVerified,
  updateRuleValue,
  type RuleValueSnapshot,
  type RulesetStore,
} from "./service.js";

const MAX_NOTE_LENGTH = 500;

function handleError(res: Parameters<typeof sendApiError>[0], err: unknown): void {
  if (err instanceof ApiError) {
    sendApiError(res, err);
    return;
  }
  sendApiError(
    res,
    new ApiError(500, "RULESET_INTERNAL", {
      en: "Ruleset operation failed.",
      he: "פעולת מאגר הרגולציה נכשלה.",
    }),
  );
}

function parseSnapshot(raw: string): RuleValueSnapshot | string {
  try {
    return JSON.parse(raw) as RuleValueSnapshot;
  } catch {
    return raw;
  }
}

export function createRulesetRouter(store: RulesetStore) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      res.json({ rules: await store.list() });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/:key/history", async (req, res) => {
    try {
      const changes = await getRuleHistory(store, req.params.key);
      res.json({
        changes: changes.map((c) => ({
          id: c.id,
          changedAt: c.changedAt,
          previousValue: parseSnapshot(c.previousValue),
          newValue: parseSnapshot(c.newValue),
          note: c.note,
        })),
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.put("/:key/value", async (req, res) => {
    const body = (req.body ?? {}) as { value?: unknown; note?: unknown };
    if (body.value === undefined) {
      sendApiError(
        res,
        new ApiError(400, "RULESET_BAD_REQUEST", {
          en: "Body must be { value, note? }.",
          he: "גוף הבקשה חייב להיות { value, note? }.",
        }),
      );
      return;
    }
    if (
      body.note !== undefined &&
      (typeof body.note !== "string" || body.note.length > MAX_NOTE_LENGTH)
    ) {
      sendApiError(
        res,
        new ApiError(400, "RULESET_BAD_REQUEST", {
          en: `note must be a string of at most ${MAX_NOTE_LENGTH} characters.`,
          he: `ההערה חייבת להיות מחרוזת באורך ${MAX_NOTE_LENGTH} תווים לכל היותר.`,
        }),
      );
      return;
    }
    try {
      const rule = await updateRuleValue(store, req.params.key, body.value, body.note);
      res.json({ rule });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/:key/verify", async (req, res) => {
    try {
      const rule = await markRuleVerified(store, req.params.key);
      res.json({ rule });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}
