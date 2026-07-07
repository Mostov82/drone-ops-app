// Shared date utilities — Israeli work-week (Sunday–Thursday; weekend Fri–Sat).
//
// This module is the ONLY permitted import path for date logic in the app
// (intent DO-003 context notes). Do not import date-fns directly elsewhere —
// that is how the Sun–Thu week stays consistent app-wide.
import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { enGB, he } from "date-fns/locale";

/** Sunday. Every week computation in the app starts here. */
export const WEEK_STARTS_ON = 0 as const;

const FRIDAY = 5;
const SATURDAY = 6;

const dateLocales = { en: enGB, he } as const;
export type DateLanguage = keyof typeof dateLocales;

/** Maps an i18next language tag (possibly regional, e.g. "he-IL") to a date locale key. */
export function toDateLanguage(languageTag: string): DateLanguage {
  return languageTag.toLowerCase().startsWith("he") ? "he" : "en";
}

export function startOfWeekIL(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function endOfWeekIL(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

/** Israeli weekend: Friday and Saturday. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === FRIDAY || day === SATURDAY;
}

/** Israeli workday: Sunday through Thursday. */
export function isWorkday(date: Date): boolean {
  return !isWeekend(date);
}

/** The 7 days of `date`'s week, Sunday first. */
export function weekDays(date: Date): Date[] {
  const start = startOfWeekIL(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Locale-aware formatting; week options pinned to the Israeli week. */
export function formatDate(date: Date, fmt: string, language: DateLanguage): string {
  return format(date, fmt, {
    locale: dateLocales[language],
    weekStartsOn: WEEK_STARTS_ON,
  });
}
