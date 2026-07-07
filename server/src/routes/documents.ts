// DO-005 — Generic document upload/retrieve/delete endpoints (behind the PIN
// middleware like all API routes). DO-009's vault UI builds on these.
//
// Upload contract: raw file bytes as the request body (no multipart dependency),
// original name in the x-file-name header (URI-encoded), type in Content-Type.
import express, {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import * as fs from "node:fs";
import { ApiError, sendApiError } from "../api-error.js";
import { fileTooLarge, type DocumentStorage } from "../storage/documents.js";

export function createDocumentsRouter(storage: DocumentStorage): Router {
  const router = Router();

  router.post(
    "/",
    express.raw({ type: () => true, limit: storage.maxSizeBytes }),
    async (req, res) => {
      const encodedName = req.header("x-file-name") ?? "";
      let fileName = "";
      try {
        fileName = decodeURIComponent(encodedName).trim();
      } catch {
        /* falls through to the empty-name rejection */
      }
      if (fileName === "") {
        sendApiError(
          res,
          new ApiError(400, "FILE_NAME_REQUIRED", {
            en: "Missing file name (x-file-name header).",
            he: "חסר שם קובץ (כותרת x-file-name).",
          }),
        );
        return;
      }
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      try {
        const meta = await storage.save(fileName, req.header("content-type") ?? "", body);
        res.status(201).json(meta);
      } catch (err) {
        respondError(res, err);
      }
    },
  );

  router.get("/", async (_req, res) => {
    res.json({ documents: await storage.list() });
  });

  router.get("/:id/file", async (req, res) => {
    try {
      const { meta, absolutePath } = await storage.read(req.params.id);
      res.setHeader("Content-Type", meta.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
      );
      fs.createReadStream(absolutePath).pipe(res);
    } catch (err) {
      respondError(res, err);
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await storage.remove(req.params.id);
      res.status(204).end();
    } catch (err) {
      respondError(res, err);
    }
  });

  // Converts body-parser's oversize rejection into the bilingual contract.
  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large") {
      sendApiError(res, fileTooLarge(storage.maxSizeBytes));
      return;
    }
    respondError(res, err);
  });

  return router;
}

function respondError(res: Response, err: unknown): void {
  if (err instanceof ApiError) {
    sendApiError(res, err);
    return;
  }
  res.status(500).json({
    code: "INTERNAL",
    message: {
      en: "Document operation failed unexpectedly.",
      he: "פעולת המסמך נכשלה באופן בלתי צפוי.",
    },
  });
}
