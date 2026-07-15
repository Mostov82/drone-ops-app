// Client for the settings API (server/src/routes/settings.ts), which persists
// key/value pairs via the Prisma `Setting` model (DO-002).
import { DEFAULT_LANGUAGE, isAppLanguage, type AppLanguage } from "@/i18n";

export interface AppSettings {
  language: AppLanguage;
  units: "metric";
  alertLeadTimes: {
    first: number;
    second: number;
    final: number;
  };
}

// Alert tier defaults per GB-02 Gate 3 resolution (60/30/7).
export const DEFAULT_SETTINGS: AppSettings = {
  language: DEFAULT_LANGUAGE,
  units: "metric",
  alertLeadTimes: { first: 60, second: 30, final: 7 },
};

// Keys as stored in the Setting table.
const KEYS = {
  language: "language",
  units: "units",
  alertFirst: "alertLeadTimes.first",
  alertSecond: "alertLeadTimes.second",
  alertFinal: "alertLeadTimes.final",
} as const;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Loads settings from the server, filling defaults for missing keys. Throws on network/server failure. */
export async function loadSettings(): Promise<AppSettings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error(`GET /api/settings responded ${res.status}`);
  const body = (await res.json()) as { settings: Record<string, string> };
  const raw = body.settings ?? {};
  const language = raw[KEYS.language];
  return {
    language: isAppLanguage(language) ? language : DEFAULT_SETTINGS.language,
    units: "metric",
    alertLeadTimes: {
      first: parsePositiveInt(raw[KEYS.alertFirst], DEFAULT_SETTINGS.alertLeadTimes.first),
      second: parsePositiveInt(raw[KEYS.alertSecond], DEFAULT_SETTINGS.alertLeadTimes.second),
      final: parsePositiveInt(raw[KEYS.alertFinal], DEFAULT_SETTINGS.alertLeadTimes.final),
    },
  };
}

/** Persists a partial update; only the provided fields are written. Throws on failure. */
export async function saveSettings(update: Partial<AppSettings>): Promise<void> {
  const entries: Record<string, string> = {};
  if (update.language !== undefined) entries[KEYS.language] = update.language;
  if (update.units !== undefined) entries[KEYS.units] = update.units;
  if (update.alertLeadTimes !== undefined) {
    entries[KEYS.alertFirst] = String(update.alertLeadTimes.first);
    entries[KEYS.alertSecond] = String(update.alertLeadTimes.second);
    entries[KEYS.alertFinal] = String(update.alertLeadTimes.final);
  }
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: entries }),
  });
  if (!res.ok) throw new Error(`PUT /api/settings responded ${res.status}`);
}
