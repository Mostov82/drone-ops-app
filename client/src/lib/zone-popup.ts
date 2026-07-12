// DO-014 — zone popup content (FR-C1/FR-C4): name/designator, verdict,
// altitude band per the zones-api.md semantics, lane directional altitudes,
// and the owning layer's provenance + staleness + unverified state.
// Pure string builder so the semantics are unit-testable; the map page binds
// it lazily (bindPopup(fn)) so it renders in the CURRENT UI language.
import { formatDate, toDateLanguage } from "@/lib/dates";
import {
  altitudeBandTextParts,
  type TranslateFn,
} from "@/lib/zone-popup-helpers";
import {
  describeAltitudeBand,
  isKnownVerdict,
  laneDirectionalAltitudes,
  LANE_ZONE_TYPE_CODE,
  verdictStyle,
} from "@/lib/zone-display";
import type { ZoneFeatureProperties, ZoneLayerSummary } from "@/lib/zones-api";

/** Escape untrusted data (zone names, notes fragments) for HTML interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function verdictLabel(verdict: string, t: TranslateFn): string {
  // The mapping is editable data — an unknown verdict value is shown raw
  // (honestly), never guessed into one of the known labels.
  return isKnownVerdict(verdict) ? t(`map.zones.verdict.${verdict}`) : verdict;
}

export interface PopupContext {
  t: TranslateFn;
  /** Active i18n language tag (drives date locale + text direction). */
  language: string;
  /** "rtl" | "ltr" — from i18n.dir(language). */
  dir: string;
}

export function buildZonePopupHtml(
  props: ZoneFeatureProperties,
  layer: ZoneLayerSummary,
  { t, language, dir }: PopupContext,
): string {
  const style = verdictStyle(props.verdict);
  const band = describeAltitudeBand(props);
  const bandText = altitudeBandTextParts(band, t);
  const directional =
    props.zoneTypeCode === LANE_ZONE_TYPE_CODE ? laneDirectionalAltitudes(props.notes) : null;
  const importedAt = new Date(layer.importedAt);
  const importedText = Number.isNaN(importedAt.getTime())
    ? layer.importedAt
    : formatDate(importedAt, "PP", toDateLanguage(language));
  const sourceTitle = layer.provenance.title ?? layer.name;

  const rows: string[] = [];

  rows.push(
    `<div class="font-semibold text-sm" dir="auto">${escapeHtml(props.name)}</div>`,
    `<div class="text-xs text-muted-foreground" dir="auto">${escapeHtml(props.zoneTypeName)}</div>`,
    `<div class="mt-1 text-xs">
      <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium"
        style="border-color:${style.color};color:${style.color}">
        <span aria-hidden="true" style="display:inline-block;width:0.6em;height:0.6em;border-radius:9999px;background:${style.fillColor}"></span>
        ${escapeHtml(verdictLabel(props.verdict, t))}
      </span>
    </div>`,
    `<div class="mt-2 text-xs">
      <span class="text-muted-foreground">${escapeHtml(t("map.zones.popup.band"))}:</span>
      <span dir="auto">${escapeHtml(bandText)}</span>
    </div>`,
  );

  if (directional) {
    // Raw directional strings exactly as published (Option A, decision 2026-07-11).
    rows.push(
      `<div class="mt-1 text-xs">
        <span class="text-muted-foreground">${escapeHtml(t("map.zones.popup.directional"))}:</span>
        <span dir="ltr">${escapeHtml(directional)}</span>
      </div>`,
      `<div class="text-xs text-muted-foreground">${escapeHtml(t("map.zones.popup.envelopeNote"))}</div>`,
    );
  }

  // Owning layer's provenance: source + import date (staleness) + unverified.
  const unverifiedChip = layer.verified
    ? ""
    : ` <span class="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 font-medium text-amber-900">${escapeHtml(
        t("ruleset.unverified"),
      )}</span>`;
  rows.push(
    `<div class="mt-2 border-t border-border pt-1 text-xs text-muted-foreground" dir="auto">
      ${escapeHtml(t("map.zones.popup.source"))}: ${escapeHtml(sourceTitle)}
      · ${escapeHtml(t("map.zones.imported", { date: importedText }))}${unverifiedChip}
    </div>`,
  );

  return `<div dir="${dir === "rtl" ? "rtl" : "ltr"}" lang="${escapeHtml(language)}" class="max-w-64">${rows.join("")}</div>`;
}
