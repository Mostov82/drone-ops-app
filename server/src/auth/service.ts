// DO-005 — PIN auth primitives. This is a local convenience lock (intent doc:
// "my kid shouldn't accidentally open it"), not internet-facing security; the
// server binds to 127.0.0.1 only.
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { Request } from "express";

/** Setting-table key for the PIN hash (location pre-approved in DO-002's schema comment). */
export const PIN_HASH_SETTING_KEY = "auth.pinHash";

/** Setting keys under this prefix are auth-internal and must never pass through /api/settings. */
export const AUTH_SETTING_PREFIX = "auth.";

/** 4–12 digits. */
export const PIN_PATTERN = /^\d{4,12}$/;

export const SESSION_COOKIE = "drone_ops_session";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h; app restart clears sessions anyway (in-memory)

export interface PinStore {
  getHash(): Promise<string | null>;
  setHash(hash: string): Promise<void>;
}

export function createPrismaPinStore(): PinStore {
  return {
    async getHash() {
      const { prisma } = await import("../db.js");
      const row = await prisma.setting.findUnique({ where: { key: PIN_HASH_SETTING_KEY } });
      return row?.value ?? null;
    },
    async setHash(hash) {
      const { prisma } = await import("../db.js");
      await prisma.setting.upsert({
        where: { key: PIN_HASH_SETTING_KEY },
        create: { key: PIN_HASH_SETTING_KEY, value: hash },
        update: { value: hash },
      });
    },
  };
}

/**
 * In-memory session store: an unguessable random token in an httpOnly cookie.
 * Restarting the server (or closing the browser — the cookie is session-scoped)
 * requires the PIN again, which is the intended behavior for a local lock.
 */
export class SessionStore {
  private sessions = new Map<string, number>(); // token -> expiry epoch ms

  create(): string {
    const token = randomBytes(32).toString("hex");
    this.sessions.set(token, Date.now() + SESSION_TTL_MS);
    return token;
  }

  isValid(token: string): boolean {
    const expiry = this.sessions.get(token);
    if (expiry === undefined) return false;
    if (Date.now() > expiry) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  revoke(token: string): void {
    this.sessions.delete(token);
  }

  revokeAll(): void {
    this.sessions.clear();
  }
}

export function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin); // argon2id, per-hash random salt
}

export function verifyPin(hash: string, pin: string): Promise<boolean> {
  return argon2.verify(hash, pin);
}

export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === "string" && PIN_PATTERN.test(pin);
}

/** Reads the session token from the Cookie header (no cookie-parsing dependency needed for one cookie). */
export function getSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}
