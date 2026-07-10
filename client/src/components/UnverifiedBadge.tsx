// DO-010 — the point-of-use "unverified" marker (GB-02 Gate 1 resolution).
// Reusable contract for every consumer that displays a regulatory value or a
// verdict derived from one (DO-015 zone verdicts, DO-017 compliance checks):
// render this next to the value; it shows only while lastVerifiedAt is null.
import { useTranslation } from "react-i18next";

export default function UnverifiedBadge({
  lastVerifiedAt,
}: {
  lastVerifiedAt: string | Date | null;
}) {
  const { t } = useTranslation();
  if (lastVerifiedAt !== null) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      {t("ruleset.unverified")}
    </span>
  );
}
