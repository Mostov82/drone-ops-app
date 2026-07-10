// DO-012 — the point-of-use "approximate" marker for elevation values (FR-C5).
// Sibling of DO-010's UnverifiedBadge, NOT a copy: "unverified" means a
// regulatory value awaiting confirmation against official sources and clears
// once verified; "approximate" is a permanent property of surface-model
// elevation data (~30 m grid, ~±4 m) and never clears. Same honest-uncertainty
// visual language, distinct semantics — render it next to EVERY displayed
// elevation or value derived from one (DO-015 contract, server/docs/map-api.md).
import { useTranslation } from "react-i18next";

export default function ApproximateBadge() {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center rounded-full border border-sky-400 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900"
      title={t("map.elevation.approximateNote")}
    >
      {t("map.elevation.approximate")}
    </span>
  );
}
