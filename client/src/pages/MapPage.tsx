// DO-012 — the offline map of Israel (FR-C1) with precise pin coordinates
// (FR-C2) and terrain elevation at the pin (FR-C5).
// Leaflet raster TileLayer over locally served MBTiles (PRD §6 locked stack;
// GB-03 Gate 2) — every tile request goes to our own Express route, so the
// page is fully functional with zero connectivity. With no package installed
// it renders the instructive empty state instead (never a crash).
// DO-014 draws the imported zone overlays on this map: verdict-driven styling
// (the editable Gate 3 mapping, read from the server per request), legend,
// per-layer toggles with client-side persistence, provenance/staleness/
// unverified surfaces, and zone popups. Canvas renderer per DO-014 Amendment 1
// (1,046 zones incl. 542 full-resolution INPA polygons; simplification is
// forbidden — precision is safety-critical). DO-015 consumes the elevation API.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import CoordinateEntry from "@/components/map/CoordinateEntry";
import LocationCheckPanel from "@/components/map/LocationCheckPanel";
import PinPanel from "@/components/map/PinPanel";
import TilesMissingNotice from "@/components/map/TilesMissingNotice";
import ZoneLayersPanel, {
  type LegendFacts,
  type ZoneLayersState,
} from "@/components/map/ZoneLayersPanel";
import i18n from "@/i18n";
import type { LatLng } from "@/lib/coords";
import { getMapStatus, TILE_URL_TEMPLATE, type MapStatus } from "@/lib/map-api";
import {
  isLayerVisible,
  laneStyle,
  loadLayerVisibility,
  saveLayerVisibility,
  verdictStyle,
  type LayerVisibility,
} from "@/lib/zone-display";
import { buildZonePopupHtml } from "@/lib/zone-popup";
import {
  getLayerGeoJson,
  getZoneLayers,
  type LayerGeoJsonResponse,
  type ZoneFeatureProperties,
} from "@/lib/zones-api";

// Initial framing of Israel (geographic constants, not regulatory values).
const ISRAEL_CENTER: [number, number] = [31.5, 35.0];
const ISRAEL_INITIAL_ZOOM = 8;
/** Gate 2: packages are built to zoom ≤ 14. */
const MAX_ZOOM = 14;

// Inline SVG pin — avoids Leaflet's default marker PNGs, which need special
// bundler handling; also crisper at high-DPI.
const PIN_ICON = L.divIcon({
  className: "", // no default divIcon chrome
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 1C7.8 1 2 6.8 2 14c0 9.6 13 27 13 27s13-17.4 13-27C28 6.8 22.2 1 15 1z"
      fill="#0f172a" stroke="#f8fafc" stroke-width="2"/>
    <circle cx="15" cy="14" r="5" fill="#f8fafc"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 41],
});

type StatusState = { kind: "loading" } | { kind: "error" } | { kind: "ok"; status: MapStatus };

type LoadedZoneData = { kind: "loading" } | { kind: "error" } | { kind: "ok"; layers: LayerGeoJsonResponse[] };

const LINE_GEOMETRY_TYPES = new Set(["LineString", "MultiLineString"]);

/** Verdict legend order: known tiers first, then anything unexpected, raw. */
const VERDICT_LEGEND_ORDER = ["RESTRICTED", "NEEDS_PERMIT", "CLEAR"];

function sortVerdicts(verdicts: Iterable<string>): string[] {
  return [...new Set(verdicts)].sort((a, b) => {
    const ia = VERDICT_LEGEND_ORDER.indexOf(a);
    const ib = VERDICT_LEGEND_ORDER.indexOf(b);
    return (ia === -1 ? VERDICT_LEGEND_ORDER.length : ia) - (ib === -1 ? VERDICT_LEGEND_ORDER.length : ib);
  });
}

export default function MapPage() {
  const { t } = useTranslation();
  const [statusState, setStatusState] = useState<StatusState>({ kind: "loading" });
  const [pin, setPin] = useState<LatLng | null>(null);
  const [zoneData, setZoneData] = useState<LoadedZoneData>({ kind: "loading" });
  const [visibility, setVisibility] = useState<LayerVisibility>(() => loadLayerVisibility());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  /** Leaflet overlay per zone layer, keyed by layer NAME (the stable layerKey). */
  const zoneOverlaysRef = useRef<Map<string, L.GeoJSON>>(new Map());

  const loadStatus = useCallback(() => {
    setStatusState({ kind: "loading" });
    getMapStatus()
      .then((status) => setStatusState({ kind: "ok", status }))
      .catch(() => setStatusState({ kind: "error" }));
  }, []);

  const loadZones = useCallback(() => {
    setZoneData({ kind: "loading" });
    getZoneLayers()
      .then((layers) => Promise.all(layers.map((layer) => getLayerGeoJson(layer.id))))
      .then((layers) => setZoneData({ kind: "ok", layers }))
      .catch(() => setZoneData({ kind: "error" }));
  }, []);

  useEffect(() => {
    loadStatus();
    loadZones();
  }, [loadStatus, loadZones]);

  const tiles = statusState.kind === "ok" ? statusState.status.tiles : null;
  const tilesAvailable = tiles?.available === true;

  // Create/destroy the Leaflet map when the tile package is available.
  useEffect(() => {
    if (!tilesAvailable || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: ISRAEL_CENTER,
      zoom: ISRAEL_INITIAL_ZOOM,
      minZoom: tiles?.minzoom ?? 0,
      maxZoom: Math.min(tiles?.maxzoom ?? MAX_ZOOM, MAX_ZOOM),
      // DO-014 Amendment 1 (pre-authorized): canvas renderer for the full
      // 1,046-zone load incl. the unsimplified INPA polygons (NFR-6).
      // Explicit renderer so lane LINES are clickable: the canvas default
      // tolerance is ~weight/2 px, which made popups on 2.5px dashed lanes
      // practically unhittable (found in DO-014 browser verification).
      preferCanvas: true,
      renderer: L.canvas({ tolerance: 8 }),
    });
    L.tileLayer(TILE_URL_TEMPLATE, {
      // OSM data attribution (ODbL) — the package's own string wins if set.
      attribution: tiles?.attribution ?? t("map.attributionFallback"),
      maxZoom: Math.min(tiles?.maxzoom ?? MAX_ZOOM, MAX_ZOOM),
    }).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      setPin({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      zoneOverlaysRef.current = new Map();
    };
    // Deliberately keyed on availability alone — the map initializes once per
    // installed package; metadata/labels don't change under a live map.
  }, [tilesAvailable]);

  // Build the zone overlays whenever the map or the fetched data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || zoneData.kind !== "ok") return;

    const overlays = new Map<string, L.GeoJSON>();
    for (const { layer, geojson } of zoneData.layers) {
      const overlay = L.geoJSON(geojson, {
        // Styling is driven by the verdict VALUE served per request (editable
        // Gate 3 data) — never by zone-type constants. Lanes (line geometry)
        // render dashed with no fill; polygons filled.
        style: (feature) => {
          const props = feature?.properties as ZoneFeatureProperties | undefined;
          const verdict = props?.verdict ?? "";
          const isLine = feature ? LINE_GEOMETRY_TYPES.has(feature.geometry.type) : false;
          return isLine ? laneStyle(verdict) : verdictStyle(verdict);
        },
        onEachFeature: (feature, featureLayer) => {
          const props = feature.properties as ZoneFeatureProperties;
          // Bound lazily so the popup renders in the CURRENT UI language.
          featureLayer.bindPopup(
            () =>
              buildZonePopupHtml(props, layer, {
                t: (key, options) => i18n.t(key, options ?? {}) as string,
                language: i18n.language,
                dir: i18n.dir(),
              }),
            { maxWidth: 280 },
          );
        },
      });
      overlays.set(layer.name, overlay);
    }

    zoneOverlaysRef.current = overlays;
    return () => {
      for (const overlay of overlays.values()) overlay.remove();
      zoneOverlaysRef.current = new Map();
    };
    // tilesAvailable re-runs this after map (re)creation.
  }, [zoneData, tilesAvailable]);

  // Keep overlay presence on the map in sync with the visibility toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [layerName, overlay] of zoneOverlaysRef.current) {
      if (isLayerVisible(visibility, layerName)) {
        if (!map.hasLayer(overlay)) overlay.addTo(map);
      } else if (map.hasLayer(overlay)) {
        overlay.remove();
      }
    }
  }, [visibility, zoneData, tilesAvailable]);

  // Keep the marker in sync with the pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pin) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([pin.lat, pin.lng]);
    } else {
      markerRef.current = L.marker([pin.lat, pin.lng], { icon: PIN_ICON }).addTo(map);
    }
  }, [pin]);

  function handleEntry(point: LatLng) {
    setPin(point);
    const map = mapRef.current;
    if (map) map.setView([point.lat, point.lng], Math.max(map.getZoom(), 12));
  }

  function handleToggle(layerName: string, visible: boolean) {
    setVisibility((previous) => {
      const next = { ...previous, [layerName]: visible };
      saveLayerVisibility(next);
      return next;
    });
  }

  const zoneLayersState: ZoneLayersState = useMemo(() => {
    if (zoneData.kind === "ok") return { kind: "ok", layers: zoneData.layers.map((l) => l.layer) };
    return zoneData.kind === "loading" ? { kind: "loading" } : { kind: "error" };
  }, [zoneData]);

  // An honest legend: only the verdict styles actually present in loaded data.
  const legend: LegendFacts = useMemo(() => {
    if (zoneData.kind !== "ok") return { polygonVerdicts: [], laneVerdicts: [] };
    const polygonVerdicts: string[] = [];
    const laneVerdicts: string[] = [];
    for (const { geojson } of zoneData.layers) {
      for (const feature of geojson.features) {
        (LINE_GEOMETRY_TYPES.has(feature.geometry.type) ? laneVerdicts : polygonVerdicts).push(
          feature.properties.verdict,
        );
      }
    }
    return { polygonVerdicts: sortVerdicts(polygonVerdicts), laneVerdicts: sortVerdicts(laneVerdicts) };
  }, [zoneData]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("map.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("map.description")}</p>
      </div>

      {statusState.kind === "loading" && (
        <p className="text-sm text-muted-foreground">{t("map.loading")}</p>
      )}
      {statusState.kind === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {t("map.statusError")}
        </p>
      )}

      {statusState.kind === "ok" && !tilesAvailable && (
        <TilesMissingNotice
          reason={tiles?.reason ?? "PACKAGE_MISSING"}
          onRecheck={loadStatus}
        />
      )}

      {statusState.kind === "ok" && tilesAvailable && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
          <div
            ref={containerRef}
            // Leaflet renders LTR map internals; the surrounding layout stays RTL-aware.
            dir="ltr"
            className="z-0 h-[55vh] min-h-72 w-full overflow-hidden rounded-lg border border-border xl:h-auto xl:flex-1"
            data-testid="leaflet-container"
          />
          <aside className="flex w-full flex-col gap-4 xl:max-w-sm">
            <CoordinateEntry onSubmit={handleEntry} />
            <div className="rounded-lg border border-border p-4">
              <PinPanel pin={pin} />
            </div>
            <div className="rounded-lg border border-border p-4">
              <LocationCheckPanel pin={pin} />
            </div>
            <div className="rounded-lg border border-border p-4">
              <ZoneLayersPanel
                state={zoneLayersState}
                visibility={visibility}
                onToggle={handleToggle}
                legend={legend}
                onRecheck={loadZones}
              />
            </div>
            {statusState.status.dem.available === false && (
              <p className="text-xs text-amber-800">{t("map.elevation.missing")}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
