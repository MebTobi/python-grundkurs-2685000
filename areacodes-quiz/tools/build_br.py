#!/usr/bin/env python3
"""Erzeugt data/br.js (Brasilien, 67 DDD-Gebiete) für das Vorwahl-Quiz.

Geometrie: Gemeindegrenzen (IBGE) aus https://github.com/tbrugz/geodata-br (CC0),
Datei geojson/geojs-100-mun.json.
DDD je Gemeinde und Einwohnerzahlen (Zensus 2022): municipios.csv aus
https://github.com/CaiqueDourado/municipios-e-estados-do-brasil (CC BY 4.0,
Basisfelder aus kelvins/municipios-brasileiros, MIT).

Die Gemeinden werden nach DDD verschmolzen. Bundesstaat eines DDD = Staat seiner
größten Stadt; Städte = die drei einwohnerstärksten Gemeinden.

Aufruf: python3 tools/build_br.py geojs-100-mun.json municipios.csv
"""
import csv
import sys
from collections import defaultdict
from common import build

UF = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia",
    "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
    "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
    "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí",
    "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul",
    "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo",
    "SE": "Sergipe", "TO": "Tocantins",
}
# Erste Ziffer des DDD -> Großregion
REGIONS = {
    "1": "São Paulo", "2": "Rio de Janeiro & Espírito Santo", "3": "Minas Gerais",
    "4": "Paraná & Santa Catarina", "5": "Rio Grande do Sul",
    "6": "Zentrum-West, Tocantins, Acre & Rondônia", "7": "Bahia & Sergipe",
    "8": "Nordosten (PE, AL, PB, RN, CE, PI)", "9": "Norden (PA, AM, RR, AP, MA)",
}


def main(geo, table):
    rows = list(csv.DictReader(open(table, encoding="utf-8")))
    assign = {r["ibge_code"]: r["ddd"] for r in rows}
    by_ddd = defaultdict(list)
    for r in rows:
        pop = int(float(r["population_2022"] or 0))
        by_ddd[r["ddd"]].append((pop, r["name"], r["uf"]))
    codes = {}
    for ddd, lst in sorted(by_ddd.items()):
        lst.sort(reverse=True)
        codes[ddd] = {"s": lst[0][2], "b": [ddd], "c": [n for _, n, _ in lst[:3]]}
    assert len(codes) == 67, len(codes)
    build(cc="br", src=[geo], assign_field="id", assign=assign, codes=codes, groups=UF,
          interval=1500, clean=("-clean", "gap-fill-area=400km2"),
          meta={"regions": REGIONS})


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
