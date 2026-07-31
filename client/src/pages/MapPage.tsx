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
import PlaceSearch from "@/components/map/PlaceSearch";
import LocationCheckPanel from "@/components/map/LocationCheckPanel";
import PinPanel from "@/components/map/PinPanel";
import TilesMissingNotice from "@/components/map/TilesMissingNotice";
import MapUnavailableStatus from "@/components/map/MapUnavailableStatus";
import { Button } from "@/components/ui/button";
import ZoneLayersPanel, {
  type LegendFacts,
  type ZoneLayersState,
} from "@/components/map/ZoneLayersPanel";
import SidebarSection from "@/components/map/SidebarSection";
import {
  isSectionOpen,
  loadMapMuted,
  loadSidebarSections,
  MUTED_MAP_CLASS,
  saveMapMuted,
  saveSidebarSections,
  SECTION_LAYERS,
  SECTION_LOCATION,
  SECTION_RESULT,
  type SidebarSectionId,
  type SidebarSectionState,
} from "@/lib/map-appearance";
import i18n from "@/i18n";
import { resolveMapMode, type MapModeOverride } from "@/lib/map-mode";
import type { LatLng } from "@/lib/coords";
import {
  getMapStatus,
  TILE_URL_TEMPLATE,
  type MapStatus,
  getProvisioningStatus,
  retryDemDownload,
  type ProvisioningStatus,
} from "@/lib/map-api";
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
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [overrideMode, setOverrideMode] = useState<MapModeOverride>(() => {
    const saved = localStorage.getItem("drone-ops-map-mode-override");
    return (saved as MapModeOverride) || "auto";
  });

  // DO-035 item 3 — muted base map (persisted like the layer toggles).
  const [muted, setMuted] = useState<boolean>(() => loadMapMuted());
  const handleMutedChange = useCallback((next: boolean) => {
    setMuted(next);
    saveMapMuted(next);
  }, []);

  // DO-035 item 1 — sidebar accordion state (persisted; Layers collapsed by default).
  const [sections, setSections] = useState<SidebarSectionState>(() => loadSidebarSections());
  const handleSectionToggle = useCallback((id: SidebarSectionId, open: boolean) => {
    setSections((previous) => {
      const next = { ...previous, [id]: open };
      saveSidebarSections(next);
      return next;
    });
  }, []);

  // "Check result panel (opens on pin)" — placing a pin reveals the section that
  // is about to answer the question. An explicit collapse afterwards persists.
  useEffect(() => {
    if (!pin) return;
    setSections((previous) => {
      if (previous[SECTION_RESULT] === true) return previous;
      const next = { ...previous, [SECTION_RESULT]: true };
      saveSidebarSections(next);
      return next;
    });
  }, [pin]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const handleModeChange = useCallback((mode: MapModeOverride) => {
    setOverrideMode(mode);
    localStorage.setItem("drone-ops-map-mode-override", mode);
  }, []);

  const resolvedMode = useMemo(() => {
    const localAvailable = statusState.kind === "ok" && statusState.status.tiles.available;
    return resolveMapMode(overrideMode, localAvailable, isOnline);
  }, [statusState, overrideMode, isOnline]);
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

  const [provStatus, setProvStatus] = useState<ProvisioningStatus | null>(null);

  const handleRetryDem = useCallback(async () => {
    try {
      await retryDemDownload();
      const status = await getProvisioningStatus();
      setProvStatus(status);
    } catch (err) {
      console.error("Failed to retry DEM download:", err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timerId: NodeJS.Timeout | null = null;

    async function checkStatus() {
      try {
        const status = await getProvisioningStatus();
        if (!active) return;
        setProvStatus((prev) => {
          if (prev && prev.dem.status !== "done" && status.dem.status === "done") {
            loadStatus();
          }
          return status;
        });
        if (status.dem.status === "downloading" || status.dem.status === "pending") {
          timerId = setTimeout(checkStatus, 2000);
        }
      } catch (err) {
        console.error("Failed to fetch provisioning status:", err);
      }
    }

    checkStatus();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [loadStatus]);

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

  // Create/destroy the Leaflet map when resolvedMode or tiles changes.
  useEffect(() => {
    const hasMapSource = resolvedMode === "offline" || resolvedMode === "online";
    if (!hasMapSource || !containerRef.current || mapRef.current) return;

    let tileUrl = TILE_URL_TEMPLATE;
    let attribution = tiles?.attribution ?? t("map.attributionFallback");
    let maxZoom = Math.min(tiles?.maxzoom ?? MAX_ZOOM, MAX_ZOOM);

    if (resolvedMode === "online") {
      tileUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
      attribution = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
      maxZoom = 17; // allow deeper zoom for OpenTopoMap
    }

    const map = L.map(containerRef.current, {
      center: ISRAEL_CENTER,
      zoom: ISRAEL_INITIAL_ZOOM,
      minZoom: resolvedMode === "offline" ? (tiles?.minzoom ?? 0) : 0,
      maxZoom,
      preferCanvas: true,
      renderer: L.canvas({ tolerance: 8 }),
    });

    const tileLayer = L.tileLayer(tileUrl, {
      attribution,
      maxZoom,
    }).addTo(map);

    if (resolvedMode === "online") {
      tileLayer.on("tileerror", () => {
        if (!navigator.onLine) {
          setIsOnline(false);
        }
      });
    }

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
  }, [resolvedMode, tiles]);

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
          // DO-032 Amendment 2: clicking the zone overlay places the pin
          featureLayer.on("click", (event: L.LeafletMouseEvent) => {
            setPin({ lat: event.latlng.lat, lng: event.latlng.lng });
          });
        },
      });
      overlays.set(layer.name, overlay);
    }

    zoneOverlaysRef.current = overlays;
    return () => {
      for (const overlay of overlays.values()) overlay.remove();
      zoneOverlaysRef.current = new Map();
    };
  }, [zoneData, resolvedMode]);

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
  }, [visibility, zoneData, resolvedMode]);

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

      {statusState.kind === "ok" && resolvedMode === "missing" && (
        overrideMode === "offline-only" ? (
          <TilesMissingNotice
            reason={statusState.status.tiles.reason ?? "PACKAGE_MISSING"}
            onRecheck={loadStatus}
          />
        ) : (
          <MapUnavailableStatus onRecheck={loadStatus} />
        )
      )}

      {statusState.kind === "ok" && resolvedMode !== "missing" && (
        <div
          // DO-035 item 4/5 — bound the desktop row to the viewport. Without this
          // the map element stretches to match the sidebar's content height
          // (measured at 3264px in a 919px window once a verdict card is open), so
          // the whole PAGE scrolls and the map repaints as a tall strip.
          //
          // `xl:flex-none` is load-bearing: this row is itself a flex item of an
          // auto-height column, where `flex-1` (flex-grow on the main axis) beats
          // the `height` property. Height alone silently did nothing — it only
          // looked correct while the sidebar happened to be short.
          //
          // Bounded, the map keeps a sane height and the sidebar scrolls inside
          // itself. Below xl the row stacks and heights stay auto — narrow layout
          // unaffected.
          className="flex min-h-0 flex-1 flex-col gap-4 xl:h-[calc(100vh-11rem)] xl:flex-none xl:flex-row"
        >
          <div className="relative h-[55vh] min-h-72 w-full xl:h-auto xl:flex-1">
            <div
              ref={containerRef}
              // Leaflet renders LTR map internals; the surrounding layout stays RTL-aware.
              dir="ltr"
              // MUTED_MAP_CLASS filters the tile pane only — overlays keep their
              // verdict colours (DO-035 item 3; see index.css).
              className={`z-0 h-full w-full overflow-hidden rounded-lg border border-border ${
                muted ? MUTED_MAP_CLASS : ""
              }`}
              data-testid="leaflet-container"
            />
            {/* The absolute-positioned source indicator! */}
            <div className="absolute right-3 top-3 z-[1000] flex items-center gap-2 rounded-md border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm select-none" dir="auto">
              <span className={`h-2.5 w-2.5 rounded-full ${
                resolvedMode === "offline" ? "bg-green-500" : "bg-amber-500"
              }`} />
              <span>
                {resolvedMode === "offline"
                  ? t("map.status.offline")
                  : t("map.status.online")}
              </span>
            </div>
          </div>
          {/* Sidebar. Three collapsible sections in the order fixed by the intent
              doc: ① Location check (open), ② Check result (opens on pin),
              ③ Layers & base map (COLLAPSED by default). Nothing was removed —
              every control that used to be permanently visible now lives in one
              of the three sections, and every honesty surface travels with it. */}
          <aside className="flex w-full min-w-0 flex-col gap-3 xl:max-w-sm xl:overflow-y-auto">
            <SidebarSection
              title={t("map.section.location")}
              open={isSectionOpen(sections, SECTION_LOCATION)}
              onToggle={(open) => handleSectionToggle(SECTION_LOCATION, open)}
              testId="section-location"
            >
              <div className="flex flex-col gap-4">
                <CoordinateEntry onSubmit={handleEntry} />
                <PlaceSearch onSelect={handleEntry} />
                <PinPanel pin={pin} />
              </div>
            </SidebarSection>

            <SidebarSection
              title={t("map.section.result")}
              open={isSectionOpen(sections, SECTION_RESULT)}
              onToggle={(open) => handleSectionToggle(SECTION_RESULT, open)}
              testId="section-result"
            >
              <LocationCheckPanel pin={pin} />
            </SidebarSection>

            <SidebarSection
              title={t("map.section.layers")}
              open={isSectionOpen(sections, SECTION_LAYERS)}
              onToggle={(open) => handleSectionToggle(SECTION_LAYERS, open)}
              testId="section-layers"
            >
              <div className="flex flex-col gap-4">
                {/* Base-map appearance: source override + the muted toggle. */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="map-source-override"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {t("map.settings.overrideLabel")}
                  </label>
                  <select
                    id="map-source-override"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    value={overrideMode}
                    onChange={(e) => handleModeChange(e.target.value as MapModeOverride)}
                  >
                    <option value="auto">{t("map.settings.mode.auto")}</option>
                    <option value="offline-only">{t("map.settings.mode.offline")}</option>
                    <option value="online-only">{t("map.settings.mode.online")}</option>
                  </select>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={muted}
                      onChange={(e) => handleMutedChange(e.target.checked)}
                      data-testid="muted-map-toggle"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{t("map.settings.muted.label")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("map.settings.muted.hint")}
                      </span>
                    </span>
                  </label>
                </div>

                <ZoneLayersPanel
                  state={zoneLayersState}
                  visibility={visibility}
                  onToggle={handleToggle}
                  legend={legend}
                  onRecheck={loadZones}
                />
              </div>
            </SidebarSection>

            {/* NFR-8 provisioning status stays OUTSIDE the accordion: it is a
                degraded-state surface, and a status the operator must see is not
                something to hide behind a collapsed header. */}
            {statusState.status.dem.available === false && (
              <div className="rounded-lg border border-border bg-amber-500/5 p-4 text-xs flex flex-col gap-2">
                {!provStatus ? (
                  <p className="text-amber-800">{t("map.elevation.missing")}</p>
                ) : provStatus.dem.status === "downloading" ? (
                  <>
                    <p className="font-medium text-amber-800">
                      {t("map.elevation.downloading", {
                        downloaded: provStatus.dem.downloaded,
                        total: provStatus.dem.total,
                        progress: provStatus.dem.progress,
                      })}
                    </p>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-600 h-full transition-all duration-300"
                        style={{ width: `${provStatus.dem.progress}%` }}
                      />
                    </div>
                  </>
                ) : provStatus.dem.status === "failed" ? (
                  <>
                    <p className="font-medium text-red-800">
                      {t("map.elevation.downloadFailed", { error: provStatus.dem.error || "" })}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRetryDem}
                      className="self-start text-xs h-7 px-2.5"
                    >
                      {t("map.elevation.downloadRetry")}
                    </Button>
                  </>
                ) : provStatus.dem.status === "offline-missing" ? (
                  <>
                    <p className="font-medium text-amber-800">
                      {t("map.elevation.downloadOffline")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRetryDem}
                      className="self-start text-xs h-7 px-2.5"
                    >
                      {t("map.elevation.downloadRetry")}
                    </Button>
                  </>
                ) : (
                  <p className="text-amber-800">{t("map.elevation.missing")}</p>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
