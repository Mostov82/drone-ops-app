// DO-013 — dataset & manifest shapes shared by builders, importer and docs.
// Every generated dataset = one directory under data-sources/zones/ holding
// a GeoJSON FeatureCollection (or entries.json when no geometry exists yet),
// a provenance manifest, and a human-readable reconciliation report.

export interface ZoneFeatureProperties {
  /** AIP designator / LLU code / dataset-scoped id. Unique within a dataset. */
  code: string;
  nameHe: string | null;
  nameEn: string | null;
  /** ZoneType.code the zone imports under (upserted at import time). */
  zoneTypeCode: string;
  /** Altitude band, ft AMSL exactly as published; null = not published. */
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  /**
   * Ceiling published in ft AGL (מעפ"ש) where the AIP gives one (LLU59–72,
   * appendix ה'). Deliberately NOT mapped to the AMSL columns — unit mismatch.
   */
  aglCeilingFt: number | null;
  /** Free-text provenance/oddities carried onto Zone.notes at import. */
  notes: string | null;
}

export interface ZoneFeature {
  type: "Feature";
  properties: ZoneFeatureProperties;
  geometry: unknown; // GeoJSON geometry (Polygon / MultiPolygon)
}

export interface ZoneFeatureCollection {
  type: "FeatureCollection";
  features: ZoneFeature[];
}

export interface DatasetManifest {
  /** Stable identity for clean re-import (maps to MapLayer.name). */
  layerKey: string;
  title: string;
  /** Repo-relative source snapshot paths with SHA-256 of the bytes used. */
  sourceFiles: { path: string; sha256: string }[];
  /** The AIP update stamp printed on the source (e.g. "עדכון 2/25"). */
  aipUpdateStamp: string;
  extractedAt: string; // ISO date — the documented timestamp exception
  extractionTools: string[];
  /** Segment count for generated circles, when the dataset contains any. */
  circleSegments?: number;
  featureCount: number;
  /** False = conversion shipped but import is blocked pending a decision. */
  importable: boolean;
  /** Everything ships unverified until Jonathan's visual check (GB-06 G3). */
  verified: false;
  notes?: string;
}

/**
 * Deterministic JSON: stable key order as authored by the builders, 1-space
 * indent, trailing newline, no locale-dependent formatting. Rerunning a
 * builder on identical inputs yields byte-identical files.
 */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 1)}\n`;
}
