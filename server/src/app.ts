import express from "express";
import {
  createPrismaSettingsStore,
  createSettingsRouter,
  type SettingsStore,
} from "./routes/settings.js";
import { createBackupRouter } from "./backup/routes.js";
import { resolvePaths } from "./backup/service.js";
import { createAuthMiddleware } from "./auth/middleware.js";
import { createAuthRouter } from "./auth/routes.js";
import { createPrismaPinStore, SessionStore, type PinStore } from "./auth/service.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { createMapRouter, type MapRouterDeps } from "./map/routes.js";
import { createRulesetRouter } from "./ruleset/routes.js";
import { createZonesRouter, type ZonesReadStore } from "./zones/routes.js";
import { createVerdictRouter, type VerdictRouterDeps } from "./verdict/routes.js";
import { createPrismaRulesetStore, type RulesetStore } from "./ruleset/service.js";
import {
  createPrismaDocumentMetaStore,
  DocumentStorage,
  type DocumentMetaStore,
} from "./storage/documents.js";
import { prisma } from "./db.js";

export interface AppDeps {
  settingsStore?: SettingsStore;
  pinStore?: PinStore;
  sessions?: SessionStore;
  appDataDir?: string;
  documentMetaStore?: DocumentMetaStore;
  maxUploadBytes?: number;
  rulesetStore?: RulesetStore;
  map?: MapRouterDeps;
  zonesStore?: ZonesReadStore;
  verdict?: VerdictRouterDeps;
}

export function createApp(deps: AppDeps = {}) {
  const app = express();
  app.use(express.json());

  const sessions = deps.sessions ?? new SessionStore();
  const pinStore = deps.pinStore ?? createPrismaPinStore();
  const settingsStore = deps.settingsStore ?? createPrismaSettingsStore();
  const documentStorage = new DocumentStorage({
    appDataDir: deps.appDataDir ?? resolvePaths().appDataDir,
    meta: deps.documentMetaStore ?? createPrismaDocumentMetaStore(),
    maxSizeBytes: deps.maxUploadBytes,
  });

  // PIN gate for every /api route (DO-005). Mounted before all routers; only
  // auth status/setup/login are open.
  app.use(createAuthMiddleware(sessions));

  app.use("/api/auth", createAuthRouter({ pinStore, sessions, settingsStore }));
  app.use("/api/settings", createSettingsRouter(settingsStore));
  app.use("/api/documents", createDocumentsRouter(documentStorage));
  app.use("/api/ruleset", createRulesetRouter(deps.rulesetStore ?? createPrismaRulesetStore()));
  app.use("/api/map", createMapRouter(deps.map)); // DO-012; behind the PIN middleware above
  app.use("/api/zones", createZonesRouter(deps.zonesStore)); // DO-014; read-only zone layers
  app.use("/api/verdict", createVerdictRouter(deps.verdict)); // DO-015; location-check verdict engine
  app.use(createBackupRouter(prisma)); // DO-004; behind the PIN middleware above

  app.get("/api/hello", (_req, res) => {
    res.json({
      message: "Drone Operations App server is alive",
      time: new Date().toISOString(),
    });
  });

  return app;
}
