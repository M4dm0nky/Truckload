# Tabellen-Import, Stufe 1 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine ausgefüllte Ladeliste (xlsx oder CSV, Reiter Cases/Traversen/Boxen/Set) wird gelesen, in einer Übersicht (A) und einer bearbeitbaren Liste geprüft und als **projekteigene, bearbeitbare** Cases samt Stücken in einen Ladeplan übernommen. Set-Teile erscheinen als schlichter Kasten. Ohne LKW-Schritt (Stufe 3) und ohne Traversen-/Boxen-Bau (Stufe 2).

**Architecture:** Lesen (CSV pur, xlsx über `DecompressionStream('deflate-raw')`) liefert Zeilen als `string[][]`. Eine reine Auswertung (`js/model/ladeliste.js`) macht daraus Einträge mit Befunden und Case-Entwürfen. Übernahme schreibt die Cases in `plan.mitgefuehrt.cases` mit `herkunft: 'import'` und die Stücke in `plan.unplaced`. `bestandFuer` trennt Import-Cases von gesperrten Bibliotheks-Kopien, damit alle vorhandenen Sperren für sie automatisch entfallen.

**Tech Stack:** Reine ES-Module, `node --test`, Three.js aus `vendor/`, Python 3 + openpyxl **nur** als Entwicklungswerkzeug in `tools/` (erzeugt Vorlage und Testdateien; zur Laufzeit nie geladen).

**Spec:** `docs/superpowers/specs/2026-11-12-tabellen-import-design.md`

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. `package.json` bleibt bei genau einem Skript.
- Fremde Zellinhalte nur über `esc()` (`js/ui/dom.js`) in HTML, in SVG `textContent`.
- Jeder neue Text über `t()`, englischer Eintrag in `js/i18n/en.js`; `tests/i18n.test.js` muss grün bleiben.
- Jede neue Datei unter `js/`, `css/`, `data/` in `ASSETS` von `sw.js` (`tests/pwa.test.js`).
- Alte Pläne laden unverändert; Regressionstest mit Datensatz im alten Schema (Task 4).
- Speicher nur über `js/store/db.js`; **kein neuer Store**. Kein Netz zur Laufzeit, keine nativen Dialoge (`alert`/`confirm`/`prompt` verboten, vorhandene `showAlert`/`showConfirm`/`showPrompt` nutzen).
- „tippen“, nie „kippen“. Gewicht leer = 0 (unbekannt), nichts raten.
- Grenzen: Namen ≤ `NAME_MAX` (80), Maße ≤ `CASE_LIMITS` (2000 cm), Gewicht ≤ 50000 kg, Case-Typen je Plan ≤ `MAX_MITGEFUEHRT_CASES` (1000, inklusive schon vorhandener), Datei ≤ 5 MB, ≤ 2000 Datenzeilen je Reiter (eigene Entscheidung).
- Subagenten: App/Browser nicht starten (macht die Abnahme, Task 7), Ausgaben filtern (`npm test 2>&1 | tail -12`), keine Prozesse offen lassen.
- Ein Commit je Task, Trailer `Co-Authored-By: Claude <Modell> <noreply@anthropic.com>`. Versionsnummer **nicht** in den Tasks ändern (kommt nach Abstimmung am Ende).

## Review Focus

1. Zahl als Text oder mit Dezimalkomma („60,5“, „ 60 “, „60 cm“) → 60,5 bzw. 60 wird gelesen; „60 cm“ ist gelb (Einheit entfernt), Buchstabensalat rot. Test in Task 3.
2. Kopfzeile mit anderer Groß-/Kleinschreibung, Zusatzleerzeichen oder auf Englisch → Reiter wird trotzdem erkannt. Test in Task 3.
3. Excel schreibt formatierte, aber leere Zeilen ans Ende (und Google `inlineStr`-Zellen) → leere Zeilen übersprungen, `inlineStr` gelesen. Tests in Task 2 und 3.
4. Name mit `<img src=x onerror=alert(1)>` → erscheint als Text in Übersicht, Liste, Seitenleiste. Test in Task 6.
5. Zu große Datei / zu viele Zeilen / mehr Case-Typen als `MAX_MITGEFUEHRT_CASES` erlaubt → klare Meldung, kein Einfrieren, nichts halb übernommen. Tests in Task 3 und 4.

---

### Task 1: CSV- und xlsx-Leser

**Files:**
- Create: `js/store/tabelle-lesen.js`
- Create: `tools/make-ladeliste.py` (nur der Teil für Testdateien; Vorlage folgt in Task 5)
- Create: `tests/fixtures/ladeliste-*.xlsx`, `tests/fixtures/ladeliste-*.csv` (erzeugt, eingecheckt)
- Create: `.gitattributes`-Eintrag `*.xlsx binary`
- Test: `tests/tabelle-lesen.test.js`

**Interfaces:**
- Produces: `parseCsv(text: string) -> string[][]`; `readXlsx(buf: ArrayBuffer) -> Promise<{ name: string, rows: string[][] }[]>`; `readTabellenDateien(files: {name: string, buf: ArrayBuffer}[]) -> Promise<{ datei: string, blatt: string, rows: string[][] }[]>` (xlsx → je Blatt ein Eintrag, `.csv` → ein Eintrag mit `blatt: ''`; unbekannte Endung → Error mit `t()`-Text).

- [ ] **Step 1: Testdateien erzeugen.** `tools/make-ladeliste.py fixtures` schreibt mit openpyxl nach `tests/fixtures/`: `ladeliste-basis.xlsx` (Reiter Cases mit 3 Zeilen, Set mit 1 Zeile, eine Zahl als Text „60,5“, eine Formel `=B2*2` mit Ergebnis, 5 formatierte leere Zeilen am Ende), `ladeliste-inlinestr.xlsx` (Zellen als `inlineStr`, per Nachbearbeitung der XML im ZIP), dazu `ladeliste-de.csv` (`;`, Dezimalkomma, BOM, ein Feld mit `"…;…"` und Zeilenumbruch) und `ladeliste-en.csv` (`,`, Punkt). Python mit `-I` starten.
- [ ] **Step 2: Failing tests** in `tests/tabelle-lesen.test.js`:
  - `parseCsv` erkennt `;` und `,`, entfernt BOM, hält `"a;b"` und `"Zeile1\nZeile2"` als je ein Feld, `""` als `"`.
  - `readXlsx(basis)` liefert Blätter in Arbeitsmappen-Reihenfolge mit Namen; Zelle „60,5“ als `'60,5'`; Formelzelle als zwischengespeicherter Wert; Zahlen als String ohne Exponent (`'120'`, `'0.5'`).
  - `readXlsx(inlinestr)` liest die Texte.
  - Leere Zellen mittendrin halten die Spaltenposition (Spaltenbuchstaben aus `r="C5"` auswerten, nicht zählen).
  - Kaputtes ZIP → Error, kein Hänger.
- [ ] **Step 3: Run** `node --test tests/tabelle-lesen.test.js` → FAIL (Modul fehlt).
- [ ] **Step 4: Implementieren.** ZIP: End-of-central-directory suchen, Zentralverzeichnis lesen, Methode 0 (stored) und 8 (deflate über `new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw')))`) — läuft in Node ≥ 18 und im Browser gleich. XML ohne `DOMParser` (fehlt in Node): kleiner Regex-/Scanner-Leser nur für `<sheet name r:id>`, Relationships, `<si>` (inkl. `<r><t>`-Runs), `<c r t><v>`, `<is><t>`; XML-Entities dekodieren.
- [ ] **Step 5: Run** → PASS; `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 6: Commit** `feat(import): CSV- und xlsx-Leser ohne Abhängigkeit`.

### Task 2: Spalten und Reiter-Erkennung

**Files:**
- Create: `js/model/ladeliste.js`
- Test: `tests/ladeliste.test.js`

**Interfaces:**
- Produces:
  - `REITER = ['cases', 'traversen', 'boxen', 'set']`
  - `SPALTEN: { [reiter]: { key: string, de: string, en: string, pflicht: boolean }[] }` – die einzige Liste der Kopfzeilen. Cases: `name` „Name“, `menge` „Menge“, `breite` „Breite (cm)“, `tiefe` „Tiefe (cm)“, `hoehe` „Höhe inkl. Rollen (cm)“, `rollen` „Rollen (ja/nein)“, `gewicht` „Gewicht (kg)“, `lage` „Höchste Lage (1/2/3)“, `tippen` „Tippen“, `gewerk` „Gewerk“, `farbe` „Farbe“. Set: wie Cases ohne `rollen`/`tippen`, `hoehe` „Höhe (cm)“. Traversen: `profil`, `laenge` „Länge (cm)“, `stueck` „Stückzahl“, `gewerk`, `notiz`. Boxen: `typ`, `anzahl`, `gewerk`, `notiz`. Englisch britisch (Glossar in `docs/superpowers/specs/2026-10-27-mehrsprachigkeit-design.md`).
  - `erkenneReiter(rows: string[][]) -> { reiter: string|null, kopfzeile: number, spalten: { [key]: number } }` – Kopfzeile = erste nichtleere Zeile in den ersten 5; Abgleich nach `trim`, Kleinschreibung, Mehrfach-Leerzeichen zusammengefasst, gegen `de` **und** `en`; Reiter = der mit allen Pflichtspalten (Cases/Set: `name`, `breite`, `tiefe`, `hoehe`; Cases vs. Set unterscheidet `hoehe`-Text bzw. `rollen`). Unbekannte Spalten werden ignoriert.

- [ ] **Step 1: Failing tests:** deutsche und englische Kopfzeile, `"  höhe INKL. rollen (cm) "`, vertauschte Spaltenreihenfolge, Kopfzeile in Zeile 3 (Hinweiszeilen davor), keine Pflichtspalten → `reiter: null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(import): Spalten der Ladeliste und Reiter-Erkennung`.

### Task 3: Zeilen auswerten (Befunde, Entwürfe, Auffälligkeiten)

**Files:**
- Modify: `js/model/ladeliste.js`
- Test: `tests/ladeliste.test.js`

**Interfaces:**
- Consumes: `erkenneReiter`, `SPALTEN`, `CATEGORIES`/`colorFor` (`js/data/categories.js`), `CASE_LIMITS`, `NAME_MAX`.
- Produces:
  - `FARBEN: { key: string, de: string, en: string, hex: string }[]` – feste Liste (eigene Entscheidung): Rot `#e5484d`, Orange `#f28c28`, Gelb `#eab308`, Grün `#22c55e`, Türkis `#14b8a6`, Blau `#3b82f6`, Lila `#a855f7`, Pink `#ec4899`, Braun `#a07845`, Grau `#9aa3ad`, Schwarz `#1c1d20`, Weiß `#f5f5f5`.
  - `zahl(s: string) -> { wert: number|null, einheitEntfernt: boolean }`
  - `werteZeilen(reiter, rows, kopf) -> Eintrag[]` mit `Eintrag = { zeile: number /*1-basiert wie in Excel*/, reiter, werte: {[key]: string}, befunde: { feld: string|null, stufe: 'rot'|'gelb', text: string }[] }`. Leere Zeilen (alle Zellen leer nach `trim`) entfallen. Mehr als 2000 Datenzeilen → Error.
  - `pruefeEintrag(e: Eintrag) -> Eintrag` (Befunde neu berechnen; die Liste ruft das nach jeder Zelländerung).
  - `entwurfAus(e: Eintrag) -> { case: object, menge: number, tipped: boolean } | null` (null bei rot). Case-Felder: `name`, `l` = Tiefe, `w` = Breite, `h` = Höhe, `weight`, `category`, `color`, `layers`, `wheels`, `dimsInclWheels: true`, `wheelH: 13` bei Rollen (nur wenn `13 < h`, sonst `wheels: false` + gelb), `tippable` = Tippen-Häkchen, `herkunft: 'import'`; Set zusätzlich `kind: 'set'`, `wheels: false`, `tippable: false`. **Keine ID** (vergibt Task 4).
  - `farbAuffaelligkeiten(eintraege) -> { farbe: string, gewerk: string, mehrheit: string, zeilen: number[] }[]` – je Farbe das Mehrheitsgewerk (≥ 60 % und ≥ 5 Zeilen, eigene Entscheidung); Zeilen mit anderem Gewerk sind auffällig.
- Regeln der Befunde (Texte über `t()`): Name leer → rot; Name > 80 → rot; Breite/Tiefe/Höhe fehlt, ≤ 0, > 2000 oder keine Zahl → rot; „60 cm“ → gelb; Menge leer → 1 + gelb, Menge keine ganze Zahl ≥ 1 oder > 9999 → rot; Gewicht leer → 0 ohne Befund, keine Zahl → rot; Lage leer → `[1,2]` + gelb, nicht 1/2/3 → rot; Rollen leer → ja; „ja/yes/x/1/wahr/true“ vs. „nein/no/0/falsch/false“, sonst rot; Tippen dieselben Wörter, leer = nein; Gewerk leer → „Sonstiges“, unbekannt → gelb (bleibt als freier Name); Farbe leer → Gewerkfarbe, `#rrggbb` direkt, Name aus `FARBEN` (de/en, ohne Groß/Klein), sonst gelb + Gewerkfarbe.

- [ ] **Step 1: Failing tests** je Regel oben (eine `test()` je Zeile der Regelliste), dazu: „60,5“ → 60.5; „1.200“ (deutscher Tausenderpunkt) → rot „unklar“ statt 1,2 (eigene Entscheidung, Review Focus 1); Set-Entwurf hat `kind: 'set'` und keine Rollen; `farbAuffaelligkeiten` mit 10× Orange/Licht + 4× Orange/Ton → Ton-Zeilen auffällig, 3× Orange/Ton allein (unter 5) → nichts; 2001 Zeilen → Error.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(import): Zeilen auswerten, Befunde und Case-Entwürfe`.

### Task 4: Datenmodell – Import-Cases und Set im Plan

**Files:**
- Modify: `js/store/io.js` (`CASE_KINDS` + `'set'`; `checkCase`: `herkunft` nur `undefined` oder `'import'`; Set: `wheels !== true`, `tippable !== true`)
- Modify: `js/model/mitgefuehrt.js`
- Create: `js/model/tabellen-uebernahme.js`
- Test: `tests/mitgefuehrt.test.js`, `tests/tabellen-uebernahme.test.js`, `tests/io.test.js` (bzw. die vorhandene Datei für `checkCase`)

**Interfaces:**
- Consumes: `entwurfAus` (Task 3), `addUnplaced` (`js/model/actions.js`), `MAX_MITGEFUEHRT_CASES`.
- Produces:
  - `bestandFuer(...)` liefert zusätzlich `ausProjekt.importCases: Set<string>`; `ausProjekt.cases` enthält **nur noch** Kopien ohne `herkunft: 'import'`. Dadurch entfallen alle vorhandenen Sperren (`istKopieCase`, Inspector, Gewicht, Stift) für Import-Cases ohne weitere Änderung.
  - `istImportCase(ausProjekt, id) -> boolean`
  - `ersetzeProjektCase(plan, c) -> plan` – ersetzt den Eintrag gleicher ID in `plan.mitgefuehrt.cases` (nur wenn er `herkunft: 'import'` trägt; sonst `plan` unverändert), `stamp`.
  - `alsEigenesCase` entfernt zusätzlich `herkunft`.
  - `uebernimmTabelle(plan, entwuerfe: {case, menge, tipped}[], newId: () => string) -> plan` – je Entwurf `case.id = newId()`, Case in `mitgefuehrt.cases` (Objekt anlegen, falls fehlt, `version: MITGEFUEHRT_VERSION`), `menge` Stücke per `addUnplaced` mit `layers: case.layers`, `tipped`. Bei Mehr-LKW-Plänen ohne `lkw`-Feld (= „Ohne LKW“). Mehr als `MAX_MITGEFUEHRT_CASES` Typen gesamt → Error, Plan unverändert.

- [ ] **Step 1: Failing tests:**
  - `uebernimmTabelle` auf leeren Plan: 2 Entwürfe (Menge 3 und 1) → 2 Cases mit neuen IDs und `herkunft`, 4 Stücke in `unplaced`, getippte Stücke mit `tipped: true`, andere `tipped: false`.
  - Auf Plan mit vorhandenen Stücken und vorhandener `mitgefuehrt`-Kopie: beides bleibt.
  - `mitfuehren` nach `uebernimmTabelle` behält die Import-Cases (Kern-Regressionsfall: sonst verschwinden sie beim ersten Autosave).
  - `bestandFuer`: Import-Case in `importCases`, nicht in `cases`; Bibliotheks-Kopie weiter in `cases`.
  - `ersetzeProjektCase` ändert Import-Case, ignoriert Bibliotheks-Kopie.
  - `alsEigenesCase` ohne `herkunft`.
  - `checkCase`: `kind: 'set'` ok, `herkunft: 'foo'` abgelehnt, Set mit `wheels: true` abgelehnt.
  - **Altes Schema:** ein Plan aus V 0.21.1 (Fixture mit `mitgefuehrt` ohne `herkunft`) lädt über `parseBundle` unverändert, Kopien bleiben gesperrt (`ausProjekt.cases`).
  - 1001 Typen → Error, Plan unverändert.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren.** **Step 4: Run** `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 5: Commit** `feat(import): projekteigene Import-Cases und Set-Art im Datenmodell`.

### Task 5: Vorlage zum Download

**Files:**
- Modify: `tools/make-ladeliste.py` (Befehl `vorlage`)
- Create: `data/Truckload-Ladeliste.xlsx`, `data/Truckload-Loadlist.xlsx`
- Modify: `sw.js` (`ASSETS`)
- Test: `tests/ladeliste-vorlage.test.js`

**Interfaces:**
- Consumes: `SPALTEN` (Task 2), `FARBEN` (Task 3), `CATEGORIES`, `readXlsx` (Task 1).
- Produces: zwei Vorlagen (de/en), je 4 Reiter in der Reihenfolge Cases, Traversen, Boxen, Set; Zeile 1 Hinweis („Höhe immer inklusive Rollen, so wie das Case auf den Rollen steht. Kopfzeile nicht ändern.“), Zeile 2 Kopfzeile; Datenüberprüfung (Auswahllisten) für Gewerk (`CATEGORIES`-Namen, freie Eingabe erlaubt: `showErrorMessage=False`), Farbe (`FARBEN`), Rollen/Tippen (ja/nein bzw. yes/no), Lage (1/2/3). Spaltenbreiten lesbar, Kopfzeile fixiert.

Das Python-Skript liest Kopfzeilen, Farben und Gewerke **nicht** aus eigenem Text, sondern per `node -e` aus `js/model/ladeliste.js` und `js/data/categories.js` (JSON auf stdout) – damit es nur eine Quelle gibt.

- [ ] **Step 1: Failing test** `tests/ladeliste-vorlage.test.js`: beide Dateien lesen (`readXlsx`), je Reiter `erkenneReiter` → richtiger Reiter; Kopfzeile Zelle für Zelle gleich `SPALTEN[reiter].map(s => s.de|en)` (Struktursperre gegen Auseinanderlaufen); Datei steht in `ASSETS`.
- [ ] **Step 2: Run** → FAIL. **Step 3:** `python3 -I tools/make-ladeliste.py vorlage` ausführen, `sw.js` ergänzen. **Step 4: Run** → PASS, `tests/pwa.test.js` grün.
- [ ] **Step 5: Commit** `feat(import): Vorlage Ladeliste (de/en) zum Download`.

### Task 6: Dialog „Tabelle importieren“ (Übersicht A, Liste, Prüfen)

**Files:**
- Create: `js/ui/tabellen-import.js` (Dialog, reine Render-Helfer exportiert)
- Create: `js/app/tabellenImport.js` (Verdrahtung: Dateiwahl, Ziel, Übernahme)
- Modify: `index.html` (Knopf „Tabelle importieren“ + „?“ + „Vorlage herunterladen“ auf dem Startbildschirm und in der Plan-Kopfleiste neben dem vorhandenen Import; `<dialog id="dlg-tabelle">`; `<input type="file" id="tabelle-datei" accept=".xlsx,.csv" multiple hidden>`), `js/app.js` (wire), `css/…` (vorhandene Datei), `js/i18n/en.js`, `sw.js`
- Test: `tests/tabellen-import.test.js`

**Interfaces:**
- Consumes: `readTabellenDateien` (T1), `erkenneReiter`/`werteZeilen`/`pruefeEintrag`/`entwurfAus`/`farbAuffaelligkeiten` (T2/T3), `uebernimmTabelle` (T4), `A.emptyPlan`, `A.packRest`, `switchPlan`/`editWhole`/`warnIfUnplaced`/`multiAddedNotice` wie in `js/app/plans.js` `runLoadWizard`, `showPrompt`/`showAlert`, `esc`.
- Produces (rein, getestet): `zusammenfassung(eintraege) -> { cases: n, traversen: n, boxen: n, set: n, rot: n, gelb: n, jeGewerk: { gewerk, farbe, anzahl /*Stücke*/ }[] }`; `uebersichtHtml(z, auffaellig, { zielAktuell: string|null })`; `listeHtml(eintraege, { filter: 'alle'|'fehler', reiter: 'cases'|'set', suche: string })`.

Ablauf und Verhalten:
- **Datei wählen** (mehrere): je Datei/Blatt `erkenneReiter`; zwei Quellen für denselben Reiter → Meldung, Abbruch. Nicht erkannte Blätter werden genannt und ignoriert. Datei > 5 MB → Meldung.
- **Übersicht (Entwurf A, `.superpowers/brainstorm/36660-1794482110/content/uebersicht.html`, Variante A):** Kacheln Cases/Traversen/Boxen/Set (Stückzahlen), rote/gelbe Bänder mit „ansehen / korrigieren“ (öffnet Liste mit Filter „fehler“), Farb-Auffälligkeiten, Tabelle je Gewerk (Farbpunkt, Anzahl; **ohne** LKW-Spalte). Traversen-/Boxen-Zeilen erscheinen als Merkliste „wird in einer späteren Version gebaut“ – nichts wird daraus erzeugt. Ziel: „ins aktuelle Projekt ‚…‘“ (nur wenn ein Plan offen ist, dann vorgewählt) / „neues Projekt anlegen“ (Name per `showPrompt`, Vorgabe `t('Load {date}')`, Fahrzeug = Standardfahrzeug; eigene Entscheidung für Stufe 1). Knöpfe: Abbrechen · Liste bearbeiten · Nur übernehmen · Übernehmen und laden.
- **Liste:** Tabelle wie Excel, Reiter Cases/Set, Filter Alle/Nur fehlerhafte, Suche, jede Zelle ein Eingabefeld (`pruefeEintrag` nach `change`), Zeile hinzufügen/löschen. Rote Zelle rot umrandet, gelbe Zeile gelb. Bei 2000 Zeilen nur die gefilterte Teilmenge rendern; Eingaben sammeln per Ereignis-Delegation am Tabellenkörper (ein Listener).
- **Prüfen:** Zählt rot/gelb; „Übernehmen“ gesperrt, solange rot bleibt, außer der Nutzer hakt „rote Zeilen nicht übernehmen“ an.
- **Übernehmen:** `uebernimmTabelle` über `editWhole` (ein Rückgängig-Schritt). „Übernehmen und laden“: Ein-LKW-Plan → `A.packRest`, danach `warnIfUnplaced`; Mehr-LKW-Plan → nicht packen, `multiAddedNotice` (wie Lade-Assistent).
- **„?“-Hilfe** (eigener kleiner Dialog, kein Netz): Text aus der Spec, Abschnitt „Hilfe ‚?‘“, inklusive „Google exportiert nur den offenen Reiter → bis zu vier CSV-Dateien, alle zusammen auswählen“.
- **Vorlage herunterladen:** Datei der aktiven Sprache über den vorhandenen Download-Weg (`js/app/download.js`).

- [ ] **Step 1: Failing tests** für `zusammenfassung` (350-Zeilen-Fixture aus Code erzeugt: Stückzahlen je Gewerk), `uebersichtHtml`/`listeHtml` mit Name `<img src=x onerror=alert(1)>` → kein `<img` im Ergebnis (Review Focus 4), Filter „fehler“ zeigt nur rote/gelbe Einträge, `listeHtml` ohne LKW-Spalte.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren** (UI-Grundsätze: dunkel, farbig, Statusfarben grün/gelb/rot, Symbole statt Kürzel; Stil der vorhandenen Dialoge). **Step 4: Run** `npm test 2>&1 | tail -12` → 0 fail (inkl. i18n- und pwa-Sperren).
- [ ] **Step 5: Commit** `feat(import): Dialog Tabelle importieren – Übersicht, Liste, Prüfen`.

### Task 7: Bearbeiten im Plan und Set-Darstellung

**Files:**
- Modify: `js/app/materialScreen.js` (`editCase`: Case aus `bestandOf(s)` statt `s.cases`; Import-Case → `openCaseEditor` ohne Ablage-Block, Ergebnis über `editWhole(p => ersetzeProjektCase(p, value))` statt `saveCase`)
- Modify: `js/app/planView.js` (`changeWeight`: Import-Case ebenso über `ersetzeProjektCase`; `'uebernehmen-case'` auch für `importCases`)
- Modify: `js/ui/inspector.js` (Import-Case: Hinweis „Aus dem Tabellen-Import – nur in diesem Projekt“ + Knopf „In meine Bibliothek übernehmen“, **keine** Sperre)
- Modify: `js/model/caseShape.js` / `js/ui/view2d.js` / `js/ui/view3d.js` / `js/ui/print.js`: `kind === 'set'` → schlichter Kasten (keine Rollen, keine Ecken/Kanten-Details, keine Griffe), in 3D derselbe Quader wie in 2D
- Test: `tests/caseShape.test.js`, `tests/inspector.test.js` (vorhandene Dateien), Browser-Szenario im Scratchpad

**Interfaces:**
- Consumes: `istImportCase`, `ersetzeProjektCase`, `ausProjekt.importCases` (T4).
- Produces: `istSchlicht(c) -> boolean` (`js/model/caseShape.js`, `c.kind === 'set'`); `caseShape` liefert für Set `{ body: box, wheels: [], face: null }`.

- [ ] **Step 1: Failing tests:** `caseShape` für Set ohne Rollen, auch wenn `wheelH` gesetzt wäre; Inspector-HTML für Import-Case enthält „Case bearbeiten“ und den Übernehmen-Knopf, für Bibliotheks-Kopie weiter nicht „Case bearbeiten“; `editCase`-Pfad: reine Hilfsfunktion `speicherZielFuer(c, ausProjekt) -> 'projekt'|'bibliothek'` mit Test (Struktursperre am Aufrufort: Test grept, dass `materialScreen.js` und `planView.js` sie aufrufen).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren.** **Step 4: Run** `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 5: Browser-Abnahme (Hauptsession, nicht Subagent):** `python3 -m http.server 8766` + `node tools/cdp.mjs <szenario> <ausgabe>`. Szenario: Fixture `ladeliste-basis.xlsx` + 350-Zeilen-CSV über die Module importieren; Screenshots von Übersicht, Liste (Filter fehler), Plan mit Import-Cases (Seitenleiste, Inspector), Set-Teil in 3D in einem **Prüf-Fahrzeug knapp größer als das Teil** (Fallstrick CLAUDE.md), dasselbe mit `?lang=en`. Import-Case-Höhe im Inspector ändern → Autosave → Neuladen → Wert bleibt. Server und Chrome danach beenden, `ps -ef` prüfen.
- [ ] **Step 6: Commit** `feat(import): Import-Cases im Plan bearbeitbar, Set als schlichter Kasten`.

### Task 8: Doku und NYX-Hinweis

**Files:**
- Create: `docs/nyx-tabellenimport.md` (für den NYX-Admin: neue Case-Felder `herkunft: 'import'` und `kind: 'set'` – ältere Truckload-Stände lehnen `kind: 'set'` beim Prüfen ab, Submodul also nicht zurückdrehen, sobald Projektdateien Set-Teile enthalten; Import-Cases liegen nur im Plan in der Projektdatei; **kein neuer Store**; neue Dateien `data/Truckload-Ladeliste.xlsx`, `data/Truckload-Loadlist.xlsx`; Dateiauswahl über `<input type=file>` ist in NYX nötig – prüfen, ob der Host das zulässt)
- Modify: `docs/architektur.md` (neuer Abschnitt „Tabellen-Import (seit V …)“; Abschnitt Mitgeführte: `importCases`), `README.md` (Bedienung), `CLAUDE.md` (Verweis auf `docs/nyx-tabellenimport.md` in der NYX-Zeile)
- [ ] **Step 1:** Texte schreiben (Haiku genügt, Hauptsession prüft).
- [ ] **Step 2: Commit** `docs: Tabellen-Import, Hinweis für NYX`.

Danach (Hauptsession): Versionsnummer vorschlagen (Patch, 0.21.1 → 0.21.2) und abstimmen, CHANGELOG, Version an allen Stellen, `npm test` voll, `superpowers:finishing-a-development-branch`, Merge nach `main`, Push, Pages-Build prüfen. Vorher den Nutzer um einen echten CSV-Export aus Google Sheets bitten und ihn einmal durch den Import schicken.
