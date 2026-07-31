// DO-035 items 1 + 3 — presentation-state persistence for the map sidebar and
// the muted base map. Mirrors the DO-014 zone-display persistence tests: the
// defaults are part of the contract (Layers COLLAPSED by default is an
// acceptance criterion), and corrupted storage must degrade, never throw.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTION_STATE,
  isSectionOpen,
  loadMapMuted,
  loadSidebarSections,
  saveMapMuted,
  saveSidebarSections,
  SECTION_LAYERS,
  SECTION_LOCATION,
  SECTION_RESULT,
  SIDEBAR_SECTION_ORDER,
} from "@/lib/map-appearance";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    read: (key: string) => map.get(key) ?? null,
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("storage unavailable");
  },
  setItem() {
    throw new Error("quota exceeded");
  },
};

describe("sidebar section defaults (acceptance criterion)", () => {
  it("orders the sections as the intent doc fixes them", () => {
    expect(SIDEBAR_SECTION_ORDER).toEqual([SECTION_LOCATION, SECTION_RESULT, SECTION_LAYERS]);
  });

  it("opens Location check and Check result, and COLLAPSES Layers by default", () => {
    expect(DEFAULT_SECTION_STATE[SECTION_LOCATION]).toBe(true);
    expect(DEFAULT_SECTION_STATE[SECTION_RESULT]).toBe(true);
    expect(DEFAULT_SECTION_STATE[SECTION_LAYERS]).toBe(false);
  });

  it("applies the defaults when nothing is stored", () => {
    expect(isSectionOpen({}, SECTION_LOCATION)).toBe(true);
    expect(isSectionOpen({}, SECTION_LAYERS)).toBe(false);
  });

  it("lets a stored value override the default in both directions", () => {
    expect(isSectionOpen({ [SECTION_LAYERS]: true }, SECTION_LAYERS)).toBe(true);
    expect(isSectionOpen({ [SECTION_LOCATION]: false }, SECTION_LOCATION)).toBe(false);
  });
});

describe("sidebar section persistence", () => {
  it("round-trips state through storage", () => {
    const storage = memoryStorage();
    saveSidebarSections({ [SECTION_LAYERS]: true, [SECTION_RESULT]: false }, storage);
    expect(loadSidebarSections(storage)).toEqual({
      [SECTION_LAYERS]: true,
      [SECTION_RESULT]: false,
    });
  });

  it("ignores unknown keys and non-boolean values", () => {
    const storage = memoryStorage({
      "droneops.mapSidebarSections": JSON.stringify({
        [SECTION_LAYERS]: true,
        bogusSection: true,
        [SECTION_LOCATION]: "yes",
      }),
    });
    expect(loadSidebarSections(storage)).toEqual({ [SECTION_LAYERS]: true });
  });

  it.each(["not json", "[]", "null", '"a string"'])(
    "falls back to defaults on corrupted persistence (%s)",
    (raw) => {
      const storage = memoryStorage({ "droneops.mapSidebarSections": raw });
      expect(loadSidebarSections(storage)).toEqual({});
    },
  );

  it("never throws when storage is unavailable", () => {
    expect(() => loadSidebarSections(throwingStorage)).not.toThrow();
    expect(loadSidebarSections(throwingStorage)).toEqual({});
    expect(() => saveSidebarSections({ [SECTION_LAYERS]: true }, throwingStorage)).not.toThrow();
  });
});

describe("muted base map persistence", () => {
  it("defaults to unmuted", () => {
    expect(loadMapMuted(memoryStorage())).toBe(false);
  });

  it("round-trips both states", () => {
    const storage = memoryStorage();
    saveMapMuted(true, storage);
    expect(storage.read("droneops.mapMuted")).toBe("true");
    expect(loadMapMuted(storage)).toBe(true);
    saveMapMuted(false, storage);
    expect(loadMapMuted(storage)).toBe(false);
  });

  it("treats any non-'true' stored value as unmuted", () => {
    expect(loadMapMuted(memoryStorage({ "droneops.mapMuted": "garbage" }))).toBe(false);
  });

  it("never throws when storage is unavailable", () => {
    expect(() => loadMapMuted(throwingStorage)).not.toThrow();
    expect(loadMapMuted(throwingStorage)).toBe(false);
    expect(() => saveMapMuted(true, throwingStorage)).not.toThrow();
  });
});
