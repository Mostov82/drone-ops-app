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
}

/** Known verdict values (GB-03 Gate 3 three-tier mapping). */
export const VERDICT_RESTRICTED = "RESTRICTED";
export const VERDICT_NEEDS_PERMIT = "NEEDS_PERMIT";
export const VERDICT_CLEAR = "CLEAR";

const VERDICT_STYLES: Record<string, ZoneStyle> = {
  [VERDICT_RESTRICTED]: { color: "#dc2626", weight: 1.5, fillColor: "#dc2626", fillOpacity: 0.22 },
  [VERDICT_NEEDS_PERMIT]: { color: "#d97706", weight: 1.5, fillColor: "#f59e0b", fillOpacity: 0.22 },
  [VERDICT_CLEAR]: { color: "#16a34a", weight: 1.5, fillColor: "#22c55e", fillOpacity: 0.15 },
};

/** Honest fallback for a verdict value this UI has no style for (the mapping
 *  is editable data — an unexpected value must render visibly, not crash). */
const UNKNOWN_VERDICT_STYLE: ZoneStyle = {
  color: "#475569",
  weight: 1.5,
  fillColor: "#64748b",
  fillOpacity: 0.18,
};

export function verdictStyle(verdict: string): ZoneStyle {
  return VERDICT_STYLES[verdict] ?? UNKNOWN_VERDICT_STYLE;
}

export function isKnownVerdict(verdict: string): boolean {
  return verdict in VERDICT_STYLES;
}

/** Lane (line-geometry) rendering: verdict color, dashed, no fill — visually
 *  distinct from polygon borders while still verdict-driven. */
export function laneStyle(verdict: string): ZoneStyle & { dashArray: string } {
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
