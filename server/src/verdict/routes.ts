// DO-015 — HTTP surface for the verdict engine (FR-C2).
//
// BUILT BUT NOT MOUNTED IN SESSION 1: `server/src/app.ts` is not this
// session's file under the DO-014/DO-015 parallel-run protocol. Session 2
// (after DO-014 merges) mounts this router at `/api/verdict` — BEHIND the
// PIN middleware, like every /api route. DO-017 consumes the service-level
// contract (`createVerdictEngine().check()`) directly, per verdict-api.md.
import { Router, type Response } from "express";
import { ApiError, sendApiError } from "../api-error.js";
import { createDemService, type DemService } from "../map/dem.js";
import { resolveMapPaths } from "../map/paths.js";
import { createPrismaRulesetStore, createRulesetReader, type RulesetReader } from "../ruleset/service.js";
import { createVerdictEngine, type VerdictEngine } from "./engine.js";
import { verdictBadRequest } from "./errors.js";
import { createPrismaVerdictStore, type VerdictDataStore } from "./store.js";

export interface VerdictRouterDeps {
  engine?: VerdictEngine;
  store?: VerdictDataStore;
  rulesetReader?: RulesetReader;
  demService?: DemService;
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof ApiError) {
    sendApiError(res, err);
    return;
  }
  sendApiError(
    res,
    new ApiError(500, "VERDICT_INTERNAL", {
      en: "Location check failed.",
      he: "בדיקת המיקום נכשלה.",
    }),
  );
}

/** Parse a required numeric query parameter; undefined when absent. */
function numberParam(query: Record<string, unknown>, name: string): number | undefined {
  const raw = query[name];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (typeof raw !== "string" || raw.trim() === "" || !Number.isFinite(value)) {
    throw verdictBadRequest(`${name} must be a number`, `${name} חייב להיות מספר`);
  }
  return value;
}

export function createVerdictRouter(deps: VerdictRouterDeps = {}) {
  const engine =
    deps.engine ??
    createVerdictEngine({
      store: deps.store ?? createPrismaVerdictStore(),
      rulesetReader: deps.rulesetReader ?? createRulesetReader(createPrismaRulesetStore()),
      demService: deps.demService ?? createDemService(resolveMapPaths().demDir),
    });

  const router = Router();

  // GET /check?lat=…&lng=…[&aglM=…]  (aglM = planned altitude, meters AGL)
  router.get("/check", async (req, res) => {
    try {
      const query = req.query as Record<string, unknown>;
      const lat = numberParam(query, "lat");
      const lng = numberParam(query, "lng");
      if (lat === undefined || lng === undefined) {
        throw verdictBadRequest(
          "lat and lng query parameters are required",
          "פרמטרים lat ו-lng נדרשים",
        );
      }
      const aglM = numberParam(query, "aglM");
      res.json(await engine.check({ lat, lng, plannedAltitudeAglM: aglM }));
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}
