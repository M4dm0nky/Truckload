# Truckload: Lage und Tippen je Stück im Wizard festlegen

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Vor Start nach `docs/superpowers/plans/2026-09-25-lage-tippen-je-stueck.md` kopieren
> (Projektkonvention). Steps mit `- [ ]`.

## Context

Der Nutzer will im Lade-Wizard pro Case festlegen, **wie** es geladen wird:
in welchen Lagen es stehen darf (Lage 1 = Boden … Lage 4) und ob es getippt
wird oder stehend (auf Rollen) fährt. Heute gibt es das nur am **Case-Typ**
(`layers`, `tippable`), und über das Tippen entscheidet der Packer selbst
(`chooseOrientation`, `js/model/packer.js:4`).

Nutzer-Entscheidungen (2026-09-25):
- **Je einzelnem Stück**, gespeichert am Stück im Load (nicht am Case-Typ).
  Ein neues Stück desselben Typs in einem anderen Load startet mit den
  Vorgaben.
- Häkchen: Lage 1–4 und „getippt“. **Standard: getippt.** Der automatische
  Packer richtet sich nach diesen Einstellungen: getippt heißt nur getippte
  Lagen, nicht getippt heißt nur stehend.
- Kein Knopf „auf alle übernehmen“: Standard ist getippt, man klickt nur die
  Ausnahmen.

Meine eigenen Entscheidungen (dem Nutzer so benennen):
- **Alte Stücke ohne die neuen Felder verhalten sich wie bisher:** Lagen vom
  Case-Typ, Tippen entscheidet der Packer. Alte Loads packen also unverändert.
- **Neue Stücke aus dem Wizard:** Lagen vorbelegt mit den erlaubten Lagen des
  Case-Typs (`layersOf(c)`), „getippt“ vorbelegt mit `canTip(c)`. Nicht
  tippbare Cases (Traversen, FOH-Pult …) haben das Häkchen ausgegraut und
  stehen immer.
- **Lagen, die der Case-Typ verbietet, sind im Wizard ausgegraut.** Wirksam
  ist die Schnittmenge aus Stück-Lagen und Typ-Lagen. Ist sie leer (z. B.
  weil der Typ später geändert wurde), gelten die Typ-Lagen, damit das Stück
  nicht unpackbar wird.
- **Manuelles Tippen/Aufstellen im Truck (T-Taste, Inspector) aktualisiert
  `tipped` des Stücks mit.** Sonst würde „Alles neu packen“ die Handänderung
  wieder rückgängig machen.
- Beim Ziehen aus der Liste in den Truck startet ein getipptes Stück getippt
  (`tipLong`), ein stehendes stehend.
- Nachträgliches Ändern im Inspector ist **nicht** Teil dieses Plans; kommt
  als offener Punkt nach `docs/offene-punkte.md`.

## Global Constraints (aus `CLAUDE.md`)

- Keine npm-Abhängigkeiten, kein Build-Schritt. `npm test` = `node --test`.
- Nutzereingaben in HTML nur über `esc()`. Oberfläche deutsch, „…“,
  **„tippen“, nie „kippen“**.
- Alte Daten laden weiter: fehlende Felder = altes Verhalten. Änderung am
  Datenmodell braucht einen Regressionstest mit einem Datensatz im alten Schema.
- Reine Logik per TDD (erst der fehlschlagende Test), Tests unter
  `tests/<modul>.test.js`.
- `js/ui/*` importiert nie aus `js/store/` (nur `js/app.js`).
- Eine Versionsnummer überall; Patch-Schritt 0.7.12 → 0.7.13.

## Datenmodell

Optionale Felder an Einträgen in `plan.unplaced[]` **und** `plan.placements[]`:
- `layers`: nicht leeres Array eindeutiger ganzer Zahlen 1–4.
- `tipped`: boolean.

Fehlt ein Feld, gilt das bisherige Verhalten.

## Task 1: Modell, Packer, Import (TDD)

**Dateien:** `js/model/geometry.js`, `js/model/packer.js`,
`js/model/actions.js`, `js/model/validate.js`, `js/store/io.js`, Tests in
`tests/geometry.test.js`, `tests/packer.test.js`, `tests/actions.test.js`,
`tests/validate.test.js`, `tests/io.test.js`.

- `geometry.js`: neue reine Funktionen neben `layersOf` (Zeile 29):
  - `pieceLayers(piece, c)` liefert die Schnittmenge aus `piece.layers` und
    `layersOf(c)`. Ist `piece.layers` nicht gesetzt oder die Schnittmenge
    leer, gilt `layersOf(c)`.
  - `pieceOrientations(piece, c)`:
    - `!c.tippable` ergibt `['standing']`.
    - `tipped === true` ergibt `['tipLong','tipShort']`.
    - `tipped === false` ergibt `['standing']`.
    - sonst `ORIENTATIONS`.
- `packer.js`:
  - `chooseOrientation(c, truck, piece = {})` nutzt `pieceOrientations` statt
    `c.tippable ? ORIENTATIONS : ['standing']` und `pieceLayers` für `cap`.
  - `buildStacks` übergibt `it` an `chooseOrientation` und nutzt
    `pieceLayers(it, c)` statt `layersOf(c)` (in `withFloor`/`withoutFloor`,
    `maxLayer`/`minLayer`, `addTo`).
  - `autoPack` schreibt `layers`/`tipped` des Stücks in das Placement, wenn
    vorhanden (wie heute label/color).
- `actions.js`:
  - `addUnplaced` nimmt zusätzlich `{ layers, tipped }` an und schreibt sie,
    wenn gesetzt.
  - `toPiece` reicht beide weiter.
  - `placeCase` übernimmt beide aus dem Ablage-Eintrag. Startorientierung:
    `tipped === true && canTip(c) ? 'tipLong' : 'standing'`.
  - `placementToUnplaced` und der Ablage-Zweig von `duplicate` behalten beide.
  - `cycleTip` setzt `tipped` passend zur neuen Orientierung.
- `validate.js`:
  - `buildItems` hängt `layers`/`tipped` aus `p` an `it`.
  - Die Lagenprüfung (Zeilen ~146-149) nutzt `pieceLayers(it.p, it.c)`.
- `io.js`: `placementOk`/`unplacedOk` akzeptieren fehlendes oder gültiges
  `layers` (Array, 1–4, eindeutig, nicht leer) und `tipped` (boolean) und
  lehnen alles andere ab.
- Tests:
  - Packer mit `tipped:true` wählt nur `tipLong`/`tipShort`, mit
    `tipped:false` nur `standing`.
  - `layers:[1]` landet nie auf einem Stapel.
  - Ein Stück ohne Felder packt exakt wie vorher (Regression).
  - `placeCase`: Startorientierung und Übernahme der Felder.
  - `cycleTip` aktualisiert `tipped`.
  - Validate meldet eine Lage außerhalb der Stück-Lagen.
  - `io`: Plan im alten Schema (ohne Felder) lädt, ungültige Werte werden
    abgelehnt.
- [ ] `npm test` grün, Commit `feat: Lage und Tippen je Stück im Modell und Packer`

## Task 2: Wizard-Häkchen und Verdrahtung

**Dateien:** `js/ui/load-wizard.js`, `js/app.js`, `css/app.css`,
`README.md` (Abschnitt „Neuen Load anlegen“, Schritt 3),
`docs/architektur.md` (Datenmodell-Abschnitt „Stück“),
`docs/offene-punkte.md`.

- `load-wizard.js`:
  - `itemsState` wird zu `{ label, color, layers, tipped }`, vorbelegt mit
    `layersOf(c)` und `canTip(c)`.
  - `renderGroups()` hängt je Stück-Zeile an: „Lage“ mit 4 Checkboxen
    (`data-layer`, nicht erlaubte `disabled`) und eine Checkbox „getippt“
    (`disabled`, wenn `!canTip(c)`).
  - Der Input-Listener schreibt die Werte. Die letzte angehakte Lage lässt
    sich nicht abwählen (Häkchen bleibt, kurzer Hinweis).
  - Das Ergebnis `items` enthält `layers` und `tipped`.
- `app.js` `runLoadWizard`: `A.addUnplaced(..., { labels, color, layers, tipped })`.
- `css/app.css`: kompakte Zeile, z. B. `.wiz-item` als Grid
  (Beschriftung | Farbe | Lagen | getippt), die bei schmaler Breite umbricht.
- Doku:
  - README Schritt 3 um Lage/Tippen ergänzen.
  - `architektur.md` um die zwei Stück-Felder und ihre Rückfall-Regel
    ergänzen.
  - Offener Punkt: „Lage/Tippen nach dem Wizard im Inspector ändern“.
- [ ] `npm test` grün, CDP-Abnahme (unten), Commit `feat: Lage und Tippen je Stück im Wizard wählen`

## Verifikation

- `npm test` grün, inklusive Regressionstests im alten Schema.
- Browser (CDP, `tools/cdp.mjs`, Prüf-Fahrzeug passend klein wählen, siehe
  „Fallstrick 3D“ in CLAUDE.md):
  1. Wizard: 4 Kabelcases wählen. Alle stehen auf „getippt“ mit Lage 1–4.
  2. Bei Stück 1 „getippt“ abwählen, bei Stück 2 nur Lage 1 lassen.
     Mit „automatisch packen“ abschließen.
  3. Prüfen:
     - Stück 1 steht (`orientation: 'standing'`).
     - Die anderen sind getippt.
     - Stück 2 liegt am Boden (z = 0) und trägt nichts unter sich.
     - Keine Warnungen.
  4. Seite neu laden, Plan öffnen, „Alles neu packen“: gleiches Ergebnis.
  5. Einen alten Plan (Import einer Sicherung ohne die Felder) öffnen und neu
     packen: Ergebnis wie vor der Änderung.
  6. Screenshot 2D-Seiten-/Rückansicht als Beleg.
- Danach Version 0.7.13 nennen, committen, pushen, veröffentlichen.
