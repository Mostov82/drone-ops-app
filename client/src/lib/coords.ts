// DO-012 — precise pin coordinates (FR-C2 as amended 2026-07-10).
// Decimal + DMS formatting and parsing, hand-rolled per the intent doc (no new
// library). DMS notation follows the AIP's style: 35° 35' 13.44" E.
// Pure functions — unit-tested in __tests__/coords.test.ts.

export interface LatLng {
  lat: number;
  lng: number;
}

const LAT_MAX = 90;
const LNG_MAX = 180;

/** Decimal rendering at ≥6 decimals (FR-C2): 6 decimals ≈ 0.11 m of latitude. */
export function formatDecimal(point: LatLng, decimals = 6): string {
  return `${point.lat.toFixed(decimals)}, ${point.lng.toFixed(decimals)}`;
}

/** One axis as DMS, AIP style: 31° 46' 12.34" N. Seconds at 2 decimals ≈ 0.31 m. */
export function formatDmsAxis(value: number, axis: "lat" | "lng"): string {
  const hemisphere = axis === "lat" ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutes = Math.floor((abs - degrees) * 60);
  let seconds = (abs - degrees - minutes / 60) * 3600;
  // Guard the carry when seconds round up to 60.00.
  if (Number(seconds.toFixed(2)) >= 60) {
    seconds = 0;
    minutes += 1;
    if (minutes === 60) {
      minutes = 0;
      degrees += 1;
    }
  }
  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${hemisphere}`;
}

export function formatDms(point: LatLng): string {
  return `${formatDmsAxis(point.lat, "lat")}, ${formatDmsAxis(point.lng, "lng")}`;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface AxisValue {
  /** Signed decimal degrees (hemisphere applied). */
  value: number;
  /** Which axis the hemisphere letter pinned this to, if one was given. */
  axis: "lat" | "lng" | null;
}

// One coordinate axis: degrees [°] [minutes ' [seconds ["]]] [NSEW],
// or a plain signed decimal with an optional hemisphere letter.
// Unicode variants accepted: ° º; ' ′ ’; " ″ ” or two single quotes.
// Minutes require their mark (') so a bare "31 46" never reads as DMS.
const DEG = "[\\u00b0\\u00ba]";
const MIN = "['\\u2032\\u2019]";
const SEC = '(?:["\\u2033\\u201d]|\'\'|\\u2032\\u2032)';
const AXIS_RE = new RegExp(
  "^\\s*([+-]?\\d+(?:\\.\\d+)?)" + // degrees (may be decimal)
    `\\s*${DEG}?\\s*` +
    "(?:(\\d+(?:\\.\\d+)?)\\s*" + // minutes (may be decimal)
    `${MIN}\\s*` +
    "(?:(\\d+(?:\\.\\d+)?)\\s*" + // seconds (may be decimal)
    `${SEC}?\\s*)?)?` +
    "([NSEWnsew])?\\s*$",
);

function parseAxis(text: string): AxisValue | null {
  const m = AXIS_RE.exec(text);
  if (!m) return null;
  const [, degStr, minStr, secStr, hemi] = m;
  const degrees = Number(degStr);
  const minutes = minStr === undefined ? 0 : Number(minStr);
  const seconds = secStr === undefined ? 0 : Number(secStr);
  if (Number.isNaN(degrees) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  if (minutes >= 60 || seconds >= 60) return null;
  // Decimal degrees may not be combined with minutes/seconds.
  if (!Number.isInteger(degrees) && (minStr !== undefined || secStr !== undefined)) return null;
  // A hemisphere letter and a minus sign are mutually exclusive.
  const negative = degStr.startsWith("-");
  if (negative && hemi) return null;

  let value = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  let axis: AxisValue["axis"] = null;
  if (hemi) {
    const h = hemi.toUpperCase();
    axis = h === "N" || h === "S" ? "lat" : "lng";
    if (h === "S" || h === "W") value = -value;
  } else if (negative) {
    value = -value;
  }
  return { value, axis };
}

/**
 * Split a full coordinate entry into its two axis parts. The separator is a
 * comma/slash, or whitespace between the end of one axis (hemisphere letter,
 * seconds mark, or plain number) and the next number.
 */
function splitPair(text: string): [string, string] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // Preferred, unambiguous separators first.
  for (const sep of [",", "/", ";"]) {
    const idx = trimmed.indexOf(sep);
    if (idx !== -1) {
      const a = trimmed.slice(0, idx);
      const b = trimmed.slice(idx + 1);
      if (b.includes(sep)) return null;
      return [a, b];
    }
  }
  // Whitespace-separated: try every whitespace gap until both halves parse.
  const gaps = [...trimmed.matchAll(/\s+/g)];
  for (const gap of gaps) {
    const at = gap.index;
    const a = trimmed.slice(0, at);
    const b = trimmed.slice(at + gap[0].length);
    if (parseAxis(a) && parseAxis(b)) return [a, b];
  }
  return null;
}

/**
 * Parse a coordinate pair typed by the operator. Accepts decimal
 * ("31.771959, 35.217018") and DMS ("31° 46' 19.05" N, 35° 13' 1.26" E") in
 * any mix; hemisphere letters may reorder the pair (E/W value can come first).
 * Returns null when the text is not a valid coordinate — the caller shows one
 * generic bilingual error, no partial guesses.
 */
export function parseCoordinates(text: string): LatLng | null {
  const pair = splitPair(text);
  if (!pair) return null;
  const first = parseAxis(pair[0]);
  const second = parseAxis(pair[1]);
  if (!first || !second) return null;

  let lat: AxisValue;
  let lng: AxisValue;
  if (first.axis === "lng" || second.axis === "lat") {
    // Explicitly reordered by hemisphere letters.
    lng = first;
    lat = second;
  } else {
    lat = first;
    lng = second;
  }
  // Contradictory hemisphere letters (both lat, or both lng) are invalid —
  // after the reordering above, any duplicate axis shows up as a mismatch here.
  if (lat.axis === "lng" || lng.axis === "lat") return null;

  if (Math.abs(lat.value) > LAT_MAX || Math.abs(lng.value) > LNG_MAX) return null;
  return { lat: lat.value, lng: lng.value };
}
