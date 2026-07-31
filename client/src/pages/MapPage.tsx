/* eslint-disable @typescript-eslint/no-explicit-any */
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
  loadWeekendView,
  saveWeekendView,
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
  loadLayerVisibility,
  saveLayerVisibility,
  getZoneStyle,
  bufferLine,
  detectSchedule,
  type LayerVisibility,
} from "@/lib/zone-display";
import { listRules } from "@/lib/ruleset-api";
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





export default function MapPage() {
  const { t } = useTranslation();
  const [statusState, setStatusState] = useState<StatusState>({ kind: "loading" });
  const [pin, setPin] = useState<LatLng | null>(null);
  const [zoneData, setZoneData] = useState<LoadedZoneData>({ kind: "loading" });
  const [visibility, setVisibility] = useState<LayerVisibility>(() => loadLayerVisibility());
  const [halfWidthM, setHalfWidthM] = useState<number>(1000);
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

  // DO-041 — weekend view highlight (persisted).
  const [weekendView, setWeekendView] = useState<boolean>(() => loadWeekendView());
  const handleWeekendViewChange = useCallback((next: boolean) => {
    setWeekendView(next);
    saveWeekendView(next);
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

  // DO-040: Apply the muted class directly to the container DOM element
  // to avoid React wiping out Leaflet's internal classes on re-render.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (muted) {
      container.classList.add(MUTED_MAP_CLASS);
    } else {
      container.classList.remove(MUTED_MAP_CLASS);
    }
  }, [muted]);

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

  useEffect(() => {
    listRules()
      .then((rules) => {
        const rule = rules.find((r) => r.key === "cvfr_lane_halfwidth_km");
        if (rule && typeof rule.numberValue === "number") {
          setHalfWidthM(rule.numberValue * 1000);
        }
      })
      .catch((err) => {
        console.error("Failed to load ruleset for lane halfwidth:", err);
      });
  }, []);

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

    const handleZoom = () => {
      const container = containerRef.current;
      if (!container) return;
      if (map.getZoom() < 11) {
        container.classList.add("zoom-low");
      } else {
        container.classList.remove("zoom-low");
      }
    };
    map.on("zoomend", handleZoom);
    handleZoom();

    map.on("click", (event: L.LeafletMouseEvent) => {
      setPin({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    mapRef.current = map;
    return () => {
      map.off("zoomend", handleZoom);
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
      const preprocessedFeatures: any[] = [];
      
      for (const feature of geojson.features) {
        const props = feature.properties as ZoneFeatureProperties;
        const typeCode = props.zoneTypeCode;
        
        if (typeCode !== "CVFR_LANE") {
          preprocessedFeatures.push(feature);
        }
        
        if (typeCode === "CVFR_LANE") {
          preprocessedFeatures.push({
            ...feature,
            properties: {
              ...props,
              isLaneCenterline: true,
            },
          });
          
          const coords = feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString"
            ? (feature.geometry as any).coordinates
            : [];
            
          let corridorCoords: any = [];
          if (feature.geometry.type === "LineString") {
            corridorCoords = [bufferLine(coords as [number, number][], halfWidthM)];
          } else if (feature.geometry.type === "MultiLineString") {
            corridorCoords = coords.map((line: [number, number][]) =>
              [bufferLine(line, halfWidthM)]
            );
          }
          
          if (corridorCoords.length > 0) {
            preprocessedFeatures.push({
              type: "Feature",
              properties: {
                ...props,
                isLaneCorridor: true,
              },
              geometry: {
                type: feature.geometry.type === "LineString" ? "Polygon" : "MultiPolygon",
                coordinates: corridorCoords,
              },
            });
          }
          
          if (props.floorAmslFt !== null && props.floorAmslFt > 0) {
            const center = getCentroid(feature.geometry);
            if (center) {
              preprocessedFeatures.push({
                type: "Feature",
                properties: {
                  ...props,
                  isFloorLabel: true,
                  labelText: i18n.language === "he" ? `${props.floorAmslFt} רגל+` : `${props.floorAmslFt}ft+`,
                },
                geometry: {
                  type: "Point",
                  coordinates: center,
                },
              });
            }
          }
        } else if (typeCode === "AIRPORT") {
          const center = getCentroid(feature.geometry);
          if (center) {
            const innerGeom = scaleGeometry(feature.geometry, 0.97, { lat: center[1], lng: center[0] });
            preprocessedFeatures.push({
              type: "Feature",
              properties: {
                ...props,
                isAirportInnerRing: true,
              },
              geometry: innerGeom,
            });
            
            preprocessedFeatures.push({
              type: "Feature",
              properties: {
                ...props,
                isAirportCenterCross: true,
              },
              geometry: {
                type: "Point",
                coordinates: center,
              },
            });
          }
        } else if (typeCode === "LLU_DRONE") {
          const center = getCentroid(feature.geometry);
          if (center) {
            const innerGeom = scaleGeometry(feature.geometry, 0.97, { lat: center[1], lng: center[0] });
            preprocessedFeatures.push({
              type: "Feature",
              properties: {
                ...props,
                isLLUInnerRing: true,
              },
              geometry: innerGeom,
            });
          }
        } else if (typeCode === "CTA") {
          if (props.floorAmslFt !== null && props.floorAmslFt > 0) {
            const center = getCentroid(feature.geometry);
            if (center) {
              preprocessedFeatures.push({
                type: "Feature",
                properties: {
                  ...props,
                  isFloorLabel: true,
                  labelText: i18n.language === "he" ? `${props.floorAmslFt} רגל+` : `${props.floorAmslFt}ft+`,
                },
                geometry: {
                  type: "Point",
                  coordinates: center,
                },
              });
            }
          }
        }
      }
      
      const preprocessedGeojson = {
        ...geojson,
        features: preprocessedFeatures,
      };

      const overlay = L.geoJSON(preprocessedGeojson as any, {
        style: (feature) => {
          const props = feature?.properties as any;
          const verdict = props?.verdict ?? "";
          const zoneTypeCode = props?.zoneTypeCode ?? "";
          
          if (props?.isFloorLabel || props?.isAirportCenterCross) {
            return { stroke: false, fill: false } as any;
          }
          
          // getZoneStyle gates isInner/isCorridor on zoneTypeCode itself, so the
          // flags can be passed unconditionally.
          return getZoneStyle(verdict, zoneTypeCode, {
            ...weekendViewExtras(props, weekendView),
            isCorridor: props?.isLaneCorridor,
            isInner: props?.isLLUInnerRing || props?.isAirportInnerRing,
          }) as any;
        },
        pointToLayer: (feature, latlng) => {
          const props = feature.properties as any;
          const { isDeemphasized } = weekendViewExtras(props, weekendView);

          if (props.isAirportCenterCross) {
            const verdict = props.verdict ?? "";
            const style = getZoneStyle(verdict, "AIRPORT", { isDeemphasized });
            return L.marker(latlng, {
              icon: L.divIcon({
                className: "airport-center-cross-icon" + (isDeemphasized ? " deemphasized" : ""),
                html: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1 V11 M1 6 H11" stroke="${style.color}" stroke-width="1.5" opacity="${isDeemphasized ? 0.3 : 1}"/></svg>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              }),
              interactive: false,
            });
          }
          
          if (props.isFloorLabel) {
            const isLane = props.zoneTypeCode === "CVFR_LANE";
            const className = [
              isLane ? "zone-floor-label-chip lane" : "zone-floor-label-chip",
              isDeemphasized ? "deemphasized" : ""
            ].filter(Boolean).join(" ");
            const verdict = props.verdict ?? "";
            const style = getZoneStyle(verdict, props.zoneTypeCode, { isDeemphasized });
            const opacity = isDeemphasized ? 0.3 : 1;
            return L.marker(latlng, {
              icon: L.divIcon({
                className: "zone-floor-label-icon",
                html: `<div class="${className}" style="border-color: ${style.color}; color: ${style.color}; opacity: ${opacity}">${props.labelText}</div>`,
                iconSize: [60, 20],
                iconAnchor: [30, 10],
              }),
              interactive: false,
            });
          }
          
          return L.marker(latlng);
        },
        onEachFeature: (feature, featureLayer) => {
          const props = feature.properties as any;
          if (props.isFloorLabel || props.isAirportCenterCross || props.isAirportInnerRing || props.isLLUInnerRing) {
            return;
          }
          
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
  }, [zoneData, resolvedMode, halfWidthM, weekendView]);

  // Keep overlay presence on the map in sync with the visibility toggles.
  // These deps MUST cover every dep of the overlay-building effect above: that
  // effect replaces zoneOverlaysRef with fresh, unattached L.GeoJSON objects,
  // and this is the only place anything is added to the map. Miss one and the
  // rebuilt overlays exist but stay invisible until some unrelated change to
  // `visibility` re-runs this — i.e. zones vanish until you toggle a layer.
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
  }, [visibility, zoneData, resolvedMode, halfWidthM, weekendView]);

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

  // An honest legend: only the zone classes and verdicts actually present in loaded data.
  const legend: LegendFacts = useMemo(() => {
    if (zoneData.kind !== "ok") return { activeClasses: [] };
    const seen = new Set<string>();
    const activeClasses: { zoneTypeCode: string; verdict: string }[] = [];
    for (const { geojson } of zoneData.layers) {
      for (const feature of geojson.features) {
        const { zoneTypeCode, verdict } = feature.properties;
        const key = `${zoneTypeCode}|${verdict}`;
        if (!seen.has(key)) {
          seen.add(key);
          activeClasses.push({ zoneTypeCode, verdict });
        }
      }
    }
    return { activeClasses };
  }, [zoneData]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* DO-040: SVG patterns definitions for zone styling */}
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <pattern id="crosshatch-restricted" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 6 6 M 6 0 L 0 6" stroke="#b3261e" strokeWidth="1" opacity="0.4" />
          </pattern>
          <pattern id="crosshatch-needs-permit" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 6 6 M 6 0 L 0 6" stroke="#c77b00" strokeWidth="1" opacity="0.4" />
          </pattern>
          <pattern id="crosshatch-clear" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 6 6 M 6 0 L 0 6" stroke="#475569" strokeWidth="1" opacity="0.4" />
          </pattern>

          <pattern id="hatch-restricted" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#c77b00" strokeWidth="1.5" opacity="0.5" />
          </pattern>
          <pattern id="hatch-needs-permit" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#d97706" strokeWidth="1.5" opacity="0.5" />
          </pattern>
          <pattern id="hatch-clear" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1.5" opacity="0.5" />
          </pattern>
        </defs>
      </svg>
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
              className="z-0 h-full w-full overflow-hidden rounded-lg border border-border"
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
                  <label className="flex items-start gap-2 text-sm mt-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={weekendView}
                      onChange={(e) => handleWeekendViewChange(e.target.checked)}
                      data-testid="weekend-view-toggle"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{t("map.settings.weekendView.label")}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("map.settings.weekendView.hint")}
                      </span>
                    </span>
                  </label>
                  {weekendView && (
                    <div className="mt-1 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-[11px] text-amber-800 leading-normal" dir="auto" data-testid="weekend-view-caption">
                      <p className="font-semibold">{t("map.settings.weekendView.caption.title")}</p>
                      <p className="mt-0.5">
                        {t("map.settings.weekendView.caption.body")}
                      </p>
                    </div>
                  )}
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

/**
 * DO-041 — weekend-view emphasis flags for one zone feature. Display only:
 * nothing here reaches the verdict, and no zone is ever hidden. Off outside
 * weekend view, and silent for zones whose schedule could not be detected.
 */
function weekendViewExtras(
  props: any,
  weekendView: boolean,
): { isDeemphasized: boolean; isEmphasized: boolean } {
  if (!weekendView) return { isDeemphasized: false, isEmphasized: false };
  const schedule = detectSchedule(props?.name || "", props?.notes || null);
  return {
    isDeemphasized: schedule?.type === "weekday",
    isEmphasized: schedule?.type === "weekend",
  };
}

function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;
  let coords: [number, number][] = [];
  if (geometry.type === "Point") {
    coords = [geometry.coordinates];
  } else if (geometry.type === "LineString") {
    coords = geometry.coordinates;
  } else if (geometry.type === "MultiLineString") {
    coords = geometry.coordinates.flat(1);
  } else if (geometry.type === "Polygon") {
    coords = geometry.coordinates[0];
  } else if (geometry.type === "MultiPolygon") {
    coords = geometry.coordinates.flatMap((poly: any) => poly[0]);
  }
  
  if (coords.length === 0) return null;
  let sumLng = 0;
  let sumLat = 0;
  const len = coords.length > 1 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1] 
    ? coords.length - 1 
    : coords.length;
    
  for (let i = 0; i < len; i++) {
    sumLng += coords[i][0];
    sumLat += coords[i][1];
  }
  return [sumLng / len, sumLat / len];
}

function scaleGeometry(geometry: any, factor: number, center: { lat: number; lng: number }): any {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: any[]) =>
        ring.map((coord) => {
          const lng = center.lng + (coord[0] - center.lng) * factor;
          const lat = center.lat + (coord[1] - center.lat) * factor;
          return [lng, lat];
        })
      )
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly: any[]) =>
        poly.map((ring: any[]) =>
          ring.map((coord) => {
            const lng = center.lng + (coord[0] - center.lng) * factor;
            const lat = center.lat + (coord[1] - center.lat) * factor;
            return [lng, lat];
          })
        )
      )
    };
  }
  return geometry;
}
