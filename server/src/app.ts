import express from "express";
import {
  createPrismaSettingsStore,
  createSettingsRouter,
  type SettingsStore,
} from "./routes/settings.js";

export interface AppDeps {
  settingsStore?: SettingsStore;
}

export function createApp(deps: AppDeps = {}) {
  const app = express();
  app.use(express.json());

  app.use("/api/settings", createSettingsRouter(deps.settingsStore ?? createPrismaSettingsStore()));

  app.get("/api/hello", (_req, res) => {
    res.json({
      message: "Drone Operations App server is alive",
      time: new Date().toISOString(),
    });
  });

  return app;
}
