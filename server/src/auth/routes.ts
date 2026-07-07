// DO-005 — Auth endpoints. Only status/setup/login are open (middleware allowlist);
// logout and change-pin require an authenticated session like every other API route.
import { Router, type Response } from "express";
import { ApiError, sendApiError } from "../api-error.js";
import type { SettingsStore } from "../routes/settings.js";
import {
  getSessionToken,
  hashPin,
  isValidPinFormat,
  SESSION_COOKIE,
  verifyPin,
  type PinStore,
  type SessionStore,
} from "./service.js";

export type AuthState = "uninitialized" | "locked" | "authenticated";

export interface AuthDeps {
  pinStore: PinStore;
  sessions: SessionStore;
  settingsStore: SettingsStore;
}

const invalidPinFormat = new ApiError(400, "INVALID_PIN_FORMAT", {
  en: "The PIN must be 4–12 digits.",
  he: "קוד ה-PIN חייב להכיל 4 עד 12 ספרות.",
});

const wrongPin = new ApiError(401, "WRONG_PIN", {
  en: "Wrong PIN.",
  he: "קוד PIN שגוי.",
});

function setSessionCookie(res: Response, token: string): void {
  // Session-scoped (no maxAge): closing the browser locks the app again.
  // secure=false is correct here — local-only HTTP server on 127.0.0.1.
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", path: "/" });
}

export function createAuthRouter({ pinStore, sessions, settingsStore }: AuthDeps): Router {
  const router = Router();

  router.get("/status", async (req, res) => {
    // Includes the UI language so the PIN screen renders in the saved language
    // before any authenticated API is reachable (deliberate, minimal disclosure).
    const [hash, settings] = await Promise.all([pinStore.getHash(), settingsStore.getAll()]);
    const token = getSessionToken(req);
    const status: AuthState =
      hash === null ? "uninitialized" : token && sessions.isValid(token) ? "authenticated" : "locked";
    res.json({ status, language: settings["language"] ?? "en" });
  });

  router.post("/setup", async (req, res) => {
    if ((await pinStore.getHash()) !== null) {
      sendApiError(
        res,
        new ApiError(409, "ALREADY_INITIALIZED", {
          en: "A PIN is already set. Use the login screen.",
          he: "קוד PIN כבר הוגדר. יש להשתמש במסך הכניסה.",
        }),
      );
      return;
    }
    const pin: unknown = req.body?.pin;
    if (!isValidPinFormat(pin)) {
      sendApiError(res, invalidPinFormat);
      return;
    }
    await pinStore.setHash(await hashPin(pin));
    setSessionCookie(res, sessions.create());
    res.status(201).json({ status: "authenticated" satisfies AuthState });
  });

  router.post("/login", async (req, res) => {
    const hash = await pinStore.getHash();
    if (hash === null) {
      sendApiError(
        res,
        new ApiError(409, "NOT_INITIALIZED", {
          en: "No PIN is set yet. Run first-time setup.",
          he: "טרם הוגדר קוד PIN. יש להשלים את ההגדרה הראשונית.",
        }),
      );
      return;
    }
    const pin: unknown = req.body?.pin;
    if (typeof pin !== "string" || !(await verifyPin(hash, pin))) {
      sendApiError(res, wrongPin);
      return;
    }
    setSessionCookie(res, sessions.create());
    res.json({ status: "authenticated" satisfies AuthState });
  });

  router.post("/logout", (req, res) => {
    const token = getSessionToken(req);
    if (token) sessions.revoke(token);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ status: "locked" satisfies AuthState });
  });

  router.post("/change-pin", async (req, res) => {
    const hash = await pinStore.getHash();
    const currentPin: unknown = req.body?.currentPin;
    if (hash === null || typeof currentPin !== "string" || !(await verifyPin(hash, currentPin))) {
      sendApiError(res, wrongPin);
      return;
    }
    const newPin: unknown = req.body?.newPin;
    if (!isValidPinFormat(newPin)) {
      sendApiError(res, invalidPinFormat);
      return;
    }
    await pinStore.setHash(await hashPin(newPin));
    // Old PIN and every existing session stop working; this client gets a fresh session.
    sessions.revokeAll();
    setSessionCookie(res, sessions.create());
    res.json({ status: "authenticated" satisfies AuthState });
  });

  return router;
}
