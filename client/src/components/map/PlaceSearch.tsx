import { useState, type FormEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface LatLng {
  lat: number;
  lng: number;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export default function PlaceSearch({ onSelect }: { onSelect: (point: LatLng) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsgKey, setErrorMsgKey] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === "") return;

    setLoading(true);
    setErrorMsgKey(null);
    setNoResults(false);
    setResults([]);

    try {
      const res = await fetch(`/api/map/search?q=${encodeURIComponent(text)}`);
      if (res.status === 429) {
        setErrorMsgKey("map.search.rateLimit");
        setLoading(false);
        return;
      }
      if (res.status === 503) {
        setErrorMsgKey("map.search.offline");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setErrorMsgKey("map.search.error");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as SearchResult[];
      if (data.length === 0) {
        setNoResults(true);
      } else {
        setResults(data);
      }
    } catch {
      setErrorMsgKey("map.search.offline");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectResult(result: SearchResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      onSelect({ lat, lng });
      setResults([]);
      setText(result.display_name); // Show selected place name in input
    }
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={dropdownRef}>
      <label htmlFor="place-search" className="text-sm font-medium">
        {t("map.search.label")}
      </label>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          id="place-search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErrorMsgKey(null);
            setNoResults(false);
          }}
          placeholder={t("map.search.placeholder")}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2"
        />
        <Button type="submit" variant="outline" disabled={loading}>
          {loading ? "..." : t("map.search.go")}
        </Button>
      </form>

      {/* Results Dropdown */}
      {results.length > 0 && (
        <div className="absolute top-[64px] z-50 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-60 overflow-y-auto">
          <ul className="py-1 text-sm">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-start px-3 py-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attribution */}
      <span className="text-[10px] text-muted-foreground select-none mt-0.5">
        {t("map.search.attribution")}
      </span>

      {/* Error or Warnings */}
      {errorMsgKey && (
        <p role="alert" className="text-xs text-amber-800 mt-1">
          {t(errorMsgKey)}
        </p>
      )}
      {noResults && (
        <p role="alert" className="text-xs text-muted-foreground mt-1">
          {t("map.search.noResults")}
        </p>
      )}
    </div>
  );
}
