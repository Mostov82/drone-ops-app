// DO-013 — types for the geodatabase dumps (server/scripts/zones/dump_gdb.py)
// and strict parsing of the gdb's raw altitude strings.

export interface GdbFeature {
  fid: number;
  properties: Record<string, string | number | boolean | null>;
  geometryWgs84?: unknown;
  geometryNative?: unknown;
}

export interface GdbDump {
  source: { zip: string; gdb: string; layer: string; crs: string };
  fields: string[];
  featureCount: number;
  features: GdbFeature[];
}

/**
 * Parse a gdb altitude attribute (`AltMin`/`AltMax`) to whole feet AMSL.
 * The gdb stores strings; observed values include plain integers, negatives
 * (Dead Sea area), stray CR/LF, and at least one dual value ("12000/16000").
 * Returns null when the string is not one unambiguous integer — the caller
 * records the raw value in the reconciliation report (trigger 1: no guessing).
 */
export function parseGdbAltitudeFt(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^-?\d+$/.test(text)) return null;
  return Number(text);
}

/**
 * Parse an א'-17 appendix ב' altitude cell to whole feet AMSL.
 * "GND", "MSL" and "MSL/GND" floors are published as surface references, not
 * numbers; per CAAI's own gdb encoding they map to 0 — the caveat (0 ft AMSL
 * vs actual surface, relevant below sea level) is documented in
 * server/docs/zones-api.md and surfaced in the session report.
 * Negative ceilings are published as "(-)530" (Dead Sea area).
 * "UNL" (unlimited) is handled by the caller via isUnlimited().
 * Anything else non-numeric returns null (caller reconciles).
 */
export function parseA17AltitudeFt(raw: string | null): number | null {
  if (raw === null) return null;
  const text = raw.replace(/\s+/g, "");
  if (/^(GND|MSL|MSL\/GND|GND\/MSL)$/.test(text)) return 0;
  const negative = /^\(-\)(\d+)$/.exec(text);
  if (negative) return -Number(negative[1]);
  if (/^-?\d+$/.test(text)) return Number(text);
  return null;
}

/** Published "unlimited" ceiling (text "UNL"; the gdb encodes it as 99000). */
export function isUnlimited(raw: string | null): boolean {
  return raw !== null && raw.replace(/\s+/g, "") === "UNL";
}
