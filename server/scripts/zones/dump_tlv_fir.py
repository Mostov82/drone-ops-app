#!/usr/bin/env python3
"""DO-036 — raw dump of the CAAI TLV_FIR layer package to intermediate JSON.

`data-sources/gis/TLV_FIR.zip` holds an Esri layer package (`TLV_FIR.lpk`),
which is a 7-zip archive containing the same file geodatabase twice (v93/v101
ArcGIS variants). We read the v101 copy's single layer `CTR` (39 features:
CTR/ATZ/CTA classes — see DECISION 2026-07-19).

GDAL's /vsizip/ cannot see inside 7-zip, so this script extracts the .lpk to a
temporary directory first (py7zr — Python-side, regeneration-only dependency;
flagged for ratification per the DO-013 tooling
pattern). The snapshot zip itself is never modified.

Output shape matches dump_gdb.py exactly (GdbDump in server/src/zones/gdb.ts):
non-interpretive raw attributes + geometry in native CRS and WGS-84.

Determinism: features sorted by FID, JSON keys sorted, coordinates rounded to
7 decimals. Rerunning on the same input is byte-identical.

Usage:
    python server/scripts/zones/dump_tlv_fir.py <repo-root> <out-dir>
"""

import io
import json
import os
import sys
import tempfile
import zipfile

import py7zr
import pyogrio.raw
import shapely
import shapely.ops
from pyproj import Transformer

ROUND = 7
ZIP_REL = "data-sources/gis/TLV_FIR.zip"
LPK_NAME = "TLV_FIR.lpk"
GDB_INNER = "v101/new_file_geodatabase_ctr.gdb"
LAYER = "CTR"
OUT_NAME = "TLV_CTR.json"


def _round_coords(geom):
    def _r(x, y, z=None):
        return (round(x, ROUND), round(y, ROUND))

    return shapely.ops.transform(_r, geom)


def _jsonable(v):
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    repo_root, out_dir = sys.argv[1], sys.argv[2]

    with zipfile.ZipFile(os.path.join(repo_root, ZIP_REL)) as outer:
        lpk_bytes = outer.read(LPK_NAME)

    with tempfile.TemporaryDirectory() as tmp:
        with py7zr.SevenZipFile(io.BytesIO(lpk_bytes)) as lpk:
            lpk.extractall(tmp)
        src = os.path.join(tmp, GDB_INNER)
        meta, fids, wkbs, field_cols = pyogrio.raw.read(src, layer=LAYER, return_fids=True)

    crs = meta["crs"]
    fields = [str(f) for f in meta["fields"]]
    transformer = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

    features = []
    for i in range(len(fids)):
        props = {fields[j]: _jsonable(field_cols[j][i]) for j in range(len(fields))}
        feat = {"fid": int(fids[i]), "properties": props}
        wkb = wkbs[i]
        if wkb is not None:
            geom2d = shapely.force_2d(shapely.from_wkb(bytes(wkb)))
            feat["geometryNative"] = json.loads(shapely.to_geojson(_round_coords(geom2d), indent=None))
            wgs = shapely.ops.transform(transformer.transform, geom2d)
            feat["geometryWgs84"] = json.loads(shapely.to_geojson(_round_coords(wgs), indent=None))
        features.append(feat)
    features.sort(key=lambda f: f["fid"])

    out = {
        "source": {"zip": ZIP_REL, "gdb": f"{LPK_NAME}!{GDB_INNER}", "layer": LAYER, "crs": crs},
        "fields": fields,
        "featureCount": len(features),
        "features": features,
    }
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, OUT_NAME)
    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print(f"{LAYER}: {len(features)} features -> {out_path}")


if __name__ == "__main__":
    main()
