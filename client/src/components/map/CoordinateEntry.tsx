// DO-012 — manual coordinate entry (FR-C2 as amended): accepts decimal and
// DMS (the AIP's notation) and moves the pin. Parsing is the hand-rolled,
// unit-tested lib/coords.ts — one generic error on unparseable input.
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { parseCoordinates, type LatLng } from "@/lib/coords";

export default function CoordinateEntry({ onSubmit }: { onSubmit: (point: LatLng) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const point = parseCoordinates(text);
    if (!point) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSubmit(point);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <label htmlFor="coordinate-entry" className="text-sm font-medium">
        {t("map.entry.label")}
      </label>
      <div className="flex gap-2">
        <input
          id="coordinate-entry"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          // Coordinates are LTR data even in the RTL layout.
          dir="ltr"
          placeholder={t("map.entry.placeholder")}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2"
        />
        <Button type="submit" variant="outline">
          {t("map.entry.go")}
        </Button>
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-red-700">
          {t("map.entry.error")}
        </p>
      )}
    </form>
  );
}
