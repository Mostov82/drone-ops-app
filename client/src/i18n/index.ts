import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import he from "./locales/he";

export const SUPPORTED_LANGUAGES = ["en", "he"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function initI18n(language: AppLanguage): Promise<unknown> {
  return i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    // Locale files use flat dotted keys — disable i18next's separators.
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false }, // React already escapes
  });
}

/** Mirrors the active language onto the document: dir (rtl/ltr), lang, and title. */
export function applyLanguageToDocument(language: string): void {
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
  document.title = i18n.t("app.title");
}

export default i18n;
