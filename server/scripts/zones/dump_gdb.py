#!/usr/bin/env python3
"""DO-013 — raw dump of the CAAI geodatabases to intermediate JSON.

Reads the read-only snapshots in data-sources/gis/ (ZONE_gdb.zip, CVFR_caai.zip)
directly through GDAL's /vsizip/ virtual filesystem — the zips are never extracted
or modified. Emits one JSON file per layer containing every feature's raw
attributes exactly as stored (no interpretation, no parsing of altitude strings)
plus its geometry both in the native CRS and reprojected to WGS-84.

This script is deliberately non-interpretive: all parsing/shaping/validation
lives in the TypeScript builders (server/src/zones/), where it is unit-tested.

Tooling note (DECISION 2026-07-10): the sanctioned
converter is GDAL. On this machine GDAL is provided by the pyogrio wheel
(vendors GDAL). Reprojection uses pyproj (PROJ).

Determinism: features sorted by FID, JSON keys sorted, coordinates rounded to
7 decimal places (~1 cm — far below the source's 0.01-arcsecond precision).
Rerunning on the same inputs yields byte-identical output.

Usage:
    python server/scripts/zones/dump_gdb.py <repo-root> <out-dir>
"""

import json
import os
import sys

import pyogrio.raw
import shapely
import shapely.ops
from pyproj import Transformer

ROUND = 7

LAYERS = [
    # (zip relative to repo root, path of .gdb inside the zip, layer name)
    ("data-sources/gis/ZONE_gdb.zip", "New File Geodatabase_ZONE.gdb", "F_Limited"),
    ("data-sources/gis/ZONE_gdb.zip", "New File Geodatabase_ZONE.gdb", "Limited_Edges"),
    ("data-sources/gis/CVFR_caai.zip", "CVFR/New File Geodatabase.gdb", "CVFR_ROUTES2023"),
    ("data-sources/gis/CVFR_caai.zip", "CVFR/New File Geodatabase.gdb", "CVFR_POINTS2023"),
]


def _round_coords(geom):
    def _r(x, y, z=None):
        # Drop Z (source Z values carry no vertical data for these layers).
        return (round(x, ROUND), round(y, ROUND))

    return shapely.ops.transform(_r, geom)


def _jsonable(v):
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    return str(v)  # numpy scalars / datetimes → their string form


def dump_layer(repo_root: str, zip_rel: str, gdb_inner: str, layer: str, out_dir: str) -> None:
    zip_abs = os.path.join(repo_root, zip_rel).replace("\\", "/")
    src = f"/vsizip/{zip_abs}/{gdb_inner}"
    meta, fids, wkbs, field_cols = pyogrio.raw.read(src, layer=layer, return_fids=True)
    crs = meta["crs"]
    fields = [str(f) for f in meta["fields"]]

    to_wgs84 = None
    if crs and crs.upper() not in ("EPSG:4326",):
        transformer = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

        def to_wgs84(geom):  # noqa: E731 — small local helper
            return shapely.ops.transform(transformer.transform, geom)

    features = []
    for i in range(len(fids)):
        props = {fields[j]: _jsonable(field_cols[j][i]) for j in range(len(fields))}
        feat = {"fid": int(fids[i]), "properties": props}
        wkb = wkbs[i]
        if wkb is not None:
            geom = shapely.from_wkb(bytes(wkb))
            geom2d = shapely.force_2d(geom)
            if to_wgs84 is not None:
                feat["geometryNative"] = json.loads(
                    shapely.to_geojson(_round_coords(geom2d), indent=None)
                )
                feat["geometryWgs84"] = json.loads(
                    shapely.to_geojson(_round_coords(to_wgs84(geom2d)), indent=None)
                )
            else:
                feat["geometryWgs84"] = json.loads(
                    shapely.to_geojson(_round_coords(geom2d), indent=None)
                )
        features.append(feat)
    features.sort(key=lambda f: f["fid"])

    out = {
        "source": {"zip": zip_rel, "gdb": gdb_inner, "layer": layer, "crs": crs},
        "fields": fields,
        "featureCount": len(features),
        "features": features,
    }
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{layer}.json")
    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, ensure_ascii=False, sort_keys=True, indent=1)
        fh.write("\n")
    print(f"{layer}: {len(features)} features -> {out_path}")


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    repo_root, out_dir = sys.argv[1], sys.argv[2]
    for zip_rel, gdb_inner, layer in LAYERS:
        dump_layer(repo_root, zip_rel, gdb_inner, layer, out_dir)


if __name__ == "__main__":
    main()
