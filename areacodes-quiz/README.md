# US-Vorwahlen Quiz

Web-App zum Lernen der US-Telefonvorwahlen (Area Codes) auf einer interaktiven Karte –
für Smartphone und Desktop, komplett auf Deutsch, ohne Build-Schritt.

**Starten:** `index.html` im Browser öffnen (funktioniert auch per `file://`) oder z. B.
`python3 -m http.server` im Ordner `areacodes-quiz/` ausführen und `http://localhost:8000` öffnen.
Für GitHub Pages einfach den Ordner veröffentlichen.

## Funktionen

- Vollbildkarte (Leaflet, OpenStreetMap/CARTO-Kacheln, Esri-Satellit) mit allen 370 Vorwahlen
  der 50 Staaten, D.C. und der Territorien (PR, VI, GU, MP, AS) – inkl. Overlays.
- Modi: **Lernmodus** (alles beschriftet, antippen = Vorwahl, Staat, Städte, Suche),
  **Zufallsquiz** (schwache Codes kommen häufiger), **Der Reihe nach** (numerisch ab
  beliebiger Vorwahl oder Staat für Staat ab beliebigem Staat), **Umgekehrt**
  (Gebiet markiert, Vorwahl per Nummernblock eintippen), **Fehler wiederholen**.
- Feedback: richtig = grün + Vorwahl bleibt stehen; falsch = rot aufblinken;
  nach 3 Fehlversuchen wird die Lösung gelb markiert.
- Einstellungen: Bundesstaaten-Auswahl, Kartenstil (hell/dunkel/Satellit/leer),
  Grenzdicke, Schwer-Modus (keine Staatsgrenzen/Ortsnamen), Timer, Hell/Dunkel-Design.
- Ergebnis mit Zeit, Trefferquote und Fehlerliste; Lernstand pro Vorwahl in `localStorage`.
- Tasten: **P** überspringen, **F** Vollbild, **Esc** Menü, Ziffern/Enter/⌫ im Umgekehrt-Modus.

## Overlays

Viele Gebiete haben mehrere Vorwahlen (z. B. Manhattan: 212, 646, 332 und 917).
Im Karten-Quiz zählt ein Klick als richtig, wenn er in einem Gebiet der gefragten Vorwahl liegt.
Im Umgekehrt-Modus wird jede Vorwahl akzeptiert, die das markierte Gebiet abdeckt.

## Daten

- Gebietsgrenzen: „North America Telephone Area Code Boundaries“ (UCLA Geoportal, 2015,
  Public Domain), via [1ec5/nanp-boundaries](https://github.com/1ec5/nanp-boundaries).
- Overlays nach 2015, Städte und Zuordnungen: Tabelle in `tools/build_data.py`.
- Neu erzeugen: `python3 tools/build_data.py area-codes.geojson` (benötigt `npx mapshaper`).
  Ergebnis: `data/codes.js` und `data/geo.js`.

Hinweis: Die Grenzen stammen von 2015 und sind vereinfacht; kleinere Grenzverschiebungen
seither sind nicht enthalten. Neue Vorwahlen entstehen heute fast nur als Overlays
und lassen sich in der Tabelle ergänzen.

Bibliotheken (in `vendor/`): Leaflet 1.9.4 (BSD-2), topojson-client 3.1.0 (ISC).
