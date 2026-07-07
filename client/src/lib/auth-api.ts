// Client for the PIN auth API (server/src/routes — DO-005).
export type AuthState = "uninitialized" | "locked" | "authenticated";

export interface BilingualMessage {
  en: string;
  he: string;
}

export interface AuthStatus {
  status: AuthState;
  language: string;
}

/** Server errors carry the bilingual { code, message: { en, he } } contract. */
export class ApiRequestError extends Error {
  constructor(
    public code: string,
    public messages: BilingualMessage | null,
  ) {
    super(code);
  }

  localized(languageTag: string): string | null {
    if (!this.messages) return null;
    return languageTag.toLowerCase().startsWith("he") ? this.messages.he : this.messages.en;
  }
}

async function post(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let parsed: { code?: string; message?: BilingualMessage } | null = null;
    try {
      parsed = (await res.json()) as { code?: string; message?: BilingualMessage };
    } catch {
      /* non-JSON error body */
    }
    throw new ApiRequestError(parsed?.code ?? "NETWORK", parsed?.message ?? null);
  }
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch("/api/auth/status");
  if (!res.ok) throw new Error(`GET /api/auth/status responded ${res.status}`);
  return (await res.json()) as AuthStatus;
}

export function setupPin(pin: string): Promise<void> {
  return post("/api/auth/setup", { pin });
}

export function login(pin: string): Promise<void> {
  return post("/api/auth/login", { pin });
}

export function changePin(currentPin: string, newPin: string): Promise<void> {
  return post("/api/auth/change-pin", { currentPin, newPin });
}
