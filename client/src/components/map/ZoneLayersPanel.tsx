// DO-014 — zone layer toggles + provenance surfaces + verdict legend (FR-C1,
// FR-C4, Gate 1 constraints). Every layer row shows its source + import date
// (staleness) and the prominent UNVERIFIED badge while verified=false —
// honest-uncertainty UI is a standing product stance (DO-010 precedent,
// GB-06 Gate 3); softening it is escalation trigger 5, not a design choice.
import { useTranslation } from "react-i18next";
import UnverifiedBadge from "@/components/UnverifiedBadge";
import { Button } from "@/components/ui/button";
import { formatDate, toDateLanguage } from "@/lib/dates";
import { isKnownVerdict, laneStyle, verdictStyle, type LayerVisibility } from "@/lib/zone-display";
import { isLayerVisible } from "@/lib/zone-display";
import type { ZoneLayerSummary } from "@/lib/zones-api";

export type ZoneLayersState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; layers: ZoneLayerSummary[] };

/** What actually loaded onto the map — drives an honest legend (only styles
 *  that are really in use), computed by MapPage from the fetched features. */
export interface LegendFacts {
  /** Distinct verdicts of polygon zones, in render order. */
  polygonVerdicts: string[];
  /** Distinct verdicts of lane (line) zones — lanes get their own swatch. */
  laneVerdicts: string[];
}

function verdictName(verdict: string, t: (key: string) => string): string {
  // Unknown verdict values (the mapping is editable data) are shown raw.
  return isKnownVerdict(verdict) ? t(`map.zones.verdict.${verdict}`) : verdict;
}

function PolygonSwatch({ verdict }: { verdict: string }) {
  const style = verdictStyle(verdict);
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-5 shrink-0 rounded-sm border"
      style={{
        borderColor: style.color,
        // Approximates fillOpacity over the map without real transparency stacking.
        backgroundColor: `color-mix(in srgb, ${style.fillColor} ${Math.round(style.fillOpacity * 100)}%, white)`,
      }}
    />
  );
}

function LaneSwatch({ verdict }: { verdict: string }) {
  const style = laneStyle(verdict);
  return (
    <svg aria-hidden="true" width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
      <line
        x1="1"
        y1="7"
        x2="19"
        y2="7"
        stroke={style.color}
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

function EmptyState({ onRecheck }: { onRecheck: () => void }) {
  const { t, i18n } = useTranslation();
  const otherLanguage = i18n.language.startsWith("he") ? "en" : "he";
  return (
    <div className="rounded-lg border border-border bg-primary/5 p-4">
      <h3 className="text-sm font-semibold">{t("map.zones.empty.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground" lang={otherLanguage}>
        {t("map.zones.empty.title", { lng: otherLanguage })}
      </p>
      <p className="mt-3 text-xs">{t("map.zones.empty.body")}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRecheck}>
        {t("map.missing.recheck")}
      </Button>
    </div>
  );
}

export default function ZoneLayersPanel({
  state,
  visibility,
  onToggle,
  legend,
  onRecheck,
}: {
  state: ZoneLayersState;
  visibility: LayerVisibility;
  onToggle: (layerName: string, visible: boolean) => void;
  legend: LegendFacts;
  onRecheck: () => void;
}) {
  const { t, i18n } = useTranslation();
  const dateLanguage = toDateLanguage(i18n.language);

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{t("map.zones.loading")}</p>;
  }
  if (state.kind === "error") {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t("map.zones.error")}
      </p>
    );
  }
  if (state.layers.length === 0) {
    return <EmptyState onRecheck={onRecheck} />;
  }

  const anyUnverified = state.layers.some((layer) => !layer.verified);

  return (
    <div className="flex flex-col gap-3">
      <section>
        <h2 className="text-sm font-semibold">{t("map.zones.title")}</h2>
        {anyUnverified && (
          <p className="mt-1 text-xs text-amber-800">{t("map.zones.unverifiedNote")}</p>
        )}
        <ul className="mt-2 flex flex-col gap-2">
          {state.layers.map((layer) => {
            const importedAt = new Date(layer.importedAt);
            const importedText = Number.isNaN(importedAt.getTime())
              ? layer.importedAt
              : formatDate(importedAt, "PP", dateLanguage);
            return (
              <li key={layer.id} className="rounded-md border border-border p-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={isLayerVisible(visibility, layer.name)}
                    onChange={(event) => onToggle(layer.name, event.target.checked)}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-medium" dir="auto">
                      {layer.provenance.title ?? layer.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("map.zones.layerZoneCount", { n: layer.zoneCount })}
                      {" · "}
                      {t("map.zones.imported", { date: importedText })}
                    </span>
                    {/* Established badge language: shows while the layer awaits
                        Jonathan's visual check (verified=false). */}
                    <span>
                      <UnverifiedBadge lastVerifiedAt={layer.verified ? layer.importedAt : null} />
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">{t("map.zones.legend.title")}</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs">
          {legend.polygonVerdicts.map((verdict) => (
            <li key={verdict} className="flex items-center gap-2">
              <PolygonSwatch verdict={verdict} />
              <span>{verdictName(verdict, t)}</span>
            </li>
          ))}
          {legend.laneVerdicts.map((verdict) => (
            <li key={`lane-${verdict}`} className="flex items-center gap-2">
              <LaneSwatch verdict={verdict} />
              <span>{t("map.zones.legend.lane")}</span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-block h-3.5 w-5 shrink-0 rounded-sm border border-border bg-transparent"
            />
            <span>{t("map.zones.legend.clearContext")}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
