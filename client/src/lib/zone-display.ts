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
  opacity?: number;
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
  extra?: {
    isInner?: boolean;
    isCorridor?: boolean;
    /** DO-041 weekend view — weekday-only zone, faded but never hidden. */
    isDeemphasized?: boolean;
    /** DO-041 weekend view — weekend-relevant zone, brought forward. */
    isEmphasized?: boolean;
    /**
     * DO-045 — a WEEKEND_BUBBLE that is active all week rather than weekends
     * only. Carried in the border grammar, never in hue alone (Amendment 1).
     */
    isAllWeek?: boolean;
  }
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
    } else if (zoneTypeCode === "WEEKEND_BUBBLE") {
      // DO-045 — teal, the one cool hue not already spoken for (indigo is lanes,
      // carmine is LLU, brick is controlled airspace, olive-amber is INPA).
      //
      // Deliberately NOT green, and not only because DO-040 Amendment 1 forbids
      // it: green would read as "cleared", and this geometry is hand-traced to
      // ±500 m and ships unverified. The colour must not promise more than the
      // data can support.
      color = "#00838f";
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

  // DO-045 — weekend fly-bubbles. These are permissive areas, so the treatment
  // must stay quiet: a light wash that never competes with a restriction sharing
  // the same ground. The weekend/all-week distinction rides on BORDER GRAMMAR,
  // extending Amendment 1's vocabulary rather than reinterpreting it — dashed
  // reads as "conditional/scheduled" exactly as it does for the AIP classes, and
  // solid means the area is in force whenever you look at it.
  if (zoneTypeCode === "WEEKEND_BUBBLE") {
    if (extra?.isAllWeek) {
      weight = 2.0;
      dashArray = undefined; // in force all week — no schedule condition to signal
      fillOpacity = 0.12;
    } else {
      weight = 1.8;
      dashArray = "6 4"; // weekends only — a scheduled, conditional area
      fillOpacity = 0.1;
    }
    fill = true;
    fillColor = color;
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

  // DO-041 weekend view — display-only re-weighting on top of DO-040's colours.
  // De-emphasis fades but never hides (honesty stance); emphasis thickens the
  // stroke and deepens the fill without changing hue, so the verdict colour a
  // reader has learned still means exactly the same thing.
  let opacity: number | undefined = undefined;
  if (extra?.isDeemphasized) {
    fillOpacity = fillOpacity * 0.25;
    opacity = 0.3;
  } else if (extra?.isEmphasized) {
    weight = weight + 1.5;
    fillOpacity = Math.min(fillOpacity * 1.8, 0.6);
  }

  return {
    color,
    weight,
    fillColor,
    fillOpacity,
    dashArray,
    fill,
    // Emitted ONLY when de-emphasis actually set it. Leaflet copies every key of
    // a style object over its defaults, so an explicit `opacity: undefined`
    // would clobber the default 1.0 — and its canvas renderer then does
    // `ctx.globalAlpha = options.opacity` (leaflet-src.js:12907) right after
    // setting globalAlpha to fillOpacity for the fill. Canvas ignores a NaN
    // alpha, so every stroke would silently inherit the fill's opacity and the
    // whole palette would wash out.
    ...(opacity === undefined ? {} : { opacity }),
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

/**
 * Layers that start hidden, overriding the "unlisted layers default to ON" rule
 * above. Jonathan's call at DO-045 review, 2026-07-29.
 *
 * The default-ON rule exists so a newly imported dataset can never silently hide
 * a RESTRICTION from an operator — that is a safety rule, and it is not being
 * weakened. The weekend fly-bubbles are the inverse: a permissive, display-only
 * layer of 37 hand-traced areas that grant nothing and restrict nothing. Hiding
 * them by default cannot cause a missed restriction, which is the only harm the
 * rule guards against; leaving 37 large washes on by default would just add
 * noise to a map that already carries 1,046 zones.
 *
 * So this set is narrow on purpose. A layer belongs here only if it is
 * permissive; anything that can restrict must stay default-ON.
 */
const DEFAULT_HIDDEN_LAYERS: ReadonlySet<string> = new Set(["caai-weekend-bubbles"]);

export function isLayerVisible(visibility: LayerVisibility, layerName: string): boolean {
  // An explicit stored choice always wins — including turning a default-hidden
  // layer on, which then persists like any other toggle.
  return visibility[layerName] ?? !DEFAULT_HIDDEN_LAYERS.has(layerName);
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

// DO-041 — schedule surfacing (display-only). Detection reads ONLY what the
// importers already preserve: variant names carrying סופש/אמצע שבוע, the
// `schedule:` notes segment (ctr.ts builder), and the `gdb comment:` segment
// (aip-zones.ts builder). Anything unmatched yields null — no chip, never
// guessed. Presentation only: verdicts stay time-blind and conservative.
export type ScheduleType = "weekend" | "weekday" | "other";

/** Which published string the schedule was read from. */
export type ScheduleSource = "name" | "notes";

export interface ZoneSchedule {
  type: ScheduleType;
  /** Chip label — the published token itself, never a normalised coinage. */
  text: string;
  /**
   * The full published string the schedule was read from, verbatim — or null
   * when it came from the zone name, which callers already render on its own
   * line. Repeating it there would print the same string twice.
   */
  verbatimText: string | null;
  source: ScheduleSource;
}

// Published tokens, exactly as they occur in the imported strings. סופ"ש (with
// gershayim) and סופש are distinct spellings and both appear in real data.
const WEEKEND_TOKEN = /סופ"ש|סופש|סוף שבוע/;
const WEEKDAY_TOKEN = /אמצע שבוע|אמצ"ש|א'-ה'|א'–ה'/;

/** Read a weekend/weekday token out of one published string. */
function readSchedule(value: string, source: ScheduleSource): ZoneSchedule | null {
  const weekend = WEEKEND_TOKEN.exec(value);
  const weekday = weekend ? null : WEEKDAY_TOKEN.exec(value);
  const match = weekend ?? weekday;
  if (!match) return null;
  return {
    type: weekend ? "weekend" : "weekday",
    text: match[0],
    verbatimText: source === "notes" ? value : null,
    source,
  };
}

export function detectSchedule(name: string, notes: string | null): ZoneSchedule | null {
  if (notes) {
    const scheduleSegment = /(?:^|\|)\s*schedule:\s*([^|]+)/.exec(notes);
    if (scheduleSegment) {
      const value = scheduleSegment[1].trim();
      // An explicit `schedule:` segment is schedule data by construction, so it
      // is surfaced verbatim even when it carries no weekend/weekday token.
      return (
        readSchedule(value, "notes") ?? {
          type: "other",
          text: value,
          verbatimText: value,
          source: "notes",
        }
      );
    }

    // gdb comments are free prose — surface only when a token is actually there.
    const commentSegment = /(?:^|\|)\s*gdb comment:\s*([^|]+)/.exec(notes);
    if (commentSegment) {
      const found = readSchedule(commentSegment[1].trim(), "notes");
      if (found) return found;
    }
  }

  return readSchedule(name, "name");
}


// ── DO-045 — weekend fly-bubbles (AIP ב'-08) ───────────────────────────────
//
// The importer writes a structured `weekendOnly: true|false` segment into the
// zone's notes rather than adding a Zone column (DO-045 trigger 4: schema
// pressure is an escalation, structured notes are the sanctioned alternative).
// Reading it here keeps every caller — map style, popup, panel — off ad-hoc
// regexes and off parsing Hebrew to decide which kind of bubble it is.

export const WEEKEND_BUBBLE_ZONE_TYPE = "WEEKEND_BUBBLE";

/**
 * `true` when the bubble is published/derived as active ALL week, `false` when
 * it is weekend-only, `null` when the note carries no such segment (a zone that
 * is not a bubble, or one whose notes predate the segment). Never guessed.
 */
export function isAllWeekBubble(notes: string | null): boolean | null {
  if (!notes) return null;
  const match = /(?:^|\|)\s*weekendOnly:\s*(true|false)\b/.exec(notes);
  if (!match) return null;
  return match[1] === "false";
}

/**
 * `true` when the bubble's weekend/all-week status was INFERRED by the importer
 * rather than published in the traced source (Jonathan's ruling 2026-07-28).
 * Surfaces are expected to say so — an inferred schedule must never be shown
 * with the same confidence as a published one.
 */
export function isBubbleScheduleInferred(notes: string | null): boolean {
  return notes ? /weekendOnly:\s*(?:true|false)\s*\(inferred/.test(notes) : false;
}

/** `true` when the zone's geometry is hand-traced rather than chart-derived. */
export function isHandTracedGeometry(notes: string | null): boolean {
  return notes ? /hand-traced/.test(notes) : false;
}
