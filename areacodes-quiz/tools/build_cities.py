#!/usr/bin/env python3
"""Erzeugt data/cities.js: die größten Städte je Land für die Kartenbeschriftung.

Quelle: Natural Earth "ne_10m_populated_places_simple" (Public Domain),
https://github.com/nvkelso/natural-earth-vector – Einwohnerzahl = pop_max (Ballungsraum).

Aufruf: python3 tools/build_cities.py ne_10m_populated_places_simple.geojson
"""
import json
import os
import sys

LIMIT = {"us": ("USA", 160), "br": ("BRA", 110), "id": ("IDN", 90)}


def main(src):
    feats = json.load(open(src, encoding="utf-8"))["features"]
    out = {}
    for cc, (a3, n) in LIMIT.items():
        rows = [f["properties"] for f in feats if f["properties"]["adm0_a3"] == a3]
        rows.sort(key=lambda p: -(p["pop_max"] or 0))
        seen, lst = set(), []
        for p in rows:
            key = (p["name"], round(p["latitude"], 1), round(p["longitude"], 1))
            if key in seen:
                continue
            seen.add(key)
            lst.append([" ".join(p["name"].split()), round(p["latitude"], 3), round(p["longitude"], 3),
                        int(p["pop_max"] or 0), 1 if p["adm0cap"] else 0])
            if len(lst) >= n:
                break
        out[cc] = lst
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "cities.js")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("// Generiert von tools/build_cities.py – Quelle: Natural Earth (Public Domain).\n")
        fh.write("window.AC_CITIES=")
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    print({k: len(v) for k, v in out.items()}, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1])
