// DO-013 — zone extraction/import errors.
// Parsing is fail-closed (intent doc trigger 1): anything a parser cannot read
// unambiguously throws ZoneParseError. Builders catch it per zone, EXCLUDE the
// zone from the dataset and record it in the reconciliation report — geometry
// is never interpolated or guessed.

export class ZoneParseError extends Error {
  readonly raw: string;

  constructor(message: string, raw: string) {
    super(`${message}: ${JSON.stringify(raw)}`);
    this.name = "ZoneParseError";
    this.raw = raw;
  }
}
