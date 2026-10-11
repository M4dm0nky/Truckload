# Abschluss Teil 1 – offene Punkte abarbeiten (V 0.13.11)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Die offenen Punkte aus `docs/offene-punkte.md` abarbeiten, die der Nutzer freigegeben hat
(Spec Punkte 1–21), ohne etwas anderes zu ändern.

**Architecture:** Gezielte Korrekturen je Schicht (Store, Modell/Packer, UI, Druck, Daten). Neue
reine Logik steht in kleinen, getesteten Funktionen (`js/model/…`), die UI ruft sie nur auf.

**Tech Stack:** ES-Module ohne Build, `node --test`, Browser-Rundgang mit `tools/cdp.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-09-abschluss-design.md` (Teilprojekt 1, Punkte 1–21).

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. Jede neue `js/`-Datei in `sw.js` ASSETS **und** als
  `modulepreload` in `index.html` (geprüft von `tests/pwa.test.js`).
- Alte Daten laden weiter; jede Modell-/Datenänderung bekommt einen Regressionstest mit einem
  Datensatz im alten Schema.
- **Keine erfundenen Zahlen** (CLAUDE.md „Haltung“): Bei Daten nur die zwei beschriebenen
  Vertauschungen; Gewichte nicht neu schätzen.
- Oberfläche Deutsch mit „…“ (schließend U+201C); „tippen“, nie „kippen“. Nutzerstrings nur über
  `esc()`.
- `js/app/*` importiert nie `js/app.js`; kein Import-Zyklus.
- Eigene Entscheidungen im Code und in der Doku als „eigene Entscheidung“ benennen.
- Commits enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.11** nur in Task 5, nach Bestätigung durch den Nutzer.

## Prüfung je Task

Nach jedem Task `npm test` und der Browser-Rundgang
`/private/tmp/claude-501/-Users-marcohoch-Library-CloudStorage-Dropbox-Privat-Incomming-github-Truckload/1d41c3e7-6ff5-420d-9d8c-00affc425a71/scratchpad/smokeE.mjs`
(`(python3 -m http.server $P &); TL_PORT=$P node tools/cdp.mjs <smokeE.mjs> <out>`, je Task ein
eigener Port aus 8790–8799). Erwartung: alle Flags wahr, `keys:{before:0,after:90,undone:0}`,
`logs:[]`, `ver` entspricht der aktuellen Version. Wo ein Task bewusst etwas ändert, das der
Rundgang abbildet, erklärt der Report die Abweichung.

## Review Focus

1. **Import:** Ein Backup mit altem Schema (ohne `company`, ohne `wagonW`, Platzierung ohne `rot`,
   Case mit `weight` über der Grenze) lässt sich laden; Warnungen erscheinen, nichts bricht ab.
2. **Packer-Beschleunigung:** Ergebnis (Positionen, Rotationen, Ablage) identisch zum bisherigen
   für normale und überfüllte Ladungen. Vergleichstest über feste Fixtures.
3. **Ablage-Grund:** Der genannte Grund stimmt mit dem tatsächlichen Packer-Verhalten überein –
   kein erfundener Grund, wenn der Packer keinen eindeutigen kennt („kein Platz“ als
   Auffangfall).
4. **Taste T und Tipp-Häkchen** stellen nie ein Case in eine unmögliche Lage und bleiben für
   Traversen/nicht tippbare Cases wirkungslos.
5. **Dateien, die keine Zahlen erfinden:** Datenänderungen betreffen genau D8+ x4/x8/x12 und
   JDC-1; IDs bleiben.

---

### Task 1: Store, Import und Datenbank

**Files:** `js/store/io.js`, `js/store/repo.js`, `js/store/db.js`, `js/app/importExport.js`,
`js/app/persistence.js` (Plan-Löschen), `js/model/actions.js` + `js/store/repo.js`
(`touch`/`stamp`), Tests `tests/io.test.js`, `tests/repo.test.js`, `tests/db.test.js`,
`tests/app-importexport.test.js` (neu, falls nötig).

- [ ] **1.1 Import-Warnungen nach dem Zusammenführen.** `parseBundle` meldet unbekannte
  Case-/Fahrzeug-Verweise weiter in `warnings`, `js/app/importExport.js` filtert diese
  Warnungen nach dem Mischen gegen den **lokalen** Zustand (`store.get().cases/trucks`) und
  zeigt nur noch die wirklich fehlenden an (Alert nach dem Import mit den Warnungen, kurz und
  deutsch). Dazu `parseBundle` so umbauen, dass es die unbekannten IDs strukturiert liefert
  (`unknownRefs: [{plan, cases:[ids], truck}]`), und der Warntext erst in `importExport.js`
  entsteht. Test: Bundle mit Plan, der auf ein lokal vorhandenes eigenes Case verweist → keine
  Warnung; auf ein nirgends vorhandenes → eine Warnung.
- [ ] **1.2 Grenzen beim Import.**
  - Neue Grenzen in `js/model/limits.js`: `NAME_MAX` (Case-, Fahrzeug-, Plan-, Regelsetname, z. B.
    80, wie `MAX_FIRM`/`MAX_RULESET_NAME`; **der Wert wird aus den heutigen Eingabefeldern
    abgeleitet**, `maxlength` im Editor prüfen und exakt übernehmen) und `COORD_MAX`
    (Platzierungskoordinaten x/y/z, Obergrenze aus der größten Fahrzeugabmessung der
    mitgelieferten Fahrzeuge plus Sicherheitsfaktor 2, im Report begründen).
  - `checkCase`/`checkTruck`/`checkPlan`/`checkPlacement` prüfen sie. Doppelte IDs innerhalb
    derselben Liste (Cases, Fahrzeuge, Pläne, Regelsets) lehnen die Datei ab mit klarer Meldung.
  - **Gewicht/Bestand/Auflast über der Grenze** (`CASE_LIMITS`): beim Import **Warnung statt
    Abbruch**. Der Wert bleibt unverändert im Case, die Warnung nennt Case und Wert. Beim
    Speichern im Editor gilt die Grenze weiterhin.
  - Tests je Grenze (gültig am Rand, ungültig knapp darüber), Warnung statt Abbruch, doppelte
    ID.
- [ ] **1.3 `repairWheelH`-Meldung.** Greift die `wheels`-Korrektur mit, nennt die Reparatur-
  Meldung beides (Rollenhöhe und Rollen-Angabe). Test auf den Text.
- [ ] **1.4 Kaputtes `updatedAt` bereinigen.** `sanitizeUpdatedAt` (Laden, `js/store/repo.js`)
  schreibt bereinigte Datensätze zusätzlich zurück nach IndexedDB (ein
  `putMany`; Fehler nur loggen, nicht abbrechen). Test mit Fake-DB.
- [ ] **1.5 Datenbank-Wiederholung.** `js/store/db.js`: eine abgelehnte `dbPromise` wird beim
  nächsten Zugriff neu versucht (Promise zurücksetzen, nicht bei `blocked`-Warteschleife).
  Test mit simuliertem `indexedDB.open`-Fehler (Fake).
- [ ] **1.6 Plan löschen.** Vor `repo.deletePlan` `await autosave.flush()` (Reihenfolge so, dass
  eine ausstehende Änderung nicht erst nach dem Löschen wieder geschrieben wird: `forget` nach
  dem Löschen bleibt). Test mit Fake-Autosave.
- [ ] **1.7 `touch`/`stamp` zusammenlegen.** Eine Funktion (`js/model/stamp.js` o. ä., reine
  Funktion mit optionaler `now`), `actions.js` und `repo.js`/`js/app/*` nutzen sie. Alle Importe
  direkt umstellen, keine Re-Exporte; neue Datei in `sw.js`/`index.html`.
- [ ] `npm test` + Rundgang (Port 8790); Commit(s) je Punkt.

### Task 2: Modell und Packer, Firmen

**Files:** `js/model/validate.js`, `js/model/items.js`, `js/model/geometry.js`, `js/model/packer.js`,
`js/model/audioDolly.js`, `js/app/persistence.js`, `js/store/repo.js`, `js/store/db.js`, Tests
`tests/packer.test.js`, `tests/validate.test.js`, `tests/audioDolly.test.js`,
`tests/app-persistence.test.js`, `tests/packer-property.test.js` (neu).

- [ ] **2.1 `supportersOf` einmal.** `validatePlan` berechnet die Auflage einmal und reicht sie an
  `layerMap` und die Kollisionsprüfung weiter; `stackAbove` bekommt sie über einen optionalen
  Parameter. Verhalten identisch (alle bestehenden Tests unverändert grün).
- [ ] **2.2 `layerMap`-Rückfall `?? 1`.** Entweder durch einen Test belegen (falls erreichbar)
  oder entfernen/auf einen gerechtfertigten Wert festnageln. Entscheidung im Report begründen.
- [ ] **2.3 Packer bei Überfüllung.** In `placeStacks` je Sortierung die kleinste gescheiterte
  Grundfläche samt Höhe merken; ein späterer Stapel mit gleicher oder größerer Grundfläche und
  Höhe wird ohne neue Suche abgelehnt; Punkte nur einmal je Sortierung sortieren.
  **Vorher** die Ausgabe (Platzierungen und Ablage) für mindestens fünf feste Fixtures
  festhalten (leichte, gemischte, überfüllte Ladung, mit Traversen und Dollys) und nach der
  Änderung als Test mit denselben Erwartungswerten prüfen. Messung (Wegwerfskript im
  Scratchpad, nicht im Repo): 1.000 kleine Stücke aus 20 Typen vorher/nachher.
- [ ] **2.4 Eigenschaftstest.** `tests/packer-property.test.js`: 50 zufällige Case-Mischungen mit
  festem Seed (eigener kleiner Zufallsgenerator, keine Abhängigkeit); Zusicherung
  `validatePlan` meldet nach `packAll` weder Kollision noch Überstand, und
  `placements.length + unplaced.length` entspricht der Eingabe.
- [ ] **2.5 Dolly-ID-Kollision.** `dollyStackId` bekommt bei einem bereits vergebenen Slug
  einer **anderen** Firma ein Suffix; die Entscheidung trifft eine reine Funktion
  `uniqueDollySlug(company, existingCases)`. Bestehende IDs ändern sich nicht, solange keine
  Kollision besteht (Altdaten-Test). `persistence`/Dolly-Dialog reichen die vorhandenen Cases
  durch.
- [ ] **2.6 „Firma löschen“ in einer Transaktion.** `repo.saveAndDelete({ saves, removeIds })`
  über `db.putMany`-Muster (eine Transaktion mit Puts und Deletes). `deleteCompany` nutzt es;
  Fehler lässt Store und Datenbank unverändert. Tests mit Fake-DB und Fake-Repo.
- [ ] `npm test` + Rundgang (Port 8791); Commit(s) je Punkt.

### Task 3: Verhalten in der Oberfläche

**Files:** `js/model/actions.js`, `js/model/geometry.js`, `js/app/planView.js`, `js/app/keyboard.js`,
`js/app/persistence.js`, `js/ui/pack-rules.js`, `js/ui/caseInfo.js`, `js/ui/truss-wizard.js`,
`js/ui/load-wizard.js`, `js/ui/view3d.js`, `js/app/materialScreen.js`, Tests.

- [ ] **3.1 Taste T.** Reine Funktion `toggleTip(piece, case)` in `js/model/actions.js`/`geometry.js`:
  Ist das Stück getippt → auf `standing`; ist es stehend → in die erste mögliche getippte
  Lage (wie heute `nextTip` von `standing`). Nicht tippbar/Traverse → keine Änderung. `T` und
  das Häkchen im Inspector nutzen dasselbe. Der bisherige Schritt-Weiter (`cycleTip`) entfällt,
  wenn sonst niemand ihn braucht. Tests: stehend→getippt→stehend; vom Packer getipptes
  `tipLong` mit `rot 0` → stehend; Traverse bleibt.
- [ ] **3.2 Regelsets mit Rückfrage.** Speichern unter vorhandenem Namen: `showConfirm`
  „Regelset ‚X‘ überschreiben?“ (Texte mit „…“); Löschen: `showConfirm` mit `danger`. Abbrechen
  ändert nichts. Tests in `tests/app-persistence.test.js` mit Fake-`showConfirm`.
- [ ] **3.3 Zahlen einheitlich.** `js/ui/caseInfo.js`: eine Formatierfunktion `fmtNum(n)` (deutsch,
  höchstens eine Nachkommastelle, ohne unnötige Nullen) für Maße und Gewichte in `caseLine`
  **und** `caseDetail`; beide zeigen die gleichen Angaben (Maße, Gewicht, bei Traverse Profil,
  Länge, Stückzahl, Wagenbreite, „kg/Wagen“). Die Snapshot-Tests aus Phase D werden bewusst
  angepasst und im Report mit alter/neuer Ausgabe gegenübergestellt.
- [ ] **3.4 Traversenwagen wiederverwenden.** Reine Funktion `findMatchingWagon(cases, spec)`
  (Profil, Länge, Stückzahl je Wagen, Wagenbreite, Firma, `kind:'truss'`, nicht legacy) in
  `js/model/truss.js`; `openTrussDialog`/`buildWagonCaseType`-Aufrufer verwenden einen
  vorhandenen passenden Case-Typ statt einen zweiten anzulegen. Test inklusive Firma
  verschieden → neuer Typ.
- [ ] **3.5 „Gestapelt“ überschreibt Auto-Pack nicht.** In `load-wizard.js` setzt die
  „gestapelt“-Option das Häkchen „danach automatisch packen“ nur, wenn der Nutzer es nicht
  selbst abgewählt hat (Zustand „vom Nutzer geändert“ merken). Test über die reine
  Entscheidungsfunktion.
- [ ] **3.6 3D: `disposed`-Schutz und „veraltet“-Hinweis.** `dispose()` zweimal ist wirkungslos.
  Wirft `update()` (Fehler beim Aufbau), zeigt `js/app/planView.js` einen kleinen Hinweis
  „3D-Ansicht nicht aktuell – bitte Ansicht wechseln“ (eigenes Element, `textContent`), der
  beim nächsten erfolgreichen `update()` verschwindet.
- [ ] `npm test` + Rundgang (Port 8792) + Probe: T-Taste an einem getippten Stück, Regelset
  überschreiben und löschen (Abbruch und Bestätigung); Commit(s) je Punkt.

### Task 4: Neue Anzeigen

**Files:** `js/model/unplacedReason.js` (neu), `js/ui/library.js`, `js/ui/print.js`,
`js/app/chrome.js`, `index.html` (`#print-doc`), `js/ui/caseStyle.js`, `js/ui/view2d.js`,
`js/ui/view3d.js`, `js/ui/view3d-parts.js`, `css/app.css`, `css/print.css`, `js/ui/inspector.js`,
`js/app/planView.js`, Tests.

- [ ] **4.1 Grund in der Ablage.** Reine Funktion `unplacedReason(piece, c, truck, plan)` in
  `js/model/unplacedReason.js` (+ Test), Rückgabe ein kurzer deutscher Text oder `null`.
  Prüfreihenfolge, jede Prüfung eine Tatsache aus den Daten (nichts raten):
  1. Maße (in keiner erlaubten Orientierung) größer als der Laderaum → „zu groß für den
     Laderaum“.
  2. `piece.tipped === true`, aber nur `standing` passt → „auf ‚getippt‘ gesetzt, passt aber nur
     stehend“.
  3. Lagen-Einschränkung des Stücks lässt keine erreichbare Lage zu → „Lagen-Einschränkung“.
  4. Gewicht würde die Nutzlast überschreiten (Summe der geladenen Stücke + dieses > Nutzlast,
     Gewicht > 0) → „Nutzlast ausgeschöpft“.
  5. sonst → „kein Platz mehr im Laderaum“.
  `library.js` zeigt den Grund in der Ablage-Zeile (klein, `esc()`); die Berechnung läuft nur
  für die sichtbare Ablage und wird je Plan-Zustand gemerkt. Test je Grund inklusive
  Auffangfall; Review Focus 3 beachten.
- [ ] **4.2 Abhakliste mit Lage.** `buildChecklist` zeigt je Stück „Lage N“ (aus
  `result.layers`, dieselbe Zahl wie Inspector und Ladeplan). Test auf das Markup.
- [ ] **4.3 Ausladeliste.** Neues Druckdokument `unload` in `#print-doc` („Ausladeliste“) und in
  `chrome.js`: `buildUnloadList` (in `print.js`) gibt dieselbe Liste wie die Abhakliste in
  **umgekehrter** Reihenfolge der Ladesequenz aus (letztes Eingeladene zuerst), mit Lage,
  eigener Überschrift „Ausladeliste“ und denselben Kopfangaben. Die Seitenregel entspricht
  der Abhakliste (A4 quer). Test auf Reihenfolge und Überschrift.
- [ ] **4.4 Schriftfarbe 2D wie 3D.** `textColorFor` nach `js/ui/caseStyle.js` verschieben (3D und
  2D importieren von dort). In 2D (`drawLabel`, Beschriftung und Laufnummer) und im Druck das
  Label mit `fill` aus `textColorFor(bodyColor)` und passender Kontur (hell auf dunkel:
  dunkle Kontur; dunkel auf hell: helle Kontur) zeichnen, statt fest weiß. Die CSS-Regeln
  `svg .case .label` entsprechend anpassen. Test für `textColorFor` (hell, dunkel,
  Grenzwert) und Probe im Browser auf mindestens vier Case-Farben (schwarz, Gelb, Rot,
  Weiß) in den Farbmodi Schwarz/Gewerk/Gewicht; Screenshots ansehen. Auch eine Druck-Vorschau
  mit gestubbtem `window.print` prüfen.
- [ ] **4.5 Gewicht im Inspector.** Bei Auswahl eines Stücks zeigt der Inspector das Gewicht des
  Case-Typs als Zahlenfeld (kg, `step="any"`, `min=0`, `max` aus `CASE_LIMITS.weight`), wenn der
  Case-Typ ein eigenes oder Firmen-Case ist (`!builtin` oder `lib-`-Überlagerung). Eine Änderung
  speichert den Case-Typ (`persistence.saveCase`, bei `lib-` als Überlagerung mit gleicher
  ID) und aktualisiert alle Stücke dieses Typs. Bei Standardvorlagen (`preset-`) statt des Feldes
  der Hinweis „Standardvorlage – über ‚Kopieren‘ in der Materialverwaltung ändern“. Unter
  Traversen (Gewicht abgeleitet) kein Feld. Test der reinen Entscheidung „editierbar ja/nein“
  und Probe im Browser (Gewicht ändern → Ladungs-Kennzahl ändert sich).
- [ ] `npm test` + Rundgang (Port 8793); Commit(s) je Punkt.

### Task 5: Daten, Doku, Version

**Files:** `js/data/case-library.js`, `docs/casemasse-gewichte.md`, `docs/offene-punkte.md`,
`docs/architektur.md`, `README.md`, `CHANGELOG.md`, Versionsstellen, Tests
(`tests/caseLibrary.test.js`).

- [ ] **5.1 D8+ x4/x8/x12:** Länge und Breite tauschen (die bisherige Länge wird Breite und
  umgekehrt), Höhe, Gewicht und `note` unverändert, IDs unverändert. Quelle in
  `docs/casemasse-gewichte.md`: „Länge/Breite in der Excel-Tabelle vertauscht, vom Nutzer
  bestätigt 2026-10-09 (Entscheidung der Anforderung ‚D8+ und JDC-1 korrigieren‘)“.
  Regressionstest: ID und Gewicht gleich, Maße getauscht.
- [ ] **5.2 JDC-1 Cube (4) / JDC-1 Cube:** Die Stückzahl im Namen und das Gerät-Zähl-Verhältnis
  passen zur Größe: das Case mit „(4)“ im Namen soll das größere sein. Dazu die **Namen** der
  beiden Zeilen tauschen (IDs bleiben, damit alte Pläne ihre Stücke behalten – eigene
  Entscheidung, im Report und in `docs/casemasse-gewichte.md` nennen). Gewicht wird nicht
  angefasst. Test.
- [ ] **5.3 Doku.** `docs/offene-punkte.md`: Erledigtes streichen (mit Beleg), Rest ehrlich
  stehen lassen (nicht gewählte Punkte, Datenlücken); `docs/architektur.md` um neue Teile
  ergänzen (`unplacedReason`, Ausladeliste, Gewicht im Inspector, Import-Warnungen);
  `README.md` kurz zu Ausladeliste, Grund in der Ablage und Gewicht im Inspector.
- [ ] **5.4 Version 0.13.11** (nach Bestätigung durch den Nutzer): sechs Stellen, CHANGELOG in
  Nutzersprache. `npm test` + Rundgang. Commit `chore: Version 0.13.11 – Abschluss Teil 1`.
