// DO-035 (items 1 + 3) — client-side persistence for the map page's presentation
// state: the base-map "muted" toggle and the sidebar accordion.
//
// Persistence follows the DO-014 precedent in `zone-display.ts` exactly:
// localStorage, a namespaced key, and corrupted/unavailable storage degrading to
// defaults rather than breaking the map. Nothing here touches data, verdicts or
// regulatory values — it is presentation state only.

// ── Muted base map (item 3) ─────────────────────────────────────────────────
// The muted mode is a CSS filter applied to Leaflet's TILE PANE only, so zone
// overlays keep their verdict colours — that is the whole point (intent doc
// context note). It works identically for the offline package and the online
// topo tiles because it never touches the tile source.

const MUTED_STORAGE_KEY = "droneops.mapMuted";

/** CSS class placed on the map container while muted (see index.css). */
export const MUTED_MAP_CLASS = "droneops-map-muted";

export function loadMapMuted(storage: Pick<Storage, "getItem"> = localStorage): boolean {
  try {
    return storage.getItem(MUTED_STORAGE_KEY) === "true";
  } catch {
    return false; // storage unavailable → normal tiles, never a crash
  }
}

export function saveMapMuted(
  muted: boolean,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(MUTED_STORAGE_KEY, muted ? "true" : "false");
  } catch {
    // Quota/private-mode failures degrade to session-only appearance.
  }
}

// ── Sidebar accordion (item 1) ──────────────────────────────────────────────

const SECTIONS_STORAGE_KEY = "droneops.mapSidebarSections";

/** The three sidebar sections, in the order the intent document fixes them. */
export const SECTION_LOCATION = "location";
export const SECTION_RESULT = "result";
export const SECTION_LAYERS = "layers";

export type SidebarSectionId =
  | typeof SECTION_LOCATION
  | typeof SECTION_RESULT
  | typeof SECTION_LAYERS;

export const SIDEBAR_SECTION_ORDER: SidebarSectionId[] = [
  SECTION_LOCATION,
  SECTION_RESULT,
  SECTION_LAYERS,
];

export type SidebarSectionState = Partial<Record<SidebarSectionId, boolean>>;

/**
 * Intent doc item 1: ① Location check OPEN by default, ② Check result (opens on
 * pin), ③ **Layers COLLAPSED by default**.
 */
export const DEFAULT_SECTION_STATE: Record<SidebarSectionId, boolean> = {
  [SECTION_LOCATION]: true,
  [SECTION_RESULT]: true,
  [SECTION_LAYERS]: false,
};

export function loadSidebarSections(
  storage: Pick<Storage, "getItem"> = localStorage,
): SidebarSectionState {
  try {
    const raw = storage.getItem(SECTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: SidebarSectionState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "boolean") continue;
      if ((SIDEBAR_SECTION_ORDER as string[]).includes(key)) {
        result[key as SidebarSectionId] = value;
      }
    }
    return result;
  } catch {
    return {}; // corrupted persistence falls back to the defaults above
  }
}

export function saveSidebarSections(
  state: SidebarSectionState,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Session-only accordion state is an acceptable degradation.
  }
}

/** A section is open per the stored value, else per the default above. */
export function isSectionOpen(state: SidebarSectionState, id: SidebarSectionId): boolean {
  return state[id] ?? DEFAULT_SECTION_STATE[id];
}
