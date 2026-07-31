#!/usr/bin/env python3
"""DO-013 — raw dump of AIP א'-17 (prohibited/restricted/danger areas) to JSON.

Extracts, per PDF page: the full text layer (as stored — Hebrew is in VISUAL
order in this PDF) and every detected table's rows, where each row carries the
words inside its rectangle with their bounding boxes. No interpretation happens
here — classification of appendices, row parsing, DMS parsing, and Hebrew
visual→logical repair all live in the TypeScript builders (server/src/zones/),
where they are unit-tested against these exact strings.

Tooling: PyMuPDF (chosen PDF text-extraction tool for DO-013 — word-level
bounding boxes make table row/column association deterministic where plain
pdftotext output is ambiguous).

Determinism: pages in order, tables in reading order, words sorted by
(y0, x0) rounded to 2 decimals; rerun on the same PDF is byte-identical.

Usage:
    python server/scripts/zones/dump_a17.py <pdf-path> <out-json>
"""

import json
import sys

import pymupdf


def dump(pdf_path: str, out_path: str) -> None:
    doc = pymupdf.open(pdf_path)
    pages = []
    for page in doc:
        words = page.get_text("words")  # (x0, y0, x1, y1, text, block, line, word)
        word_list = [
            {
                "bbox": [round(w[0], 2), round(w[1], 2), round(w[2], 2), round(w[3], 2)],
                "text": w[4],
            }
            for w in words
        ]
        word_list.sort(key=lambda w: (w["bbox"][1], w["bbox"][0]))

        tables = []
        for tab in page.find_tables().tables:
            # Collect unique cell rectangles. PyMuPDF lists a merged cell's full
            # rectangle once (on its first row) and None for the spanned slots —
            # the rects therefore encode row/column spans exactly as ruled in
            # the PDF, which is what makes zone↔vertex association deterministic.
            seen = set()
            cells = []
            for row in tab.rows:
                for cell in row.cells:
                    if cell is None:
                        continue
                    key = tuple(round(v, 2) for v in cell)
                    if key in seen:
                        continue
                    seen.add(key)
                    x0, y0, x1, y1 = key
                    inside = [
                        w
                        for w in word_list
                        if x0 - 0.5 <= (w["bbox"][0] + w["bbox"][2]) / 2 <= x1 + 0.5
                        and y0 - 0.5 <= (w["bbox"][1] + w["bbox"][3]) / 2 <= y1 + 0.5
                    ]
                    cells.append({"bbox": list(key), "words": inside})
            cells.sort(key=lambda c: (c["bbox"][1], c["bbox"][0]))
            tables.append(
                {
                    "bbox": [round(v, 2) for v in tab.bbox],
                    "rowCount": len(tab.rows),
                    "cells": cells,
                }
            )

        pages.append(
            {
                "page": page.number + 1,
                "text": page.get_text("text"),
                "tables": tables,
            }
        )

    out = {"source": {"pdf": pdf_path.replace("\\", "/").split("/")[-1], "pageCount": doc.page_count}, "pages": pages}
    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print(f"{doc.page_count} pages -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    dump(sys.argv[1], sys.argv[2])
