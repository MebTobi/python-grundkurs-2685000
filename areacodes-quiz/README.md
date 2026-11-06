# Vorwahlen-Quiz: USA · Brasilien · Indonesien

Web-App zum Lernen von Telefonvorwahlen auf einer interaktiven Karte –
für Smartphone und Desktop, komplett auf Deutsch, ohne Build-Schritt.

**Starten:** `index.html` im Browser öffnen (funktioniert auch per `file://`) oder
`python3 -m http.server` im Ordner `areacodes-quiz/` ausführen und `http://localhost:8000` öffnen.
Für GitHub Pages einfach den Ordner veröffentlichen.

## Windows-Programm

Im Ordner `desktop/` liegt eine Electron-Hülle, die dieselbe App als eigenständiges
Windows-Programm verpackt (eigenes Fenster, Startmenü nicht nötig, Lernstand bleibt erhalten).

- **Fertige .exe:** GitHub → *Actions* → „Vorwahlen-Quiz Windows-Build“ → letzter Lauf →
  Artefakt *Vorwahlen-Quiz-Windows* herunterladen. Wird ein Tag `quiz-v1.0.0` gepusht,
  landen die Dateien zusätzlich als GitHub-Release.
  - `Vorwahlen-Quiz-Setup-1.0.0.exe`: Installationsprogramm (ohne Admin-Rechte, Ordner wählbar,
    Verknüpfungen auf Desktop und im Startmenü, Deinstallation über die Windows-Einstellungen).
  - `Vorwahlen-Quiz-1.0.0-portable.exe`: ohne Installation, einfach doppelklicken.
  - `Vorwahlen-Quiz-1.0.0-x64.zip`: entpacken und `Vorwahlen-Quiz.exe` starten.
- **Selbst bauen** (Windows, Node.js 20): `cd desktop`, `npm install`, `npm run dist:win`
  → Ergebnis in `desktop/dist/`. Zum Ausprobieren ohne Build: `npm start`.
- Tasten: F oder F11 = Vollbild, Strg + Plus/Minus = Zoom, Alt zeigt das Menü.
- Die Karten-Hintergründe werden online geladen; Vorwahlgebiete und Quiz funktionieren auch offline.
- Windows SmartScreen kann beim ersten Start warnen, weil die .exe nicht signiert ist
  („Weitere Informationen“ → „Trotzdem ausführen“).

## Mac-Programm (macOS)

Gleiche Electron-App als Mac-Version, je eine Datei für Apple Silicon (M1–M4, `arm64`)
und Intel-Macs (`x64`). Welche du brauchst: Apple-Menü → *Über diesen Mac* → „Chip“.

1. `Vorwahlen-Quiz-1.0.0-mac-arm64.zip` bzw. `…-mac-x64.zip` doppelklicken (entpackt die App).
2. `Vorwahlen-Quiz.app` in den Ordner *Programme* ziehen.
3. Einmalig im Terminal ausführen (die App ist nicht bei Apple registriert/notarisiert):
   ```
   xattr -cr /Applications/Vorwahlen-Quiz.app
   codesign --force --deep --sign - /Applications/Vorwahlen-Quiz.app
   ```
4. App normal starten (Launchpad oder *Programme*).

**Selbst bauen** auf einem Mac: `cd desktop`, `npm install`, `npm run dist:mac`
(erzeugt ein signiertes Universal-`.dmg` in `desktop/dist/`). Auf GitHub läuft der Mac-Build
nur manuell (*Actions* → „Run workflow“) oder bei Tags `quiz-v*`.

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
