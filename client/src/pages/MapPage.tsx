// DO-012 — the offline map of Israel (FR-C1) with precise pin coordinates
// (FR-C2) and terrain elevation at the pin (FR-C5).
// Leaflet raster TileLayer over locally served MBTiles (PRD §6 locked stack;
// GB-03 Gate 2) — every tile request goes to our own Express route, so the
// page is fully functional with zero connectivity. With no package installed
// it renders the instructive empty state instead (never a crash).
// DO-014 draws zone overlays on this map; DO-015 consumes the elevation API.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import CoordinateEntry from "@/components/map/CoordinateEntry";
import PinPanel from "@/components/map/PinPanel";
import TilesMissingNotice from "@/components/map/TilesMissingNotice";
import type { LatLng } from "@/lib/coords";
import { getMapStatus, TILE_URL_TEMPLATE, type MapStatus } from "@/lib/map-api";

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

export default function MapPage() {
  const { t } = useTranslation();
  const [statusState, setStatusState] = useState<StatusState>({ kind: "loading" });
  const [pin, setPin] = useState<LatLng | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const loadStatus = useCallback(() => {
    setStatusState({ kind: "loading" });
    getMapStatus()
      .then((status) => setStatusState({ kind: "ok", status }))
      .catch(() => setStatusState({ kind: "error" }));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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
    };
    // Deliberately keyed on availability alone — the map initializes once per
    // installed package; metadata/labels don't change under a live map.
  }, [tilesAvailable]);

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
            {statusState.status.dem.available === false && (
              <p className="text-xs text-amber-800">{t("map.elevation.missing")}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
