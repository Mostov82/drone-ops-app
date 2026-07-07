import { useTranslation } from "react-i18next";
import { formatDate, isWorkday, toDateLanguage, weekDays } from "@/lib/dates";
import { MODULE_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import PlaceholderPage from "./PlaceholderPage";

/** Current week rendered from the shared date helper: Sunday first, Fri–Sat weekend. */
function WeekStrip() {
  const { t, i18n } = useTranslation();
  const dateLanguage = toDateLanguage(i18n.language);
  const days = weekDays(new Date());
  const today = new Date();

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-muted-foreground">{t("dashboard.thisWeek")}</h2>
      <ul className="mt-3 flex max-w-xl gap-2">
        {days.map((day) => (
          <li
            key={day.toISOString()}
            className={cn(
              "flex flex-1 flex-col items-center rounded-md border px-1 py-2 text-sm",
              isWorkday(day)
                ? "border-border bg-primary/5 font-medium"
                : "border-border/60 text-muted-foreground",
              formatDate(day, "yyyy-MM-dd", "en") === formatDate(today, "yyyy-MM-dd", "en") &&
                "ring-2 ring-primary",
            )}
          >
            <span>{formatDate(day, "EEE", dateLanguage)}</span>
            <span className="mt-1 text-xs">{formatDate(day, "d", dateLanguage)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("dashboard.workday")}: {days.filter(isWorkday).map((d) => formatDate(d, "EEEEEE", dateLanguage)).join(" · ")}
        {" — "}
        {t("dashboard.weekend")}: {days.filter((d) => !isWorkday(d)).map((d) => formatDate(d, "EEEEEE", dateLanguage)).join(" · ")}
      </p>
    </section>
  );
}

export default function DashboardPage() {
  const dashboardItem = MODULE_NAV_ITEMS[0];

  return (
    <div>
      <PlaceholderPage item={dashboardItem} />
      <WeekStrip />
    </div>
  );
}
