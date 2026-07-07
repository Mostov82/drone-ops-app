import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
} from "@/lib/settings-api";

type SaveStatus = "idle" | "saved" | "error";

const fieldClass =
  "h-9 w-28 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch(() => setLoadFailed(true));
  }, []);

  const changeLanguage = (language: AppLanguage) => {
    // Applies live (no reload) and persists via the Setting model.
    void i18n.changeLanguage(language);
    setSettings((s) => ({ ...s, language }));
    saveSettings({ language })
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("error"));
  };

  const changeLeadTime = (tier: keyof AppSettings["alertLeadTimes"], value: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return;
    setSaveStatus("idle");
    setSettings((s) => ({ ...s, alertLeadTimes: { ...s.alertLeadTimes, [tier]: parsed } }));
  };

  const saveLeadTimes = () => {
    saveSettings({ alertLeadTimes: settings.alertLeadTimes })
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("error"));
  };

  const leadTimeTiers = ["first", "second", "final"] as const;

  return (
    <article className="max-w-xl">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>

      {loadFailed && (
        <p role="alert" className="mt-4 rounded-md border border-border bg-primary/5 px-3 py-2 text-sm">
          {t("settings.loadError")}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium">{t("settings.language.label")}</h2>
        <div className="mt-2 flex gap-2">
          {SUPPORTED_LANGUAGES.map((language) => (
            <Button
              key={language}
              variant={settings.language === language ? "default" : "outline"}
              lang={language}
              aria-pressed={settings.language === language}
              onClick={() => changeLanguage(language)}
            >
              {t(`settings.language.${language}`)}
            </Button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">{t("settings.units.label")}</h2>
        <select disabled aria-label={t("settings.units.label")} className={`${fieldClass} mt-2 block`}>
          <option>{t("settings.units.metric")}</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.units.note")}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">{t("settings.alerts.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.alerts.description")}</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {leadTimeTiers.map((tier) => (
            <label key={tier} className="flex flex-col gap-1 text-sm">
              {t(`settings.alerts.${tier}`)}
              <input
                type="number"
                min={1}
                className={fieldClass}
                value={settings.alertLeadTimes[tier]}
                onChange={(e) => changeLeadTime(tier, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={saveLeadTimes}>{t("settings.save")}</Button>
          {saveStatus === "saved" && <span className="text-sm text-muted-foreground">{t("settings.saved")}</span>}
          {saveStatus === "error" && (
            <span role="alert" className="text-sm text-destructive">
              {t("settings.saveError")}
            </span>
          )}
        </div>
      </section>
    </article>
  );
}
