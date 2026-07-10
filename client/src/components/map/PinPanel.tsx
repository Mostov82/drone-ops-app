// DO-012 — the pinned-point readout (FR-C2 + FR-C5): precise decimal and DMS
// coordinates, terrain elevation with the ALWAYS-ON approximate badge, and the
// optional online cross-check (explicit button — never automatic, NFR-1).
// Elevation errors surface the server's structured bilingual message —
// a missing DEM shows instructions, never a default value.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ApproximateBadge from "@/components/map/ApproximateBadge";
import { Button } from "@/components/ui/button";
import { formatDecimal, formatDms, type LatLng } from "@/lib/coords";
import {
  crosscheckElevation,
  getElevation,
  MapRequestError,
  type CrosscheckResult,
  type ElevationResult,
} from "@/lib/map-api";

type ElevationState =
  | { kind: "loading" }
  | { kind: "ok"; result: ElevationResult }
  | { kind: "error"; code: string | null };

type CrosscheckState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; result: CrosscheckResult }
  | { kind: "error" };

function elevationErrorKey(code: string | null): string {
  if (code === "DEM_NOT_AVAILABLE") return "map.elevation.missing";
  if (code === "DEM_OUT_OF_COVERAGE") return "map.elevation.outOfCoverage";
  return "map.elevation.error";
}

export default function PinPanel({ pin }: { pin: LatLng | null }) {
  const { t } = useTranslation();
  const [elevation, setElevation] = useState<ElevationState>({ kind: "loading" });
  const [crosscheck, setCrosscheck] = useState<CrosscheckState>({ kind: "idle" });

  useEffect(() => {
    if (!pin) return;
    let stale = false;
    setElevation({ kind: "loading" });
    setCrosscheck({ kind: "idle" });
    getElevation(pin.lat, pin.lng)
      .then((result) => {
        if (!stale) setElevation({ kind: "ok", result });
      })
      .catch((err: unknown) => {
        if (!stale) {
          setElevation({ kind: "error", code: err instanceof MapRequestError ? err.code : null });
        }
      });
    return () => {
      stale = true;
    };
  }, [pin]);

  if (!pin) {
    return <p className="text-sm text-muted-foreground">{t("map.pin.none")}</p>;
  }

  async function runCrosscheck() {
    if (!pin) return;
    setCrosscheck({ kind: "loading" });
    try {
      setCrosscheck({ kind: "ok", result: await crosscheckElevation(pin.lat, pin.lng) });
    } catch {
      setCrosscheck({ kind: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("map.pin.title")}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("map.pin.decimal")}</dt>
        <dd dir="ltr" className="text-start font-mono">
          {formatDecimal(pin)}
        </dd>
        <dt className="text-muted-foreground">{t("map.pin.dms")}</dt>
        <dd dir="ltr" className="text-start font-mono">
          {formatDms(pin)}
        </dd>
        <dt className="text-muted-foreground">{t("map.elevation.label")}</dt>
        <dd>
          {elevation.kind === "loading" && (
            <span className="text-muted-foreground">{t("map.elevation.loading")}</span>
          )}
          {elevation.kind === "ok" && (
            <span className="inline-flex items-center gap-2">
              <span dir="ltr" className="font-mono">
                {t("map.elevation.value", { value: elevation.result.elevationM })}
              </span>
              <ApproximateBadge />
            </span>
          )}
          {elevation.kind === "error" && (
            <span className="text-amber-800">{t(elevationErrorKey(elevation.code))}</span>
          )}
        </dd>
      </dl>
      {elevation.kind === "ok" && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runCrosscheck()}
              disabled={crosscheck.kind === "loading"}
            >
              {t("map.crosscheck.run")}
            </Button>
            {crosscheck.kind === "ok" && (
              <span className="inline-flex items-center gap-2 text-sm">
                <span dir="ltr" className="font-mono">
                  {t("map.elevation.value", { value: crosscheck.result.elevationM })}
                </span>
                <span className="text-muted-foreground">({crosscheck.result.provider})</span>
              </span>
            )}
            {crosscheck.kind === "error" && (
              <span className="text-sm text-amber-800">{t("map.crosscheck.failed")}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("map.crosscheck.note")}</p>
        </div>
      )}
    </div>
  );
}
