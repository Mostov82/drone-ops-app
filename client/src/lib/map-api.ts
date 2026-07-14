// DO-012 — client for the offline map + elevation API (server/src/map/routes.ts;
// contract: server/docs/map-api.md). Elevation values only ever arrive from the
// server and are ALWAYS approximate — the UI must badge them (FR-C5).

export interface BilingualMessage {
  en: string;
  he: string;
}

export interface MapApiError {
  code: string;
  message: BilingualMessage;
}

export interface TilesStatus {
  available: boolean;
  reason?: "PACKAGE_MISSING" | "FORMAT_UNSUPPORTED";
  format?: string;
  minzoom?: number;
  maxzoom?: number;
  /** "west,south,east,north" when the package declares it. */
  bounds?: string;
  attribution?: string;
}

export interface DemStatus {
  available: boolean;
  tileCount: number;
}

export interface MapStatus {
  tiles: TilesStatus;
  dem: DemStatus;
}

export interface ElevationResult {
  elevationM: number;
  approximate: true;
  source: string;
  resolutionM: number;
}

export interface CrosscheckResult {
  elevationM: number;
  approximate: true;
  provider: string;
}

/** Leaflet TileLayer URL template — served locally, fully offline. */
export const TILE_URL_TEMPLATE = "/api/map/tiles/{z}/{x}/{y}";

/** Thrown for non-OK responses; carries the server's structured bilingual error. */
export class MapRequestError extends Error {
  constructor(public apiError: MapApiError | null) {
    super(apiError?.message.en ?? "Map request failed");
  }
  get code(): string | null {
    return this.apiError?.code ?? null;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const err = (await res.json().catch(() => null)) as MapApiError | null;
  throw new MapRequestError(err);
}

export async function getMapStatus(): Promise<MapStatus> {
  return parseOrThrow<MapStatus>(await fetch("/api/map/status"));
}

export async function getElevation(lat: number, lng: number): Promise<ElevationResult> {
  return parseOrThrow<ElevationResult>(
    await fetch(`/api/map/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`),
  );
}

/** Optional online cross-check — call ONLY on explicit user action (NFR-1). */
export async function crosscheckElevation(lat: number, lng: number): Promise<CrosscheckResult> {
  return parseOrThrow<CrosscheckResult>(
    await fetch(
      `/api/map/elevation/crosscheck?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    ),
  );
}

export interface DemDownloadStatus {
  status: "idle" | "pending" | "downloading" | "done" | "failed" | "offline-missing";
  downloaded: number;
  total: number;
  progress: number;
  currentFile: string | null;
  error: string | null;
}

export interface ProvisioningStatus {
  database: { status: string; error: string | null };
  ruleset: { status: string; error: string | null };
  zones: { status: string; error: string | null };
  dem: DemDownloadStatus;
}

export async function getProvisioningStatus(): Promise<ProvisioningStatus> {
  return parseOrThrow<ProvisioningStatus>(await fetch("/api/provisioning/status"));
}

export async function retryDemDownload(): Promise<{ message: string; status: DemDownloadStatus }> {
  return parseOrThrow<{ message: string; status: DemDownloadStatus }>(
    await fetch("/api/provisioning/retry-dem", { method: "POST" }),
  );
}
