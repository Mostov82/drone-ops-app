// DO-014 — zone layer toggles + provenance surfaces + verdict legend (FR-C1,
// FR-C4, Gate 1 constraints). Every layer row shows its source + import date
// (staleness) and the prominent UNVERIFIED badge while verified=false —
// honest-uncertainty UI is a standing product stance (DO-010 precedent,
// GB-06 Gate 3); softening it is not a design choice.
import { useTranslation } from "react-i18next";
import UnverifiedBadge from "@/components/UnverifiedBadge";
import { Button } from "@/components/ui/button";
import { formatDate, toDateLanguage } from "@/lib/dates";
import { isKnownVerdict, getZoneStyle, type LayerVisibility } from "@/lib/zone-display";
import { isLayerVisible } from "@/lib/zone-display";
import type { ZoneLayerSummary } from "@/lib/zones-api";

export type ZoneLayersState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; layers: ZoneLayerSummary[] };

export interface LegendClassFact {
  zoneTypeCode: string;
  verdict: string;
}

export interface LegendFacts {
  activeClasses: LegendClassFact[];
}

function verdictName(verdict: string, t: (key: string) => string): string {
  return isKnownVerdict(verdict) ? t(`map.zones.verdict.${verdict}`) : verdict;
}

function ClassSwatch({ zoneTypeCode, verdict }: { zoneTypeCode: string; verdict: string }) {
  const style = getZoneStyle(verdict, zoneTypeCode);
  const color = style.color;

  if (zoneTypeCode === "AIP_PROHIBITED" || zoneTypeCode === "BORDER_SECURITY") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2.5"
          y="2.5"
          width="19"
          height="11"
          rx="1.5"
          fill={verdict === "RESTRICTED" ? "url(#crosshatch-restricted)" : verdict === "NEEDS_PERMIT" ? "url(#crosshatch-needs-permit)" : "url(#crosshatch-clear)"}
          stroke={color}
          strokeWidth="2.6"
        />
      </svg>
    );
  }

  if (zoneTypeCode === "AIP_RESTRICTED" || zoneTypeCode === "POPULATED") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill={color}
          fillOpacity={verdict === "NEEDS_PERMIT" ? 0.12 : 0.16}
          stroke={color}
          strokeWidth="2.2"
          strokeDasharray={verdict === "NEEDS_PERMIT" ? "2 4" : "8 4"}
        />
      </svg>
    );
  }

  if (zoneTypeCode === "AIP_DANGER") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill={verdict === "RESTRICTED" ? "url(#hatch-restricted)" : verdict === "NEEDS_PERMIT" ? "url(#hatch-needs-permit)" : "url(#hatch-clear)"}
          stroke={color}
          strokeWidth="2"
          strokeDasharray={verdict === "NEEDS_PERMIT" ? "2 4" : "10 3 2 3"}
        />
      </svg>
    );
  }

  if (zoneTypeCode === "LLU_DRONE") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="2.6"
        />
        <rect
          x="5.5"
          y="5.5"
          width="13"
          height="5"
          rx="0.5"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="1 3"
        />
      </svg>
    );
  }

  if (zoneTypeCode === "AIRPORT") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill={color}
          fillOpacity="0.08"
          stroke={color}
          strokeWidth="1.4"
        />
        <rect
          x="5"
          y="4"
          width="14"
          height="8"
          rx="1"
          fill="none"
          stroke={color}
          strokeWidth="1.4"
        />
        <path d="M12 6 v4 M10 8 h4" stroke={color} strokeWidth="1" />
      </svg>
    );
  }

  if (zoneTypeCode === "CTR") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill={color}
          fillOpacity="0.15"
          stroke={color}
          strokeWidth="2.2"
          strokeDasharray={verdict === "NEEDS_PERMIT" ? "2 4" : "12 4"}
        />
      </svg>
    );
  }

  if (zoneTypeCode === "ATZ") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill={color}
          fillOpacity="0.07"
          stroke={color}
          strokeWidth="1.2"
          strokeDasharray={verdict === "NEEDS_PERMIT" ? "2 4" : "5 3"}
        />
      </svg>
    );
  }

  if (zoneTypeCode === "CTA") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeDasharray="2 2"
        />
        <text
          x="12"
          y="10.5"
          fontSize="6"
          fontFamily="sans-serif"
          fontWeight="bold"
          fill={color}
          textAnchor="middle"
        >
          1000+
        </text>
      </svg>
    );
  }

  if (zoneTypeCode === "NATURE_RESERVE") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <rect
          x="2"
          y="2"
          width="20"
          height="12"
          rx="1.5"
          fill={color}
          fillOpacity="0.14"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="1.5 3.5"
        />
      </svg>
    );
  }

  if (zoneTypeCode === "CVFR_LANE") {
    return (
      <svg aria-hidden="true" width="24" height="16" className="shrink-0">
        <line x1="1" y1="2" x2="23" y2="2" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
        <line x1="1" y1="14" x2="23" y2="14" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
        <line x1="1" y1="8" x2="23" y2="8" stroke={color} strokeWidth="1.4" strokeDasharray="7 5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" width="24" height="16" className="shrink-0">
      <rect
        x="2"
        y="2"
        width="20"
        height="12"
        rx="1.5"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={verdict === "NEEDS_PERMIT" ? "2 4" : undefined}
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
        <div className="mt-2 flex flex-col gap-3 text-xs">
          {(() => {
            const groups: Record<string, LegendClassFact[]> = {};
            for (const item of legend.activeClasses) {
              groups[item.verdict] ??= [];
              groups[item.verdict].push(item);
            }

            const sortedVerdicts = Object.keys(groups).sort((a, b) => {
              const order: Record<string, number> = { RESTRICTED: 1, NEEDS_PERMIT: 2, CLEAR: 3 };
              return (order[a] ?? 99) - (order[b] ?? 99);
            });

            const CLASS_ORDER = [
              "AIP_PROHIBITED",
              "BORDER_SECURITY",
              "AIP_RESTRICTED",
              "AIP_DANGER",
              "LLU_DRONE",
              "AIRPORT",
              "CTR",
              "ATZ",
              "CTA",
              "NATURE_RESERVE",
              "CVFR_LANE",
              "POPULATED",
              "OTHER"
            ];
            const sortClasses = (items: LegendClassFact[]) => {
              return [...items].sort((a, b) => {
                const idxA = CLASS_ORDER.indexOf(a.zoneTypeCode);
                const idxB = CLASS_ORDER.indexOf(b.zoneTypeCode);
                const orderA = idxA === -1 ? 999 : idxA;
                const orderB = idxB === -1 ? 999 : idxB;
                return orderA - orderB;
              });
            };

            return sortedVerdicts.map((verdict) => (
              <div key={verdict} className="flex flex-col gap-1.5">
                <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                  {t(`map.zones.legend.family.${verdict}`, { defaultValue: verdictName(verdict, t) })}
                </h3>
                <ul className="flex flex-col gap-1.5 pl-1.5">
                  {sortClasses(groups[verdict]).map((item) => (
                    <li key={`${item.verdict}-${item.zoneTypeCode}`} className="flex items-center gap-2">
                      <ClassSwatch zoneTypeCode={item.zoneTypeCode} verdict={item.verdict} />
                      <span dir="auto">
                        {t(`map.zones.class.${item.zoneTypeCode}`, { defaultValue: item.zoneTypeCode })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ));
          })()}
          <div className="flex flex-col gap-1.5 text-muted-foreground border-t border-border/60 pt-2">
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-block h-3.5 w-5 shrink-0 rounded-sm border border-border bg-transparent"
              />
              <span>{t("map.zones.legend.clearContext")}</span>
            </div>
            <p className="text-[10px] leading-normal italic mt-1" dir="auto">
              {t("map.zones.legend.disclaimer")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
