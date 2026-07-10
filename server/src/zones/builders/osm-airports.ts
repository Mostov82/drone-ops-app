// DO-013 — OSM airport gap-filler (Gate 1: OSM demoted to gap-filler for
// airport locations + buffer circles; the AIP layers don't carry the
// drone-specific airport buffer).
//
// Input: a committed raw Overpass API snapshot (aeroway=aerodrome in the
// Israel region bbox). Output: POINT features carrying `bufferRuleKey` —
// the buffer circle is generated AT IMPORT TIME from the Ruleset read API
// (`airport_buffer_km`), never a constant (conventions §4, trigger 4).

import type { ReconIssue } from "./aip-zones.js";

export const AIRPORT_ZONE_TYPE = "AIRPORT";
export const AIRPORT_BUFFER_RULE_KEY = "airport_buffer_km";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassSnapshot {
  osm3s?: { timestamp_osm_base?: string };
  elements: OverpassElement[];
}

export interface AirportFeature {
  type: "Feature";
  properties: {
    code: string;
    nameHe: string | null;
    nameEn: string | null;
    zoneTypeCode: string;
    bufferRuleKey: string;
    icao: string | null;
    osmTags: Record<string, string>;
    notes: string;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface OsmAirportsResult {
  collection: { type: "FeatureCollection"; features: AirportFeature[] };
  issues: ReconIssue[];
  stats: { elements: number; converted: number; skippedNoCenter: number; osmTimestamp: string | null };
}

export function buildOsmAirports(snapshot: OverpassSnapshot): OsmAirportsResult {
  const issues: ReconIssue[] = [];
  const features: AirportFeature[] = [];
  let skippedNoCenter = 0;

  for (const el of snapshot.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    const code = `OSM-${el.type}-${el.id}`;
    if (lat === undefined || lon === undefined) {
      skippedNoCenter += 1;
      issues.push({ code, kind: "parse-failure", detail: `no coordinates/center in Overpass element — skipped ("${tags.name ?? "?"}")` });
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        code,
        nameHe: tags["name:he"] ?? (tags.name && /[֐-׿]/.test(tags.name) ? tags.name : null),
        nameEn: tags["name:en"] ?? tags.int_name ?? (tags.name && !/[֐-׿]/.test(tags.name) ? tags.name : null),
        zoneTypeCode: AIRPORT_ZONE_TYPE,
        bufferRuleKey: AIRPORT_BUFFER_RULE_KEY,
        icao: tags.icao ?? null,
        osmTags: tags,
        notes: `OSM gap-filler (Gate 1): aerodrome location from OpenStreetMap ${el.type}/${el.id}; buffer circle generated at import from Ruleset ${AIRPORT_BUFFER_RULE_KEY}`,
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }

  features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

  return {
    collection: { type: "FeatureCollection", features },
    issues,
    stats: {
      elements: snapshot.elements.length,
      converted: features.length,
      skippedNoCenter,
      osmTimestamp: snapshot.osm3s?.timestamp_osm_base ?? null,
    },
  };
}
