# Tabellen-Import, Stufe 2 und 3 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Import-Dialog bekommt nach der Übersicht die Schritte **Traversen** und **Boxen** (Bau über die vorhandenen Dialoge, Ergebnis nur im Projekt) und **LKWs** (Zuordnung je Gewerk, „so wenige LKWs wie möglich“, Verhalten bei schon geladenem Projekt, Meldung „nicht geladen“).

**Architecture:** Stufe 2: `stock-target.js` bekommt die Betriebsart `{ mode: 'projekt' }` (kein Haken „Im Materialbestand ablegen“, `inStock: false`). Traversen- und Dolly-Dialog laufen damit unverändert; was sie bauen, wird per `alsImportCase` zum projekteigenen Import-Case und über ein erweitertes `uebernimmTabelle(…, gebaut)` in den Plan gelegt. Stufe 3: eine reine Funktion `planeLkws(plan, ctx, einst)` in `js/model/lkw-import.js` baut die LKW und packt sie mit den vorhandenen `packAll`/`packRest`/`packAllLkws`. Vorschau im Dialog und echte Übernahme rufen dieselbe Funktion.

**Tech Stack:** Reine ES-Module, `node --test`, `tools/cdp.mjs` für die Browser-Abnahme.

**Spec:** `docs/superpowers/specs/2026-11-12-tabellen-import-design.md` (Abschnitte „4. Traversen und 5. Boxen“, „7. LKWs“, „Ziel-Projekt hat schon geladene LKW“). Stufe 1: `docs/superpowers/plans/2026-11-12-tabellen-import-stufe-1.md`.

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. `package.json` bleibt bei genau einem Skript.
- Fremde Zellinhalte nur über `esc()` (`js/ui/dom.js`) in HTML, in SVG `textContent`.
- Jeder neue Text über `t()`, englischer Eintrag in `js/i18n/en.js` (britisch); `tests/i18n.test.js` bleibt grün. Einzahl/Mehrzahl als getrennte Sätze (siehe Issue #43).
- Jede neue Datei unter `js/` in `ASSETS` von `sw.js` (`tests/pwa.test.js`).
- Import schreibt **nie** in die Bibliothek: kein `saveCase` aus dem Import-Ablauf. Gebaute Case-Typen liegen nur in `plan.mitgefuehrt.cases` mit `herkunft: 'import'`; Pre-Rig-Vorlagen werden nur referenziert (Bibliotheks-ID), nicht kopiert.
- Kein neues Datenfeld, kein neuer Store. Alte Pläne laden unverändert.
- Farbe steuert keine Zuordnung, gruppiert wird nur nach Gewerk (`category`, leer = „Sonstiges“).
- `MAX_LKW` (12) zählt vorhandene LKW mit. Alles deterministisch (gleiche Eingabe, gleiche `newId`-Folge → gleicher Plan).
- „tippen“, nie „kippen“. Keine nativen Dialoge (`showAlert`/`showConfirm`/`showPrompt`).
- Subagenten: App/Browser nicht starten (Abnahme macht Task 6), Ausgaben filtern (`npm test 2>&1 | tail -12`), keine Prozesse offen lassen.
- Ein Commit je Task auf Branch `feat/tabellen-import-2-3`, Trailer `Co-Authored-By: Claude <Modell> <noreply@anthropic.com>`. Versionsnummer **nicht** in den Tasks ändern.

## Entscheidungen in diesem Plan (Nutzer-Review 2026-11-12: 2–6 bestätigt, 1 und 8 vom Nutzer geändert)

1. **Eigener Set-Schritt** (Nutzer: Set ist meist sehr individuell, da muss man ggf. nochmal ran): bearbeitbare Tabelle nur der Set-Teile (alle Spalten, Zeile hinzufügen/löschen, Befunde wie in der Liste), Weiter nur ohne rote Set-Zeilen (oder mit „rote Zeilen nicht übernehmen“). Entfällt, wenn der Reiter Set keine Zeilen hat.
2. **„Alles neu laden“ ersetzt die vorhandenen LKW:** alle Stücke (alt und neu) werden nach den Einstellungen des LKW-Schritts auf **neu angelegte** LKW verteilt; Namen und Fahrzeuge der alten LKW gehen dabei verloren. Der Schritt sagt das in einem Hinweis.
3. **Die Frage „Projekt hat schon LKW“** steht im LKW-Schritt (nicht in der Übersicht) und kommt, sobald das Ziel ein Mehr-LKW-Plan ist oder Platzierungen hat. Bei „Nur übernehmen“ gibt es keinen LKW-Schritt und keine Frage (Verhalten wie Stufe 1).
4. **„Übernehmen und laden“ ergibt immer einen Mehr-LKW-Plan**, auch wenn am Ende nur ein LKW entsteht.
5. **Vorschau der LKW-Wahl** steht im LKW-Schritt (Liste: LKW, Gewerke, Stückzahl, „nicht geladen“), nicht in der Übersicht; die Übersicht kommt vor den Einstellungen und kann sie nicht kennen.
6. **„So wenige LKWs wie möglich“ (Verfahren):** LKW nacheinander füllen (`packAll` auf einen leeren LKW, Rest in den nächsten), bis nichts mehr übrig ist oder ein leerer LKW nichts aufnimmt. „Nach Gewerk getrennt“: je Gewerk so füllen; alle LKW außer dem letzten gelten als „voll“, der Inhalt des jeweils letzten geht in den gemeinsamen Rest, der wieder nacheinander gefüllt wird. Im Rest werden die Stücke vorher nach Gewerk (`CATEGORIES`-Reihenfolge) sortiert; ob sie als Blöcke stehen, entscheidet danach der Packer mit seinen Regeln (keine Zusatzgarantie).
7. **„Nur hinzufügen“:** neue Stücke gehen in Listenreihenfolge an die LKW ihres Gewerks, sonst an Rest-LKW ohne Gewerk-Haken (Regel von `distributeLkws`), jeweils per `packRest`. Was nirgends passt, liegt ohne LKW in der Ablage.
8. **Lose Boxen, beide Wege** (Nutzerentscheidung): (a) Der Reiter Boxen bekommt die optionalen Spalten „Breite (cm)“, „Tiefe (cm)“, „Höhe (cm)“, „Gewicht (kg)“. Eine Zeile mit allen drei Maßen wird direkt eine **lose Box** (Import-Case, keine Rollen, nie getippt, `layers` Vorgabe `[1,2]`, gelb), wie ein Case; ein oder zwei Maße → rot „Maße unvollständig“. (b) Zeilen ohne Maße bleiben Merkliste; im Schritt wählt man eine Grundbox aus den Bibliotheks-Cases mit `dollyPrompt` und fügt sie **lose** (Anzahl, Stücke verweisen auf die Bibliotheks-ID wie Pre-Rig) oder **auf Dolly** hinzu. Anzahl je Gebautem in der Bau-Liste änderbar (1–500).

## Review Focus

1. **„Zusammen mit“-Kreis** (Licht mit Ton, Ton mit Licht) oder Kette (A→B→C) → eine Gruppe, kein Hänger; Kreis gilt als „offen“. Test in Task 3.
2. **Case größer als das Fahrzeug** beim offenen Füllen → kein Endlos-Anlegen leerer LKW; Stück steht in `nichtGeladen`, es entsteht kein leerer LKW. Test in Task 3.
3. **Schon 11 LKW, „Neue zusätzliche LKW“, Bedarf 3** → genau ein neuer LKW, Rest nicht geladen und gemeldet. Test in Task 4.
4. **Bibliothek ohne Dolly-Grundboxen / Traversen-Dialog abgebrochen** → Schritt bleibt bedienbar, Hinweis statt leerer Auswahl, „Weiter“ geht. Test in Task 2. Dazu: **alte Boxen-Tabelle ohne Maß-Spalten** (Vorlage 0.30.0) wird weiter erkannt, alle Zeilen sind Merkliste. Test in Task 1b.
5. **Gebauter Traversenwagen bzw. Dolly als Import-Case** übersteht Speichern/Laden (Prüfung in `js/store/io.js`) und `mitfuehren`. Test in Task 1.

---

## Stufe 2 – Traversen und Boxen

### Task 1: Betriebsart „nur fürs Projekt“ und Übernahme gebauter Cases

**Files:**
- Modify: `js/ui/stock-target.js` (`stockTargetHtml`, `readStockTarget`, `wireStockTarget`)
- Modify: `js/model/tabellen-uebernahme.js`
- Test: `tests/tabellen-uebernahme.test.js`, neuer Testblock für `stock-target` in `tests/tabellen-import.test.js`

**Interfaces:**
- Produces:
  - `stockTargetHtml({ mode: 'projekt' })` → `''`; `readStockTarget(form, { mode: 'projekt' })` → `{ inStock: false, company: '' }`; `wireStockTarget` tut ohne `inStock`-Feld nichts (heute schon so).
  - `alsImportCase(c: Case) -> Case`: entfernt `onlyInPlan`, `company`, `collectionId`, `legacy`; setzt `herkunft: 'import'`; ID bleibt.
  - `uebernimmTabelle(plan, entwuerfe, newId, gebaut = { cases: [], stuecke: [] })`; `gebaut.cases`: fertige Import-Cases (IDs bleiben); `gebaut.stuecke`: `{ caseId, n }[]`, `caseId` aus `gebaut.cases` **oder** eine Bibliotheks-ID (Pre-Rig). Stücke ohne `lkw` in die Ablage, `layers` vom Case. `MAX_MITGEFUEHRT_CASES` zählt vorhandene + Entwürfe + `gebaut.cases`.

- [ ] **Step 1: Failing tests**
  - `stockTargetHtml({mode:'projekt'}) === ''`; `readStockTarget(null, {mode:'projekt'})` → `{ inStock: false, company: '' }`.
  - `alsImportCase({ id:'x', name:'W', onlyInPlan:true, company:'ACME', kind:'truss', truss:{…} })` → kein `onlyInPlan`/`company`, `herkunft === 'import'`, `id === 'x'`.
  - `uebernimmTabelle(plan, [], newId, { cases:[wagen], stuecke:[{caseId:wagen.id,n:3},{caseId:'preset-mlt',n:2}] })` → `mitgefuehrt.cases` enthält `wagen` (nicht `preset-mlt`), `unplaced` hat 5 Stücke, keins mit `lkw`.
  - Grenze: 999 vorhandene + 1 Entwurf + 1 gebauter Case → Error mit dem bestehenden Text.
  - Ohne viertes Argument: Ergebnis gleich wie bisher (bestehende Tests unverändert grün).
  - Review Focus 5: Plan mit einem über `buildWagonCaseType` + `alsImportCase` und einem über `buildDollyResult(base, 3, wagen, {inStock:false}, 'u1')` + `alsImportCase` gebauten Case: `validatePlan`-Weg aus `js/store/io.js` (den die Plan-Tests schon nutzen) wirft nicht; `mitfuehren` (`js/model/mitgefuehrt.js`) behält beide, solange ein Stück sie nutzt.
- [ ] **Step 2: Run** `node --test tests/tabellen-uebernahme.test.js tests/tabellen-import.test.js` → FAIL.
- [ ] **Step 3: Implementieren** (Felder wie oben; `alsImportCase` in `tabellen-uebernahme.js`).
- [ ] **Step 4: Run** → PASS; `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 5: Commit** `feat(import): Betriebsart „nur fürs Projekt“ und gebaute Cases übernehmen`.

### Task 1b: Boxen-Reiter mit Maßen (lose Boxen aus der Tabelle)

**Files:**
- Modify: `js/model/ladeliste.js` (`SPALTEN.boxen`, Auswertung), `js/ui/tabellen-import.js` (`zusammenfassung`, `entwuerfeAus`, Liste: Reiter Boxen umschaltbar), `js/i18n/en.js`
- Modify: `tools/make-ladeliste.py` und neu erzeugt `data/Truckload-Ladeliste.xlsx`, `data/Truckload-Loadlist.xlsx` (Spalten im Reiter Boxen, Hinweis „Maße nur für lose Boxen; Boxen auf Dolly ohne Maße, die baut man im Schritt Boxen“)
- Test: `tests/ladeliste.test.js`, `tests/ladeliste-vorlage.test.js`, `tests/tabellen-import.test.js`

**Interfaces:**
- Produces: `SPALTEN.boxen` = `typ` (Pflicht), `anzahl` (Pflicht), `breite` „Breite (cm)“/„Width (cm)“, `tiefe` „Tiefe (cm)“/„Depth (cm)“, `hoehe` „Höhe (cm)“/„Height (cm)“, `gewicht` „Gewicht (kg)“/„Weight (kg)“ (alle vier optional; englische Texte wie bei den gleichnamigen Spalten der anderen Reiter), `gewerk`, `notiz`. `entwurfAus(e)` liefert für eine Boxen-Zeile mit allen drei Maßen `{ case: { name: typ, l, w, h, weight, wheels: false, dimsInclWheels: false, tippable: false, layers: [1,2], category, herkunft: 'import' }, menge: anzahl, tipped: false }`, ohne Maße `null` **ohne** roten Befund (Merkliste). `istLoseBox(e) -> boolean`. Merkliste (Übersicht und Schritt Boxen) zeigt nur Boxen-Zeilen ohne Maße.

- [ ] **Step 1: Failing tests:** Zeile mit 3 Maßen → Entwurf wie oben, Gewicht leer → 0; eine/zwei Maße → roter Befund am fehlenden Feld; keine Maße → kein Befund, kein Entwurf; alte Kopfzeile ohne Maß-Spalten → Reiter `boxen` erkannt, alle Zeilen Merkliste; `entwuerfeAus` nimmt lose Boxen mit, `ausgelassen` enthält rote Boxen-Zeilen; Vorlagen-Test findet die neuen Kopfzellen in beiden Sprachen.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren**, Vorlagen mit `python3 -I tools/make-ladeliste.py vorlage` neu erzeugen. **Step 4: Run** → PASS; `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 5: Commit** `feat(import): lose Boxen mit Maßen im Reiter Boxen`.

### Task 2: Schritte Traversen, Boxen und Set im Import-Dialog

**Files:**
- Modify: `js/ui/tabellen-import.js` (Schrittfolge, Render-Helfer, Dialogablauf, Merkliste-Text)
- Modify: `js/app/tabellenImport.js` (Dialoge und Grundboxen durchreichen, `gebaut` an `uebernimmTabelle`, Trockenlauf mit `gebaut`)
- Modify: `js/i18n/en.js`, `css/*` (nur was die neuen Seiten brauchen; vorhandene `.ti-*`-Klassen nutzen)
- Test: `tests/tabellen-import.test.js`

**Interfaces:**
- Consumes: `alsImportCase`, `uebernimmTabelle(…, gebaut)` (Task 1); `openTrussDialog(dlg, { cases, onNewTruss, stock })`, `openDollyDialog(dlg, { baseCase, existingCases, onNewDollyStack, stock })` unverändert, mit `stock: { mode: 'projekt' }`; `onNewTruss`/`onNewDollyStack` geben `alsImportCase(caseType)` zurück (kein Speichern).
- Produces:
  - `schritte(eintraege, laden: boolean) -> ('traversen'|'boxen'|'set'|'lkws')[]` in dieser Reihenfolge – `traversen`/`boxen`/`set` nur, wenn der Reiter Zeilen hat; `lkws` nur bei `laden` (Task 5 füllt ihn; bis dahin endet der Ablauf nach Set).
  - `bauSchrittHtml(art: 'traversen'|'boxen', merkliste: Eintrag[], gebaut: { cases, stuecke }, { dollyBasen: Case[] }) -> string` – links Merkliste der Zeilen dieses Reiters (Boxen: nur ohne Maße; lose Boxen mit Maßen als Zeile „kommt aus der Tabelle“), rechts Liste des schon Gebauten (Name, „lose“/„Dolly“, Anzahl als `<input type=number min=1 max=500 data-k="n">`, Entfernen), Knopf „Traverse hinzufügen“ bzw. Grundbox-Auswahl + Anzahl + „Lose hinzufügen“ + „Auf Dolly laden“, Knöpfe Zurück · Weiter (bzw. letzter Schritt: „Nur übernehmen“ / „Übernehmen und laden“).
  - Set-Schritt: `setSchrittHtml(eintraege, { ohneRot }) -> string` – die vorhandene `listeHtml(eintraege, { reiter: 'set', filter: 'alle' })` plus „Zeile hinzufügen“, Zähler rot/gelb nur über Set-Zeilen, Häkchen „rote Zeilen nicht übernehmen“; Weiter gesperrt, solange rote Set-Zeilen bleiben und das Häkchen fehlt. Bearbeiten läuft über denselben `onchange`-Weg wie die Liste (gleiche `data-i`/`data-k`).
  - Lose Grundbox: `gebaut.stuecke.push({ caseId: basis.id, n })` (Bibliotheks-ID, kein neuer Case).
  - `openTabellenImport` opts zusätzlich `{ trussDlg, dollyDlg, dollyBasen: Case[], bibliothekCases: Case[] }`; Ergebnis zusätzlich `gebaut: { cases: Case[], stuecke: {caseId, n}[] }`. `bestaetige(ergebnis)` wird erst beim **letzten** Schritt aufgerufen (Name, Trockenlauf inkl. `gebaut`).

- [ ] **Step 1: Failing tests**
  - `schritte`: nur Cases + `laden:false` → `[]`; mit Traversen-Zeilen → `['traversen']`; Traversen + Boxen + Set + `laden:true` → `['traversen','boxen','set','lkws']`.
  - `setSchrittHtml` mit einer roten Set-Zeile → Weiter `disabled`; mit `ohneRot: true` → nicht `disabled`; Cases-Zeilen erscheinen dort nicht.
  - `bauSchrittHtml('boxen', …)` mit einer Grundbox → Knöpfe „Lose hinzufügen“ und „Auf Dolly laden“; eine lose Box mit Maßen aus der Tabelle steht nicht in der Merkliste.
  - `bauSchrittHtml('traversen', …)` mit Profil `<img src=x onerror=alert(1)>` → enthält `&lt;img`, kein `<img`.
  - Review Focus 4: `bauSchrittHtml('boxen', [], leer, { dollyBasen: [] })` → Hinweis „Keine Grundboxen …“, kein `<select>`, Knopf „Weiter“ vorhanden und nicht `disabled`.
  - Gebautes mit `n: 3` erscheint mit `value="3"`.
  - Merkliste in der Übersicht sagt nicht mehr „spätere Version“.
- [ ] **Step 2: Run** `node --test tests/tabellen-import.test.js` → FAIL.
- [ ] **Step 3: Implementieren.** Dialog-Zustand `st.view` um `'traversen'|'boxen'` erweitern; „Nur übernehmen“/„Übernehmen und laden“ in der Übersicht merken `laden` und gehen zum ersten Schritt aus `schritte()` (leer → wie bisher `fertig`). Truss-/Dolly-Dialog öffnen sich **über** dem Import-Dialog (eigene `<dialog>`-Elemente `#dlg-truss`, `#dlg-dolly`); danach Bauseite neu zeichnen. Truss-Ergebnis: `newCases` → `gebaut.cases`, `additions` → `gebaut.stuecke` (gleiche `caseId` addieren). Dolly: `addition` ebenso. Entfernen löscht das Stück; ein Case ohne Stück fällt aus `gebaut.cases`. Esc auf einer Bauseite → zurück zur Übersicht (wie Liste), Gebautes bleibt. In `tabellenImport.js`: `dollyBasen = bestandOf(store.get()).cases.filter(c => c.dollyPrompt && isInStock(c))`, `bibliothekCases = bestandOf(store.get()).cases` (für Pre-Rig-Vorlagen im Traversen-Dialog).
- [ ] **Step 4: Run** → PASS; `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 5: Commit** `feat(import): Schritte Traversen, Boxen und Set`.

## Stufe 3 – LKW-Schritt

### Task 3: `planeLkws` – Gruppen, feste und offene Anzahl

**Files:**
- Create: `js/model/lkw-import.js` (+ Eintrag in `sw.js` `ASSETS`)
- Test: `tests/lkw-import.test.js`

**Interfaces:**
- Consumes: `packAll`, `packRest`, `placementToUnplaced` (`js/model/actions.js`); `packAllLkws`, `stueck` (`js/model/lkw-distribute.js`); `lkwView`, `mergeLkwView`, `lkwsOf`, `convertToMulti` (`js/model/lkw.js`); `CATEGORIES`.
- Produces:
  - Einstellungen `einst`: `{ verhalten: 'neu'|'hinzu'|'zusaetzlich', truckId: string, art: 'je-gewerk'|'wenigste', getrennt: boolean, gewerke: { [gewerk]: { modus: 'offen' } | { modus: 'n', n: number } | { modus: 'mit', mit: string } }, neu: string[] /* IDs der neuen Stücke */ }`.
  - `gruppenAus(gewerke: string[], einst) -> { gewerke: string[], modus: 'offen'|'n', n?: number }[]` – „mit“ folgt bis zur Wurzel; Kreis → eine Gruppe, `modus: 'offen'`; fehlender Eintrag oder Ziel nicht in der Liste → `offen`. Reihenfolge nach `CATEGORIES` der Wurzel, unbekannte danach alphabetisch.
  - `planeLkws(plan, ctx, einst) -> plan` – `ctx = { caseById, newId, truckById: Map }`; Fahrzeug neuer LKW = `truckById.get(einst.truckId)`. Ergebnis immer Mehr-LKW-Plan; jeder LKW hat `categories` = die Gewerke seiner Stücke (Gruppe bzw. Rest-Mischung), Namen „LKW n“ fortlaufend.
  - `nichtGeladen(plan, ids: string[]) -> { id, caseId }[]` – Stücke aus `ids`, die in `plan.unplaced` liegen.
  - In diesem Task nur `verhalten: 'neu'`, `art: 'je-gewerk'`. `neu`: alle Stücke ohne `lkw` und ohne Platzierung, alte LKW verworfen (Eigene Entscheidung 2).
  - Feste Anzahl `n`: `min(n, MAX_LKW − schon angelegte)` LKW mit den Gruppen-Gewerken anlegen, Gruppenstücke über `packAllLkws` auf einem Teilplan (nur diese LKW, nur diese Stücke) verteilen und zurückschreiben; nicht Passendes bleibt ohne `lkw` in der Ablage.
  - Offen: nacheinander füllen (Eigene Entscheidung 6); Abbruch, wenn ein leerer LKW nichts aufnimmt (der leere LKW wird **nicht** angelegt) oder `MAX_LKW` erreicht.

- [ ] **Step 1: Failing tests** (Testfahrzeug klein, z. B. 240 × 120 × 200, Cases 120 × 60 × 100 ohne Stapeln, damit „1 LKW voll“ exakt rechenbar ist; Kontext wie in `tests/lkw-distribute.test.js` bauen)
  - `gruppenAus`: Licht `mit` Ton → eine Gruppe `[Ton, Licht]` mit Tons Modus; Kreis Licht↔Ton → eine Gruppe `offen`; Kette A→B→C → eine Gruppe.
  - Offen: 10 Licht-Stücke, 4 je LKW → 3 LKW (4/4/2), `categories: ['Licht']`, `nichtGeladen` leer.
  - Feste Anzahl 1 für 10 Licht-Stücke → 1 LKW, `nichtGeladen` hat 6 Einträge.
  - Review Focus 1: Kreis lädt alles, kein Hänger (Test mit `{ timeout: 2000 }`).
  - Review Focus 2: ein Case 500 × 500 × 500 → kein LKW für es angelegt, steht in `nichtGeladen`.
  - `MAX_LKW`: 60 Stücke à 4 je LKW, offen → genau 12 LKW, 12 Stücke `nichtGeladen`.
  - Determinismus: zweimal mit frischem Zähler-`newId` → `deepStrictEqual`.
- [ ] **Step 2: Run** `node --test tests/lkw-import.test.js` → FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4: Run** → PASS; `npm test 2>&1 | tail -12` → 0 fail (inkl. `tests/pwa.test.js`).
- [ ] **Step 5: Commit** `feat(lkw): LKW aus dem Import planen (Gruppen, feste/offene Anzahl)`.

### Task 4: „So wenige LKWs wie möglich“ und vorhandene LKW

**Files:**
- Modify: `js/model/lkw-import.js`
- Test: `tests/lkw-import.test.js`

**Interfaces:**
- Consumes/Produces: `planeLkws` aus Task 3, jetzt mit `art: 'wenigste'` (`getrennt` an/aus) und `verhalten: 'hinzu'|'zusaetzlich'`.
  - `wenigste`, `getrennt: false`: alle betroffenen Stücke eine Gruppe, offen gefüllt, vorher nach Gewerk sortiert.
  - `wenigste`, `getrennt: true`: Eigene Entscheidung 6.
  - `zusaetzlich`: vorhandene LKW/Platzierungen unverändert (Ein-LKW-Plan vorher `convertToMulti`), nur `einst.neu`-Stücke auf neue LKW nach den Einstellungen.
  - `hinzu`: keine neuen LKW; Eigene Entscheidung 7; `art`/`gewerke` werden ignoriert.

- [ ] **Step 1: Failing tests**
  - Nutzerbeispiel: 5 Licht + 5 Ton à 4 je LKW, `getrennt: true` → 3 LKW: einer nur Licht (4), einer nur Ton (4), einer mit beiden Resten (`categories` enthält Licht und Ton, 2+2).
  - Gleiche Daten, `getrennt: false` → 3 LKW (10 Stücke / 4), gemischt erlaubt.
  - `zusaetzlich`: Plan mit 1 LKW (2 platzierte Stücke) + 4 neue → alter LKW unverändert (`deepStrictEqual` seiner Platzierungen), 1 neuer LKW mit den 4.
  - Review Focus 3: 11 vorhandene LKW, `zusaetzlich`, 10 neue Stücke à 4 je LKW → 12 LKW, 6 in `nichtGeladen`.
  - `hinzu`: LKW „Licht“ mit 2 freien Plätzen, LKW „Ton“ voll, 3 neue Licht-Stücke → 2 in LKW „Licht“, 1 ohne `lkw` in `nichtGeladen`; keine LKW-Zahl-Änderung.
  - Ein-LKW-Plan mit Platzierungen + `zusaetzlich` → Ergebnis Mehr-LKW, alte Stücke in „LKW 1“ an ihren Plätzen.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren.** **Step 4: Run** → PASS; `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 5: Commit** `feat(lkw): so wenige LKW wie möglich, Verhalten bei vorhandenen LKW`.

### Task 5: LKW-Schritt im Dialog, Vorschau, Übernahme, Meldung

**Files:**
- Modify: `js/ui/tabellen-import.js`, `js/app/tabellenImport.js`, `js/i18n/en.js`, `css/*`
- Test: `tests/tabellen-import.test.js`

**Interfaces:**
- Consumes: `schritte` (Task 2), `planeLkws`, `nichtGeladen` (Task 3/4).
- Produces:
  - `lkwSchrittHtml({ gewerke: string[], einst, fahrzeuge: {id, name}[], zielHatLkw: boolean, freieLkw: number, vorschau: null | { lkws: {name, gewerke: string[], stueck: number}[], nichtGeladen: {name, gewerk}[] } }) -> string` – oben (nur bei `zielHatLkw`) die drei Verhaltensweisen mit Hinweis zu Entscheidung 2; Fahrzeug-Auswahl; Umschalter „Je Gewerk“ / „So wenige LKWs wie möglich“ + Häkchen „nach Gewerk getrennt“; je Gewerk (Farbpunkt, Symbol, Stückzahl) Auswahl offen / auf N verteilen (`min=1 max=freieLkw`) / zusammen mit Gewerk …; bei `hinzu` sind Gewerk-Zeilen ausgeblendet; darunter die Vorschau; Knöpfe Zurück · „Übernehmen und laden“.
  - `nichtGeladenText(liste: {name, gewerk}[]) -> string` – `''` bei leer; sonst „Achtung: 1 Case nicht geladen, kein Platz: …“ / „Achtung: {n} Cases nicht geladen, kein Platz: …“, Liste „Name (Gewerk)“ über `capList`.
  - `openTabellenImport` opts zusätzlich `{ zielHatLkw, freieLkw, fahrzeuge, vorhandeneGewerke, vorschau: async (ergebnisOhneName) => vorschauDaten }`; Ergebnis zusätzlich `lkw: einst` (ohne `neu`, das setzt die App).
  - App: `uebernehmen` mit `laden`: `editWhole(p => uebernimmTabelle(…))`, dann `neu` = Stück-IDs nach minus vor der Übernahme, dann `editWhole((p, c) => planeLkws(p, { ...c, truckById }, { ...res.lkw, neu }), false)`, danach `nichtGeladenText` per `showAlert`, wenn nicht leer. `vorschau` rechnet dasselbe auf einer Kopie (Ziel „neu“: `A.emptyPlan`) mit `wholeCtxOf({ ...store.get(), plan: entwurf }, uid)` + `truckById` und ändert den Store nicht. Der bisherige Zweig `packRest` + `multiAddedNotice` für `laden` entfällt.
  - Gewerke im Schritt: neue Stücke; bei `verhalten: 'neu'` zusätzlich `vorhandeneGewerke`.
  - Vorschau läuft nach jeder Änderung, entprellt (300 ms), letzte Anfrage gewinnt.

- [ ] **Step 1: Failing tests**
  - `lkwSchrittHtml` ohne `zielHatLkw` → keine Verhaltens-Radios; mit → drei Radios, Vorgabe `neu`.
  - `verhalten: 'hinzu'` → keine Gewerk-Zeilen.
  - Gewerk-Name `<b>x</b>` (freies Gewerk aus der Tabelle) → escaped.
  - `freieLkw: 3` → N-Feld `max="3"`.
  - `nichtGeladenText([])` → `''`; ein Eintrag → Einzahl-Satz; zwei → Mehrzahl-Satz mit beiden Namen.
  - `schritte(…, true)` endet jetzt auf `'lkws'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implementieren.** **Step 4: Run** → PASS; `npm test 2>&1 | tail -12` → 0 fail.
- [ ] **Step 5: Commit** `feat(import): LKW-Schritt mit Vorschau und Meldung „nicht geladen“`.

### Task 6: Doku, Browser-Abnahme (Opus, Hauptsitzung)

**Files:**
- Modify: `docs/nyx-tabellenimport.md` (Import-Cases können jetzt auch Traversenwagen/Dolly-Stacks sein, gleiche Felder, kein neuer Store; „Übernehmen und laden“ erzeugt Mehr-LKW-Pläne; die Vorlagen unter `data/` haben im Reiter Boxen neue Spalten), `docs/architektur.md` (`lkw-import.js`), `README.md` (Import-Abschnitt: Traversen, Boxen, LKWs), `CHANGELOG.md` (Eintrag ohne Nummer, Nummer kommt mit dem Versionsschritt)

- [ ] **Step 1:** Doku nachziehen, `npm test 2>&1 | tail -12` → 0 fail. Commit `docs: Tabellen-Import Stufe 2 und 3`.
- [ ] **Step 2: Browser-Abnahme** mit `python3 -m http.server 8766` + `node tools/cdp.mjs <szenario> <ausgabe>` (Szenario im Scratchpad):
  - Testdatei mit 350 Zeilen in 3 Gewerken (aus `tools/make-ladeliste.py`) + 2 Traversen- + 2 Boxen-Zeilen (eine mit Maßen, eine ohne) + 2 Set-Zeilen (eine ohne Höhe): Traversen-Schritt → Wagen bauen, Boxen-Schritt → Dolly bauen und Grundbox lose hinzufügen, Set-Schritt → fehlende Höhe nachtragen, Weiter erst danach frei, LKW-Schritt „So wenige wie möglich, getrennt“ → Vorschau stimmt mit Ergebnis überein (LKW-Zahl, Stück je LKW per `p.eval` aus dem Store).
  - Ziel mit vorhandenem geladenem LKW: alle drei Verhaltensweisen je einmal; „Alles neu laden“ ersetzt LKW, „Neue zusätzliche“ lässt alten LKW gleich.
  - Bibliothek unverändert: Zahl der Bibliotheks-Cases vor/nach gleich (Gegenprobe: dieselbe Messung meldet einen Unterschied, wenn im Szenario ein Case per `saveCase` angelegt wird).
  - „nicht geladen“-Meldung erscheint bei fester Anzahl 1 für ein Gewerk mit 2 LKW Bedarf.
  - Englisch einmal durchklicken (Screenshot LKW-Schritt).
  - Server und Chrome beenden, `ps -ef | grep -E "http.server|Chrome.*headless"` leer.
- [ ] **Step 3:** Versionsnummer vorschlagen (Patch ab dem veröffentlichten 0.30.0 → 0.30.1), nach Bestätigung bumpen (alle Stellen laut `tests/version.test.js`), mergen, pushen, Pages prüfen.
