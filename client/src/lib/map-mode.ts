// Map mode resolution logic for DO-032.
// auto: prefer local package if available, else online tiles if connection is available.
// offline-only: use local package if available, else show the missing-tiles / status-state screen. Never goes online.
// online-only: use online OpenTopoMap tiles if connection is available, even if local package is present.

export type MapModeOverride = "auto" | "offline-only" | "online-only";

export type ResolvedMapMode = "offline" | "online" | "missing";

export function resolveMapMode(
  override: MapModeOverride,
  localAvailable: boolean,
  isOnline: boolean,
): ResolvedMapMode {
  if (override === "online-only") {
    return isOnline ? "online" : "missing";
  }
  if (override === "offline-only") {
    return localAvailable ? "offline" : "missing";
  }
  // "auto" mode
  if (localAvailable) {
    return "offline";
  }
  return isOnline ? "online" : "missing";
}
