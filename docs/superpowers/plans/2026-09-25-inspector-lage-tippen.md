# Lage und Tippen im Inspector bearbeiten – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps mit `- [ ]`.

**Goal:** Lage (1–4) und „getippt“ je Stück lassen sich nach dem Wizard ändern:
- für Stücke im Truck im Inspector,
- für Stücke in „Noch nicht geladen“, indem man sie in der Seitenleiste anklickt.

**Architecture:** Zwei reine Aktionen in `js/model/actions.js` ändern die Stück-Felder `layers`/`tipped` (seit V 0.7.13 im Modell). Die Oberfläche bekommt einen Block „Laden“ im Inspector. Außerdem wird die Auswahl (`selectedId`) auf Ablage-Stücke erweitert.

**Tech Stack:** Vanilla-JS-ES-Module, kein Build-Schritt, `node --test`.

**Spec:** vom Nutzer freigegebener Entwurf (Chat 2026-09-25), hier im Kontext zusammengefasst.

## Context

Seit V 0.7.13 legt der Wizard Lage und „getippt“ je Stück fest. Danach lässt sich
beides nicht mehr ändern. Der Nutzer will ein Case im Truck vollständig steuern
(tippen/nicht tippen, drehen usw.) und Stücke in der Liste vorab einstellen,
z. B. nach „Truck entladen“, bevor er von Hand lädt.

Freigegebener Entwurf:

- **Stück im Truck (Inspector):**
  - Neuer Block „Laden“ mit den Häkchen Lage 1–4 und „getippt“, unter den
    vorhandenen Knöpfen.
  - „getippt“ wirkt sofort wie Taste T: Häkchen raus stellt das Case auf,
    Häkchen rein tippt es.
  - Vom Case-Typ verbotene Lagen sind ausgegraut. „getippt“ ist ausgegraut,
    wenn `!canTip(c)`.
  - Die letzte angehakte Lage lässt sich nicht abwählen (Häkchen bleibt,
    kurzer Hinweis).
  - Eine neue Lagen-Vorgabe verschiebt nichts im Truck. Steht das Stück dann
    in einer verbotenen Lage, erscheint die bekannte Warnung „darf nicht in
    Lage n stehen“.
- **Stück in „Noch nicht geladen“:**
  - Klick auf die Zeile in der Seitenleiste wählt das Stück aus, die Zeile
    wird markiert.
  - Der Inspector zeigt Beschriftung, Farbe, Lage 1–4, getippt, „Case
    bearbeiten“ und „Entfernen“. Kein Drehen und keine Position.
  - Ziehen in den Truck bleibt wie heute.
  - Entf entfernt das ausgewählte Listen-Stück. R/T/W/D/Pfeile tun nichts.
- **Speichern wie im Wizard** (Ruling V 0.7.13): Sind die Lagen gleich
  `layersOf(c)` (als Menge), wird das Feld `layers` entfernt. Bei `!canTip(c)`
  wird kein `tipped` gespeichert.

## Global Constraints (aus `CLAUDE.md`)

- Keine npm-Abhängigkeiten, kein Build-Schritt. `npm test` = `node --test`.
- Nutzereingaben in HTML nur über `esc()` (`js/ui/dom.js`). Oberfläche
  deutsch, „…“, **„tippen“, nie „kippen“**.
- Alte Daten laden weiter: fehlende Felder = altes Verhalten.
- Reine Logik per TDD (erst der fehlschlagende Test), Tests unter
  `tests/<modul>.test.js`.
- `js/ui/*` importiert nie aus `js/store/` (nur `js/app.js`).
- Neue Dateien unter `js/`/`css/` gehören in `ASSETS` in `sw.js` (hier keine
  erwartet).
- Stück-Felder: `layers` = nicht leeres Array eindeutiger ganzer Zahlen 1–4.
  `tipped` = boolean. Wirksame Lagen = `pieceLayers(piece, c)`
  (`js/model/geometry.js`).
- Keine Versionsnummer ändern. Das macht der Controller beim Veröffentlichen
  (0.7.14, zusammen mit dem bereits committeten „Truck entladen“).

---

## Task 1: Modell-Aktionen (TDD)

**Files:**
- Modify: `js/model/actions.js`
- Test: `tests/actions.test.js` (Fixtures `mkCase`, `P`, `plan`, `byId`,
  `counter` aus `tests/fixtures.js`)

**Interfaces:**
- Consumes (vorhanden): `layersOf(c)`, `pieceLayers` (`js/model/geometry.js`),
  `canTip(c)` (`js/model/truss.js`), `cycleTip(plan, id, ctx)` (setzt
  `orientation` und `tipped` eines Placements um), `touch`.
- Produces:
  - `setPieceLayers(plan, id, layers, ctx)` → neuer Plan (oder derselbe,
    wenn nichts zu tun ist).
  - `setPieceTipped(plan, id, tipped, ctx)` → neuer Plan (oder derselbe).
  - Beide finden das Stück per `id` in `plan.placements` **oder**
    `plan.unplaced`.
  - `ctx` ist das übliche `{ caseById, truck, newId }`.

Verhalten `setPieceLayers`:
- Unbekannte id oder Case-Typ fehlt: gleicher `plan`.
- `layers` ungültig (kein Array, leer, Werte außerhalb 1–4, doppelt): gleicher
  `plan`. Die Oberfläche verhindert das; die Aktion schützt sich trotzdem.
- Werte, die `layersOf(c)` nicht erlaubt, werden herausgefiltert. Bleibt nichts
  übrig: gleicher `plan`.
- Ist die gefilterte Menge gleich `layersOf(c)`: Feld `layers` am Stück
  entfernen. Sonst setzen, aufsteigend sortiert.
- Ändert sich dabei nichts, kommt derselbe `plan` zurück (kein leerer
  Undo-Schritt).
- Position/Orientierung eines Placements bleiben unverändert.

Verhalten `setPieceTipped`:
- Unbekannte id, fehlender Case-Typ oder `!canTip(c)`: gleicher `plan`.
- **Ablage-Stück:** Feld `tipped` auf den Wert setzen. Ist es schon so:
  gleicher `plan`.
- **Placement:**
  - Soll-Zustand `tipped` ≠ Ist-Zustand (`orientation !== 'standing'`):
    `cycleTip(plan, id, ctx)` aufrufen. Das legt um und setzt `tipped`.
  - Soll = Ist: nur das Feld `tipped` setzen, falls es abweicht, sonst
    gleicher `plan`.

- [ ] **Step 1: Failing tests schreiben**, u. a.:
  - Placement: `setPieceLayers(..., [1])` setzt `layers:[1]`, x/y/z/orientation unverändert.
  - Ablage-Stück: `setPieceLayers` auf ein Ablage-Stück wirkt ebenso.
  - `[4,3,2,1]` bei Typ mit Standard-Lagen entfernt ein vorhandenes `layers`-Feld.
  - Bei Typ `layers:[1,2]` wird `[1,2,3]` zu „kein Feld“ und `[2,3]` zu `[2]`.
  - `[3,4]` bei Typ `[1,2]` sowie `[]`/`[0]`/`[1,1]` liefern denselben Plan (`assert.equal`).
  - `setPieceTipped(false)` auf getipptes Placement: `orientation === 'standing'`, `tipped === false`.
  - `setPieceTipped(true)` auf stehendes Placement: `orientation !== 'standing'`, `tipped === true`.
  - `setPieceTipped` auf ein Ablage-Stück setzt nur das Feld.
  - `setPieceTipped` bei nicht tippbarem Case: derselbe Plan.
  - Gleicher Wert: derselbe Plan.
- [ ] **Step 2:** `node --test tests/actions.test.js` → FAIL (Funktionen fehlen).
- [ ] **Step 3:** Implementieren (kurz, im Stil der Datei; ein gemeinsamer
  Helfer zum Finden/Patchen eines Stücks in beiden Listen ist ok, gerne auch
  für `setItemLabel` nutzbar, `setItemLabel` aber nicht umbauen).
- [ ] **Step 4:** `node --test tests/actions.test.js` grün, dann `npm test` grün.
- [ ] **Step 5:** Commit `feat: Aktionen zum Ändern von Lage und Tippen je Stück`

## Task 2: Inspector, Auswahl in der Seitenleiste, Tastatur

**Files:**
- Modify: `js/ui/inspector.js`, `js/ui/library.js`, `js/app.js`, `css/app.css`
- Modify (Doku): `docs/offene-punkte.md` (Punkt „Lage/Tippen nach dem Wizard im
  Inspector ändern“ als erledigt entfernen/markieren), `README.md` (ein Satz)

**Interfaces:**
- Consumes: `A.setPieceLayers`, `A.setPieceTipped` aus Task 1; vorhandene
  `A.setItemLabel` (wirkt schon auf Placements und Ablage),
  `A.removeUnplaced(plan, id)`, `select(id)` (`js/app.js:75`), `layersOf`,
  `pieceLayers`, `canTip`.
- Produces: keine neuen Exporte außer ggf. einer Render-Hilfe im Inspector.

Umsetzung:

- **`js/app.js`, Inspector-Hook** (heute Zeile ~296):
  - `selected` = Placement-Item aus `d.result.items` wie bisher.
  - Sonst: Ablage-Eintrag mit `selectedId` aus `s.plan.unplaced`, zusammen mit
    seinem Case-Typ als `selectedUnplaced` an `renderInspector` übergeben.
  - Die Anzeige braucht Label/Farbe mit Rückfall auf Case-Name/Gewerkfarbe,
    wie `buildItems` es macht.
- **`ACTIONS`/Tastatur:**
  - `delete` bei Ablage-Stück ruft `A.removeUnplaced`, dann `select(null)`.
  - `edit-case` findet den Case-Typ auch für Ablage-Stücke.
  - Die Pfeiltasten-Behandlung (heute `p.x` ohne Prüfung) muss bei einem
    Ablage-Stück nichts tun statt abzustürzen.
  - R/T/W/D tun bei Ablage-Stücken nichts (die Aktionen liefern dann schon
    denselben Plan — prüfen).
- **`#inspector` change-Listener:**
  - Checkbox `data-layer` ruft `setPieceLayers` mit allen angehakten Lagen des
    Blocks auf.
  - Checkbox `name="tipped"` ruft `setPieceTipped`.
  - Wird die letzte Lage abgewählt: Häkchen wieder setzen, Hinweis
    „Mindestens eine Lage nötig.“ zeigen, keine Aktion.
  - `data-id` wie bisher an der `.insp-sel`-Section.
- **`js/ui/inspector.js`:**
  - `renderInspector(el, { selected, selectedUnplaced, result, truck })`.
  - Neuer Block „Laden“ (für beide Fälle gleich, als eine Hilfsfunktion):
    - Lage 1–4-Checkboxen. Angehakt = `pieceLayers(piece, c)`, `disabled`, wenn
      nicht in `layersOf(c)`.
    - Checkbox „getippt“. Angehakt bei Placement = `orientation !== 'standing'`,
      bei Ablage = `tipped ?? canTip(c)`. `disabled` bei `!canTip(c)`.
  - Für Ablage-Stücke eigene, schlankere Section: Titel ohne Ladefolge-Nummer,
    Hinweis „Noch nicht geladen“, Beschriftung/Farbe, Block „Laden“, Knöpfe
    „Case bearbeiten“ und „Entfernen“.
  - Alle Nutzerstrings über `esc()`.
- **`js/ui/library.js`:**
  - Klick auf eine Ablage-Zeile (nicht auf den „−“-Knopf) ruft einen neuen Hook
    `h.onSelectUnplaced(id)` auf.
  - Die ausgewählte Zeile (Ablage oder platziert) bekommt die Klasse `sel`.
    Dafür nimmt `update(state)` auch `state.selectedId` entgegen und rendert
    bei Änderung neu.
  - Ziehen bleibt unverändert.
- **`js/app.js`:** `onSelectUnplaced: id => select(id)` verdrahten.
- **`css/app.css`:**
  - Markierung `.lib-item.sel` (z. B. Akzent-Rahmen).
  - Kompakter Block „Laden“ im Inspector, gleiche Optik wie die
    Wizard-Häkchen.
- [ ] `npm test` grün.
- [ ] Browser-Abnahme (CDP, `tools/cdp.mjs`, siehe Verifikation).
- [ ] Commit `feat: Lage und Tippen im Inspector bearbeiten, auch für Stücke in der Liste`.

## Verifikation

- `npm test` grün.
- CDP (Server `python3 -m http.server 8766`, Service-Worker im Szenario
  abmelden). Load mit 3 Kabelcases (`preset-kabel-120x60x60`, tippbar) und
  1 MLT (`preset-hof-mlt2-240`, nicht tippbar, Lagen [1,2]) im Sprinter, gepackt.
  1. Kabelcase im Truck anklicken. Block „Laden“ zeigt getippt ✓, Lage 1–4 ✓.
     „getippt“ abwählen: das Case steht sofort (`orientation 'standing'`).
     Wieder anhaken: getippt. ⌘Z nimmt es zurück.
  2. Beim selben Case nur Lage 1 lassen. Steht es in Lage 2: Warnung sichtbar.
     Nach „Alles neu packen“ steht es in Lage 1.
  3. MLT anklicken: „getippt“ ausgegraut, Lage 3/4 ausgegraut.
  4. „Truck entladen“, dann ein Kabelcase links anklicken. Die Zeile ist
     markiert, der Inspector zeigt die Listen-Ansicht. „getippt“ abwählen,
     dann in den Truck ziehen (bzw. `placeCase` über `edit` im Szenario): Es
     startet stehend.
  5. Ablage-Stück ausgewählt, Entf: Das Stück ist weg. Pfeiltasten und R/T/D
     werfen keinen Fehler (`p.logs` ohne Exceptions).
  6. Screenshots vom Inspector für ein Truck-Stück und ein Listen-Stück.
