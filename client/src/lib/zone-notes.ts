// DO-035 (item 2) — presentation of `Zone.notes` in the location-check panel.
//
// `Zone.notes` is free prose written by the import pipeline (server/docs/zones-api.md):
// typeHe / definition prose, provenance and source oddities, lane directional
// strings, `aglCeilingFt=N`, and — where the AIP published them — coordination
// contacts. This module ONLY splits and classifies that text for readable
// rendering. It invents nothing:
//
//   * Segments are the note's own `|`-separated fragments, shown verbatim.
//   * A "contact" is a phone number literally present in the note text. There is
//     no lookup table, no inferred authority, no default number. When no phone is
//     present the caller states that plainly ("no contact published in the
//     imported data") — silence is never filled in.
//   * Structured per-zone contact extraction from א'-17 is DO-036's ticket; this
//     is presentation of what the imported data already carries.
//
// Nothing regulatory lives here (conventions §4) — a phone number is contact
// information, not a regulatory value.

/** One `|`-separated fragment of a zone's notes, shown verbatim. */
export interface NoteSegment {
  text: string;
  /** True when this fragment contains at least one detected phone number. */
  hasContact: boolean;
}

export interface DetectedPhone {
  /** Exactly as it appears in the note — never reformatted. */
  raw: string;
  /** Digits-only (with +972 preserved) href value for a `tel:` link. */
  tel: string;
}

/**
 * Israeli phone numbers as the AIP prose publishes them.
 *
 * Deliberately strict — this text is full of long digit runs that must NOT be
 * mistaken for phone numbers: OSM node ids (`node/1042045384`), ISO timestamps
 * (`2023-04-24T00:00:00.000`), DMS coordinates (`31° 46' 19.05" N`), KMZ stamps
 * (`RATAG_kmz_07092020`) and radii. A false positive here would render an
 * invented "contact" — the exact failure this ticket must not produce.
 *
 * Accepted shapes:
 *   0X-XXXXXXX      landline   (area 2,3,4,8,9)
 *   05X-XXXXXXX     mobile
 *   07X-XXXXXXX     non-geographic
 *   +972-X-XXXXXXX  international form of either
 *   1-800-XXXXXX    toll-free
 * Separators may be `-`, a single space, or nothing. The match may not sit
 * inside a longer digit run, and may not be glued to a letter or `/`.
 */
const PHONE_PATTERN = new RegExp(
  [
    "(?<![\\w\\d/+])(?:",
    // +972 international form (leading zero dropped)
    "\\+972[-\\s]?(?:[23489]|5\\d|7\\d)[-\\s]?\\d{3}[-\\s]?\\d{4}",
    "|",
    // 1-800 toll-free
    "1[-\\s]?800[-\\s]?\\d{3}[-\\s]?\\d{3}",
    "|",
    // national form
    "0(?:[23489]|5\\d|7\\d)[-\\s]?\\d{3}[-\\s]?\\d{4}",
    ")(?![\\d])",
  ].join(""),
  "g",
);

/**
 * Phone numbers literally present in `text`, in order of appearance, de-duplicated.
 * Returns `[]` for null/empty text — never a placeholder.
 */
export function detectPhoneNumbers(text: string | null | undefined): DetectedPhone[] {
  if (!text) return [];
  const seen = new Set<string>();
  const found: DetectedPhone[] = [];
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const raw = match[0];
    const tel = toTelHref(raw);
    if (seen.has(tel)) continue;
    seen.add(tel);
    found.push({ raw, tel });
  }
  return found;
}

/** `tel:` href value — separators stripped, a leading `+` preserved. */
export function toTelHref(raw: string): string {
  const plus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}

/**
 * Splits a note into its published `|` fragments for readable rendering.
 * Empty fragments are dropped; nothing else is altered, reordered or rewritten.
 */
export function splitZoneNotes(notes: string | null | undefined): NoteSegment[] {
  if (!notes) return [];
  return notes
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((text) => ({ text, hasContact: detectPhoneNumbers(text).length > 0 }));
}

/**
 * Splits one segment into plain-text and phone runs so the renderer can wrap the
 * phone runs in `tel:` links while leaving every other character untouched.
 */
export type NotePart =
  | { kind: "text"; text: string }
  | { kind: "phone"; text: string; tel: string };

export function splitSegmentParts(text: string): NotePart[] {
  const parts: NotePart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ kind: "text", text: text.slice(cursor, start) });
    parts.push({ kind: "phone", text: match[0], tel: toTelHref(match[0]) });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: "text", text: text.slice(cursor) });
  return parts;
}
