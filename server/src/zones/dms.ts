// DO-013 — DMS (degrees/minutes/seconds) coordinate parsing.
// Safety-critical (intent doc trigger 1): parsing is strict and fail-closed.
// Two source notations are supported, exactly as published:
//   - AIP א'-17 appendix ב' / gdb `Limited_Edges`:  `33° 07' 13.65" N`
//   - AIP א'-17 appendix ג' (LLU):                  `31°56'06"N`
// Anything else throws ZoneParseError. No leniency, no guessing.

import { ZoneParseError } from "./errors.js";

/** Unicode bidi control characters that PDF text extraction leaves behind. */
const BIDI = /[‎‏‪-‮⁦-⁩]/g;

export function stripBidi(s: string): string {
  return s.replace(BIDI, "");
}

// The trailing `\s*'` tolerance covers a typographic quirk that appears in the
// source (e.g. `31° 46 '41.00" N` — the minutes apostrophe drifted onto the
// seconds token). Structure remains strict: deg ° min ' sec " hemisphere.
const DMS = /^(\d{1,3})°\s*(\d{1,2})\s*'\s*(\d{1,2}(?:\.\d+)?)"\s*([NSEW])$/;

export interface DmsParts {
  degrees: number;
  minutes: number;
  seconds: number;
  hemisphere: "N" | "S" | "E" | "W";
}

export function parseDmsParts(raw: string): DmsParts {
  const cleaned = stripBidi(raw).trim();
  const m = DMS.exec(cleaned);
  if (!m) throw new ZoneParseError("Unrecognized DMS notation", raw);
  const degrees = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  const hemisphere = m[4] as DmsParts["hemisphere"];
  if (minutes >= 60) throw new ZoneParseError("Minutes out of range", raw);
  if (seconds >= 60) throw new ZoneParseError("Seconds out of range", raw);
  const maxDegrees = hemisphere === "N" || hemisphere === "S" ? 90 : 180;
  if (degrees > maxDegrees) throw new ZoneParseError("Degrees out of range", raw);
  return { degrees, minutes, seconds, hemisphere };
}

/** Parse one DMS token to signed decimal degrees (S/W negative). */
export function parseDms(raw: string): number {
  const { degrees, minutes, seconds, hemisphere } = parseDmsParts(raw);
  const value = degrees + minutes / 60 + seconds / 3600;
  return hemisphere === "S" || hemisphere === "W" ? -value : value;
}

/** Parse a (north, east) DMS pair into {lat, lng}; hemisphere axes enforced. */
export function parseDmsPair(northRaw: string, eastRaw: string): { lat: number; lng: number } {
  const north = parseDmsParts(northRaw);
  const east = parseDmsParts(eastRaw);
  if (north.hemisphere !== "N" && north.hemisphere !== "S") {
    throw new ZoneParseError("Latitude token has E/W hemisphere", northRaw);
  }
  if (east.hemisphere !== "E" && east.hemisphere !== "W") {
    throw new ZoneParseError("Longitude token has N/S hemisphere", eastRaw);
  }
  return { lat: parseDms(northRaw), lng: parseDms(eastRaw) };
}
