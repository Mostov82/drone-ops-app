// DO-014 — client for the read-only zone routes (server/src/zones/routes.ts;
// contract: server/docs/zones-api.md "Read API" section). Verdicts arrive from
// the server per request — they are the editable Gate 3 ZoneType mapping read
// at request time, NEVER a client-side constant (FR-C1 data-driven styling).

import type { Geometry } from "geojson";

export interface BilingualMessage {
  en: string;
  he: string;
}

export interface ZonesApiError {
  code: string;
  message: BilingualMessage;
}

/** Provenance blob the importer wrote onto MapLayer.source (FR-C4). */
export interface LayerProvenance {
  title?: string;
  sourceFiles?: { path: string; sha256: string }[];
  aipUpdateStamp?: string;
  extractedAt?: string;
  extractionTools?: string[];
}

export interface ZoneLayerSummary {
  id: string;
  name: string;
  /** ISO timestamp — the staleness signal the UI must show (FR-C4). */
  importedAt: string;
  /** False until Jonathan's visual check (GB-06 Gate 3) — badge while false. */
  verified: boolean;
  zoneCount: number;
  provenance: LayerProvenance;
}

export interface ZoneFeatureProperties {
  id: string;
  name: string;
  zoneTypeCode: string;
  zoneTypeName: string;
  /** ZoneType.defaultVerdict at request time — styling keys off this. */
  verdict: string;
  /** ft AMSL exactly as published; null = not published (semantics vary by type — see zone-display.ts). */
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  notes: string | null;
}

export interface ZoneFeature {
  type: "Feature";
  properties: ZoneFeatureProperties;
  geometry: Geometry;
}

export interface ZoneFeatureCollection {
  type: "FeatureCollection";
  features: ZoneFeature[];
}

export interface LayerGeoJsonResponse {
  layer: ZoneLayerSummary;
  geojson: ZoneFeatureCollection;
}

export class ZonesRequestError extends Error {
  constructor(public apiError: ZonesApiError | null) {
    super(apiError?.message.en ?? "Zones request failed");
  }
  get code(): string | null {
    return this.apiError?.code ?? null;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const err = (await res.json().catch(() => null)) as ZonesApiError | null;
  throw new ZonesRequestError(err);
}

export async function getZoneLayers(): Promise<ZoneLayerSummary[]> {
  const body = await parseOrThrow<{ layers: ZoneLayerSummary[] }>(
    await fetch("/api/zones/layers"),
  );
  return body.layers;
}

export async function getLayerGeoJson(layerId: string): Promise<LayerGeoJsonResponse> {
  return parseOrThrow<LayerGeoJsonResponse>(
    await fetch(`/api/zones/layers/${encodeURIComponent(layerId)}/geojson`),
  );
}
