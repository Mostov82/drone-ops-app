import { describe, expect, it } from "vitest";
import { resolveMapMode } from "../lib/map-mode";

describe("resolveMapMode", () => {
  it("resolves auto mode: prefers offline when present", () => {
    // localAvailable = true, isOnline = true -> offline
    expect(resolveMapMode("auto", true, true)).toBe("offline");
    // localAvailable = true, isOnline = false -> offline
    expect(resolveMapMode("auto", true, false)).toBe("offline");
    // localAvailable = false, isOnline = true -> online
    expect(resolveMapMode("auto", false, true)).toBe("online");
    // localAvailable = false, isOnline = false -> missing
    expect(resolveMapMode("auto", false, false)).toBe("missing");
  });

  it("resolves offline-only mode: never goes online", () => {
    // localAvailable = true, isOnline = true -> offline
    expect(resolveMapMode("offline-only", true, true)).toBe("offline");
    // localAvailable = true, isOnline = false -> offline
    expect(resolveMapMode("offline-only", true, false)).toBe("offline");
    // localAvailable = false, isOnline = true -> missing
    expect(resolveMapMode("offline-only", false, true)).toBe("missing");
    // localAvailable = false, isOnline = false -> missing
    expect(resolveMapMode("offline-only", false, false)).toBe("missing");
  });

  it("resolves online-only mode: ignores local package", () => {
    // localAvailable = true, isOnline = true -> online
    expect(resolveMapMode("online-only", true, true)).toBe("online");
    // localAvailable = true, isOnline = false -> missing
    expect(resolveMapMode("online-only", true, false)).toBe("missing");
    // localAvailable = false, isOnline = true -> online
    expect(resolveMapMode("online-only", false, true)).toBe("online");
    // localAvailable = false, isOnline = false -> missing
    expect(resolveMapMode("online-only", false, false)).toBe("missing");
  });
});
