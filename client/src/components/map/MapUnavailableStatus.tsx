import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function MapUnavailableStatus({
  onRecheck,
}: {
  onRecheck: () => void;
}) {
  const { t, i18n } = useTranslation();
  const otherLanguage = i18n.language.startsWith("he") ? "en" : "he";

  return (
    <div className="max-w-xl rounded-lg border border-border bg-primary/5 p-6" dir="auto">
      <h2 className="text-lg font-semibold">{t("map.unavailable.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground" lang={otherLanguage}>
        {t("map.unavailable.title", { lng: otherLanguage })}
      </p>
      <p className="mt-4 text-sm">{t("map.unavailable.body")}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={onRecheck}>
        {t("map.missing.recheck")}
      </Button>
    </div>
  );
}
