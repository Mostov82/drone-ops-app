// DO-043 — the zone overlay stack's draw order.
//
// The acceptance criterion this file exists for is "render is provably identical
// regardless of the order layers were toggled on/off". The intent doc asks for a
// pure, unit-testable ordering function rather than assertions on Leaflet
// internals, so the ordering policy is tested directly, and the *mechanism* that
// consumes it is tested against a small model of Leaflet's canvas draw list
// (a `_drawFirst → next` linked list that `_addPath` appends to, and that
// `bringToFront` splices to the end — see leaflet-src.js:12988).
//
// Following DO-041's lesson, the layer names are not invented here: the last
// describe block reads the shipped manifests, so a new dataset arriving without
// a slot in the policy fails in CI rather than silently landing on top of the
// map.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  drawOrderRank,
  orderLayersForDraw,
  ZONE_LAYER_DRAW_ORDER,
} from "@/lib/zone-layer-order";

/** The six shipped layers, in the order the API serves them (`name` asc). */
const ALPHABETICAL = [
  "aip-a17-inpa-closures",
  "aip-a17-llp-llr-danger",
  "aip-a17-llu-drone",
  "caai-ctr-atz-cta",
  "cvfr-lanes",
  "osm-airport-buffers",
];

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

describe("the draw-order policy", () => {
  it("puts broad area washes at the bottom and specific airspace on top", () => {
    expect(orderLayersForDraw(ALPHABETICAL)).toEqual([
      "aip-a17-inpa-closures",
      "aip-a17-llp-llr-danger",
      "cvfr-lanes",
      "caai-ctr-atz-cta",
      "aip-a17-llu-drone",
      "osm-airport-buffers",
    ]);
  });

  it("does NOT depend on layer-name alphabetisation (the AC's exact words)", () => {
    // The whole point: the API serves alphabetically, and that is an accident of
    // dataset naming, not a design. If these ever coincide the policy has
    // stopped doing anything.
    expect(orderLayersForDraw(ALPHABETICAL)).not.toEqual(ALPHABETICAL);
  });

  it("keeps the drone-specific and airport layers above the AIP and INPA washes", () => {
    const order = orderLayersForDraw(ALPHABETICAL);
    expect(order.indexOf("aip-a17-llu-drone")).toBeGreaterThan(order.indexOf("aip-a17-inpa-closures"));
    expect(order.indexOf("osm-airport-buffers")).toBeGreaterThan(order.indexOf("aip-a17-llp-llr-danger"));
  });

  it("keeps the CAAI CTR/ATZ/CTA layer above the INPA closures (the reported case)", () => {
    const order = orderLayersForDraw(ALPHABETICAL);
    expect(order.indexOf("caai-ctr-atz-cta")).toBeGreaterThan(order.indexOf("aip-a17-inpa-closures"));
  });

  it("keeps the CAAI CTR/ATZ/CTA layer above the AIP P/R/D layer (the MEASURED case)", () => {
    // LLR20 — גליל הצנחה הבונים is an AIP_RESTRICTED polygon sharing ATZ-LLBO's
    // exact footprint at more than double its fill opacity; it, not INPA, is
    // what actually sits under the הבונים ATZ variants. Session log, Finding 1.
    const order = orderLayersForDraw(ALPHABETICAL);
    expect(order.indexOf("caai-ctr-atz-cta")).toBeGreaterThan(order.indexOf("aip-a17-llp-llr-danger"));
  });
});

describe("the ordering is independent of input order", () => {
  it("is identical across all 720 permutations of the six shipped layers", () => {
    const perms = permutations(ALPHABETICAL);
    expect(perms).toHaveLength(720);
    const expected = orderLayersForDraw(ALPHABETICAL);
    for (const perm of perms) {
      expect(orderLayersForDraw(perm)).toEqual(expected);
    }
  });

  it("orders every subset consistently with the full order", () => {
    // Toggling layers off must not reshuffle the ones left on.
    const full = orderLayersForDraw(ALPHABETICAL);
    for (let mask = 0; mask < 1 << ALPHABETICAL.length; mask++) {
      const subset = ALPHABETICAL.filter((_, i) => mask & (1 << i));
      const ordered = orderLayersForDraw([...subset].reverse());
      expect(ordered).toEqual(full.filter((name) => subset.includes(name)));
    }
  });

  it("never drops or duplicates a layer — ordering is not filtering", () => {
    // The honesty stance: this ticket may reorder, never suppress.
    for (const perm of permutations(ALPHABETICAL).slice(0, 50)) {
      const ordered = orderLayersForDraw(perm);
      expect(ordered).toHaveLength(perm.length);
      expect([...ordered].sort()).toEqual([...perm].sort());
    }
  });

  it("accepts any iterable, including a Map's keys (what MapPage passes)", () => {
    const overlays = new Map(ALPHABETICAL.map((name) => [name, {}]));
    expect(orderLayersForDraw(overlays.keys())).toEqual(orderLayersForDraw(ALPHABETICAL));
  });
});

describe("layers the policy has never heard of", () => {
  it("ranks an unknown layer above every known one", () => {
    for (const known of ZONE_LAYER_DRAW_ORDER) {
      expect(drawOrderRank("some-future-dataset")).toBeGreaterThan(drawOrderRank(known));
    }
  });

  it("still orders unknown layers deterministically, by name", () => {
    const withUnknowns = ["zeta-new", "caai-ctr-atz-cta", "alpha-new", "aip-a17-inpa-closures"];
    const expected = ["aip-a17-inpa-closures", "caai-ctr-atz-cta", "alpha-new", "zeta-new"];
    for (const perm of permutations(withUnknowns)) {
      expect(orderLayersForDraw(perm)).toEqual(expected);
    }
  });
});

describe("the mechanism: a model of Leaflet's shared-canvas draw list", () => {
  // Leaflet's canvas renderer holds every path from every layer in ONE ordered
  // list. `addTo(map)` appends; `bringToFront()` splices to the end. This models
  // exactly that, so the toggle-order defect and its fix are both reproducible
  // without a DOM.
  class DrawList {
    stack: string[] = [];
    add(layer: string) {
      if (!this.stack.includes(layer)) this.stack.push(layer);
    }
    remove(layer: string) {
      this.stack = this.stack.filter((l) => l !== layer);
    }
    bringToFront(layer: string) {
      if (!this.stack.includes(layer)) return;
      this.remove(layer);
      this.stack.push(layer);
    }
  }

  /** What `MapPage`'s presence effect does after every visibility change. */
  function syncPresence(list: DrawList, visible: Set<string>, all: string[], applyPolicy: boolean) {
    for (const name of all) {
      if (visible.has(name)) list.add(name);
      else list.remove(name);
    }
    if (!applyPolicy) return;
    for (const name of orderLayersForDraw(all)) {
      if (visible.has(name)) list.bringToFront(name);
    }
  }

  /** Replays a sequence of toggles, starting from everything visible. */
  function replay(sequence: string[], applyPolicy: boolean): string[] {
    const list = new DrawList();
    const visible = new Set(ALPHABETICAL);
    syncPresence(list, visible, ALPHABETICAL, applyPolicy);
    for (const name of sequence) {
      if (visible.has(name)) visible.delete(name);
      else visible.add(name);
      syncPresence(list, visible, ALPHABETICAL, applyPolicy);
    }
    return list.stack;
  }

  it("reproduces the defect without the policy: toggling moves a layer to the top", () => {
    // Off-then-on for INPA lifts 542 polygons from the bottom of the stack to
    // the very top. This is the bug, demonstrated.
    const fresh = replay([], false);
    expect(fresh[0]).toBe("aip-a17-inpa-closures");
    const afterToggle = replay(["aip-a17-inpa-closures", "aip-a17-inpa-closures"], false);
    expect(afterToggle.at(-1)).toBe("aip-a17-inpa-closures");
    expect(afterToggle).not.toEqual(fresh);
  });

  it("with the policy, the stack is identical whatever was toggled and in what order", () => {
    const expected = orderLayersForDraw(ALPHABETICAL);
    expect(replay([], true)).toEqual(expected);

    // every single off-then-on, and every ordered pair of them
    for (const a of ALPHABETICAL) {
      expect(replay([a, a], true)).toEqual(expected);
      for (const b of ALPHABETICAL) {
        expect(replay([a, a, b, b], true)).toEqual(expected);
        expect(replay([a, b, b, a], true)).toEqual(expected);
      }
    }
  });

  it("with the policy, a partially-visible stack is also order-independent", () => {
    // Turn three layers off, in every order; the three left on must stack the same.
    const off = ["aip-a17-inpa-closures", "cvfr-lanes", "osm-airport-buffers"];
    const expected = orderLayersForDraw(ALPHABETICAL).filter((n) => !off.includes(n));
    for (const perm of permutations(off)) {
      expect(replay(perm, true)).toEqual(expected);
    }
  });

  it("re-asserts the order after a rebuild (weekend view / lane half-width)", () => {
    // Those two rebuild every overlay and re-add them, which is a fresh add of
    // all six in Map-insertion (alphabetical) order. The policy must survive it.
    const list = new DrawList();
    const visible = new Set(ALPHABETICAL);
    syncPresence(list, visible, ALPHABETICAL, true);
    const beforeRebuild = [...list.stack];

    const rebuilt = new DrawList(); // fresh, unattached overlays
    syncPresence(rebuilt, visible, ALPHABETICAL, true);

    expect(rebuilt.stack).toEqual(beforeRebuild);
    expect(rebuilt.stack).toEqual(orderLayersForDraw(ALPHABETICAL));
  });
});

describe("the policy against the real shipped datasets", () => {
  const ROOT = path.resolve(__dirname, "../../../data-sources/zones");

  function shippedLayerKeys(): string[] {
    return fs
      .readdirSync(ROOT)
      .map((dir) => path.join(ROOT, dir, "manifest.json"))
      .filter((file) => fs.existsSync(file))
      .map((file) => JSON.parse(fs.readFileSync(file, "utf8")).layerKey as string)
      .sort();
  }

  it("assigns an explicit slot to every dataset that actually ships", () => {
    // A new dataset with no slot would land on top of everything by the unknown-
    // layer rule. That is a deliberate, safe default — but it should be a
    // decision, so it fails here first.
    expect(shippedLayerKeys()).toEqual([...ZONE_LAYER_DRAW_ORDER].sort());
  });

  it("has no duplicate slots", () => {
    expect(new Set(ZONE_LAYER_DRAW_ORDER).size).toBe(ZONE_LAYER_DRAW_ORDER.length);
  });
});
