// DO-004 — Backup/restore HTTP routes. Registered in app.ts (seam: one line).
// After DO-005 lands, these fall behind the global PIN middleware automatically.
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { BackupError, createBackup, restoreBackup } from "./service.js";

export function createBackupRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post("/api/backup", async (req, res) => {
    const destDir = typeof req.body?.destDir === "string" ? req.body.destDir : "";
    try {
      const result = await createBackup(prisma, destDir);
      res.json(result);
    } catch (err) {
      respondError(res, err);
    }
  });

  router.post("/api/restore", async (req, res) => {
    const archivePath = typeof req.body?.archivePath === "string" ? req.body.archivePath : "";
    // Explicit confirmation contract: client must send confirm: "REPLACE_ALL_DATA".
    if (req.body?.confirm !== "REPLACE_ALL_DATA") {
      res.status(400).json({
        code: "CONFIRMATION_REQUIRED",
        message: {
          en: "Restore replaces ALL current data and requires explicit confirmation.",
          he: "השחזור מחליף את כל הנתונים הקיימים ודורש אישור מפורש.",
        },
      });
      return;
    }
    try {
      const result = await restoreBackup(prisma, archivePath);
      res.json(result);
    } catch (err) {
      respondError(res, err);
    }
  });

  return router;
}

function respondError(res: import("express").Response, err: unknown) {
  if (err instanceof BackupError) {
    const status = err.code === "SCHEMA_MISMATCH" ? 409 : 400;
    res.status(status).json({ code: err.code, message: err.messages });
  } else {
    res.status(500).json({
      code: "INTERNAL",
      message: {
        en: "Backup operation failed unexpectedly.",
        he: "פעולת הגיבוי נכשלה באופן בלתי צפוי.",
      },
    });
  }
}
