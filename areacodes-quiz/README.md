# Vorwahlen-Quiz: USA · Brasilien · Indonesien

Web-App zum Lernen von Telefonvorwahlen auf einer interaktiven Karte –
für Smartphone und Desktop, komplett auf Deutsch, ohne Build-Schritt.

**Starten:** `index.html` im Browser öffnen (funktioniert auch per `file://`) oder
`python3 -m http.server` im Ordner `areacodes-quiz/` ausführen und `http://localhost:8000` öffnen.
Für GitHub Pages einfach den Ordner veröffentlichen.

## Länder

| Land | Vorwahlen | Gebiete | Gruppierung |
|---|---|---|---|
| 🇺🇸 USA | 370 Area Codes (3-stellig, inkl. Overlays) | 244 | 50 Staaten, D.C., PR, VI, GU, MP, AS |
| 🇧🇷 Brasilien | 67 DDD (11–99) | 67 | 27 Bundesstaaten + 9 Großregionen (erste Ziffer) |
| 🇮🇩 Indonesien | 298 Kode wilayah (2–3-stellig, ohne 0) | 277 | 38 Provinzen |

Umschalten über den Länder-Knopf oben in der Leiste oder im Startmenü. Einstellungen zur
Auswahl, Lernstand und gespeicherte Fehler werden **pro Land** gespeichert.

## Funktionen

- **Modi:** Lernmodus (alles beschriftet, antippen = Vorwahl, Staat/Provinz, Städte, Suche),
  Zufallsquiz (schwache Codes kommen häufiger), Der Reihe nach (numerisch ab beliebiger
  Vorwahl, Staat/Provinz für Staat/Provinz, in Brasilien auch nach Großregion), Umgekehrt
  (Gebiet markiert, Vorwahl per Nummernblock), Fehler wiederholen.
- **Feedback:** richtig = grün, Vorwahl bleibt stehen; falsch = rot aufblinken;
  nach 3 Fehlversuchen wird die Lösung gelb markiert.
- **Einstellungen:** Staaten/Provinzen (alle/keine), Großregionen (Brasilien),
  führende 0 (Indonesien), Kartenstil, Grenzdicke, Schwer-Modus, Timer, Hell/Dunkel.
- **Tasten:** P überspringen, F Vollbild, Esc Menü, Ziffern/Enter/⌫ im Umgekehrt-Modus.

Teilen sich mehrere Vorwahlen ein Gebiet (Overlays in den USA, Zusatzvorwahlen in
Indonesien), zählt ein Klick in das Gebiet als richtig; im Umgekehrt-Modus wird jede
Vorwahl akzeptiert, die das markierte Gebiet abdeckt.

## Daten und Lizenzen

- **USA:** Grenzen „North America Telephone Area Code Boundaries“ (UCLA Geoportal, 2015,
  Public Domain) via [1ec5/nanp-boundaries](https://github.com/1ec5/nanp-boundaries);
  Overlays nach 2015 und Städte: Tabelle in `tools/build_us.py`.
- **Brasilien:** Gemeindegrenzen (IBGE) via [tbrugz/geodata-br](https://github.com/tbrugz/geodata-br) (CC0),
  nach DDD verschmolzen; DDD-Zuordnung und Einwohnerzahlen aus
  [CaiqueDourado/municipios-e-estados-do-brasil](https://github.com/CaiqueDourado/municipios-e-estados-do-brasil)
  (CC BY 4.0, Basis kelvins/municipios-brasileiros, MIT).
- **Indonesien:** Kabupaten/Kota-Grenzen 2020 (Kemendagri/BIG) via
  [Alf-Anas/batas-administrasi-indonesia](https://github.com/Alf-Anas/batas-administrasi-indonesia);
  Zuordnung Kabupaten → Vorwahl: Tabelle in `tools/build_id.py`, abgeglichen mit
  [Namchee/telepon](https://github.com/Namchee/telepon) (MIT).
- Bibliotheken in `vendor/`: Leaflet 1.9.4 (BSD-2), topojson-client 3.1.0 (ISC).

**Einschränkungen:** Die US-Grenzen stammen von 2015. In Indonesien folgen Vorwahlen nicht
exakt den Verwaltungsgrenzen: Jede Kabupaten/Kota ist genau einer Haupt-Vorwahl zugeordnet,
Zusatzvorwahlen für Teilgebiete (z. B. 0336 in Jember, 0327 Kangean) zeigen auf das ganze
Gebiet der Haupt-Vorwahl.

## Daten neu erzeugen

Benötigt Python 3 und `npx mapshaper`:

```
python3 tools/build_us.py area-codes.geojson
python3 tools/build_br.py geojs-100-mun.json municipios.csv
python3 tools/build_id.py "Batas Kabupaten.shp"
```

Ergebnis: `data/us.js`, `data/br.js`, `data/id.js` (werden bei Bedarf nachgeladen).
