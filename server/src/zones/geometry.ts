// DO-013 — geometry helpers for zone datasets.
// Circle generation uses @turf/turf (the pre-approved geometry utility).
// Coordinates are [lng, lat] per GeoJSON. Output is deterministic: fixed
// segment count, coordinates rounded to 7 decimals (~1 cm).

import { circle } from "@turf/turf";
import { ZoneParseError } from "./errors.js";

/** Documented in every dataset manifest that contains generated circles. */
export const CIRCLE_SEGMENTS = 64;

const ROUND = 1e7;

export function roundCoord(v: number): number {
  return Math.round(v * ROUND) / ROUND;
}

export type Position = [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

/** Geodesic circle around [lat, lng] with radius in metres. */
export function circlePolygon(lat: number, lng: number, radiusM: number): PolygonGeometry {
  if (!Number.isFinite(radiusM) || radiusM <= 0) {
    throw new ZoneParseError("Circle radius must be a positive number of metres", String(radiusM));
  }
  const feature = circle([lng, lat], radiusM / 1000, { steps: CIRCLE_SEGMENTS, units: "kilometers" });
  const ring = feature.geometry.coordinates[0].map(
    ([x, y]) => [roundCoord(x), roundCoord(y)] as Position,
  );
  return { type: "Polygon", coordinates: [ring] };
}

/**
 * Build a Polygon from an ordered vertex list ({lat,lng}), closing the ring
 * if the source did not repeat the first vertex. A polygon needs ≥ 3 distinct
 * vertices — fewer is a parse failure, never a guess.
 */
export function polygonFromVertices(vertices: { lat: number; lng: number }[]): PolygonGeometry {
  const ring = vertices.map(({ lat, lng }) => [roundCoord(lng), roundCoord(lat)] as Position);
  if (ring.length > 0) {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  }
  // distinct vertices excluding the closing repeat
  const distinct = new Set(ring.slice(0, -1).map((p) => p.join(",")));
  if (distinct.size < 3) {
    throw new ZoneParseError("Polygon needs at least 3 distinct vertices", JSON.stringify(vertices));
  }
  return { type: "Polygon", coordinates: [ring] };
}
