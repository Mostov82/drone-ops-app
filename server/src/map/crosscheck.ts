// DO-012 — optional ONLINE elevation cross-check (FR-C5; decision log
// 2026-07-10: hybrid, offline DEM primary). Provider chosen this session:
// Open Topo Data public instance (https://www.opentopodata.org/) — free,
// KEYLESS (escalation trigger 5 satisfied), documented limits: 100 locations/
// request, 1 call/sec, 1000 calls/day. Dataset: srtm30m (SRTM 30 m, covers
// Israel). No keyless public API serves Copernicus GLO-30 itself, so the
// cross-check compares against an independent 30 m dataset — a sanity check,
// not a same-source verification (documented in server/docs/map-api.md).
//
// The app never calls this on its own: the client invokes it only on an
// explicit user action, so offline operation is never disturbed (NFR-1).
import { ApiError } from "../api-error.js";

export const CROSSCHECK_PROVIDER = {
  name: "Open Topo Data (srtm30m)",
  homepage: "https://www.opentopodata.org/",
  urlFor: (lat: number, lng: number) =>
    `https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lng}`,
} as const;

export interface CrosscheckResult {
  elevationM: number;
  approximate: true;
  provider: string;
}

/** Injectable for tests; defaults to global fetch (Node ≥ 18). */
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

function crosscheckFailedError(): ApiError {
  return new ApiError(502, "CROSSCHECK_FAILED", {
    en: "Online elevation cross-check is unavailable (offline, or the provider did not answer).",
    he: "בדיקת הגובה המקוונת אינה זמינה (אין חיבור לרשת, או שהספק לא השיב).",
  });
}

const TIMEOUT_MS = 8000;

export async function crosscheckElevation(
  lat: number,
  lng: number,
  fetchImpl: FetchLike = fetch,
): Promise<CrosscheckResult> {
  let body: unknown;
  try {
    const res = await fetchImpl(CROSSCHECK_PROVIDER.urlFor(lat, lng), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error("provider error");
    body = await res.json();
  } catch {
    throw crosscheckFailedError();
  }
  const elevation = (
    body as { results?: Array<{ elevation?: unknown }> } | null
  )?.results?.[0]?.elevation;
  if (typeof elevation !== "number" || !Number.isFinite(elevation)) {
    throw crosscheckFailedError();
  }
  return { elevationM: elevation, approximate: true, provider: CROSSCHECK_PROVIDER.name };
}
