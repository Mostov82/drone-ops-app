// DO-015 — geometric queries over imported zone geometries (@turf, the
// pre-approved geometry utility — intent doc scope).
//
// FAIL CLOSED on anything unevaluable: a zone whose geometry the engine
// cannot assess could silently hide a restriction, so an unsupported or
// malformed geometry aborts the check (verdictGeometryUnsupported) instead
// of being skipped.
//
// Boundary policy (conservative, tested): a point exactly ON a polygon
// boundary counts as INSIDE (turf's booleanPointInPolygon with the boundary
// included — ignoreBoundary defaults to false).

import {
  booleanPointInPolygon,
  centroid,
  distance as turfDistance,
  point as turfPoint,
  pointToLineDistance,
} from "@turf/turf";
import type { Feature, LineString, MultiPolygon, Polygon } from "geojson";
import { verdictGeometryUnsupported } from "./errors.js";

interface GeometryLike {
  type?: unknown;
  coordinates?: unknown;
}

function geometryType(geometryJson: string, zoneName: string): { type: string; geometry: GeometryLike } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(geometryJson);
  } catch {
    throw verdictGeometryUnsupported(zoneName, "unparseable JSON");
  }
  const geometry = parsed as GeometryLike;
  if (typeof geometry?.type !== "string" || !Array.isArray(geometry.coordinates)) {
    throw verdictGeometryUnsupported(zoneName, String(geometry?.type ?? "missing"));
  }
  return { type: geometry.type, geometry };
}

export function isAreaGeometry(geometryJson: string, zoneName: string): boolean {
  const { type } = geometryType(geometryJson, zoneName);
  if (type === "Polygon" || type === "MultiPolygon") return true;
  if (type === "LineString" || type === "MultiLineString") return false;
  throw verdictGeometryUnsupported(zoneName, type);
}

/** Point-in-polygon, boundary inclusive. Area geometries only. */
export function areaContainsPoint(geometryJson: string, zoneName: string, lat: number, lng: number): boolean {
  const { geometry } = geometryType(geometryJson, zoneName);
  return booleanPointInPolygon(turfPoint([lng, lat]), geometry as unknown as Polygon | MultiPolygon);
}

/** Geodesic distance (meters) from the point to the area geometry's centroid. */
export function distanceToCentroidM(geometryJson: string, zoneName: string, lat: number, lng: number): number {
  const { geometry } = geometryType(geometryJson, zoneName);
  const center = centroid({
    type: "Feature",
    properties: {},
    geometry: geometry as unknown as Polygon,
  } as Feature<Polygon>);
  return turfDistance(turfPoint([lng, lat]), center, { units: "meters" });
}

/** Shortest distance (meters) from the point to a LineString/MultiLineString. */
export function distanceToLineM(geometryJson: string, zoneName: string, lat: number, lng: number): number {
  const { type, geometry } = geometryType(geometryJson, zoneName);
  const pt = turfPoint([lng, lat]);
  if (type === "LineString") {
    return pointToLineDistance(pt, geometry as unknown as LineString, { units: "meters" });
  }
  if (type === "MultiLineString") {
    const parts = geometry.coordinates as unknown[];
    if (parts.length === 0) throw verdictGeometryUnsupported(zoneName, "empty MultiLineString");
    let min = Number.POSITIVE_INFINITY;
    for (const coords of parts) {
      const line: LineString = { type: "LineString", coordinates: coords as LineString["coordinates"] };
      min = Math.min(min, pointToLineDistance(pt, line, { units: "meters" }));
    }
    return min;
  }
  throw verdictGeometryUnsupported(zoneName, type);
}
