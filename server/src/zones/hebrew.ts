// DO-013 — RTL line assembly for text extracted from the AIP PDFs.
//
// Verified against the א'-17 PDF by codepoint inspection (verified
// 2026-07-10): PyMuPDF's get_text("words") yields each Hebrew word with its
// characters already in LOGICAL order for this document — no character-level
// reversal is needed. What DOES need repair is word order: words come with
// x-positions, and on a right-to-left line the logical first word is the
// RIGHTMOST one. LTR tokens (numbers, codes like "LLU22", "GND", "ENR5.1")
// occupy single words and keep their internal order.
//
// Limitation (documented): a run of MULTIPLE consecutive LTR words inside one
// RTL line would come out run-reversed. The AIP tables contain only
// single-word LTR tokens inside Hebrew lines, and names are display-only —
// codes/coordinates/altitudes are parsed from their own cells.

const HEBREW = /[֐-׿]/;

export interface PositionedWord {
  x: number;
  text: string;
}

/** True if the text contains any Hebrew character. */
export function hasHebrew(s: string): boolean {
  return HEBREW.test(s);
}

/**
 * Join the words of ONE visual line into a logical string: right-to-left when
 * the line contains Hebrew, left-to-right otherwise.
 */
export function lineToLogical(words: PositionedWord[]): string {
  const rtl = words.some((w) => hasHebrew(w.text));
  const sorted = [...words].sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
  return sorted
    .map((w) => w.text.trim())
    .filter((t) => t.length > 0)
    .join(" ");
}
