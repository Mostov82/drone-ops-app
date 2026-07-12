// DO-015 (session 2) — client for the location-check verdict engine
// (server/src/verdict/routes.ts; contract: server/docs/verdict-api.md).
//
// The verdict, its reasons, distances, vertical findings and data-quality
// flags all arrive from the server per request — read fresh against current
// data, NEVER a client-side constant. This is the safety-critical decision
// path: the client MUST fail closed (surface the server's structured error,
// never degrade to a silent "clear") and MUST badge every unverified layer,
// unverified rule and approximate elevation at point of use (verdict-api.md
// consumer obligations 1 & 3; PRD §10 — never authoritative).

export interface BilingualMessage {
  en: string;
  he: string;
}

export interface VerdictApiError {
  code: string;
  message: BilingualMessage;
}

/** The three-tier Gate 3 mapping (editable data — unknown values render raw). */
export type Verdict = "RESTRICTED" | "NEEDS_PERMIT" | "CLEAR" | string;

export type VerticalStatus = "CONFLICT" | "BELOW_FLOOR" | "ABOVE_CEILING" | "NO_CLAIM";

export interface VerticalFinding {
  status: VerticalStatus;
  /** ft; present only for BELOW_FLOOR / ABOVE_CEILING (smallest clearance consistent with ±uncertainty). */
  clearanceFt: number | null;
  groundReaching: boolean;
  /** P/R/D UNL only. */
  unboundedCeiling: boolean;
  /** Conservative assumptions applied (each widens, never narrows). */
  assumptions: string[];
}

export interface LayerInfo {
  name: string;
  importedAt: string;
  verified: boolean;
}

export interface RuleRef {
  key: string;
  value: number;
  unit: string;
  lastVerifiedAt: string | null;
}

export interface ReasonZone {
  id: string;
  name: string;
  zoneTypeCode: string;
  zoneTypeName: string;
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  notes: string | null;
}

export interface VerdictReason {
  kind: "POINT_IN_ZONE" | "WITHIN_AIRPORT_BUFFER_RULE" | "WITHIN_LANE_CORRIDOR" | string;
  verdict: Verdict;
  zone: ReasonZone;
  layer: LayerInfo;
  vertical?: VerticalFinding | null;
  /** WITHIN_AIRPORT_BUFFER_RULE / WITHIN_LANE_CORRIDOR carry these. */
  distanceM?: number;
  rule?: RuleRef;
}

export interface NearestAirport {
  zoneId: string;
  name: string;
  distanceM: number;
  insideImportedBuffer: boolean;
}

export interface BufferWarning {
  ruleKey: string;
  bufferM: number;
  airportZoneId: string;
  airportName: string;
  distanceM: number;
  ruleLastVerifiedAt: string | null;
}

export interface DistanceFindings {
  nearestAirport: NearestAirport;
  bufferWarning: BufferWarning | null;
}

export interface NearestLane {
  zoneId: string;
  name: string;
  horizontalDistanceM: number;
  withinCorridor: boolean;
  floorAmslFt: number | null;
  ceilingAmslFt: number | null;
  notes: string | null;
  layer: LayerInfo;
  vertical?: VerticalFinding | null;
}

export interface LaneCorridorRule {
  ruleKey: string;
  halfWidthM: number;
  ruleLastVerifiedAt: string | null;
}

export interface LaneFindings {
  nearest: NearestLane | null;
  laneCount: number;
  corridor: LaneCorridorRule | null;
}

export interface ElevationInfo {
  elevationM: number;
  approximate: true;
  source: string;
  resolutionM: number;
}

export interface VerticalContext {
  plannedAltitudeAglM: number;
  elevation: ElevationInfo;
  uncertaintyM: number;
  plannedAmslFt: { minFt: number; maxFt: number };
}

export interface NumberLimit {
  key: string;
  value: number;
  unit: string;
  lastVerifiedAt: string | null;
}

export interface BooleanLimit {
  key: string;
  value: boolean;
  lastVerifiedAt: string | null;
}

export interface VerdictContext {
  numberLimits: NumberLimit[];
  booleanLimits: BooleanLimit[];
}

export interface DataQuality {
  layers: LayerInfo[];
  unverifiedLayers: string[];
  elevationApproximate: boolean;
  unverifiedRuleKeys: string[];
}

export interface VerdictResult {
  verdict: Verdict;
  point: { lat: number; lng: number };
  reasons: VerdictReason[];
  distance: DistanceFindings;
  lanes: LaneFindings;
  vertical: VerticalContext | null;
  context: VerdictContext;
  dataQuality: DataQuality;
  checkedAt: string;
}

/** Thrown for non-OK responses; carries the server's structured bilingual error. */
export class VerdictRequestError extends Error {
  constructor(public apiError: VerdictApiError | null) {
    super(apiError?.message.en ?? "Verdict request failed");
  }
  get code(): string | null {
    return this.apiError?.code ?? null;
  }
  /** The bilingual message, so the UI can surface it in the current language. */
  get bilingual(): BilingualMessage | null {
    return this.apiError?.message ?? null;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const err = (await res.json().catch(() => null)) as VerdictApiError | null;
  throw new VerdictRequestError(err);
}

/**
 * Runs a location check. `plannedAltitudeAglM` is METERS above ground level
 * (the Ruleset's altitude unit); omit it for a horizontal-only check.
 * Fails closed — any server error becomes a thrown `VerdictRequestError`.
 */
export async function checkLocation(
  lat: number,
  lng: number,
  plannedAltitudeAglM?: number,
): Promise<VerdictResult> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (plannedAltitudeAglM !== undefined) params.set("aglM", String(plannedAltitudeAglM));
  return parseOrThrow<VerdictResult>(await fetch(`/api/verdict/check?${params.toString()}`));
}
