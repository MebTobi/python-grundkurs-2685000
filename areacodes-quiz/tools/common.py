"""Gemeinsamer Build-Schritt: Quellpolygone -> Vorwahlgebiete -> data/<land>.js.

Jedes Quellpolygon wird über `assign` (Wert von `assign_field` -> Gebiets-ID)
einem Vorwahlgebiet zugeordnet, die Gebiete werden mit mapshaper verschmolzen,
bereinigt, vereinfacht und als TopoJSON ausgegeben.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data")


def ms(*args):
    subprocess.run(["npx", "mapshaper", *args], check=True)


def build(cc, src, assign_field, assign, codes, groups, extra_cmds=(),
          interval=600, clean=("-clean",), meta=None, strict=None, preclean=None):
    region_ids = sorted({b for c in codes.values() for b in c["b"]})
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw.json")
        ms(*src, *extra_cmds, "-o", "format=geojson", raw)
        data = json.load(open(raw, encoding="utf-8"))
        feats, seen, unassigned = [], set(), set()
        for f in data["features"]:
            props = f["properties"] or {}
            key = str(props.get(assign_field, ""))
            if key not in assign or not f["geometry"]:
                if f["geometry"] and strict:
                    unassigned.add(key + " " + str(props.get(strict, "")))
                continue
            seen.add(key)
            rid = assign[key]
            f["properties"] = {"id": rid, "st": codes[rid]["s"]}
            feats.append(f)
        if unassigned:
            sys.exit(f"Nicht zugeordnet: {sorted(unassigned)}")
        missing = sorted(set(assign) - seen)
        if missing:
            print("WARNUNG: ohne Geometrie:", missing, file=sys.stderr)
        got = {f["properties"]["id"] for f in feats}
        lost = [r for r in region_ids if r not in got]
        if lost:
            sys.exit(f"Gebiete ohne Geometrie: {lost}")
        base = os.path.join(tmp, "base.json")
        json.dump({"type": "FeatureCollection", "features": feats}, open(base, "w"))
        if preclean:
            pre = os.path.join(tmp, "pre.json")
            ms(base, *preclean, "-o", "format=geojson", pre)
            base = pre
        diss = os.path.join(tmp, "diss.json")
        ms(base, "-dissolve", "id", "copy-fields=st", "-o", "format=geojson", diss)
        topo = os.path.join(tmp, "topo.json")
        ms(diss, *clean, "-simplify", "weighted", f"interval={interval}", "keep-shapes",
           "-filter-slivers", "min-area=2km2",
           "-o", "format=topojson", "quantization=200000", topo)
        pts = os.path.join(tmp, "pts.json")
        ms(diss, "-points", "inner", "-o", "format=geojson", "precision=0.001", pts)
        topo_data = json.load(open(topo))
        labels = {f["properties"]["id"]: f["geometry"]["coordinates"]
                  for f in json.load(open(pts))["features"] if f["geometry"]}
    obj = next(iter(topo_data["objects"].values()))
    have = {g["properties"]["id"] for g in obj["geometries"] if g.get("type")}
    lost = [r for r in region_ids if r not in have]
    if lost:
        sys.exit(f"Gebiete nach Bereinigung verloren: {lost}")
    topo_data["objects"] = {"base": obj}
    payload = {"groups": groups, "codes": codes, "topo": topo_data, "labels": labels}
    if meta:
        payload.update(meta)
    path = os.path.join(OUT, cc + ".js")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("// Generiert von tools/build_%s.py – nicht von Hand bearbeiten.\n" % cc)
        fh.write("(window.AC_DATA=window.AC_DATA||{})." + cc + "=")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    print(f"{cc}: {len(codes)} Vorwahlen, {len(region_ids)} Gebiete, "
          f"{os.path.getsize(path) // 1024} KB")
