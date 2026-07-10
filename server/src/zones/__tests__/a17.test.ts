// DO-013: א'-17 dump parser — synthetic cell fixtures modeled on the real
// PDF structures (merged row-spanning cells, polygon LLUs, phantom code
// references, page-break continuations).
import { describe, expect, it } from "vitest";
import { parseA17, type A17Dump } from "../a17.js";

type Cell = { bbox: number[]; words: { bbox: number[]; text: string }[] };

function word(x: number, y: number, text: string) {
  return { bbox: [x, y, x + 10, y + 8], text };
}

/** A one-row cell at (x0..x1, y0..y1) containing words laid out left→right. */
function cell(x0: number, y0: number, x1: number, y1: number, ...texts: string[]): Cell {
  const step = (x1 - x0) / (texts.length + 1);
  return {
    bbox: [x0, y0, x1, y1],
    words: texts.map((t, i) => word(x0 + step * (i + 1), (y0 + y1) / 2 - 4, t)),
  };
}

function dump(tables: { bbox: number[]; rowCount: number; cells: Cell[] }[], text = ""): A17Dump {
  return {
    source: { pdf: "test.pdf", pageCount: 2 },
    pages: [
      { page: 1, text, tables: [] },
      { page: 2, text: "", tables },
    ],
  };
}

describe("parseA17 — appendix ג' (LLU)", () => {
  it("parses a circle row: center + radius + name + code", () => {
    const table = {
      bbox: [0, 0, 400, 40],
      rowCount: 1,
      cells: [
        cell(0, 10, 80, 30, `31°56'06"N`),
        cell(80, 10, 140, 30, `34°52'50"E`),
        cell(140, 10, 220, 30, "מטר", "1000"),
        cell(220, 10, 320, 30, "מעשיהו", "-", "איילון"),
        cell(320, 10, 400, 30, "LLU01"),
      ],
    };
    const parsed = parseA17(dump([table]));
    expect(parsed.failures).toEqual([]);
    expect(parsed.appendixC).toHaveLength(1);
    const entry = parsed.appendixC[0];
    expect(entry.code).toBe("LLU01");
    expect(entry.radiusM).toBe(1000);
    expect(entry.center?.lat).toBeCloseTo(31 + 56 / 60 + 6 / 3600, 10);
    expect(entry.center?.lng).toBeCloseTo(34 + 52 / 60 + 50 / 3600, 10);
    expect(entry.nameHe).toBe("איילון - מעשיהו");
    expect(entry.polygons).toEqual([]);
  });

  it("assigns vertices to the correct sub-polygon via the merged cell spans (LLU22 pattern)", () => {
    // 3 vertex rows under label A (cell spanning y 10..70), 3 under label B
    // (y 70..130); name+code cells span the whole group (y 10..130).
    const vertexRows = [15, 35, 55, 75, 95, 115].map((y, i) => [
      cell(0, y - 5, 80, y + 15, `30°5${i}'0${i}"N`),
      cell(80, y - 5, 140, y + 15, `34°5${i}'1${i}"E`),
    ]);
    const table = {
      bbox: [0, 0, 400, 140],
      rowCount: 6,
      cells: [
        ...vertexRows.flat(),
        cell(140, 10, 220, 70, "1", "אווירי", "מרחב"),
        cell(140, 70, 220, 130, "2", "אווירי", "מרחב"),
        cell(220, 10, 320, 130, "ירוחם"),
        cell(320, 10, 400, 130, "LLU22"),
      ],
    };
    const parsed = parseA17(dump([table]));
    expect(parsed.failures).toEqual([]);
    expect(parsed.appendixC).toHaveLength(1);
    const entry = parsed.appendixC[0];
    expect(entry.radiusM).toBeNull();
    expect(entry.polygons).toHaveLength(2);
    expect(entry.polygons[0].vertices).toHaveLength(3);
    expect(entry.polygons[1].vertices).toHaveLength(3);
    expect(entry.nameHe).toBe("ירוחם");
  });
});

describe("parseA17 — appendix ב'", () => {
  const bTable = (codeCellTexts: string[], extra: Cell[] = [], spanY1 = 70) => ({
    bbox: [0, 0, 400, spanY1 + 10],
    rowCount: 3,
    cells: [
      cell(0, 10, 90, 30, "33°", "07'", `13.65"`, "N"),
      cell(90, 10, 180, 30, "35°", "35'", `13.44"`, "E"),
      cell(0, 30, 90, 50, "33°", "07'", `05.65"`, "N"),
      cell(90, 30, 180, 50, "35°", "36'", `43.44"`, "E"),
      cell(0, 50, 90, 70, "33°", "06'", `35.65"`, "N"),
      cell(90, 50, 180, 70, "35°", "37'", `30.44"`, "E"),
      cell(180, 10, 220, spanY1, "GND"),
      cell(220, 10, 260, spanY1, "3000"),
      cell(260, 10, 330, spanY1, "החולה"),
      cell(330, 10, 400, spanY1, ...codeCellTexts),
      ...extra,
    ],
  });

  it("parses vertices, altitudes and name via the code cell's span", () => {
    const parsed = parseA17(dump([bTable(["LLP01"])]));
    expect(parsed.failures).toEqual([]);
    expect(parsed.appendixB).toHaveLength(1);
    const entry = parsed.appendixB[0];
    expect(entry.code).toBe("LLP01");
    expect(entry.vertices).toHaveLength(3);
    expect(entry.altMinRaw).toBe("GND");
    expect(entry.altMaxRaw).toBe("3000");
    expect(entry.nameHe).toBe("החולה");
    expect(entry.vertexIssues).toEqual([]);
  });

  it("does not spawn entries from definition prose that references a code", () => {
    // a note cell in the coordinate columns mentioning LLP13 (LLP172 pattern)
    const noteCell = cell(0, 70, 180, 78, "LLP13", "גבול", "לאורך", "בקשת");
    const parsed = parseA17(dump([bTable(["LLP01"], [noteCell])]));
    expect(parsed.appendixB.map((e) => e.code)).toEqual(["LLP01"]);
  });

  it("merges page-break continuations marked (המשך) and flags them", () => {
    const cont = {
      bbox: [0, 200, 400, 260],
      rowCount: 2,
      cells: [
        cell(0, 210, 90, 230, "32°", "01'", `00.00"`, "N"),
        cell(90, 210, 180, 230, "35°", "01'", `00.00"`, "E"),
        cell(330, 210, 400, 250, "LLP01", ")", "המשך", "("),
      ],
    };
    const parsed = parseA17(dump([bTable(["LLP01"]), cont]));
    expect(parsed.appendixB).toHaveLength(1);
    expect(parsed.appendixB[0].vertices).toHaveLength(4); // 3 + 1 merged
    expect(parsed.failures.some((f) => f.reason.includes("continuation"))).toBe(true);
  });

  it("records unparseable coordinate cells as vertexIssues instead of guessing", () => {
    // broken cell inside the code cell's span (LLD29 pattern from page 17)
    const broken = cell(0, 70, 90, 88, "31°", "17'", ".", "13", `00"`, "N");
    const parsed = parseA17(dump([bTable(["LLP01"], [broken], 90)]));
    expect(parsed.appendixB[0].vertices).toHaveLength(3);
    expect(parsed.appendixB[0].vertexIssues).toHaveLength(1);
  });
});

describe("parseA17 — appendix ה'", () => {
  it("parses code/name/type/AGL rows (no coordinates)", () => {
    const table = {
      bbox: [0, 0, 400, 40],
      rowCount: 1,
      cells: [
        cell(0, 10, 60, 30, "300"),
        cell(60, 10, 180, 30, "טבע", "שמורת"),
        cell(180, 10, 320, 30, "אבוקה"),
        cell(320, 10, 400, 30, "LLP2329"),
      ],
    };
    const parsed = parseA17(dump([table]));
    expect(parsed.appendixE).toHaveLength(1);
    expect(parsed.appendixE[0]).toMatchObject({
      code: "LLP2329",
      nameHe: "אבוקה",
      typeHe: "שמורת טבע",
      maxAglFt: 300,
    });
  });
});
