import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ModuleNavItem } from "@/lib/navigation";

/** Arrow pointing "back" — mirrors in RTL via the .icon-directional CSS rule. */
function BackArrowIcon() {
  return (
    <svg
      className="icon-directional size-4"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 3.5 6 8l4.5 4.5" />
    </svg>
  );
}

interface PlaceholderPageProps {
  item: ModuleNavItem;
}

export default function PlaceholderPage({ item }: PlaceholderPageProps) {
  const { t, i18n } = useTranslation();
  // The page shows its name in both languages (DO-003 acceptance criterion):
  // active language as the title, the other as a subtitle.
  const otherLanguage = i18n.language.startsWith("he") ? "en" : "he";

  return (
    <article className="max-w-xl">
      <h1 className="text-2xl font-semibold">{t(`nav.${item.key}`)}</h1>
      <p className="mt-1 text-sm text-muted-foreground" lang={otherLanguage}>
        {t(`nav.${item.key}`, { lng: otherLanguage })}
      </p>
      <p className="mt-6 inline-block rounded-md border border-border px-3 py-1.5 text-sm font-medium">
        {t("placeholder.comingInPhase", { phase: item.phase })}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">{t("placeholder.description")}</p>
      {item.path !== "/" && (
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
        >
          <BackArrowIcon />
          {t("placeholder.backToDashboard")}
        </Link>
      )}
    </article>
  );
}
