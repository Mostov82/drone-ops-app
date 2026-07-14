import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { demDownloader } from "./dem-downloader.js";
import { prisma as globalPrisma } from "../db.js";

export function createProvisioningRouter(prisma: PrismaClient = globalPrisma) {
  const router = Router();

  router.get("/status", async (_req, res) => {
    try {
      let databaseStatus = "completed";
      let databaseError = null;
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (err: unknown) {
        databaseStatus = "failed";
        databaseError = err instanceof Error ? err.message : "Database connection failed";
      }

      let rulesetStatus = "completed";
      let rulesetError = null;
      try {
        const count = await prisma.regulationRule.count();
        if (count === 0) {
          rulesetStatus = "pending";
        }
      } catch (err: unknown) {
        rulesetStatus = "failed";
        rulesetError = err instanceof Error ? err.message : String(err);
      }

      let zonesStatus = "completed";
      let zonesError = null;
      try {
        const count = await prisma.mapLayer.count();
        if (count === 0) {
          zonesStatus = "pending";
        }
      } catch (err: unknown) {
        zonesStatus = "failed";
        zonesError = err instanceof Error ? err.message : String(err);
      }

      const dem = demDownloader.getStatus();

      res.json({
        database: { status: databaseStatus, error: databaseError },
        ruleset: { status: rulesetStatus, error: rulesetError },
        zones: { status: zonesStatus, error: zonesError },
        dem,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retrieve status";
      res.status(500).json({ error: msg });
    }
  });

  router.post("/retry-dem", async (_req, res) => {
    try {
      demDownloader.start();
      res.json({ message: "DEM download restarted", status: demDownloader.getStatus() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retry DEM download";
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
export default createProvisioningRouter;
