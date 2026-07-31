// DO-043 — the zone overlay stack's draw order.
//
// WHY THIS FILE EXISTS
//
// Every zone layer renders into ONE shared Leaflet canvas (`MapPage.tsx` builds
// the map with `preferCanvas: true` and a single `L.canvas({ tolerance: 8 })`).
// Leaflet's canvas renderer keeps its paths in a `_drawFirst → next` linked list
// and `_addPath` appends, so **that list is the z-order and it is pure insertion
// order**. Before this file there was nothing else: no panes, no `zIndex`, no
// `bringToFront`. Two unrelated things decided what an operator saw —
//
//   1. the API's `orderBy: { name: "asc" }` (alphabetical by layer *name*), and
//   2. at runtime, whatever order the operator happened to toggle layers in,
//      because a layer is `addTo(map)`-ed the moment it becomes visible and
//      therefore lands on top of everything already drawn.
//
// (2) is the defect. Toggling the INPA closures layer off and on again moved 542
// polygons from the bottom of the stack to the top. Two operators with the same
// layers enabled could be looking at different maps.
//
// WHAT ORDER, AND WHY THAT ORDER
//
// The axis is **footprint and specificity, not severity** — severity is already
// carried by hue and border grammar (DO-040 Amendment 1), and doubling it up in
// z-order would say the same thing twice while burying the small, precise marks
// a drone operator actually navigates by. Broad area washes sink; tight,
// specific airspace floats. Bottom → top:
//
//   1. aip-a17-inpa-closures  542 nature reserves — the broadest wash on the map
//   2. aip-a17-llp-llr-danger 113 AIP P/R/D areas — large published restrictions
//   3. cvfr-lanes            265 lanes — 2 km-wide corridors, long and crossing
//   4. caai-ctr-atz-cta       39 CTR/ATZ/CTA — controlled airspace, light & small
//   5. aip-a17-llu-drone      73 LLU zones — drone-specific (DO-040 gave them
//                                their own carmine hue precisely so they pop)
//   6. osm-airport-buffers    53 buffers — smallest marks, plus a centre cross
//
// ORDERING NEVER HIDES ANYTHING. Fills are capped at ~22% by DO-040 Amendment 1,
// so a lower layer still reads through every layer above it; strokes are what
// z-order really decides, and every stroke is still drawn. A prohibited area
// under an ATZ keeps its heavy 2.6px solid border and its crosshatch. Nothing
// here reaches the verdict engine — this is presentation only, exactly as DO-041
// and DO-040 were.
//
// This list lives in the CLIENT on purpose. Encoding draw order in the imported
// data or in the API's layer ordering would put presentation meaning into zone
// data (DO-043 scope boundary).

/**
 * Zone layers in draw order, **bottom first**. Values are `MapLayer.name`
 * (the manifest `layerKey`) — stable across re-imports, unlike row ids.
 */
export const ZONE_LAYER_DRAW_ORDER: readonly string[] = [
  "aip-a17-inpa-closures",
  "aip-a17-llp-llr-danger",
  "cvfr-lanes",
  "caai-ctr-atz-cta",
  "aip-a17-llu-drone",
  "osm-airport-buffers",
];

/**
 * Draw rank for one layer — lower draws first (further back).
 *
 * A layer this policy has never heard of ranks above every known one. That
 * matches the visibility rule next door in `zone-display.ts` ("unlisted layers
 * default to ON: new datasets must be visible the first time, never silently
 * hidden") — a newly imported dataset should announce itself, not arrive
 * pre-buried. It is still fully deterministic: unknown layers tie-break by name,
 * so they too are immune to toggle order.
 */
export function drawOrderRank(layerName: string): number {
  const index = ZONE_LAYER_DRAW_ORDER.indexOf(layerName);
  return index === -1 ? ZONE_LAYER_DRAW_ORDER.length : index;
}

/**
 * The layer names sorted **bottom first** — the order they must be stacked in.
 *
 * Pure and total: the result depends only on the SET of names given, never on
 * the order they arrive in, so a render is identical no matter what sequence the
 * operator toggled layers in. That property is what this ticket exists to buy,
 * and it is what the tests pin.
 */
export function orderLayersForDraw(layerNames: Iterable<string>): string[] {
  return [...layerNames].sort((a, b) => {
    const rank = drawOrderRank(a) - drawOrderRank(b);
    // Known ranks are unique, so the name tie-break only ever separates unknown
    // layers — but applying it always is what makes the sort total, and a total
    // sort is what makes the result independent of the input order.
    return rank !== 0 ? rank : a.localeCompare(b);
  });
}
