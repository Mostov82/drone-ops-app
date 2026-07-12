// DO-015 (session 2) — pure display logic for the location-check verdict card.
// Sibling of zone-display.ts. NO regulatory value lives here: verdict values,
// bands, distances and thresholds all arrive from the server (verdict-api.md);
// this file only maps them to presentation tokens and i18n key suffixes.
//
// Verdict styling keys off the VERDICT VALUE the server returns (the editable
// Gate 3 mapping) — never a client-side constant. An unexpected verdict value
// must render visibly and honestly, never crash.
import type { Verdict, VerticalStatus } from "@/lib/verdict-api";

/** Card tone per verdict tier — border/background/text Tailwind classes. */
export interface VerdictTone {
  container: string;
  heading: string;
}

const VERDICT_TONES: Record<string, VerdictTone> = {
  RESTRICTED: {
    container: "border-red-300 bg-red-50",
    heading: "text-red-800",
  },
  NEEDS_PERMIT: {
    container: "border-amber-300 bg-amber-50",
    heading: "text-amber-900",
  },
  CLEAR: {
    container: "border-green-300 bg-green-50",
    heading: "text-green-800",
  },
};

/** Honest neutral fallback for a verdict value this UI has no tone for (the
 *  mapping is editable data — an unknown value must render, not disappear). */
const UNKNOWN_VERDICT_TONE: VerdictTone = {
  container: "border-slate-300 bg-slate-50",
  heading: "text-slate-800",
};

export function verdictTone(verdict: Verdict): VerdictTone {
  return VERDICT_TONES[verdict] ?? UNKNOWN_VERDICT_TONE;
}

export function isKnownVerdict(verdict: Verdict): boolean {
  return verdict in VERDICT_TONES;
}

/** i18n key suffix for a vertical-finding status. */
export function verticalStatusKey(status: VerticalStatus | string): string {
  return `map.check.vertical.status.${status}`;
}

/** i18n key suffix for a reason kind (why a zone triggered). */
export function reasonKindKey(kind: string): string {
  return `map.check.reasonKind.${kind}`;
}

/**
 * A verdict computed over any unverified layer, any unverified rule, or an
 * approximate elevation is itself not authoritative (verdict-api.md obligation
 * 3; PRD §10). This collapses the response's data-quality signals into the
 * single question the banner asks: must we caveat this verdict?
 */
export function hasDataQualityCaveats(dq: {
  unverifiedLayers: string[];
  unverifiedRuleKeys: string[];
  elevationApproximate: boolean;
}): boolean {
  return (
    dq.unverifiedLayers.length > 0 ||
    dq.unverifiedRuleKeys.length > 0 ||
    dq.elevationApproximate
  );
}
