// DO-014 — altitude-band → display-text mapping (bilingual via the i18n keys;
// semantics computed in zone-display.ts per server/docs/zones-api.md).
// Split from zone-popup.ts so the text mapping is trivially unit-testable.
import type { AltitudeBand, BandValue } from "@/lib/zone-display";

/** Narrow view of i18next's t — keeps these modules testable without i18n. */
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function bandValueText(value: BandValue, t: TranslateFn): string {
  switch (value.kind) {
    case "ground":
      return t("map.zones.band.ground");
    case "amsl":
      return t("map.zones.band.amsl", { ft: value.ft });
    case "agl":
      // Displayed exactly as published — AGL→AMSL conversion is out of scope
      // (Amendment 1; awaits a modeling decision).
      return t("map.zones.band.agl", { ft: value.ft });
    case "unbounded":
      return t("map.zones.band.unbounded");
    case "notPublished":
      return t("map.zones.band.notPublished");
  }
}

export function altitudeBandTextParts(band: AltitudeBand, t: TranslateFn): string {
  if (band.kind === "noVerticalClaim") return t("map.zones.band.noVerticalClaim");
  return t("map.zones.band.range", {
    floor: bandValueText(band.floor, t),
    ceiling: bandValueText(band.ceiling, t),
  });
}
