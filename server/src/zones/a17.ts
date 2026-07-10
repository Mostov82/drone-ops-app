// DO-013 — parser for the א'-17 dump produced by server/scripts/zones/dump_a17.py.
//
// The dump is raw: PDF table cells (rectangles from the document's own ruling
// lines, merged cells spanning their full group) with the words inside them.
// This module classifies tables into appendices and assembles zone entries by
// GEOMETRIC association — a zone's vertices/name/altitudes are the cells that
// overlap its code cell's vertical span. No positional guessing, no row
// heuristics: the PDF's ruling lines are the authority.
//
// Fail-closed (trigger 1): an entry that cannot be assembled unambiguously is
// pushed to `failures` with a reason — callers exclude it from datasets and
// list it in the reconciliation report.

import { parseDmsPair, parseDmsParts, stripBidi } from "./dms.js";
import { hasHebrew, lineToLogical } from "./hebrew.js";

// ── dump shapes ──────────────────────────────────────────────────────────────

interface DumpWord {
  bbox: number[];
  text: string;
}
interface DumpCell {
  bbox: number[];
  words: DumpWord[];
}
interface DumpTable {
  bbox: number[];
  rowCount: number;
  cells: DumpCell[];
}
interface DumpPage {
  page: number;
  text: string;
  tables: DumpTable[];
}
export interface A17Dump {
  source: { pdf: string; pageCount: number };
  pages: DumpPage[];
}

// ── parsed shapes ────────────────────────────────────────────────────────────

export interface A17Vertex {
  northRaw: string;
  eastRaw: string;
  lat: number;
  lng: number;
}

export interface AppendixBEntry {
  code: string;
  nameHe: string | null;
  altMinRaw: string | null;
  altMaxRaw: string | null;
  vertices: A17Vertex[];
  /**
   * Coordinate-looking cells that did NOT parse (source typography quirks,
   * e.g. `31° 17 '.13 00" N`). Never guessed — listed in the reconciliation
   * report; geometry authority for these zones is the gdb (Gate 1 amendment).
   */
  vertexIssues: string[];
  /**
   * Hebrew definition text inside the coordinate columns (circle definitions
   * "מעגל שרדיוסו…", arcs, border-following segments, ENR references).
   */
  noteHe: string | null;
  page: number;
}

export interface AppendixCEntry {
  code: string;
  nameHe: string | null;
  /** Exactly one of radius/polygons is populated. */
  radiusM: number | null;
  center: A17Vertex | null;
  polygons: { labelHe: string; vertices: A17Vertex[] }[];
  page: number;
}

export interface AppendixEEntry {
  code: string;
  nameHe: string | null;
  typeHe: string | null;
  maxAglFt: number | null;
  page: number;
}

export interface ParseFailure {
  appendix: "B" | "C" | "E";
  code: string;
  page: number;
  reason: string;
}

export interface A17Parsed {
  appendixB: AppendixBEntry[];
  appendixC: AppendixCEntry[];
  appendixE: AppendixEEntry[];
  failures: ParseFailure[];
  /** LLU codes mentioned in the main-text prose (cross-check for appendix C). */
  proseLluCodes: string[];
  /** Footer update stamps seen on appendix pages, visual→logical repaired. */
  updateStamps: string[];
}

// ── small helpers ────────────────────────────────────────────────────────────

const CODE = /^LL[PRDU]\d{1,4}$/;

function wordText(w: DumpWord): string {
  return stripBidi(w.text).trim();
}

/**
 * Cell text, line by line (top→bottom). Hebrew words arrive in logical
 * character order in this PDF (verified by codepoint inspection); RTL lines
 * are assembled right-to-left by lineToLogical.
 */
function cellLines(cell: DumpCell): string[] {
  const lines: { y: number; words: DumpWord[] }[] = [];
  for (const w of cell.words) {
    const yc = (w.bbox[1] + w.bbox[3]) / 2;
    const line = lines.find((l) => Math.abs(l.y - yc) < 3);
    if (line) line.words.push(w);
    else lines.push({ y: yc, words: [w] });
  }
  lines.sort((a, b) => a.y - b.y);
  return lines
    .map((l) => lineToLogical(l.words.map((w) => ({ x: w.bbox[0], text: wordText(w) }))))
    .filter((t) => t.length > 0);
}

/** Full cell text: lines joined top→bottom. */
function cellText(cell: DumpCell): string {
  return cellLines(cell).join(" ").trim();
}

function yCenter(bbox: number[]): number {
  return (bbox[1] + bbox[3]) / 2;
}

function spanContains(span: DumpCell, cell: DumpCell): boolean {
  const yc = yCenter(cell.bbox);
  return yc >= span.bbox[1] - 1 && yc <= span.bbox[3] + 1;
}

function tryDms(cell: DumpCell): { raw: string; axis: "NS" | "EW" } | null {
  const raw = cellText(cell);
  try {
    const parts = parseDmsParts(raw);
    return { raw, axis: parts.hemisphere === "N" || parts.hemisphere === "S" ? "NS" : "EW" };
  } catch {
    return null;
  }
}

/**
 * The code found in a cell's words. `strict` additionally requires the cell to
 * contain nothing but the code (± a footnote asterisk, ± a page-break
 * continuation marker like "LLP172 (המשך)") — definition prose can reference
 * other codes ("…בקשת לאורך גבול LLP13"), and such note cells must never
 * spawn phantom entries.
 */
function codeOf(cell: DumpCell, strict = false): string | null {
  const texts = cell.words.map(wordText).filter((t) => t.length > 0);
  const code = texts.find((t) => CODE.test(t.replace(/\*+$/, "")));
  if (!code) return null;
  if (strict) {
    const extras = texts
      .filter((t) => !CODE.test(t.replace(/\*+$/, "")))
      .map((t) => t.replace(/[()*]/g, ""))
      .filter((t) => t.length > 0);
    if (extras.some((t) => t !== "המשך")) return null;
  }
  return code.replace(/\*+$/, "");
}

function isHebrewCell(cell: DumpCell): boolean {
  return cell.words.some((w) => hasHebrew(w.text));
}

/** Table headers repeat on every page — filter them out by keyword. */
const HEADER_WORDS = new Set(["ןופצ", "חרזמ", "הבוג", "יברמ", "ירעזמ", "יוהיז", "דוק", "םש", "רוזאה", "סוידר", "הריגסה", "גוס", "רוזא", "ש\"פעמ", "יברימ"]);
function isHeaderCell(cell: DumpCell): boolean {
  const texts = cell.words.map(wordText).filter((t) => t.length > 0);
  if (texts.length === 0) return false;
  const headerish = texts.filter((t) => HEADER_WORDS.has(t) || t === "(Y)" || t === "(X)" || t === ")" || t === "(" || t === "X" || t === "Y").length;
  return headerish >= Math.max(1, texts.length - 1);
}

// ── table classification ─────────────────────────────────────────────────────

type Appendix = "B" | "C" | "D" | "E" | null;

function classify(table: DumpTable): Appendix {
  const texts = table.cells.flatMap((c) => c.words.map(wordText));
  const codes = texts.filter((t) => CODE.test(t));
  if (codes.length === 0) return null;
  const hasLlu = codes.some((c) => c.startsWith("LLU"));
  const hasDegrees = texts.some((t) => t.includes("°"));
  const hasCompactDms = texts.some((t) => /^\d{5,6}[NE]$/.test(t));
  if (hasLlu && hasDegrees) return "C";
  if (hasCompactDms && !hasDegrees) return "D"; // appendix ד' obstacles — out of scope
  if (hasDegrees) return "B";
  return "E";
}

// ── appendix B ───────────────────────────────────────────────────────────────

function parseAppendixBTable(
  table: DumpTable,
  page: number,
  out: AppendixBEntry[],
  failures: ParseFailure[],
): void {
  const cells = table.cells.filter((c) => c.words.length > 0 && !isHeaderCell(c));
  const codeCells = cells.filter((c) => codeOf(c, true) !== null && !tryDms(c));

  for (const codeCell of codeCells) {
    const code = codeOf(codeCell, true)!;
    const span = cells.filter((c) => c !== codeCell && spanContains(codeCell, c));
    try {
      // Vertices: DMS cells inside the span, paired per visual row. Geometry
      // authority for these zones is the gdb (Gate 1 second amendment) — the
      // text vertices feed spot-checks, so an unparseable coordinate cell is
      // recorded as an issue (reconciliation report), never guessed at.
      const vertexIssues: string[] = [];
      const dmsCells = span
        .map((c) => ({ cell: c, dms: tryDms(c) }))
        .filter((x) => x.dms !== null);
      const looksCoordinate = (c: DumpCell) =>
        !isHebrewCell(c) && /[°"]/.test(cellText(c)) && !dmsCells.some((x) => x.cell === c);
      for (const c of span.filter(looksCoordinate)) {
        vertexIssues.push(cellText(c));
      }
      const ns = dmsCells.filter((x) => x.dms!.axis === "NS");
      const ew = dmsCells.filter((x) => x.dms!.axis === "EW");
      const usedEw = new Set<(typeof ew)[number]>();
      const vertices: A17Vertex[] = [];
      for (const n of ns.sort((a, b) => a.cell.bbox[1] - b.cell.bbox[1])) {
        const mate = ew.find(
          (e) => !usedEw.has(e) && Math.abs(yCenter(e.cell.bbox) - yCenter(n.cell.bbox)) < 3,
        );
        if (!mate) {
          vertexIssues.push(`${n.dms!.raw} — no E/W partner on its row`);
          continue;
        }
        usedEw.add(mate);
        const { lat, lng } = parseDmsPair(n.dms!.raw, mate.dms!.raw);
        vertices.push({ northRaw: n.dms!.raw, eastRaw: mate.dms!.raw, lat, lng });
      }
      for (const e of ew) {
        if (!usedEw.has(e)) vertexIssues.push(`${e.dms!.raw} — no N/S partner on its row`);
      }

      // name: Hebrew cell immediately left of the code column
      const hebrewCells = span.filter((c) => isHebrewCell(c) && !tryDms(c));
      const nameCell = hebrewCells
        .filter((c) => c.bbox[2] <= codeCell.bbox[0] + 2)
        .sort((a, b) => b.bbox[0] - a.bbox[0])[0];
      // note: Hebrew definition text in the coordinate columns (left half)
      const tableMidX = (table.bbox[0] + table.bbox[2]) / 2;
      const noteCells = hebrewCells
        .filter((c) => c !== nameCell && c.bbox[0] < tableMidX)
        .sort((a, b) => a.bbox[1] - b.bbox[1]);
      const noteHe = noteCells.length > 0 ? noteCells.map(cellText).join(" · ") : null;

      // altitudes: non-Hebrew, non-coordinate cells (GND / MSL / numbers)
      const altCells = span
        .filter((c) => !isHebrewCell(c) && !tryDms(c) && !looksCoordinate(c) && c !== codeCell)
        .filter((c) => /^[A-Z0-9/\s.,()-]+$/.test(cellText(c))) // parens: negative ceilings "(-)530"
        .sort((a, b) => a.bbox[0] - b.bbox[0]);
      let altMinRaw: string | null = null;
      let altMaxRaw: string | null = null;
      if (altCells.length === 2) {
        altMinRaw = cellText(altCells[0]);
        altMaxRaw = cellText(altCells[1]);
      } else if (altCells.length === 1) {
        // single altitude cell: GND/MSL tokens are floors, numbers are ceilings
        const text = cellText(altCells[0]);
        if (/GND|MSL/.test(text) && !/\d{3,}/.test(text)) altMinRaw = text;
        else altMaxRaw = text;
      } else if (altCells.length > 2) {
        throw new Error(
          `expected ≤2 altitude cells, found ${altCells.length}: ${altCells.map(cellText).join(" | ")}`,
        );
      }

      out.push({
        code,
        nameHe: nameCell ? cellText(nameCell) : null,
        altMinRaw,
        altMaxRaw,
        vertices,
        vertexIssues,
        noteHe,
        page,
      });
    } catch (err) {
      failures.push({ appendix: "B", code, page, reason: (err as Error).message });
    }
  }
}

// ── appendix C ───────────────────────────────────────────────────────────────

const METERS = "מטר";

function parseAppendixCTable(
  table: DumpTable,
  page: number,
  out: AppendixCEntry[],
  failures: ParseFailure[],
): void {
  const cells = table.cells.filter((c) => c.words.length > 0 && !isHeaderCell(c));
  const codeCells = cells.filter((c) => {
    const code = codeOf(c);
    return code !== null && code.startsWith("LLU");
  });

  for (const codeCell of codeCells) {
    const code = codeOf(codeCell)!;
    const span = cells.filter((c) => c !== codeCell && spanContains(codeCell, c));
    try {
      const dmsCells = span
        .map((c) => ({ cell: c, dms: tryDms(c) }))
        .filter((x) => x.dms !== null);
      const ns = dmsCells.filter((x) => x.dms!.axis === "NS");
      const ew = dmsCells.filter((x) => x.dms!.axis === "EW");
      if (ns.length !== ew.length) {
        throw new Error(`unpaired DMS cells (${ns.length} N/S vs ${ew.length} E/W)`);
      }
      const pairAt = (n: { cell: DumpCell; dms: { raw: string } | null }): A17Vertex => {
        const mate = ew.find((e) => Math.abs(yCenter(e.cell.bbox) - yCenter(n.cell.bbox)) < 3);
        if (!mate) throw new Error(`N/S cell at y=${yCenter(n.cell.bbox)} has no E/W partner`);
        const { lat, lng } = parseDmsPair(n.dms!.raw, mate.dms!.raw);
        return { northRaw: n.dms!.raw, eastRaw: mate.dms!.raw, lat, lng };
      };

      // middle-column cells: radius ("<digits> מטר") or polygon labels (מרחב אווירי…)
      const hebrewName = span
        .filter((c) => isHebrewCell(c) && !tryDms(c) && c.bbox[2] <= codeCell.bbox[0] + 2)
        .sort((a, b) => b.bbox[0] - a.bbox[0]);
      const nameCell = hebrewName[0] ?? null;
      const middle = span.filter(
        (c) => c !== nameCell && !tryDms(c) && (nameCell ? c.bbox[2] <= nameCell.bbox[0] + 2 : true),
      );
      const radiusCells = middle.filter((c) =>
        c.words.some((w) => wordText(w) === METERS) && c.words.some((w) => /^\d+$/.test(wordText(w))),
      );
      const polygonLabelCells = middle.filter(
        (c) => isHebrewCell(c) && !radiusCells.includes(c) && c.words.length > 0,
      );

      if (radiusCells.length === 1 && polygonLabelCells.length === 0) {
        if (ns.length !== 1) throw new Error(`circle entry expects 1 vertex pair, found ${ns.length}`);
        const digits = radiusCells[0].words.map(wordText).find((t) => /^\d+$/.test(t))!;
        out.push({
          code,
          nameHe: nameCell ? cellText(nameCell) : null,
          radiusM: Number(digits),
          center: pairAt(ns[0]),
          polygons: [],
          page,
        });
      } else if (radiusCells.length === 0 && polygonLabelCells.length >= 1) {
        const polygons = polygonLabelCells
          .sort((a, b) => a.bbox[1] - b.bbox[1])
          .map((label) => {
            const vs = ns
              .filter((n) => spanContains(label, n.cell))
              .sort((a, b) => a.cell.bbox[1] - b.cell.bbox[1])
              .map(pairAt);
            return { labelHe: cellText(label), vertices: vs };
          });
        const assigned = polygons.reduce((sum, p) => sum + p.vertices.length, 0);
        if (assigned !== ns.length) {
          throw new Error(`${ns.length} vertex pairs but ${assigned} assigned to polygon labels`);
        }
        if (polygons.some((p) => p.vertices.length < 3)) {
          throw new Error("polygon label with fewer than 3 vertices");
        }
        out.push({
          code,
          nameHe: nameCell ? cellText(nameCell) : null,
          radiusM: null,
          center: null,
          polygons,
          page,
        });
      } else {
        throw new Error(
          `ambiguous entry: ${radiusCells.length} radius cells, ${polygonLabelCells.length} polygon labels, ${ns.length} vertex pairs`,
        );
      }
    } catch (err) {
      failures.push({ appendix: "C", code, page, reason: (err as Error).message });
    }
  }
}

// ── appendix E ───────────────────────────────────────────────────────────────

function parseAppendixETable(
  table: DumpTable,
  page: number,
  out: AppendixEEntry[],
  failures: ParseFailure[],
): void {
  const cells = table.cells.filter((c) => c.words.length > 0 && !isHeaderCell(c));
  const codeCells = cells.filter((c) => codeOf(c) !== null);

  for (const codeCell of codeCells) {
    const code = codeOf(codeCell)!;
    try {
      // In appendix E the code cell sometimes contains the code AND the name.
      const own = cellLines(codeCell)
        .map((line) => line.replace(new RegExp(`\\s*\\b${code}\\b\\s*`), " ").trim())
        .filter((t) => t.length > 0)
        .join(" ")
        .trim();

      const span = cells.filter((c) => c !== codeCell && spanContains(codeCell, c));
      const hebrew = span
        .filter((c) => isHebrewCell(c))
        .sort((a, b) => b.bbox[0] - a.bbox[0]); // right-to-left
      const nameCell = hebrew.find((c) => c.bbox[2] <= codeCell.bbox[0] + 2) ?? null;
      const typeCell = hebrew.find((c) => c !== nameCell && (nameCell ? c.bbox[2] <= nameCell.bbox[0] + 2 : true)) ?? null;
      const aglCell = span.find((c) => !isHebrewCell(c) && /^\d{3,4}$/.test(cellText(c))) ?? null;

      const nameHe = own.length > 0 ? own : nameCell ? cellText(nameCell) : null;
      out.push({
        code,
        nameHe,
        typeHe: typeCell ? cellText(typeCell) : null,
        maxAglFt: aglCell ? Number(cellText(aglCell)) : null,
        page,
      });
    } catch (err) {
      failures.push({ appendix: "E", code, page, reason: (err as Error).message });
    }
  }
}

// ── entry point ──────────────────────────────────────────────────────────────

export function parseA17(dump: A17Dump): A17Parsed {
  const parsed: A17Parsed = {
    appendixB: [],
    appendixC: [],
    appendixE: [],
    failures: [],
    proseLluCodes: [],
    updateStamps: [],
  };

  const appendixPages = new Set<number>();
  for (const page of dump.pages) {
    for (const table of page.tables) {
      const appendix = classify(table);
      if (appendix === "B") parseAppendixBTable(table, page.page, parsed.appendixB, parsed.failures);
      else if (appendix === "C") parseAppendixCTable(table, page.page, parsed.appendixC, parsed.failures);
      else if (appendix === "E") parseAppendixETable(table, page.page, parsed.appendixE, parsed.failures);
      if (appendix) appendixPages.add(page.page);
    }
  }

  // prose LLU mentions (main text, before the appendix pages)
  const firstAppendixPage = Math.min(...appendixPages);
  const prose = new Set<string>();
  for (const page of dump.pages) {
    if (page.page >= firstAppendixPage) continue;
    for (const m of stripBidi(page.text).matchAll(/LLU\d{1,3}/g)) prose.add(m[0]);
  }
  parsed.proseLluCodes = [...prose].sort();

  // footer update stamps on appendix pages (word order may run either way)
  const stamps = new Set<string>();
  for (const page of dump.pages) {
    if (!appendixPages.has(page.page)) continue;
    for (const line of page.text.split("\n")) {
      if (!line.includes("עדכון")) continue;
      const cleaned = stripBidi(line).trim();
      const m = /עדכון\s+(\d+\/\d+)/.exec(cleaned) ?? /(\d+\/\d+)\s+עדכון/.exec(cleaned);
      if (m) stamps.add(m[1]);
    }
  }
  parsed.updateStamps = [...stamps].sort();

  // Page-break continuations: appendix B zones can span pages, producing two
  // entries for one code. Merge the continuation's vertices into the first
  // entry (source order) and flag it for the reconciliation report.
  {
    const byCode = new Map<string, AppendixBEntry>();
    const merged: AppendixBEntry[] = [];
    for (const entry of parsed.appendixB) {
      const first = byCode.get(entry.code);
      if (!first) {
        byCode.set(entry.code, entry);
        merged.push(entry);
        continue;
      }
      first.vertices.push(...entry.vertices);
      first.vertexIssues.push(...entry.vertexIssues);
      if (entry.noteHe) first.noteHe = first.noteHe ? `${first.noteHe} · ${entry.noteHe}` : entry.noteHe;
      first.altMinRaw ??= entry.altMinRaw;
      first.altMaxRaw ??= entry.altMaxRaw;
      first.nameHe ??= entry.nameHe;
      parsed.failures.push({
        appendix: "B",
        code: entry.code,
        page: entry.page,
        reason: `page-break continuation merged into the p${first.page} entry — verify vertex order manually`,
      });
    }
    parsed.appendixB = merged;
  }
  {
    const seen = new Set<string>();
    for (let i = 0; i < parsed.appendixC.length; i++) {
      const code = parsed.appendixC[i].code;
      if (seen.has(code)) {
        parsed.failures.push({
          appendix: "C",
          code,
          page: parsed.appendixC[i].page,
          reason: "duplicate entry for code — kept first, verify manually",
        });
        parsed.appendixC.splice(i--, 1);
      } else {
        seen.add(code);
      }
    }
  }

  return parsed;
}
