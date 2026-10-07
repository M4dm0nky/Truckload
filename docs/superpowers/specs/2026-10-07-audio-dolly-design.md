# Dolly-Pflicht für Line-Array-Tops und Subs (Gewerk Ton)

## Kontext

Die 13 Einzelbox-Vorlagen aus „Gewerk Audio“ (V 0.10.0: 8 Array-Tops + 5 Subs, siehe
[docs/casemasse-gewichte.md](../../casemasse-gewichte.md)) stehen aktuell mit `wheelH: 0`
direkt auf dem Boden. Nach Praxiswissen des Nutzers ist das falsch – Line-Array-Elemente und
Subwoofer stehen in der Praxis **immer** auf einem Dolly mit Schwerlastrollen, nie lose auf
dem Boden. Die 8 bereits bestehenden festen „…4er/6er (auf Dolly)“-Vorlagen decken das nur für
Array-Tops und nur mit einer fest eingebackenen Stückzahl ab.

Ziel: jede der 13 Einzelbox-Vorlagen bekommt beim Hinzufügen im Lade-Wizard immer einen Dolly
untergelegt, mit einer beliebigen vom Nutzer gewählten Stückzahl übereinander – nicht mehr nur
feste 4er/6er-Pakete.

## Recherche-Stand

Keine der fünf vom Nutzer genannten Verleihfirmen (Motion, Go Audio, TSE AG, Complete Audio,
Niclen) veröffentlicht Dolly-Maße online – deckt sich mit dem Befund aus V 0.10.0 (geladene
Dolly-Geometrie wird in der Branche praktisch nirgends veröffentlicht). Gefunden wurden drei
echte, offiziell dokumentierte Sub-Dollys als Kalibrierpunkte:

| Dolly | Maße (B×T×H) | Rollen | Gewicht |
|---|---|---|---|
| Carvin DB521018 | 81×75×20 cm | 4× 127 mm Lenkrollen (2 Bremse) | 18,3 kg |
| SYNQ SQ-218 Dolly | – | 4× 100 mm Schwerlast-Gummirollen (2 Bremse) | 11 kg |
| DAS PL-EV118S | ~81×71×18 cm (Versandmaß) | – | ~11 kg |

Daraus: Dolly-Eigenhöhe (Rollen + Platte) **18 cm**, Dolly-Eigengewicht pauschal **15 kg**
(Mittelwert, dokumentiert, nicht erfunden – mit den drei Quellen belegt, CLAUDE.md „Haltung“).

## Nutzer-Korrektur zur Breite

Dollys sind so gebaut, dass 2, 3 oder 4 nebeneinander in den Standard-Sattelauflieger/
Megatrailer passen (248 cm Innenbreite, `js/data/preset-trucks.js`). Zwei vom Nutzer
durchgerechnete Beispiele:

- L-Acoustics K2 (Box-`w`-Feld = 40 cm) → Dolly-Normbreite 60 cm (4 nebeneinander, 240/248 cm).
- RCF SUB 8006-AS (Box-`w`-Feld = 71 cm, passt nicht auf 60) → Dolly-Normbreite 80 cm
  (3 nebeneinander, 240/248 cm).

Regel daraus: die Dolly-Normbreite ist das kleinere der beiden Box-Fußmaße (`w`-Feld),
aufgerundet auf die kleinste passende Stufe aus **60 / 80 / 124 cm** (= 248 ÷ 4 / ÷ 3 / ÷ 2) –
exakt das Muster, das `js/model/truss.js` für Traversenwagen schon hat
(`DOLLY_WIDTHS = [60, 80]`), hier um die 124-cm-Stufe erweitert.

**Bewusste Vereinfachung für diese Runde:** Die reale Dolly-Normbreite ändert nichts am
Fußabdruck des Cases für die Pack-Logik (bleibt `l × w` der Box, wie bisher) und wird auch
nicht separat gezeichnet. Der reale Dolly sitzt in der Praxis außerdem nicht mittig unter der
Box (vorne unter dem schwereren Teil, hinten überstehend) – auch das bleibt für diese Runde
eine reine Vereinfachung: der Dolly wird als Rollensatz unter der ganzen Box dargestellt
(Nutzer-Entscheidung: „erstmal zentriert/einfach“). Die 60/80/124-Regel fließt in dieser Runde
nur in die Dokumentation ein, nicht in eine neue Zeichenfunktion.

## Architektur-Entscheidung: dynamischer Dialog statt fester Vorlagen

- Die 8 bestehenden festen „…4er/6er (auf Dolly)“-Presets werden **entfernt** (inkl. ihrer
  Tests) – der neue Dialog deckt jede Stückzahl ab, die festen Varianten wären doppelt und
  veraltet.
- Jeder Klick auf „+“ bei einer der 13 Einzelbox-Vorlagen öffnet **immer** einen Dialog
  („Dolly-Dialog“), analog zu `openTrussDialog()` (`js/ui/truss-wizard.js`) und dessen
  Einbindung in `js/ui/load-wizard.js` (`addTruss()`). Der Dialog fragt nur die Stückzahl ab –
  keine „ohne Dolly“-Option (Nutzer-Entscheidung: „immer mit Dolly, keine Ausnahme“). Keine
  eigene Obergrenze im Dialog – die bestehende Höhen-/Gewichtsprüfung beim Platzieren im Truck
  greift wie bei jedem anderen Case (Nutzer-Entscheidung).
- Bei Bestätigung entsteht ein neuer, konkreter Case-Typ (z. B. „Nexo LS18 3er (auf Dolly)“),
  der wie beim Traversenwagen in `cases`/`counts` einsortiert wird und danach als normale Zeile
  mit normalem +/−-Stepper erscheint (gleiches Muster wie neu angelegte Wagen-Typen).
  Persistenz über einen neuen Callback (analog `opts.onNewTruss`), damit die Vorlage über
  Sitzungen hinweg erhalten bleibt.
- Geometrie der erzeugten Variante (Basisbox `b`, Stückzahl `N`):
  - `l = b.l`, `w = b.w` (Fußabdruck unverändert)
  - `wheelH = 18`, `dimsInclWheels = false` → `outerDims()` (`js/model/geometry.js`) addiert
    die 18 cm automatisch; die vorhandene 4-Rollen-Zeichnung aus `caseShape()`
    (`js/model/caseShape.js`) übernimmt die Visualisierung vollständig, ohne neuen Zeichencode
    – bei 18 cm Rollenhöhe (vs. 12–16 cm Blue Wheel) sind die Rollen sichtbar größer/wuchtiger,
    das ist die Unterscheidung von den case-üblichen Blue Wheels.
  - `h = N * b.h` (Boxhöhen gestapelt, Dolly-Höhe steckt in `wheelH`, nicht in `h`)
  - `weight = 15 + N * b.weight` (Dolly-Pauschale + Stückzahl × Boxgewicht)
  - `tippable: false`, `layers: [1]` (Stack ist der volle Turm), `category: 'Ton'`, kein
    `company`-Feld (neutral, wie alle 13 Basis-Vorlagen)

## Betroffene Bereiche

- `js/data/preset-cases.js`: die 13 Basis-Vorlagen bleiben unverändert (keine eigenen Rollen –
  die bekommen sie erst über die dynamische Dolly-Variante); ein neues Marker-Feld
  (`dollyPrompt: true`) kennzeichnet genau diese 13. Die 8 festen
  `…-4er-dolly`/`…-6er-dolly`-Presets werden entfernt.
- Eine reine, UI-unabhängige Funktion (Vorschlag: `dollyStackCase(baseCase, n)`), die die
  Geometrie-Formel oben kapselt – direkt unit-testbar, Ort je nach Umsetzung (`preset-cases.js`
  oder ein neues kleines Modul).
- Neue Datei `js/ui/dolly-wizard.js` (Struktur analog `js/ui/truss-wizard.js`):
  `openDollyDialog(dlg, { baseCase, onNewDollyStack })` – fragt Stückzahl ab, baut den neuen
  Case-Typ, speichert ihn über `onNewDollyStack`, gibt `{ newCase, addition }` zurück (vgl.
  Rückgabeform von `openTrussDialog`).
- `js/ui/load-wizard.js`: Click-Handler der Case-Liste erkennt `dollyPrompt`-Vorlagen und öffnet
  bei „+“ den Dolly-Dialog statt direkt zu inkrementieren – Rest des Flusses wie `addTruss()`.
- Ein neues `<dialog>`-Element (analog zum Traversen-Dialog) sowie das Store-Wiring für einen
  neuen `onNewDollyStack`-Callback (dort, wo `onNewTruss` heute verdrahtet ist).
- `tests/presets.test.js`: Tests für die 8 entfernten festen Presets löschen; neue Tests für
  die Geometrie-Formel.
- `docs/casemasse-gewichte.md`, `docs/architektur.md`: Dokumentation der Recherche, der
  60/80/124-Regel und des neuen Dialogs.
- `CHANGELOG.md` + Versionsnummer (Patch-Vorschlag, vor Commit bestätigen lassen).

## Verifikation

- `npm test` grün, inkl. neuer Unit-Tests für die Dolly-Geometrie-Formel.
- Browser-Probe (`tools/cdp.mjs`): Lade-Wizard, Gewerk „Ton“ → bei jeder der 13 Vorlagen öffnet
  „+“ den Dolly-Dialog; Stückzahl 3 bei einem Sub ergibt eine neue Zeile „… 3er (auf Dolly)“ mit
  korrekter Höhe/Gewicht nach der Formel; die 8 alten festen Presets tauchen nicht mehr auf.
- Typografie-Prüfung (CLAUDE.md) auf allen geänderten Dateien.
