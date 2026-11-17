# Dicht laden – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Nach Freigabe wird dieser Plan nach `docs/superpowers/plans/2026-11-17-dicht-laden.md` kopiert
> (Branch `feat/dicht-laden`, dort liegt schon die Spec). **Videos sind NICHT Teil dieses Plans**
> (Nutzer, 2026-11-17: „mach nichts mit Videos, erst andere Sachen“).

**Goal:** Drei Vorlagen tippbar machen, eine anklickbare Lade-Option „Reihen planen“ bauen, die jede Reihe mit Stapeln desselben Gewerks dicht füllt, und Bodenlücken vor der letzten Reihe als Warnung melden.

**Architecture:** Die Stapelbildung (`buildStacks`) bleibt unverändert. Neu ist ein zweites Aufstell-Verfahren `planRows` neben `placeStacks` in einer eigenen Datei; `autoPack` wählt per `rowPlan`. Reihenmodell und Lückenmessung leben in einer reinen Modul-Datei, die Packer-Test und Warnung (`validatePlan`) gemeinsam nutzen. Das Plan-Feld `rowPlan` folgt exakt dem Muster `mixTop`.

**Tech Stack:** Vanilla JS (ES-Module), `node --test`, headless Chrome über `tools/cdp.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-17-dicht-laden-design.md`

## Global Constraints

- Nicht tippbar bleiben nur `preset-rack-*` und `preset-foh-pult`; tippbar werden `preset-mh-2er`, `preset-led-8er`, `preset-distro-63a`.
- Plan-Feld `rowPlan: true`, fehlt = aus; Vorgabe aus. Regelsets tragen es wie `mixTop`.
- Füllstapel nur, wenn `belongsTogether` mit der führenden Sorte (gleiche Gruppe bzw. ohne Gruppe gleiches Gewerk `category`). Traversenwagen (`isTruss`) nie als Füllstück, füllen nie fremde Reihen.
- Lücke = freie Bodenfläche quer in einer Reihe oder längs zwischen Reihen, **vor der letzten Reihe**; Höhe zählt nicht; Radkästen/Hindernisse sind keine Lücke; Mindestgröße: kleinste Grundfläche eines Stücks dieses LKW (getippt/stehend, gedreht), mindestens 25 × 25 cm.
- Warntext: „Lücke {b} × {t} cm in Reihe {n}“ (Reihe ab Stirnwand gezählt, b quer, t längs).
- Reihe = Kette von Stapeln/Stücken mit überlappenden x-Bereichen; letzte Reihe = größtes x0 je LKW.
- „Aus“: Golden-Tests (`tests/packer-golden.test.js`) unverändert grün.
- Rechenzeit: 300 Stücke mit `rowPlan` < 1 s.
- Keine nativen Dialoge, keine Netzabrufe, kein neuer Store (NYX, `docs/nyx-host.md`).
- Texte Deutsch im Code, Englisch in `js/i18n/en.js` (i18n-Test prüft Vollständigkeit).

## Review Focus

1. **Ladung nur aus einem Gewerk mit krummer Breite** (z. B. nur 100-cm-Cases in 245 cm): „Reihen planen“ darf nichts Fremdes reinholen, die Restbreite bleibt, die Warnung meldet sie – Test in Task 4.
2. **Transporter mit Radkästen:** Reihen mit Hindernis dürfen nicht abstürzen oder Stapel verlieren; Radkasten ist keine Lücke – Tests in Task 3 und Task 4.
3. **Mehr-LKW-Plan:** Warnung und letzte Reihe je LKW, nicht über alle LKW – Test in Task 3.
4. **Von Hand verschobene Stücke** mit leicht versetztem x: Reihenbildung über Überlappung, keine Geisterlücke durch 1-cm-Versatz – Test in Task 2.
5. **„Rest einpacken“ mit `rowPlan` an:** nichts vor `startX` – Test in Task 4.

---

### Task 1: Vorlagen tippbar

**Files:**
- Modify: `data/standard.json` (Einträge `preset-mh-2er`, `preset-led-8er`, `preset-distro-63a`)
- Test: `tests/dataJson.test.js`

- [ ] **Step 1: Failing test** `standard.json: Tippbarkeit nach Praxis` – lädt `data/standard.json`, erwartet `tippable === true` für die drei IDs und `tippable !== true` für `preset-rack-12he`, `preset-rack-20he`, `preset-foh-pult`.
- [ ] **Step 2:** `node --test tests/dataJson.test.js` → FAIL (drei IDs nicht tippbar).
- [ ] **Step 3:** Die drei Einträge auf `"tippable": true` setzen. Prüfen, dass tipped-Maße die Truckhöhe nicht verletzen ist Sache von `chooseOrientation` (keine Änderung).
- [ ] **Step 4:** `npm test` → PASS (inkl. Golden-Tests; falls ein Golden-Test die drei Presets nutzt und kippt, Ursache melden, nicht Erwartung anpassen).
- [ ] **Step 5:** Commit `fix(data): Moving-Head-, LED-Wall-Case und Stromverteiler tippbar`.

### Task 2: Reihenmodell und Lückenmessung (reines Modul)

**Files:**
- Create: `js/model/rows.js`
- Test: `tests/rows.test.js`

**Interfaces:**
- Produces:
  - `groupRows(boxes) → Array<{ x0, x1, boxes }>` – `boxes`: `{ x0, x1, y0, y1 }`; Kette überlappender x-Bereiche (Überlappung > `EPS` aus `geometry.js`), sortiert nach x0.
  - `floorGaps(boxes, truck, { obstacles = [], minSize = 25 }) → Array<{ row, x0, x1, y0, y1, w, d }>` – nur Reihen vor der letzten; freie Rechtecke im Reihen-Band `[row.x0,row.x1] × [0,truck.w]` abzüglich belegter Grundflächen und Hindernisse; zurückgegeben werden nur Rechtecke mit `w >= minSize && d >= minSize` (w quer = y-Ausdehnung, d längs = x-Ausdehnung); `row` 1-basiert.
  - `freeFloorArea(boxes, truck, { obstacles = [] }) → number` – Summe (Reihentiefe × truck.w − belegt − Hindernisfläche im Band) über alle Reihen vor der letzten (Spec „Festlegung 4“).
  - `minFootprint(pieces, caseById) → number` – kleinste Kante der kleinsten möglichen Grundfläche über alle Stücke (Orientierungen aus `pieceOrientations`, Maße aus `effectiveDims`), mindestens 25.

- [ ] **Step 1: Failing tests** in `tests/rows.test.js`:
  - `groupRows: überlappende x bilden eine Reihe, 1 cm Versatz bleibt eine Reihe` (Boxen x 0–100 und 1–101 → 1 Reihe; 0–100 und 100–200 → 2 Reihen).
  - `floorGaps: 2×100 in 245 mit Reihe dahinter → eine Lücke 45 breit` (truck.w 245, Reihe 1: y 0–100, 100–200 bei x 0–120; Reihe 2 bei x 120–240 voll) → genau 1 Gap mit `w === 45`, `row === 1`.
  - `floorGaps: 3×80 in 245 → keine Lücke` (Rest 5 < 25).
  - `floorGaps: Lücke nur in der letzten Reihe → keine Lücke`.
  - `floorGaps: Längslücke` (Reihe 1: Stapel tief 120 und 80 nebeneinander, Reihe 2 dahinter) → Gap `d === 40`.
  - `floorGaps: Radkasten zählt nicht` (Hindernis füllt die freie Fläche) → keine Lücke.
  - `freeFloorArea` für das 2×100-Beispiel = 45 × 120.
  - `minFootprint` mit einem 60×60×60-Packcase und einem 120×80-Case → 60.
- [ ] **Step 2:** `node --test tests/rows.test.js` → FAIL (Modul fehlt).
- [ ] **Step 3:** `js/model/rows.js` implementieren. Freie Rechtecke: Reihen-Band in y-Streifen an allen y-Kanten der Boxen zerlegen, je Streifen die belegten x-Intervalle abziehen, benachbarte gleich breite Reste zusammenfassen (maximale Rechtecke nicht nötig; die Mindestgröße gilt je Rechteck).
- [ ] **Step 4:** `node --test tests/rows.test.js` → PASS.
- [ ] **Step 5:** Commit `feat(model): Reihenmodell und Lückenmessung`.

### Task 3: Lücken-Warnung in `validatePlan`

**Files:**
- Modify: `js/model/validate.js` (nach den Grenz-/Kollisionsprüfungen)
- Modify: `js/i18n/en.js`
- Test: `tests/validate.test.js`

**Interfaces:**
- Consumes: `groupRows`, `floorGaps`, `minFootprint` aus Task 2.
- Produces: Issue `{ placementId: null, code: 'gap', message }`, Text `t('Lücke {b} × {t} cm in Reihe {n}', { b, t, n })` mit gerundeten cm.

- [ ] **Step 1: Failing tests** in `tests/validate.test.js` mit echten Plan-Formen (Placements wie aus `autoPack`, Cases aus `data/standard.json` bzw. Test-Cases mit Maßen):
  - `validatePlan: Lücke vor der letzten Reihe wird gemeldet` (2×100-Beispiel) → genau ein Issue `code 'gap'`, Text „Lücke 45 × 120 cm in Reihe 1“.
  - `validatePlan: keine Lücke bei 3×80`.
  - `validatePlan: Radkasten im Transporter ist keine Lücke` (Truck mit `archBoxes`).
  - `validatePlan: Mehr-LKW – je LKW eigene letzte Reihe` (Plan mit `lkws`, so wie `validatePlan` heute je LKW aufgerufen wird; Aufrufort prüfen und dort testen).
- [ ] **Step 2:** `node --test tests/validate.test.js` → FAIL.
- [ ] **Step 3:** In `validatePlan`: Boden-Boxen = Grundflächen aller Items mit `box.z0 <= EPS`; `floorGaps(boxes, truck, { obstacles: archBoxes(truck), minSize: minFootprint(pieces, caseById) })`; je Gap `add(null, 'gap', …)`. Englischen Text in `en.js` ergänzen („Gap {b} × {t} cm in row {n}“).
- [ ] **Step 4:** `npm test` → PASS (i18n-Vollständigkeit inklusive).
- [ ] **Step 5:** Commit `feat(validate): Lücken vor der letzten Reihe melden`.

### Task 4: Reihenplaner `planRows` und Anschluss an `autoPack`

**Files:**
- Create: `js/model/rowPlanner.js`
- Modify: `js/model/packer.js` (`autoPack`: neue Option `rowPlan`), `js/model/packer.js` exportiert `belongsTogether` (heute modul-intern, Z. 58)
- Test: `tests/rowPlanner.test.js`, `tests/packer-property.test.js`

**Interfaces:**
- Consumes: Stapel aus `buildStacks` (Felder `dx, dy, height, sort, block, items, ownWeight, mixed`), `freeFloorArea` aus Task 2, `isTruss`/`archBoxes`/`overlaps` aus `geometry.js`, `belongsTogether(a, ca, b, cb)`.
- Produces:
  - `planRows(stacks, truck, obstacles = [], { startX = 0 }) → { placed: Array<{ stack, box, swap }>, failed: Array<stack> }` – gleiche Rückgabeform wie `placeStacks`.
  - `autoPack(items, truck, { …, rowPlan = false })` – bei `rowPlan` `planRows` statt `placeStacks`, sonst unverändert.

- [ ] **Step 1: Failing tests** in `tests/rowPlanner.test.js` (Stücke wie aus `toPiece`, Cases mit `category`):
  - `rowPlan füllt 100er-Reihe mit 40er-Stapel desselben Gewerks` (Licht: 4×100 breit, 2×40 breit; truck.w 245) → keine Reihe mit Rest ≥ 40; `freeFloorArea` mit `rowPlan` < ohne.
  - `rowPlan holt nichts aus fremdem Gewerk` (Licht 100er + Ton 40er) → Ton-Stapel stehen nicht in Licht-Reihen; Restbreite bleibt (Review Focus 1).
  - `rowPlan: Traversenwagen nie als Füllstück und zuletzt` (Rangliste mit Traversen zuletzt).
  - `rowPlan: schwerere Stapel einer Sorte weiter vorn` (ownWeight absteigend über die Reihen).
  - `rowPlan: Rest einpacken – nichts vor startX` (Review Focus 5).
  - `rowPlan: Transporter mit Radkästen – alle Stapel platziert oder in failed, keine Überlappung` (Review Focus 2).
  - `rowPlan: 300 Stücke < 1000 ms`.
- [ ] **Step 2:** `node --test tests/rowPlanner.test.js` → FAIL.
- [ ] **Step 3:** `planRows` implementieren:
  - Offene Stapel je Sorte in Ranglisten-Reihenfolge (`stack.sort`), innerhalb der Sorte nach `ownWeight` absteigend, `mixed` zuletzt (wie `placeStacks`).
  - Reihe beginnt bei `x = max(startX, Ende der vorigen Reihe)`. Führende Sorte = erste mit offenen Stapeln; ihre Stapel nebeneinander, solange sie in die Breite passen (ungedreht oder `swap`).
  - Restbreite: aus offenen Stapeln späterer Sorten mit `belongsTogether` zur führenden Sorte und nicht `isTruss` die Kombination wählen, die die Restbreite am besten füllt (Rucksack über ganzzahlige cm-Breiten, Kandidaten je Grundfläche zusammengefasst); Bewertung = freie Fläche der Reihe (Breitenrest × Reihentiefe + Tiefenunterschiede), Gleichstand: kleinere Ranglisten-Distanz, dann weniger Stapel.
  - Hindernis: Findet ein Stapel an der geplanten Stelle keinen Platz, Eckensuche wie `placeStacks` ab Reihen-x0; nächste Reihe hinter dem größten belegten x1.
- [ ] **Step 4:** `autoPack` um `rowPlan` erweitern; `belongsTogether` exportieren. `node --test tests/rowPlanner.test.js` → PASS.
- [ ] **Step 5:** In `tests/packer-property.test.js` die bestehenden Eigenschaften (keine Überlappung, in den Grenzen, Gewicht/Lagen) zusätzlich mit `rowPlan: true` laufen lassen. `npm test` → PASS, Golden unverändert.
- [ ] **Step 6:** Commit `feat(packer): Reihen planen (dicht laden)`.

### Task 5: Plan-Feld `rowPlan`, Regelsets, Dialog

**Files:**
- Modify: `js/model/packRules.js` (`rowPlanFor`), `js/model/actions.js` (`setRowPlan`; `autoPack`-Aufrufe Z. ~308 und ~330 mit `rowPlan: rowPlanFor(plan)`), `js/store/io.js` (Prüfung bei Plan Z. ~172 und Regelset Z. ~200), `js/app/persistence.js` (`saveRuleSet` Z. 244: `rowPlan` mitspeichern), `js/ui/pack-rules.js` (Häkchen unter „Deckschicht mischen“, Übernahme aus Regelset Z. ~150, Rückgabe `{ rules, mixTop, rowPlan, repack }`), `js/app/planView.js` (Z. ~326/337: `rowPlan` übergeben, `A.setRowPlan`), `js/app/core.js` (`packRulesTitle`: Zusatz „· Reihen planen an“), `js/i18n/en.js`
- Test: `tests/actions.test.js`, `tests/io.test.js`, `tests/pack-rules-sets.test.js`

**Interfaces:**
- Consumes: `autoPack(…, { rowPlan })` aus Task 4.
- Produces: `rowPlanFor(plan) → boolean` (`plan?.rowPlan === true`); `setRowPlan(plan, on) → plan` (gleiche Referenz bei unverändert, Feld entfernen bei aus – wie `setMixTop`).

- [ ] **Step 1: Failing tests:**
  - `actions: setRowPlan setzt/entfernt Feld, unverändert = gleiche Referenz`.
  - `actions: packAll nutzt rowPlan des Plans` (Plan mit `rowPlan: true` packt wie `autoPack(…, { rowPlan: true })`).
  - `io: Plan mit rowPlan true/fehlend ok, rowPlan "ja" → Fehler`; dasselbe für Regelsets.
  - `pack-rules-sets: Regelset speichert und überträgt rowPlan`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Umsetzen nach dem `mixTop`-Muster an allen genannten Stellen. Dialogtext: „Reihen planen: jede Reihe so dicht wie möglich füllen, auch mit Cases späterer Sorten desselben Gewerks“; Englisch in `en.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Browser-Abnahme headless (`tools/cdp.mjs`, Szenario im Scratchpad, nur `preset-*`-Cases): Pack-Regeln öffnen → Häkchen sichtbar; Häkchen + „Speichern und neu packen“ ändert Placements; Warnliste zeigt „Lücke …“ ohne Häkchen und weniger/keine mit. Screenshots ansehen.
- [ ] **Step 6:** Commit `feat(ui): Option „Reihen planen“ in den Pack-Regeln`.

### Task 6: Doku, NYX, Version

**Files:**
- Modify: `README.md` (Abschnitt Pack-Regeln: „Reihen planen“; Warnungen: Lücken), `docs/architektur.md` (Packer: `planRows`, `rows.js`), `docs/nyx-projektdatei.md` (oben „Für den Admin: zu tun vor 0.32.0“: neues Feld `rowPlan` an Plan und Regelset, kein neuer Store, neue Dateien `js/model/rows.js`, `js/model/rowPlanner.js` für eigene Dateilisten), `CHANGELOG.md`, Versionsdateien wie bei 0.31.0 (`js/version.js`, `package.json`, `index.html`, `sw.js` inkl. neuer Dateien in `ASSETS`, `README.md`).
- Test: `tests/version.test.js`, `tests/pwa.test.js`

- [ ] **Step 1:** Doku- und Versionsänderungen auf 0.32.0; neue Module in `sw.js` `ASSETS`.
- [ ] **Step 2:** `npm test` → PASS (version/pwa prüfen Versionsgleichheit und Asset-Liste).
- [ ] **Step 3:** Commit `chore: Version 0.32.0 – dicht laden`.
- [ ] **Step 4 (Wirkung nach außen, erst nach Rückfrage beim Nutzer):** Push, Merge, Issue-Kommentar mit den Admin-Schritten für NYX.

## Self-Review (erledigt)

- Spec-Abdeckung: Datenkorrektur T1; Option/Speicherung/Regelsets T4+T5; Füllregel Gewerk/Traversen T4; Lücken-Warnung inkl. Mindestgröße/letzte Reihe/Radkästen/Mehr-LKW T2+T3; Rest einpacken T4; NYX T6; Rechenzeit T4.
- Namen konsistent: `groupRows`, `floorGaps`, `freeFloorArea`, `minFootprint`, `planRows`, `rowPlanFor`, `setRowPlan`, `belongsTogether`, Feld `rowPlan`.
- Abnahme kann fehlschlagen: Lücken-Tests haben Treffer (2×100) und Nicht-Treffer (3×80, letzte Reihe, Radkasten).
