#!/usr/bin/env python3
"""DO-013 (session 3) — raw dump of the INPA RATAG KMZ to JSON.

Input is the CAAI-hosted INPA closures layer `data-sources/gis/RATAG_kmz.zip`
(a zip holding one inner .kmz, itself a zip holding `doc.kml`). Each KML
Placemark carries an HTML attribute table in its <description> (Name, Code,
minAlt, maxAlt, Alt, aipType, reasoning, Place, AreaKM2, SeaLevelMa) and a
Polygon/MultiGeometry in WGS-84.

No interpretation happens here — pairing against the governing appendix ה'
entries, cross-checks and reconciliation live in the TypeScript builder
(server/src/zones/builders/inpa.ts), where they are unit-tested.

Tooling: Python stdlib only (zipfile / xml.etree / re) — within the DO-013
sanctioned envelope; no new dependencies.

Determinism: placemarks in document order; coordinates kept exactly as parsed
(float repr); rerun on the same zip is byte-identical.

Usage:
    python server/scripts/zones/dump_ratag.py <ratag-zip-path> <out-json>
"""

import io
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

KML_NS = "{http://www.opengis.net/kml/2.2}"

FIELD_KEYS = [
    "Name", "AreaKM2", "Code", "minAlt", "maxAlt",
    "aipType", "Alt", "reasoning", "Place", "SeaLevelMa",
]


def read_doc_kml(zip_path: str):
    """Outer zip -> inner .kmz -> doc.kml text, plus the inner kmz name."""
    with zipfile.ZipFile(zip_path) as outer:
        kmz_names = [n for n in outer.namelist() if n.lower().endswith(".kmz")]
        if len(kmz_names) != 1:
            raise SystemExit(f"expected exactly one inner .kmz, found: {kmz_names}")
        with zipfile.ZipFile(io.BytesIO(outer.read(kmz_names[0]))) as inner:
            kml_names = [n for n in inner.namelist() if n.lower().endswith(".kml")]
            if len(kml_names) != 1:
                raise SystemExit(f"expected exactly one .kml, found: {kml_names}")
            return inner.read(kml_names[0]).decode("utf-8"), kmz_names[0]


def parse_fields(description_html: str):
    """The description is an HTML table of <td>key</td><td>value</td> rows."""
    fields = {}
    for key in FIELD_KEYS:
        m = re.search(r"<td>%s</td>\s*<td>(.*?)</td>" % re.escape(key), description_html, re.S)
        fields[key] = m.group(1).strip() if m else None
    return fields


def parse_ring(coord_text: str):
    ring = []
    for token in coord_text.split():
        parts = token.split(",")
        if len(parts) < 2:
            raise SystemExit(f"malformed coordinate token: {token!r}")
        ring.append([float(parts[0]), float(parts[1])])  # lon, lat; altitude dropped
    return ring


def parse_polygon(poly_el):
    outer = poly_el.find(f"{KML_NS}outerBoundaryIs/{KML_NS}LinearRing/{KML_NS}coordinates")
    if outer is None or not (outer.text or "").strip():
        raise SystemExit("polygon without outer ring coordinates")
    rings = [parse_ring(outer.text)]
    for inner in poly_el.findall(f"{KML_NS}innerBoundaryIs/{KML_NS}LinearRing/{KML_NS}coordinates"):
        if (inner.text or "").strip():
            rings.append(parse_ring(inner.text))
    return rings


def parse_geometry(pm_el):
    polygons = [parse_polygon(p) for p in pm_el.iter(f"{KML_NS}Polygon")]
    if not polygons:
        return None
    if len(polygons) == 1:
        return {"type": "Polygon", "coordinates": polygons[0]}
    return {"type": "MultiPolygon", "coordinates": polygons}


def dump(zip_path: str, out_path: str) -> None:
    kml_text, inner_kmz = read_doc_kml(zip_path)
    root = ET.fromstring(kml_text)
    placemarks = []
    for pm in root.iter(f"{KML_NS}Placemark"):
        desc = pm.find(f"{KML_NS}description")
        fields = parse_fields(desc.text or "") if desc is not None else {k: None for k in FIELD_KEYS}
        placemarks.append({
            "id": pm.get("id"),
            "fields": fields,
            "geometry": parse_geometry(pm),
        })
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {"sourceZip": zip_path.replace("\\", "/").split("/")[-1], "innerKmz": inner_kmz, "placemarks": placemarks},
            f, ensure_ascii=False, indent=1,
        )
        f.write("\n")
    print(f"{out_path}: {len(placemarks)} placemarks")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    dump(sys.argv[1], sys.argv[2])
