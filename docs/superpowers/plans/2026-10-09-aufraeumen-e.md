# Aufräumen Phase E – `app.js` zerlegen (V 0.13.9)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** `js/app.js` (1.053 Zeilen, ~12 Aufgaben, in Node nicht testbar) wird in kleine Module
unter `js/app/` zerlegt. Jedes hat eine Aufgabe, die reine Logik ist in Node getestet. `app.js`
bleibt als schlanke Startdatei. Für den Nutzer ändert sich nichts.

**Architecture:**
- **Abhängigkeiten nur nach innen gereicht:** `app.js` lädt die Daten, erzeugt den Store und ruft
  `wire…({ store, edit, select, … })`/`mount…` der Module auf.
- Module unter `js/app/` importieren **nie** `js/app.js` (sonst Zyklus) und untereinander nur
  reine Helfer (`core.js`).
- `ui/*` bleibt store-unwissend wie bisher.
- **Reine Teile** (State-Übergänge, Tastenzuordnung, Screen-Wahl, Plan-Listen) stehen in eigenen
  Funktionen ohne DOM und haben Node-Tests.
- **Bildschirm-Zustand im Store:** `materialOpen` wird Teil des Store-Zustands, kein Modul-Flag.
  Undo erfasst nur `plan`, also unproblematisch, wie `mode`/`caseColors` heute.
  `screenOf(s)` entscheidet `'material' | 'plan' | 'start'`.

**Tech Stack:** ES-Module ohne Build, `node --test`, Browser-Rundgang mit `tools/cdp.mjs`.

**Spec:** `/Users/marcohoch/.claude/plans/ich-h-tte-gern-eine-stateful-melody.md`, „Phase E“;
Befunde I2, I3, M7–M15, M19–M21 aus dem `app.js`-Review.

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. Jede neue `js/`-Datei in `sw.js` ASSETS **und** als
  `modulepreload` in `index.html` (geprüft von `tests/pwa.test.js`).
- **Kein sichtbares Verhalten ändern.** Alle Knöpfe, Tastenkürzel, Dialoge, Banner,
  Autosave, Import/Export und Druck wie vorher.
- `js/app.js` exportiert weiter `store`, `derive`, `edit`, `select`, `scheduleRender`,
  `renderHooks`; die Browser-Szenarien importieren sie. `window.__tlBooted = true;` bleibt die
  letzte Anweisung von `app.js`.
- Module unter `js/app/` importieren nie `js/app.js`. Kein Import-Zyklus.
- Nutzerstrings in HTML nur über `esc()`. Deutsche Texte mit „…“ (schließend U+201C).
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.9** (bestätigt) erst in Task 5.

## Prüfung je Task

Nach jedem Task `npm test` **und** der Browser-Rundgang
`/private/tmp/claude-501/-Users-marcohoch-Library-CloudStorage-Dropbox-Privat-Incomming-github-Truckload/1d41c3e7-6ff5-420d-9d8c-00affc425a71/scratchpad/smokeE.mjs`:

```bash
(python3 -m http.server 8781 >/dev/null 2>&1 &); sleep 1
TL_PORT=8781 node tools/cdp.mjs <scratchpad>/smokeE.mjs <scratchpad>/outE-taskN
pkill -f "http.server 8781"
```

Das Ergebnis muss dem Ausgangsstand entsprechen:

```
{"start":{"booted":true,"start":true,"ver":"V 0.13.8"},"material":{"shown":true,"backToStart":true},
 "wizard":{"planOpen":true,"placed":3,"unplaced":0,"header":true},"keys":{"before":0,"after":90,"undone":0},
 "materialFromPlan":{"kept":true,"planBack":true},"3d":{"canvas":true},
 "exportImport":{"plans":1,"warnings":0},"logs":[]}
```

Je Task einen Port aus 8781–8789 wählen. Ab Task 5 ist `ver` dann „V 0.13.9“.

## Review Focus

1. **Bildschirmwechsel:** Start → Material → zurück (Start), Plan → Material → zurück (Plan),
   Wizard → Material → zurück (Wizard). Tastenkürzel wirken nur auf dem Plan-Bildschirm.
2. **Datenpfade:** Speichern/Löschen von Cases, Firmen, Fahrzeugen, Regelsets; Import mit
   Vorab-Sicherung; Autosave beim Planwechsel. Jeder Fehlerpfad zeigt genau eine Meldung.
3. **Startreihenfolge:** Blockiert-Banner, Speicher-Warnung, Tab-Hinweis und
   `unhandledrejection` werden weiterhin früh genug registriert. `__tlBooted` steht zuletzt.

---

### Task 1: `js/app/core.js` – reine Zustandshelfer

**Files:** Create `js/app/core.js`, `tests/app-core.test.js`. Modify `js/app.js`, `sw.js`,
`index.html`.

- [ ] Aus `app.js` als **reine Funktionen** (Zustand rein, Ergebnis raus) nach `core.js`:
  - `caseByIdOf` (gemerkt mit `memoLast`).
  - `ctxOf(s, newId)`: der Inhalt des heutigen `ctx`.
  - `deriveOf(s, newId)`: gemerkt über `(plan, cases, trucks)`.
  - `allPlansOf(s)`: aktueller Plan plus `s.plans` ohne Dublette, `plan === null`-sicher. Ersetzt
    die 5 leicht verschiedenen Varianten in `app.js` (~l.254, 640, 732, 863, 895). Vorher jede
    Variante prüfen, ob sie wirklich dasselbe meint, und Abweichungen im Report nennen.
  - `piecesOf(plan)`: `[...placements, ...unplaced]`, ersetzt die 4 Stellen.
  - `usage(s, caseId)` und `truckUsage(s, truckId)`, beide `plan === null`-sicher.
- [ ] `app.js` behält `derive`, `edit`, `select` als dünne Hüllen um den Store und nutzt `core.js`.
- [ ] Tests in `tests/app-core.test.js`:
  - `allPlansOf` mit und ohne Plan, ohne Dublette.
  - `piecesOf`.
  - `usage`/`truckUsage` über mehrere Pläne und ohne aktuellen Plan.
  - `deriveOf` liefert bei gleichen Referenzen dasselbe Objekt.
- [ ] Toten Code mit erledigen: immer wahre Bedingung (falls noch vorhanden), `lastPreImportBackup`
  als lokales `const` (~l.870), doppelter `stamp`-Import (~l.18).
- [ ] `npm test` + Rundgang; Commit `refactor: reine Zustandshelfer aus app.js nach js/app/core.js`.

### Task 2: Bildschirme und Tastatur

**Files:** Create `js/app/screens.js`, `js/app/keyboard.js`, `tests/app-screens.test.js`,
`tests/app-keyboard.test.js`. Modify `js/app.js`, `sw.js`, `index.html`.

- [ ] `materialOpen: false` in den Anfangszustand des Stores. `openMaterial`/`onBack` setzen es per
  `store.update`; das manuelle `scheduleRender()` entfällt, wenn der Store-Subscriber ohnehin
  rendert (prüfen). `materialReturn` (Rückweg in den Wizard) bleibt ein lokaler Wert in dem
  Modul, das den Material-Bildschirm verdrahtet (vorerst `app.js`, Task 4 verschiebt es).
- [ ] `screens.js`:
  - `screenOf(s)` (rein).
  - `showScreen(name, els)`: eine Tabelle `{ start: [startEl], plan: [headerEl, layoutEl],
    material: [materialEl] }`, die alle anderen ausblendet.
  - `renderStartScreen(el, s, handlers)` (DOM, aus `app.js` verschoben).
  - `render()` in `app.js` verzweigt nur noch über `screenOf(s)`.
- [ ] `keyboard.js`:
  - `keyFor(e)` (rein): Tastenereignis → Aktionsname oder `null`. Aus dem heutigen
    keydown-Handler.
  - `attachKeyboard({ getState, screenOf, actions })`: Handler nur auf dem Plan-Bildschirm
    aktiv, gleiche Ausnahmen für Eingabefelder und offene Dialoge wie heute.
  - Das heutige Verhalten exakt übernehmen, inklusive ⇧/⌘-Varianten und Pfeil-Schrittweite.
  - Dabei auch beheben: Der heutige Handler wirft bei `e.target === document`
    (`closest is not a function`); `keyFor`/der Guard prüfen `e.target?.closest`.
- [ ] Tests:
  - `screenOf` für alle Kombinationen.
  - `keyFor` für jede heutige Taste: r, t, d, Entf/Backspace, Pfeile mit und ohne ⇧, ⌘Z, ⇧⌘Z,
    Escape sowie die weiteren Tasten aus dem heutigen Handler.
  - Eingabefeld/Dialog → `null` bzw. ignoriert.
- [ ] Namen glätten: Die Inspector-Aktion `'wheel-face'` und `ACTIONS.wheelFace` werden eine
  Aktion mit Parameter.
- [ ] `npm test` + Rundgang; Commit `refactor: Bildschirmwahl und Tastatur als eigene, getestete Module`.

### Task 3: Speichern und Fehlerbehandlung

**Files:** Create `js/app/persistence.js`, `js/app/guarded.js`, `tests/app-persistence.test.js`.
Modify `js/app.js`, `sw.js`, `index.html`.

- [ ] `guarded.js`: `guarded(label, fn, { showAlert })` → `{ ok, value }`. Bei Fehler genau eine
  Meldung „<label>: <message>“. Ersetzt die 9 gleichen `try/catch + showAlert`-Blöcke. Texte
  bleiben wörtlich wie heute. Je Stelle den heutigen Text als `label` übernehmen.
- [ ] `persistence.js`:
  - `createPersistence({ repo, store, showAlert, showConfirm, stamp })` mit `saveCase`,
    `removeFromStock`, `renameCompany`, `deleteCompany`, `saveRuleSet`, `deleteRuleSet`,
    `saveTruck`, `deleteTruck`.
  - Das sind die heutigen Funktionen aus `app.js`, mit identischem Verhalten und identischen
    Meldungen.
- [ ] Tests mit Fake-Repo (Objekt mit `saveCase`/`deleteCase`/`saveCases`/… als Stubs) und
  Fake-Store (`createStore` aus `js/store/state.js`):
  - Erfolg aktualisiert den Store.
  - Fehler lässt den Store unverändert und ruft `showAlert` genau einmal.
  - Firma umbenennen: atomar.
  - Firma löschen mit Standard-Case: Abbruch mit einer Meldung.
- [ ] `app.js` verdrahtet über `createPersistence`.
- [ ] `npm test` + Rundgang; Commit `refactor: Speicherpfade und Fehlermeldungen in js/app/persistence.js`.

### Task 4: Restliche Verdrahtung in Module

**Files:** Create `js/app/materialScreen.js`, `js/app/importExport.js`, `js/app/plans.js`,
`js/app/chrome.js`, `js/app/planView.js`, `tests/app-plans.test.js`. Modify `js/app.js`,
`sw.js`, `index.html`.

- [ ] `plans.js`:
  - Reine Übergänge `switchPlanState(s, plan)` und `deletePlanState(s)`, mit Tests.
  - Die Verdrahtung der Plan-Knöpfe (Neu, Umbenennen, Duplizieren, Löschen, Auswahl) mit
    Autosave-Aufrufen (`markKnown`, `flush`, `forget`) wie heute.
- [ ] `materialScreen.js`: `mountMaterial`-Verdrahtung, `openMaterial`/`openMaterialFromWizard`,
  `materialReturn`, `pickCase`/`pickFirm`.
- [ ] `importExport.js`: Sichern, Importieren mit Vorab-Sicherung und `downloadJSON`.
- [ ] `chrome.js`: Banner (Speicher, blockiert, neue Version, Tab-Hinweis per BroadcastChannel),
  Versionsanzeige, Druck-Seitenregel, Service-Worker-Registrierung. Reihenfolge der
  Registrierung wie heute.
- [ ] `planView.js`:
  - Die `renderHooks` für Seitenleiste, Inspector (inklusive Event-Handler und
    `invalidateInspector`), Werkzeugleiste/Umschalter und das 3D-Nachladen.
  - Die 2D-Interaktionen (`attachTopInteractions`).
  - `ACTIONS`.
  - Lagen-/Farbmodus.
- [ ] `app.js` am Ende etwa 150–250 Zeilen: Daten laden, Store, Kern-Hüllen, `render()`,
  `mount…`/`wire…`-Aufrufe, Exporte, `__tlBooted`.
- [ ] Veraltete Verlaufs-Kommentare in den verschobenen Teilen auf das „Warum“ kürzen. Wörter
  wie „Task 10–13“, „Befund“, „Fix-Runde“ fallen weg.
- [ ] Modul-Karte im Report: wer importiert wen. Kein Zyklus, `js/app/*` importiert `js/app.js`
  nie.
- [ ] `npm test` + Rundgang + zusätzlich:
  - Pläne neu, umbenennen, duplizieren, löschen.
  - Fahrzeug bearbeiten.
  - Pack-Regeln öffnen.
  - Drucken-Vorschau (`#print` klicken, Druckdialog headless abfangen oder `window.print` vorher
    stubben).
  - Import einer exportierten Datei über `#import`, mit einem `File`-Objekt per `DataTransfer`.
- [ ] Commit(s) je Modul, z. B. `refactor: Plan-Verwaltung nach js/app/plans.js`.

### Task 5: Version 0.13.9

- [ ] Version an allen sechs Stellen auf 0.13.9. CHANGELOG kurz: „Intern aufgeräumt: die
  Steuerzentrale der App ist in kleine, getestete Teile zerlegt. Für die Bedienung ändert sich
  nichts.“ `docs/architektur.md`: Abschnitt „Schichten“ um `js/app/` ergänzen.
  `npm test` + Rundgang. Commit `chore: Version 0.13.9 – Aufräumen Phase E`.
