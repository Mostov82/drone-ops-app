// DO-014 — pure zone display logic: verdict→style mapping, altitude-band
// semantics (server/docs/zones-api.md — read that section before touching
// this file), lane/AGL note parsing, and layer-visibility persistence.
//
// Styling keys off the VERDICT VALUE the server returns per request (the
// editable Gate 3 ZoneType.defaultVerdict mapping) — never off zone-type
// constants. Editing a verdict in the DB restyles the overlay on the next
// load with zero changes here. The colors below are presentational choices
// only; no regulatory value lives in this file (conventions §4).
import type { ZoneFeatureProperties } from "@/lib/zones-api";

// ── Verdict → style ─────────────────────────────────────────────────────────

export interface ZoneStyle {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
  dashArray?: string;
  fill?: boolean;
  stroke?: boolean;
}

/** Known verdict values (GB-03 Gate 3 three-tier mapping). */
export const VERDICT_RESTRICTED = "RESTRICTED";
export const VERDICT_NEEDS_PERMIT = "NEEDS_PERMIT";
export const VERDICT_CLEAR = "CLEAR";

const VERDICT_STYLES: Record<string, ZoneStyle> = {
  [VERDICT_RESTRICTED]: { color: "#dc2626", weight: 1.5, fillColor: "#dc2626", fillOpacity: 0.22 },
  [VERDICT_NEEDS_PERMIT]: { color: "#d97706", weight: 1.5, fillColor: "#f59e0b", fillOpacity: 0.22 },
  [VERDICT_CLEAR]: { color: "#475569", weight: 1.5, fillColor: "#64748b", fillOpacity: 0.15 },
};

/** Honest fallback for a verdict value this UI has no style for (the mapping
 *  is editable data — an unexpected value must render visibly, not crash). */
const UNKNOWN_VERDICT_STYLE: ZoneStyle = {
  color: "#475569",
  weight: 1.5,
  fillColor: "#64748b",
  fillOpacity: 0.18,
};

export function getZoneStyle(
  verdict: string,
  zoneTypeCode: string,
  extra?: { isInner?: boolean; isCorridor?: boolean }
): ZoneStyle {
  let color = "#475569";
  
  if (verdict === VERDICT_RESTRICTED) {
    switch (zoneTypeCode) {
      case "AIP_PROHIBITED":
      case "BORDER_SECURITY":
        color = "#b3261e";
        break;
      case "AIP_RESTRICTED":
      case "AIRPORT":
      case "POPULATED":
        color = "#d64500";
        break;
      case "AIP_DANGER":
        color = "#c77b00";
        break;
      case "LLU_DRONE":
        color = "#c2185b";
        break;
      case "CTR":
      case "ATZ":
      case "CTA":
      case "OTHER":
        color = "#8c4a2f";
        break;
      case "NATURE_RESERVE":
        color = "#9c7a00";
        break;
      case "CVFR_LANE":
        color = "#3f51b5";
        break;
      default:
        color = "#dc2626";
    }
  } else if (verdict === VERDICT_NEEDS_PERMIT) {
    switch (zoneTypeCode) {
      case "NATURE_RESERVE":
        color = "#9c7a00";
        break;
      case "CVFR_LANE":
        color = "#3f51b5";
        break;
      case "AIP_DANGER":
        color = "#c77b00";
        break;
      case "CTR":
      case "ATZ":
      case "CTA":
      case "OTHER":
        color = "#a16207";
        break;
      case "AIP_PROHIBITED":
      case "BORDER_SECURITY":
      case "LLU_DRONE":
        color = "#c77b00";
        break;
      default:
        color = "#d97706";
    }
  } else {
    if (zoneTypeCode === "CVFR_LANE") {
      color = "#3f51b5";
    } else {
      switch (zoneTypeCode) {
        case "AIP_PROHIBITED":
        case "LLU_DRONE":
        case "BORDER_SECURITY":
        case "OTHER":
          color = "#475569";
          break;
        case "AIP_RESTRICTED":
        case "AIRPORT":
        case "POPULATED":
          color = "#64748b";
          break;
        case "AIP_DANGER":
        case "NATURE_RESERVE":
          color = "#94a3b8";
          break;
        default:
          color = "#64748b";
      }
    }
  }

  let weight = 1.5;
  let dashArray: string | undefined = undefined;
  let fillColor = color;
  let fillOpacity = 0.15;
  let fill = true;

  if (verdict === VERDICT_NEEDS_PERMIT) {
    weight = 1.6;
    dashArray = "2 4";
    fillOpacity = 0.12;
  } else if (verdict === VERDICT_CLEAR) {
    weight = 1.2;
    dashArray = "4 4";
    fillOpacity = 0.08;
  } else {
    switch (zoneTypeCode) {
      case "AIP_PROHIBITED":
      case "BORDER_SECURITY":
        weight = 2.6;
        fillColor = "url(#crosshatch-restricted)";
        fillOpacity = 0.22;
        break;
      case "AIP_RESTRICTED":
      case "POPULATED":
        weight = 2.2;
        dashArray = "8 4";
        fillOpacity = 0.16;
        break;
      case "AIP_DANGER":
        weight = 2.0;
        dashArray = "10 3 2 3";
        fillColor = "url(#hatch-restricted)";
        fillOpacity = 0.16;
        break;
      case "LLU_DRONE":
        weight = 2.6;
        fillOpacity = 0.20;
        break;
      case "AIRPORT":
        weight = 1.4;
        fillOpacity = 0.08;
        break;
      case "CTR":
      case "OTHER":
        weight = 2.2;
        dashArray = "12 4";
        fillOpacity = 0.15;
        break;
      case "ATZ":
        weight = 1.2;
        dashArray = "5 3";
        fillOpacity = 0.07;
        break;
      case "CTA":
        weight = 1.6;
        dashArray = "2 2";
        fill = false;
        fillOpacity = 0;
        break;
      case "NATURE_RESERVE":
        weight = 1.8;
        dashArray = "1.5 3.5";
        fillOpacity = 0.14;
        break;
      case "CVFR_LANE":
        break;
      default:
        weight = 1.5;
        fillOpacity = 0.15;
    }
  }

  if (zoneTypeCode === "LLU_DRONE" && extra?.isInner) {
    weight = 1.5;
    dashArray = "1 3";
    fill = false;
    fillOpacity = 0;
  } else if (zoneTypeCode === "AIRPORT" && extra?.isInner) {
    weight = 1.4;
    fill = false;
    fillOpacity = 0;
  } else if (zoneTypeCode === "CVFR_LANE") {
    if (extra?.isCorridor) {
      weight = 1.0;
      fill = true;
      fillOpacity = 0.08;
    } else {
      weight = 1.4;
      dashArray = "7 5";
      fill = false;
      fillOpacity = 0;
    }
  }

  if (verdict === VERDICT_NEEDS_PERMIT) {
    if (zoneTypeCode === "AIP_PROHIBITED" || zoneTypeCode === "BORDER_SECURITY") {
      fillColor = "url(#crosshatch-needs-permit)";
    } else if (zoneTypeCode === "AIP_DANGER") {
      fillColor = "url(#hatch-needs-permit)";
    }
  } else if (verdict === VERDICT_CLEAR) {
    if (zoneTypeCode === "AIP_PROHIBITED" || zoneTypeCode === "BORDER_SECURITY") {
      fillColor = "url(#crosshatch-clear)";
    } else if (zoneTypeCode === "AIP_DANGER") {
      fillColor = "url(#hatch-clear)";
    }
  }

  return {
    color,
    weight,
    fillColor,
    fillOpacity,
    dashArray,
    fill,
  };
}

export function verdictStyle(verdict: string, zoneTypeCode?: string): ZoneStyle {
  if (zoneTypeCode) {
    return getZoneStyle(verdict, zoneTypeCode);
  }
  return VERDICT_STYLES[verdict] ?? UNKNOWN_VERDICT_STYLE;
}

export function isKnownVerdict(verdict: string): boolean {
  return verdict in VERDICT_STYLES;
}

/** Lane (line-geometry) rendering: verdict color, dashed, no fill — visually
 *  distinct from polygon borders while still verdict-driven. */
export function laneStyle(verdict: string, zoneTypeCode?: string): ZoneStyle & { dashArray: string } {
  if (zoneTypeCode) {
    const style = getZoneStyle(verdict, zoneTypeCode);
    return {
      ...style,
      dashArray: style.dashArray ?? "8 6",
    } as ZoneStyle & { dashArray: string };
  }
  const base = verdictStyle(verdict);
  return { ...base, weight: 2.5, fillOpacity: 0, dashArray: "8 6" };
}

// ── Altitude-band semantics (zones-api.md, ratified 2026-07-11) ─────────────

/** AIP P/R/D zone types — the ONLY types where a null ceiling means UNL
 *  (unbounded above). Everywhere else null = not published (Amendment 1:
 *  INPA AMSL nulls are "not published", never "unbounded"). */
const PRD_ZONE_TYPE_CODES = new Set(["AIP_PROHIBITED", "AIP_RESTRICTED", "AIP_DANGER"]);

/** CVFR lanes carry the Option A envelope; both-null = no vertical claim. */
export const LANE_ZONE_TYPE_CODE = "CVFR_LANE";

export type BandValue =
  | { kind: "ground" } // floor stored 0 = GND/MSL: reaches the surface (incl. below-sea-level terrain)
  | { kind: "amsl"; ft: number } // ft AMSL exactly as published (may be negative — Dead Sea)
  | { kind: "agl"; ft: number } // ft AGL from notes aglCeilingFt=N — displayed as published, NEVER converted
  | { kind: "unbounded" } // null ceiling on an AIP P/R/D zone (UNL)
  | { kind: "notPublished" }; // null = the source publishes nothing (never guessed)

export type AltitudeBand =
  | { kind: "band"; floor: BandValue; ceiling: BandValue }
  | { kind: "noVerticalClaim" }; // lane with a blank published band

/** Parses `aglCeilingFt=N` riding in Zone.notes (import contract). */
export function aglCeilingFromNotes(notes: string | null): number | null {
  if (!notes) return null;
  const match = /(?:^|\|)\s*aglCeilingFt=(\d+)\s*(?:\||$)/.exec(notes);
  return match ? Number(match[1]) : null;
}

/**
 * Raw directional altitude strings a lane's notes carry
 * ("CVFR lane; directional altitudes ft AMSL as published: N 1500 / S 2000 | …").
 * Returns the published fragment exactly as preserved, or null.
 */
export function laneDirectionalAltitudes(notes: string | null): string | null {
  if (!notes) return null;
  const match = /directional altitudes ft AMSL as published:\s*([^|]*)/.exec(notes);
  const value = match?.[1]?.trim();
  return value && value !== "none" ? value : null;
}

export function describeAltitudeBand(
  props: Pick<ZoneFeatureProperties, "zoneTypeCode" | "floorAmslFt" | "ceilingAmslFt" | "notes">,
): AltitudeBand {
  const { zoneTypeCode, floorAmslFt, ceilingAmslFt } = props;
  const aglCeiling = aglCeilingFromNotes(props.notes);

  if (
    zoneTypeCode === LANE_ZONE_TYPE_CODE &&
    floorAmslFt === null &&
    ceilingAmslFt === null
  ) {
    // A lane with a blank published band makes NO vertical claim — never "probably low".
    return { kind: "noVerticalClaim" };
  }

  const floor: BandValue =
    floorAmslFt === null
      ? { kind: "notPublished" }
      : floorAmslFt === 0
        ? { kind: "ground" } // GND/MSL stored as 0 (CAAI encoding): starts at the surface
        : { kind: "amsl", ft: floorAmslFt };

  let ceiling: BandValue;
  if (ceilingAmslFt !== null) {
    ceiling = { kind: "amsl", ft: ceilingAmslFt };
  } else if (aglCeiling !== null) {
    ceiling = { kind: "agl", ft: aglCeiling }; // shown as published; AMSL conversion is out of scope
  } else if (PRD_ZONE_TYPE_CODES.has(zoneTypeCode)) {
    ceiling = { kind: "unbounded" }; // UNL — P/R/D only (zones-api.md)
  } else {
    ceiling = { kind: "notPublished" }; // INPA and everything else: null = not published
  }

  return { kind: "band", floor, ceiling };
}

// ── Layer-visibility persistence (session decision, 2026-07-11) ─
// Client-side persistence keyed by layer NAME (layerKey — stable across
// re-imports, unlike ids in a rebuilt dev DB). Unlisted layers default to ON:
// new datasets must be visible the first time, never silently hidden.

const VISIBILITY_STORAGE_KEY = "droneops.zoneLayerVisibility";

export type LayerVisibility = Record<string, boolean>;

export function loadLayerVisibility(storage: Pick<Storage, "getItem"> = localStorage): LayerVisibility {
  try {
    const raw = storage.getItem(VISIBILITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: LayerVisibility = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") result[key] = value;
    }
    return result;
  } catch {
    return {}; // corrupted persistence must never break the map
  }
}

export function saveLayerVisibility(
  visibility: LayerVisibility,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // Quota/private-mode failures degrade to session-only visibility.
  }
}

export function isLayerVisible(visibility: LayerVisibility, layerName: string): boolean {
  return visibility[layerName] ?? true;
}

export function bufferLine(coords: [number, number][], halfWidthM: number): [number, number][] {
  if (coords.length < 2) return [];

  const leftPoints: [number, number][] = [];
  const rightPoints: [number, number][] = [];

  for (let i = 0; i < coords.length; i++) {
    const curr = coords[i];
    let dx = 0;
    let dy = 0;

    if (i === 0) {
      const next = coords[i + 1];
      dx = next[0] - curr[0];
      dy = next[1] - curr[1];
    } else if (i === coords.length - 1) {
      const prev = coords[i - 1];
      dx = curr[0] - prev[0];
      dy = curr[1] - prev[1];
    } else {
      const prev = coords[i - 1];
      const next = coords[i + 1];
      const d1x = curr[0] - prev[0];
      const d1y = curr[1] - prev[1];
      const d2x = next[0] - curr[0];
      const d2y = next[1] - curr[1];
      dx = d1x + d2x;
      dy = d1y + d2y;
    }

    const latRad = (curr[1] * Math.PI) / 180;
    const metersPerDegLat = 111132;
    const metersPerDegLng = 111132 * Math.cos(latRad);

    const lenM = Math.sqrt((dx * metersPerDegLng) ** 2 + (dy * metersPerDegLat) ** 2);
    if (lenM === 0) continue;

    const tx = (dx * metersPerDegLng) / lenM;
    const ty = (dy * metersPerDegLat) / lenM;

    const nx = -ty;
    const ny = tx;

    const offsetLng = (nx * halfWidthM) / metersPerDegLng;
    const offsetLat = (ny * halfWidthM) / metersPerDegLat;

    leftPoints.push([curr[0] + offsetLng, curr[1] + offsetLat]);
    rightPoints.push([curr[0] - offsetLng, curr[1] - offsetLat]);
  }

  return [...leftPoints, ...rightPoints.reverse(), leftPoints[0]];
}
