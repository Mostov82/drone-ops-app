import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MODULE_NAV_ITEMS, SETTINGS_PATH } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-2 text-sm text-start transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-foreground hover:bg-primary/5",
  );

export default function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-e border-border lg:w-64">
        <div className="px-4 py-5 text-lg font-semibold">{t("app.title")}</div>
        <nav aria-label={t("nav.ariaLabel")} className="flex flex-1 flex-col gap-1 px-2 pb-4">
          {MODULE_NAV_ITEMS.map((item) => (
            <NavLink key={item.key} to={item.path} end={item.path === "/"} className={navLinkClass}>
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
          <div className="mt-auto border-t border-border pt-2">
            <NavLink to={SETTINGS_PATH} className={navLinkClass}>
              {t("nav.settings")}
            </NavLink>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
