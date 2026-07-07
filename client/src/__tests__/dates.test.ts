import { describe, expect, it } from "vitest";
import {
  endOfWeekIL,
  formatDate,
  isWeekend,
  isWorkday,
  startOfWeekIL,
  toDateLanguage,
  weekDays,
  WEEK_STARTS_ON,
} from "../lib/dates";

// 2026-07-08 is a Wednesday; its Israeli week runs Sun 2026-07-05 → Sat 2026-07-11.
const wednesday = new Date(2026, 6, 8);

describe("Israeli work-week (Sun–Thu, weekend Fri–Sat)", () => {
  it("weeks start on Sunday", () => {
    expect(WEEK_STARTS_ON).toBe(0);
    const start = startOfWeekIL(wednesday);
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(5);
  });

  it("weeks end on Saturday", () => {
    const end = endOfWeekIL(wednesday);
    expect(end.getDay()).toBe(6);
    expect(end.getDate()).toBe(11);
  });

  it("weekDays returns the 7 days Sunday-first", () => {
    const days = weekDays(wednesday);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getDay())).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("Sun–Thu are workdays, Fri–Sat are the weekend", () => {
    const [sun, mon, tue, wed, thu, fri, sat] = weekDays(wednesday);
    for (const workday of [sun, mon, tue, wed, thu]) {
      expect(isWorkday(workday)).toBe(true);
      expect(isWeekend(workday)).toBe(false);
    }
    for (const weekendDay of [fri, sat]) {
      expect(isWeekend(weekendDay)).toBe(true);
      expect(isWorkday(weekendDay)).toBe(false);
    }
  });

  it("formats day names in both languages", () => {
    const sunday = weekDays(wednesday)[0];
    expect(formatDate(sunday, "EEEE", "en")).toBe("Sunday");
    expect(formatDate(sunday, "EEEE", "he")).toBe("יום ראשון");
  });

  it("maps i18next language tags to date locales", () => {
    expect(toDateLanguage("he")).toBe("he");
    expect(toDateLanguage("he-IL")).toBe("he");
    expect(toDateLanguage("en")).toBe("en");
    expect(toDateLanguage("en-US")).toBe("en");
  });
});
