// DO-015 (session 2) — the location-check panel (FR-C2/C3/C5/C6). A pin (or
// entered coordinates) plus an optional planned altitude → the verdict card:
// clear / needs-permit / restricted, EVERY triggering zone with its itemized
// reason, distance findings (nearest airport / buffer), vertical-separation
// findings, and a prominent data-quality banner.
//
// Standing product stance (verdict-api.md obligation 3; PRD §10; escalation
// trigger 5 of the intent doc): this is operator-maintained information, NEVER
// authoritative. Unverified layers, unverified rules and approximate elevation
// are surfaced honestly and MUST NOT be softened. The card fails closed — a
// server error surfaces the server's structured bilingual message and never
// degrades to a silent "clear".
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ApproximateBadge from "@/components/map/ApproximateBadge";
import ZoneNotes from "@/components/map/ZoneNotes";
import UnverifiedBadge from "@/components/UnverifiedBadge";
import { Button } from "@/components/ui/button";
import type { LatLng } from "@/lib/coords";
import { formatDate, toDateLanguage } from "@/lib/dates";
import {
  checkLocation,
  VerdictRequestError,
  type NearestLane,
  type VerdictReason,
  type VerdictResult,
  type VerticalFinding,
} from "@/lib/verdict-api";
import {
  hasDataQualityCaveats,
  reasonKindKey,
  verdictTone,
  verticalStatusKey,
  isKnownVerdict,
} from "@/lib/verdict-display";
import { altitudeBandTextParts } from "@/lib/zone-popup-helpers";
import { describeAltitudeBand, detectSchedule } from "@/lib/zone-display";

type CheckState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; result: VerdictResult }
  | { kind: "error"; code: string | null; message: { en: string; he: string } | null };

/** LTR-wrapped numeric span — numbers/units are LTR data even in the RTL layout. */
function Num({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" className="font-mono">
      {children}
    </span>
  );
}

export default function LocationCheckPanel({ pin }: { pin: LatLng | null }) {
  const { t, i18n } = useTranslation();
  const dateLanguage = toDateLanguage(i18n.language);
  const [altText, setAltText] = useState("");
  const [altError, setAltError] = useState(false);
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });

  // A verdict is for one point. When the pin moves, the previous verdict is
  // stale and misleading — reset to idle so the operator must re-check. (Honest
  // over convenient: never show a verdict for a point that is no longer pinned.)
  useEffect(() => {
    setCheck({ kind: "idle" });
  }, [pin]);

  function formatImported(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : formatDate(d, "PP", dateLanguage);
  }

  async function runCheck() {
    if (!pin) return;
    const trimmed = altText.trim();
    let aglM: number | undefined;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        setAltError(true);
        return;
      }
      aglM = n;
    }
    setAltError(false);
    setCheck({ kind: "loading" });
    try {
      const result = await checkLocation(pin.lat, pin.lng, aglM);
      setCheck({ kind: "ok", result });
    } catch (err) {
      if (err instanceof VerdictRequestError) {
        setCheck({ kind: "error", code: err.code, message: err.bilingual });
      } else {
        setCheck({ kind: "error", code: null, message: null });
      }
    }
  }

  return (
    // DO-035 item 4: the panel's own "Location check" <h2> was removed — the
    // accordion section header now names this block, and keeping it duplicated the
    // title of sidebar section ①, which reads as two different things called the
    // same name. No content was lost.
    <div className="flex flex-col gap-3">
      {!pin && <p className="text-sm text-muted-foreground">{t("map.check.prompt")}</p>}

      {pin && (
        <div className="flex flex-col gap-2">
          <label htmlFor="planned-altitude" className="text-sm font-medium">
            {t("map.check.altitude.label")}
          </label>
          <div className="flex gap-2">
            <input
              id="planned-altitude"
              inputMode="decimal"
              value={altText}
              onChange={(e) => {
                setAltText(e.target.value);
                setAltError(false);
              }}
              dir="ltr"
              placeholder={t("map.check.altitude.placeholder")}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void runCheck()}
              disabled={check.kind === "loading"}
            >
              {check.kind === "loading" ? t("map.check.running") : t("map.check.run")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("map.check.altitude.hint")}</p>
          {altError && (
            <p role="alert" className="text-sm text-red-700">
              {t("map.check.altitude.error")}
            </p>
          )}
        </div>
      )}

      {check.kind === "error" && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-800">{t("map.check.error.title")}</p>
          <p className="mt-1 text-sm text-red-800" dir="auto">
            {check.message
              ? i18n.language.startsWith("he")
                ? check.message.he
                : check.message.en
              : t("map.check.error.generic")}
          </p>
          {check.code && (
            <p className="mt-1 text-xs text-red-700">
              <Num>{check.code}</Num>
            </p>
          )}
        </div>
      )}

      {check.kind === "ok" && (
        <VerdictCard result={check.result} t={t} formatImported={formatImported} />
      )}
    </div>
  );
}

// ── Verdict card ────────────────────────────────────────────────────────────

function VerdictCard({
  result,
  t,
  formatImported,
}: {
  result: VerdictResult;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatImported: (iso: string) => string;
}) {
  const tone = verdictTone(result.verdict);
  const verdictLabel = isKnownVerdict(result.verdict)
    ? t(`map.zones.verdict.${result.verdict}`)
    : result.verdict;

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-3 ${tone.container}`}>
      <div>
        <div className={`text-base font-semibold ${tone.heading}`} dir="auto">
          {verdictLabel}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("map.check.checkedAt", { date: formatImported(result.checkedAt) })}
        </div>
      </div>

      {/* Data-quality banner FIRST — the verdict is never authoritative. */}
      <DataQualityBanner result={result} t={t} formatImported={formatImported} />

      {/* Triggering zones, worst verdict first. */}
      {result.reasons.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold">{t("map.check.reasons.title")}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {result.reasons.map((reason, i) => (
              <li key={`${reason.zone.id}-${reason.kind}-${i}`}>
                <ReasonRow reason={reason} t={t} formatImported={formatImported} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm" dir="auto">
          {t("map.check.clear.body")}
        </p>
      )}

      {/* Distance findings (FR-C3) — always present. */}
      <DistanceSection result={result} t={t} />

      {/* CVFR lanes (FR-C6). */}
      <LaneSection result={result} t={t} />

      {/* Vertical separation (FR-C5). */}
      <VerticalSection result={result} t={t} />

      {/* Standard limits echo (Gate 3 — a clear still shows the limits). */}
      <ContextSection result={result} t={t} formatImported={formatImported} />
    </div>
  );
}

function VerdictTierChip({
  verdict,
  t,
}: {
  verdict: string;
  t: (key: string) => string;
}) {
  const tone = verdictTone(verdict);
  const label = isKnownVerdict(verdict) ? t(`map.zones.verdict.${verdict}`) : verdict;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone.container} ${tone.heading}`}
      dir="auto"
    >
      {label}
    </span>
  );
}

function VerticalFindingLine({
  vertical,
  t,
}: {
  vertical: VerticalFinding;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{t("map.check.vertical.label")}: </span>
      <span dir="auto">{t(verticalStatusKey(vertical.status))}</span>
      {vertical.clearanceFt !== null && (
        <span>
          {" — "}
          {t("map.check.vertical.clearance", { ft: vertical.clearanceFt })}
        </span>
      )}
      {vertical.groundReaching && (
        <span className="ms-1 text-muted-foreground">
          · {t("map.check.vertical.groundReaching")}
        </span>
      )}
      {vertical.unboundedCeiling && (
        <span className="ms-1 text-muted-foreground">
          · {t("map.check.vertical.unbounded")}
        </span>
      )}
    </div>
  );
}

function ReasonRow({
  reason,
  t,
  formatImported,
}: {
  reason: VerdictReason;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatImported: (iso: string) => string;
}) {
  const band = altitudeBandTextParts(describeAltitudeBand(reason.zone), t);
  const schedule = detectSchedule(reason.zone.name, reason.zone.notes);
  return (
    <div className="rounded-md border border-border bg-background/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words text-xs font-medium" dir="auto">
          {reason.zone.name}
        </span>
        <VerdictTierChip verdict={reason.verdict} t={t} />
        {schedule && (
          <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[9px] font-bold text-blue-900 leading-none" dir="auto">
            {schedule.text}
          </span>
        )}
      </div>
      <div className="mt-0.5 break-words text-xs text-muted-foreground" dir="auto">
        {reason.zone.zoneTypeName}
      </div>
      {/* Published schedule text verbatim. Omitted when it was read from the
          zone name, which is already rendered above. */}
      {schedule?.verbatimText && (
        <div className="mt-1 text-xs" dir="auto">
          <span className="text-muted-foreground">{t("map.zones.popup.schedule")}: </span>
          <span className="italic text-muted-foreground">{schedule.verbatimText}</span>
        </div>
      )}
      <div className="mt-1 text-xs" dir="auto">
        {t(reasonKindKey(reason.kind))}
        {reason.distanceM !== undefined && (
          <span>
            {" — "}
            <Num>{reason.distanceM}</Num> {t("map.check.units.m")}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs">
        <span className="text-muted-foreground">{t("map.zones.popup.band")}: </span>
        <span dir="auto">{band}</span>
      </div>
      {reason.vertical && <VerticalFindingLine vertical={reason.vertical} t={t} />}
      {reason.kind === "CVFR_OVERHEAD" && reason.allowedAglM !== undefined && reason.allowedAglM !== null && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50/50 p-2 text-xs text-amber-900" dir="auto">
          <p className="font-medium">
            {t("map.check.vertical.allowedHeightAdvisory", { height: reason.allowedAglM })}
          </p>
        </div>
      )}
      {/* DO-035 item 2 — the zone's published special text + coordination contact. */}
      <ZoneNotes notes={reason.zone.notes} />
      <div className="mt-2 break-words text-xs text-muted-foreground" dir="auto">
        {reason.layer.name} · {t("map.zones.imported", { date: formatImported(reason.layer.importedAt) })}
        {!reason.layer.verified && (
          <span className="ms-1">
            <UnverifiedBadge lastVerifiedAt={null} />
          </span>
        )}
      </div>
    </div>
  );
}

function DistanceSection({
  result,
  t,
}: {
  result: VerdictResult;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { nearestAirport, bufferWarning } = result.distance;
  return (
    <section>
      <h3 className="text-sm font-semibold">{t("map.check.distance.title")}</h3>
      <div className="mt-1 text-xs">
        <span className="text-muted-foreground">{t("map.check.distance.nearestAirport")}: </span>
        <span dir="auto">{nearestAirport.name}</span>
        {" — "}
        <Num>{nearestAirport.distanceM}</Num> {t("map.check.units.m")}
      </div>
      {bufferWarning ? (
        <p className="mt-1 text-xs text-amber-900" dir="auto">
          {t("map.check.distance.bufferWarning", {
            name: bufferWarning.airportName,
            m: bufferWarning.bufferM,
          })}
        </p>
      ) : (
        nearestAirport.insideImportedBuffer && (
          <p className="mt-1 text-xs text-amber-900">
            {t("map.check.distance.insideImportedBuffer")}
          </p>
        )
      )}
    </section>
  );
}

function LaneSection({
  result,
  t,
}: {
  result: VerdictResult;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { nearest, corridor } = result.lanes;
  if (!nearest || !corridor) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold">{t("map.check.lanes.title")}</h3>
      <LaneRow lane={nearest} t={t} />
    </section>
  );
}

function LaneRow({
  lane,
  t,
}: {
  lane: NearestLane;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const band = altitudeBandTextParts(
    describeAltitudeBand({
      zoneTypeCode: "CVFR_LANE",
      floorAmslFt: lane.floorAmslFt,
      ceilingAmslFt: lane.ceilingAmslFt,
      notes: lane.notes,
    }),
    t,
  );
  return (
    <div className="mt-1 text-xs">
      <div dir="auto">
        <span className="text-muted-foreground">{t("map.check.lanes.nearest")}: </span>
        {lane.name}
      </div>
      <div>
        <span className="text-muted-foreground">{t("map.check.lanes.centerlineDistance")}: </span>
        <Num>{lane.horizontalDistanceM}</Num> {t("map.check.units.m")}
        {lane.withinCorridor && (
          <span className="ms-1 font-medium text-amber-900">
            · {t("map.check.lanes.withinCorridor")}
          </span>
        )}
      </div>
      <div>
        <span className="text-muted-foreground">{t("map.zones.popup.band")}: </span>
        <span dir="auto">{band}</span>
      </div>
      {lane.vertical && <VerticalFindingLine vertical={lane.vertical} t={t} />}
      {lane.withinCorridor && lane.allowedAglM !== undefined && lane.allowedAglM !== null && (
        <div className="mt-1.5 rounded border border-amber-200 bg-amber-50/50 p-2 text-[11px] text-amber-900" dir="auto">
          <p className="font-medium">
            {t("map.check.vertical.allowedHeightAdvisory", { height: lane.allowedAglM })}
          </p>
        </div>
      )}
    </div>
  );
}

function VerticalSection({
  result,
  t,
}: {
  result: VerdictResult;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{t("map.check.vertical.title")}</h3>
      {result.vertical ? (
        <div className="mt-1 flex flex-col gap-0.5 text-xs">
          <div>
            <span className="text-muted-foreground">{t("map.check.vertical.plannedLabel")}: </span>
            <Num>{result.vertical.plannedAltitudeAglM}</Num> {t("map.check.vertical.aglUnit")}
          </div>
          <div className="inline-flex flex-wrap items-center gap-2">
            <span>
              <span className="text-muted-foreground">{t("map.elevation.label")}: </span>
              <Num>{t("map.elevation.value", { value: result.vertical.elevation.elevationM })}</Num>
            </span>
            <ApproximateBadge />
          </div>
          <div>
            <span className="text-muted-foreground">{t("map.check.vertical.interval")}: </span>
            <Num>
              {result.vertical.plannedAmslFt.minFt}–{result.vertical.plannedAmslFt.maxFt}
            </Num>{" "}
            {t("map.check.vertical.ftAmsl")}
          </div>
          <p className="text-muted-foreground">{t("map.check.vertical.conservativeNote")}</p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{t("map.check.vertical.noAltitude")}</p>
      )}
    </section>
  );
}

function ContextSection({
  result,
  t,
  formatImported,
}: {
  result: VerdictResult;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatImported: (iso: string) => string;
}) {
  const { numberLimits, booleanLimits } = result.context;
  const ruleName = (key: string) => {
    const translated = t(`ruleset.rule.${key}`);
    // Unknown keys fall back to the raw key rather than the i18n miss string.
    return translated === `ruleset.rule.${key}` ? key : translated;
  };
  return (
    <section>
      <h3 className="text-sm font-semibold">{t("map.check.context.title")}</h3>
      <ul className="mt-1 flex flex-col gap-1 text-xs">
        {numberLimits.map((limit) => (
          <li key={limit.key} className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground" dir="auto">
              {ruleName(limit.key)}:
            </span>
            <Num>
              {limit.value} {limit.unit}
            </Num>
            <UnverifiedBadge lastVerifiedAt={limit.lastVerifiedAt} />
          </li>
        ))}
        {booleanLimits.map((limit) => (
          <li key={limit.key} className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground" dir="auto">
              {ruleName(limit.key)}:
            </span>
            <span>{limit.value ? t("ruleset.value.true") : t("ruleset.value.false")}</span>
            <UnverifiedBadge lastVerifiedAt={limit.lastVerifiedAt} />
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("map.check.context.imported", { date: formatImported(result.checkedAt) })}
      </p>
    </section>
  );
}

function DataQualityBanner({
  result,
  t,
  formatImported,
}: {
  result: VerdictResult;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatImported: (iso: string) => string;
}) {
  const dq = result.dataQuality;
  const caveated = hasDataQualityCaveats(dq);
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
      {/* NEVER softened: the standing disclaimer shows on every verdict. */}
      <p className="font-medium">{t("map.check.dq.notAuthoritative")}</p>
      {caveated && (
        // break-words: these are long joined identifier lists — they must wrap
        // inside the sidebar, never overflow it (item 4). Nothing is truncated:
        // a clipped data-quality caveat would be a softened honesty surface.
        <ul className="mt-1 flex flex-col gap-0.5 break-words">
          {dq.unverifiedLayers.length > 0 && (
            <li dir="auto">
              {t("map.check.dq.unverifiedLayers", { layers: dq.unverifiedLayers.join(", ") })}
            </li>
          )}
          {dq.unverifiedRuleKeys.length > 0 && (
            <li dir="auto">
              {t("map.check.dq.unverifiedRules", { rules: dq.unverifiedRuleKeys.join(", ") })}
            </li>
          )}
          {dq.elevationApproximate && <li>{t("map.check.dq.elevationApproximate")}</li>}
          {dq.layers.length > 0 && (
            <li className="text-amber-800">
              {dq.layers
                .map((l) => `${l.name} (${t("map.zones.imported", { date: formatImported(l.importedAt) })})`)
                .join(" · ")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
