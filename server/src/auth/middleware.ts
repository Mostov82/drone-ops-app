// DO-005 — Global PIN gate for the API. Mounted before all routers in app.ts,
// so every /api route (settings, backup, documents, hello, future modules)
// rejects unauthenticated requests. Non-/api paths are untouched.
import type { NextFunction, Request, Response } from "express";
import { getSessionToken, type SessionStore } from "./service.js";

const OPEN_ENDPOINTS = new Set([
  "GET /api/auth/status",
  "POST /api/auth/setup",
  "POST /api/auth/login",
]);

export function createAuthMiddleware(sessions: SessionStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.path.startsWith("/api")) {
      next();
      return;
    }
    if (OPEN_ENDPOINTS.has(`${req.method} ${req.path}`)) {
      next();
      return;
    }
    const token = getSessionToken(req);
    if (token && sessions.isValid(token)) {
      next();
      return;
    }
    res.status(401).json({
      code: "UNAUTHENTICATED",
      message: {
        en: "PIN login required.",
        he: "נדרשת כניסה עם קוד PIN.",
      },
    });
  };
}
