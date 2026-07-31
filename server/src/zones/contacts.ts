// DO-036 (session 2) — coordination-contact extraction from the א'-17 MAIN-TEXT
// prose (pages before the first appendix), so the published "לתיאום טיסה…"
// sentences ride Zone.notes and DO-035's panel renders them (tel: links from
// its own phone-pattern detection — zero client change).
//
// ASSOCIATION DISCIPLINE (by design): a sentence attaches
// to a zone ONLY by exact-code association —
//   (a) the sentence sits inside that code's serial-marked prose entry, or
//   (b) the sentence itself names the code(s) it covers (e.g. the
//       "באזורים LLR90/801/802/803/83" list, or the inline "לאזור LLU21" phone).
// Class-level blocks that name NO codes (the מתא"מ regional fire-zone
// coordination paragraph, the prison-service class applicability) are NEVER
// distributed by geography, name or proximity — they are recorded as
// `contact-ambiguous` issues for the reconciliation report and human review.
//
// TEXT FIDELITY: the dump's prose lines carry Hebrew in logical character and
// word order, but PDF bidi typesetting mangles punctuation and token
// boundaries. Normalization here is DECODING, not paraphrase — words stay in
// published order, phones/emails stay verbatim. The documented repairs:
//   * fused Hebrew↔digit/Latin tokens split ("בטלפון050-3384198", "במיילitzik…")
//   * phones split across lines rejoined ("054-" + "2021535"), including the
//     one visually-REVERSED phone ("9599800 - 09" → "09-9599800")
//   * zone codes typeset digits-first rejoined ("03" + "LLP" → "LLP03")
//   * bidi-displaced parentheses/colons dropped (a paren inserted mid-word,
//     "צרפ)תי", is removed; floating colons become spaces)
//   * dual phones published as "X/Y" spaced to "X / Y" (both sides full
//     numbers only — "08-9902926/8" alternate-digit forms stay as published)
// A sweep then accounts for EVERY phone/email in the main text: attached,
// listed in an issue, or reported as `contact-unextracted` with its context —
// nothing silently dropped.

import type { A17Dump } from "./a17.js";
import { stripBidi } from "./dms.js";
import type { ZoneFeatureCollection } from "./dataset.js";
import type { ReconIssue } from "./builders/aip-zones.js";

const CODE = /^LL[PRDU]\d{1,4}$/;
const HEB = "֐-׿";

export interface ContactAttachment {
  code: string;
  /** True when the sentence covers several zones (rendered with an (אזורי) tag). */
  regional: boolean;
  /** The published sentence, normalized as documented above. */
  sentence: string;
}

export interface ContactExtraction {
  attachments: ContactAttachment[];
  issues: ReconIssue[];
  stats: {
    sentences: number;
    attachments: number;
    ambiguousExcluded: number;
    residualContacts: number;
    phonesSeen: number;
    phonesAttached: number;
    emailsSeen: number;
    emailsAttached: number;
  };
}

/** Edge punctuation stripped for token comparisons (never inside tokens). */
function bare(token: string): string {
  return token.replace(/^[,.":;]+/, "").replace(/[,.":;]+$/, "");
}

/** Main-text pages → whitespace tokens, bidi controls stripped. */
function tokenize(dump: A17Dump, firstAppendixPage: number): string[] {
  const tokens: string[] = [];
  for (const page of dump.pages) {
    if (page.page >= firstAppendixPage) continue;
    tokens.push(...stripBidi(page.text).split(/\s+/).filter((t) => t.length > 0));
  }
  return tokens;
}

/** The documented normalization pipeline (see file header). */
export function normalizeTokens(raw: string[]): string[] {
  const split: string[] = [];
  for (let t of raw) {
    // a paren inserted mid-word by bidi layout is dropped; others become spaces
    t = t.replace(new RegExp(`(?<=[${HEB}])[()](?=[${HEB}])`, "g"), "");
    t = t.replace(/[()]/g, " ");
    // colons keep only their digit:digit (time) role; elsewhere they float
    t = t.replace(/(?<!\d):|:(?!\d)/g, " ");
    // a geresh displaced onto the following word ("'דוד")
    t = t.replace(/^[׳']+(?=[\w֐-׿])/, "");
    // fused Hebrew ↔ Latin/digit boundaries
    t = t.replace(new RegExp(`([${HEB}"׳״])(?=[A-Za-z0-9@+])`, "g"), "$1 ");
    t = t.replace(new RegExp(`([A-Za-z0-9@.])(?=[${HEB}])`, "g"), "$1 ");
    split.push(...t.split(/\s+/).filter((s) => s.length > 0));
  }

  const merged: string[] = [];
  for (let i = 0; i < split.length; i++) {
    const a = split[i];
    const b = split[i + 1] ?? "";
    const c = split[i + 2] ?? "";
    // phone split across lines: "054-" + "2021535" (trailing ;,. tolerated)
    if (/^0\d{1,2}-$/.test(a) && /^\d{6,7}(\/\d)?[;,.]?$/.test(b)) {
      merged.push(a + b);
      i += 1;
      continue;
    }
    // visually-reversed phone: "9599800" "-" "09" → "09-9599800"
    if (/^\d{6,7}$/.test(a) && b === "-" && /^0\d{1,2}$/.test(c)) {
      merged.push(`${c}-${a}`);
      i += 2;
      continue;
    }
    // zone code typeset digits-first: "03" + "LLP," → "LLP03,"
    if (/^\d{1,4}$/.test(a) && /^LL[PRDU][,.:]?$/.test(b)) {
      merged.push(b.slice(0, 3) + a + b.slice(3));
      i += 1;
      continue;
    }
    // abbreviation tail split off with its quote: "סמנכ" + '"ל' → 'סמנכ"ל'
    if (new RegExp(`[${HEB}]$`).test(a) && /^"[א-ת]$/.test(b)) {
      merged.push(a + b);
      i += 1;
      continue;
    }
    merged.push(a);
  }

  // dual phones fused as X/Y — spaced so each side stays a detectable number
  const out: string[] = [];
  for (const t of merged) {
    const m = /^(0\d{1,2}-\d{6,7})\/(0\d{1,2}-\d{6,7})([;,.]?)$/.exec(t);
    if (m) out.push(m[1], "/", m[2] + m[3]);
    else out.push(t);
  }
  return out;
}

interface Mark {
  index: number;
  kind: "entry" | "section";
  codes: string[];
}

/**
 * Entry / section boundaries. An ENTRY is a serial marker (Hebrew serial
 * "כג.", numbered "43", "43)") whose zone code follows within the next few
 * tokens — mid-prose code references ("ראה LLP19", "לסגירת LLD35") are never
 * preceded by a serial marker and never become entries. SECTION marks are the
 * chapter's own top-level numbering ("2.", "1 .א") — they close the previous
 * entry's block so class-level paragraphs never inherit a zone code.
 */
function findMarks(tokens: string[]): Mark[] {
  const marks: Mark[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    // section forms: "2." + Hebrew heading | "1" "." "<one Hebrew letter>"
    if (/^\d{1,2}\.$/.test(t) && new RegExp(`[${HEB}]`).test(tokens[i + 1] ?? "")) {
      marks.push({ index: i, kind: "section", codes: [] });
      i += 1;
      continue;
    }
    if (
      /^\d{1,2}$/.test(t) &&
      tokens[i + 1] === "." &&
      /^[א-ת]$/.test(tokens[i + 2] ?? "")
    ) {
      marks.push({ index: i, kind: "section", codes: [] });
      i += 3;
      continue;
    }
    // entry markers
    if (/^[א-ת]{1,3}\.$/.test(t) || /^\d{1,3}\)?$/.test(t)) {
      const codes: string[] = [];
      let k = i + 1;
      let scanned = 0;
      while (k < tokens.length && scanned < 4) {
        const s = bare(tokens[k]);
        if (CODE.test(s)) {
          codes.push(s);
          if (tokens[k + 1] === "/" && CODE.test(bare(tokens[k + 2] ?? ""))) {
            codes.push(bare(tokens[k + 2]));
            k += 2;
          }
          break;
        }
        if (!/^[,"]*$/.test(tokens[k]) && tokens[k] !== ")") break;
        k += 1;
        scanned += 1;
      }
      if (codes.length > 0) {
        marks.push({ index: i, kind: "entry", codes });
        i = k + 1;
        continue;
      }
    }
    i += 1;
  }
  return marks;
}

/** Sentence tokens from `start` to the terminator / next mark, rendered. */
function readSentence(
  tokens: string[],
  start: number,
  markIndexes: Set<number>,
): { sentence: string; end: number } {
  const parts: string[] = [];
  let k = start;
  while (k < tokens.length) {
    if (k > start && markIndexes.has(k)) break; // block boundary backstop
    const t = k === start ? tokens[k].replace(/^[,.:;]+/, "") : tokens[k];
    if (t === ".") {
      parts.push(".");
      k += 1;
      break;
    }
    parts.push(t);
    if (new RegExp(`^[${HEB}]{2,}\\.$`).test(t)) {
      k += 1;
      break;
    }
    k += 1;
  }
  const sentence = parts
    .join(" ")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return { sentence, end: k };
}

/** Expand an explicit published list like "LLR90/801/802/803/83". */
function expandCodeList(token: string): string[] {
  const clean = bare(token);
  const parts = clean.split("/");
  if (!CODE.test(parts[0])) return [];
  const prefix = parts[0].slice(0, 3);
  return parts.map((p) => (CODE.test(p) ? p : prefix + p)).filter((p) => CODE.test(p));
}

const PHONE = /(?<![\w/+-])0\d{1,2}-\d{6,7}(?:\/\d)?/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function extractCoordinationContacts(
  dump: A17Dump,
  firstAppendixPage: number,
): ContactExtraction {
  const tokens = normalizeTokens(tokenize(dump, firstAppendixPage));
  const marks = findMarks(tokens);
  const markIndexes = new Set(marks.map((m) => m.index));
  const blockOf = (index: number): Mark | null => {
    let prev: Mark | null = null;
    for (const m of marks) {
      if (m.index <= index) prev = m;
      else break;
    }
    return prev;
  };

  const attachments: ContactAttachment[] = [];
  const issues: ReconIssue[] = [];
  let sentences = 0;
  let ambiguousExcluded = 0;

  let i = 0;
  while (i < tokens.length) {
    const t0 = bare(tokens[i]);
    const t1 = tokens[i + 1] ?? "";
    const t2 = tokens[i + 2] ?? "";

    // Zone-entry coordination sentences (attach to the enclosing entry's code).
    const zoneAnchor =
      (t0 === "לתיאום" && t1 === "טיסה") ||
      (t0 === "לצורך" && t1 === "תיאום") ||
      (t0 === "טרם" && t1 === "הגשת") ||
      (t0 === "עבור" && t1 === "טיסות" && t2.startsWith("רב"));
    if (zoneAnchor) {
      const { sentence, end } = readSentence(tokens, i, markIndexes);
      sentences += 1;
      const block = blockOf(i);
      if (block && block.kind === "entry") {
        for (const code of block.codes) {
          attachments.push({ code, regional: block.codes.length > 1, sentence });
        }
      } else {
        ambiguousExcluded += 1;
        issues.push({
          code: "—",
          kind: "contact-ambiguous",
          detail: `coordination sentence outside any zone entry — NOT attached (no exact-code association): "${sentence}"`,
        });
      }
      i = end;
      continue;
    }

    // Class-level blocks ("גורם המעוניין להגיש בקשה…"): attach ONLY to codes
    // the sentence itself names; nothing named → ambiguous, human review.
    if (t0 === "גורם" && t1 === "המעוניין") {
      const { sentence, end } = readSentence(tokens, i, markIndexes);
      sentences += 1;
      const named = [...new Set(sentence.split(" ").map(bare).filter((w) => CODE.test(w)))];
      if (named.length > 0) {
        for (const code of named) attachments.push({ code, regional: true, sentence });
        issues.push({
          code: named.join(", "),
          kind: "note",
          detail: `class-level coordination sentence attached ONLY to the code(s) it names explicitly — its wider class coverage ("מרחבים אלו") is NOT resolvable to codes from the text and stays unassigned: "${sentence}"`,
        });
      } else {
        ambiguousExcluded += 1;
        issues.push({
          code: "—",
          kind: "contact-ambiguous",
          detail: `class-level coordination sentence names NO zone codes — NOT attached to any zone (would require geographic/name inference, forbidden by trigger 3): "${sentence}"`,
        });
      }
      i = end;
      continue;
    }

    // Explicit multi-zone list: "בקשה לתכנית טיסה באזורים LLR90/801/802/803/83…"
    if (
      t0 === "בקשה" &&
      t1 === "לתכנית" &&
      t2 === "טיסה" &&
      bare(tokens[i + 3] ?? "") === "באזורים" &&
      expandCodeList(tokens[i + 4] ?? "").length > 1
    ) {
      const { sentence, end } = readSentence(tokens, i, markIndexes);
      sentences += 1;
      for (const code of expandCodeList(tokens[i + 4])) {
        attachments.push({ code, regional: true, sentence });
      }
      i = end;
      continue;
    }

    i += 1;
  }

  // ── completeness sweep: every phone/email accounted for ────────────────────
  const text = tokens.join(" ");
  const attachedText = attachments.map((a) => a.sentence).join(" ");
  const issueText = issues.map((x) => x.detail).join(" ");
  const phones = [...new Set(text.match(PHONE) ?? [])].sort();
  const emails = [...new Set(text.match(EMAIL) ?? [])].sort();
  let residualContacts = 0;
  let phonesAttached = 0;
  let emailsAttached = 0;
  for (const [kind, values] of [
    ["phone", phones],
    ["email", emails],
  ] as const) {
    for (const value of values) {
      if (attachedText.includes(value)) {
        if (kind === "phone") phonesAttached += 1;
        else emailsAttached += 1;
        continue;
      }
      if (issueText.includes(value)) continue; // already listed with its sentence
      residualContacts += 1;
      const at = tokens.findIndex((tok) => tok.includes(value));
      const context = tokens.slice(Math.max(0, at - 12), at + 8).join(" ");
      const block = blockOf(at);
      issues.push({
        code: block && block.kind === "entry" ? block.codes.join(", ") : "—",
        kind: "contact-unextracted",
        detail: `${kind} ${value} appears in chapter prose but was NOT extracted (no covering coordination-sentence anchor / part of a multi-conditional procedure): "…${context}…"`,
      });
    }
  }

  return {
    attachments,
    issues,
    stats: {
      sentences,
      attachments: attachments.length,
      ambiguousExcluded,
      residualContacts,
      phonesSeen: phones.length,
      phonesAttached,
      emailsSeen: emails.length,
      emailsAttached,
    },
  };
}

/**
 * Append attached sentences to their zones' notes as delimited segments:
 * `… | תיאום: <sentence>` (or `תיאום (אזורי): …` for multi-zone sentences).
 * DO-035's panel splits notes on `|` and renders phone patterns as tel: links.
 * Attachments whose code has no feature in the collection become issues —
 * never silently dropped.
 */
export function appendContactNotes(
  collection: ZoneFeatureCollection,
  attachments: ContactAttachment[],
): { attached: number; zonesCovered: number; issues: ReconIssue[] } {
  const byCode = new Map(collection.features.map((f) => [f.properties.code, f]));
  const issues: ReconIssue[] = [];
  const covered = new Set<string>();
  let attached = 0;
  for (const a of attachments) {
    const feature = byCode.get(a.code);
    if (!feature) {
      issues.push({
        code: a.code,
        kind: "contact-no-zone",
        detail: `coordination sentence associated to ${a.code} but the dataset has no such zone — NOT attached: "${a.sentence}"`,
      });
      continue;
    }
    const segment = `תיאום${a.regional ? " (אזורי)" : ""}: ${a.sentence}`;
    feature.properties.notes = feature.properties.notes
      ? `${feature.properties.notes} | ${segment}`
      : segment;
    attached += 1;
    covered.add(a.code);
  }
  return { attached, zonesCovered: covered.size, issues };
}
