#!/usr/bin/env python3
"""Packt die ganze App (HTML, CSS, JS, Bibliotheken, alle drei Länder) in EINE Datei:
Vorwahlen-Quiz.html – per Doppelklick im Browser öffnen, keine Installation nötig.

Aufruf: python3 tools/build_single.py
"""
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def read(*p):
    with open(os.path.join(ROOT, *p), encoding="utf-8") as fh:
        return fh.read()


def script(code):
    # "</script" darf im eingebetteten Code nicht vorkommen
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>\n"


html = read("index.html")
html = html.replace('<link rel="stylesheet" href="vendor/leaflet.css">',
                    "<style>\n" + read("vendor", "leaflet.css") + "\n</style>")
html = html.replace('<link rel="stylesheet" href="style.css">',
                    "<style>\n" + read("style.css") + "\n</style>")
inline = (script(read("vendor", "leaflet.js")) + script(read("vendor", "topojson-client.min.js")) +
          "".join(script(read("data", cc + ".js")) for cc in ("us", "br", "id")) +
          script(read("data", "cities.js")) +
          script(read("app.js")))
old = ('<script src="vendor/leaflet.js"></script>\n<script src="vendor/topojson-client.min.js"></script>\n'
       '<script src="data/cities.js"></script>\n<script src="app.js"></script>\n')
assert old in html, "Script-Block in index.html nicht gefunden"
html = html.replace(old, inline)
out = os.path.join(ROOT, "Vorwahlen-Quiz.html")
with open(out, "w", encoding="utf-8") as fh:
    fh.write(html)
print(f"{out}: {os.path.getsize(out) // 1024} KB")
