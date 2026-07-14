// DO-012 — the instructive empty state when no tile package is installed
// (acceptance criterion: bilingual instructions pointing at the README steps,
// no crash, no blank screen). Follows the PlaceholderPage precedent of
// echoing the title in the other language.
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function TilesMissingNotice({
  reason,
  onRecheck,
}: {
  reason: "PACKAGE_MISSING" | "FORMAT_UNSUPPORTED";
  onRecheck: () => void;
}) {
  const { t, i18n } = useTranslation();
  const otherLanguage = i18n.language.startsWith("he") ? "en" : "he";
  const bodyKey = reason === "FORMAT_UNSUPPORTED" ? "map.missing.vectorBody" : "map.missing.body";

  return (
    <div className="max-w-xl rounded-lg border border-border bg-primary/5 p-6">
      <h2 className="text-lg font-semibold">{t("map.missing.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground" lang={otherLanguage}>
        {t("map.missing.title", { lng: otherLanguage })}
      </p>
      <p className="mt-4 text-sm">{t(bodyKey)}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={onRecheck}>
        {t("map.missing.recheck")}
      </Button>
    </div>
  );
}
