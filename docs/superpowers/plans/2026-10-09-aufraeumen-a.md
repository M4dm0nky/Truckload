# Aufräumen Phase A – echte Fehler und schnelle Gewinne (V 0.13.5)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Die echten Fehler und risikoarmen Gewinne aus der Code-Durchsicht vom 2026-10-09 beheben,
ohne sonst Verhalten zu ändern.

**Architecture:** Gezielte Einzelkorrekturen in Store (`io.js`, `repo.js`, `db.js`), Modell
(`material.js`), Service Worker (`sw.js`, `index.html`) und UI (`load-wizard.js`, `view3d.js`,
`inspector.js`, `app.js`). Keine Umstrukturierung, die kommt in den Phasen C–E.

**Tech Stack:** Reine ES-Module ohne Build, `node --test`, IndexedDB, Service Worker, Browser-Probe
mit `tools/cdp.mjs`.

**Spec:** `/Users/marcohoch/.claude/plans/ich-h-tte-gern-eine-stateful-melody.md`, Abschnitt
„Phase A“. Es gibt keine eigene Spec-Datei, das ist eine Fehlerliste aus dem Review.

## Global Constraints

- Keine npm-Abhängigkeit, kein Build-Schritt; `package.json` behält nur `npm test`.
- Jede neue Datei unter `js/`/`css/` in `ASSETS` von `sw.js` (`tests/pwa.test.js`).
- Alte Daten laden weiter. Modelländerungen brauchen einen Regressionstest mit altem Schema.
- UI-Texte deutsch mit typografischen Anführungszeichen „…“ (schließend U+201C). Der Begriff ist
  „tippen“, nie „kippen“.
- Nutzerstrings in HTML nur über `esc()`.
- Kein Verhalten ändern außer den hier genannten Fehlern.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.5** (vom Nutzer bestätigt) erst in Task 4.

## Review Focus

1. **Service-Worker „ein Stand pro Seitenaufruf“:** Sobald ein Abruf eines Seitenaufrufs in den
   Timeout läuft, kommen alle weiteren Abrufe desselben Clients aus dem Cache. Ein neuer
   Seitenaufruf (neuer Client) versucht wieder das Netz. Test in Task 2.
2. **Atomares Umbenennen:** Schlägt die Transaktion fehl, ändert sich weder der Store noch die
   Auswahl der Materialseite, und es kommt genau eine Meldung. Test in Task 1 (repo) plus Probe.
3. **Import-Warnung:** Ein Plan mit `preset-`-Referenz bekommt keine Warnung mehr, ein wirklich
   unbekanntes Case weiterhin. Test in Task 1.
4. **3D nach dem Render-Fix:** Größenänderung des Fensters, Wechsel 2D→3D→2D und Auswahl zeichnen
   weiterhin korrekt (kein leeres oder verzerrtes Bild). Browser-Probe in Task 3.
5. **Wizard + Materialseite mit Fehler:** Wirft `onOpenMaterial`, geht der Wizard mit der alten
   Liste wieder auf und hängt nicht. Probe in Task 3.

---

### Task 1: Store und Modell

**Files:** `js/store/io.js`, `js/store/repo.js`, `js/store/db.js` (falls nötig), `js/model/material.js`,
`js/app.js` (`onRename`, `onDeleteCompany`), `js/ui/material.js` (Rename-/Delete-Handler),
Tests `tests/io.test.js`, `tests/repo.test.js`, `tests/material.test.js`.

- [ ] **1a Import-Warnung.** In `parseBundle` (`js/store/io.js` ~l.217) bekommt `knownCaseIds`
  zusätzlich `...PRESET_CASES.map(c => c.id)`. Test: ein Bundle mit einem Plan, der auf
  `preset-k2` verweist, ergibt **keine** Warnung. Ein Plan mit `'gibt-es-nicht'` ergibt weiter
  eine. Zuerst rot.
- [ ] **1b Platzhalter als Firmenname.** `firmNameError` (`js/model/material.js`) lehnt Namen ab, die
  nach Trim `/^__.*__$/` entsprechen. Meldung: „Dieser Firmenname ist reserviert.“ Test zuerst.
- [ ] **1c Atomar speichern.** Neue Funktion `saveCases(list)` in `js/store/repo.js`, die alle
  Cases in **einer** IndexedDB-Transaktion schreibt. `db.putMany` nutzt das Muster schon.
  Prüfe dessen Signatur (`items` = `[{ store, value }]`?) und verwende es. Test in
  `tests/repo.test.js` im Stil der vorhandenen `putMany`/`saveImportWinners`-Tests.
- [ ] **1d Umbenennen/Löschen einer Firma in `js/app.js`.**
  - `onRename`: die Liste aus `renameCompany(...)` mit `repo.saveCases` speichern. Bei Erfolg
    `store.update` mit allen neuen Datensätzen auf einmal. Bei Fehler **eine**
    `showAlert`-Meldung „Firma konnte nicht umbenannt werden: …“, Store unverändert. Rückgabe
    `true`/`false`.
  - `onDeleteCompany`: bei Bestätigung `deletionFor` für alle Cases auswerten. Die
    `save`-Datensätze (legacy-Überlagerungen) gehen gesammelt per `repo.saveCases`, die
    `remove`-IDs per `repo.deleteCase`. Danach ein `store.update`. Bei Fehler eine Meldung und
    `false`. Hinweis: Lösch- und Speicher-Teil müssen dabei nicht in einer gemeinsamen
    Transaktion laufen; dann im Commit notieren.
- [ ] **1e Materialseite** (`js/ui/material.js`): Die Handler für Umbenennen und Firma-Löschen setzen
  `sel`/`extra` nur, wenn der Handler `true` liefert (beim Löschen ist das schon so, beim
  Umbenennen nachziehen).
- [ ] `npm test`; Commit `fix: Import-Warnung für Standard-Cases, Firmen atomar umbenennen/löschen, reservierte Firmennamen`.

### Task 2: Service Worker robust bei schlechtem Netz

**Files:** `sw.js`, `index.html`, `tests/sw.test.js`, `tests/pwa.test.js`.

- [ ] **2a Ein Stand pro Seitenaufruf.**
  - `networkFirst(request, cache, fetchFn, timeoutMs, state)` bekommt einen optionalen
    Zustand je Client, z. B. eine `Set` `degradedClients` im Worker, Schlüssel
    `event.resultingClientId || event.clientId`.
  - Ist der Client als „degradiert“ markiert, sofort aus dem Cache antworten; nur ohne
    Cache-Treffer aufs Netz.
  - Läuft ein Abruf in den Timeout und es gibt einen Cache-Treffer, den Client markieren.
  - Navigationen (`request.mode === 'navigate'`) starten einen neuen Client und beginnen daher
    frisch.
  - Tests in `tests/sw.test.js`, vorhandene `loadSw()`-Technik:
    - Nach einem Timeout liefert der nächste Abruf desselben Clients sofort den Cache, ohne
      `fetchFn` aufzurufen.
    - Ein anderer Client geht wieder ans Netz.
- [ ] **2b `cache.put` in `event.waitUntil`.** `networkFirst` gibt die Put-Promise zusätzlich
  zurück oder nimmt einen `waitUntil`-Callback. Der fetch-Handler reicht `event.waitUntil` durch.
  Bestehende Tests anpassen, Verhalten unverändert.
- [ ] **2c Install ohne HTTP-Cache.**
  `c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))`.
- [ ] **2d modulepreload.** In `index.html` für jede `js/`-Datei aus `ASSETS` ein
  `<link rel="modulepreload" href="js/…">`, außer `vendor/` (Three.js lädt in 3D nach).
  Erweiterung in `tests/pwa.test.js`: Die Menge der `modulepreload`-hrefs ist gleich der
  `js/`-Einträge in `ASSETS`. Zuerst rot.
- [ ] **2e Ladefehler-Hinweis.** Kleines klassisches Inline-Skript in `index.html` vor dem
  Modul-Script:
  - `window.addEventListener('error', …, true)`. Ist das Ziel ein `<script type="module">` oder
    `<link rel="modulepreload">`, ein festes Banner einblenden: „Die App konnte nicht vollständig
    geladen werden. Bitte neu laden.“ mit Knopf „Neu laden“ (`location.reload()`).
  - Text fest, kein Nutzerinhalt.
  - Bei CSP-/Inline-Skript-Problemen auf GitHub Pages nicht nötig, Pages setzt keine CSP.
- [ ] **2f Kopfkommentar `sw.js`.** Versionsangabe der Strategie auf V 0.13.1 korrigieren und die
  Regel für einen Stand pro Seitenaufruf in zwei Zeilen erklären.
- [ ] `npm test`; Commit `fix: Service Worker liefert pro Seitenaufruf einen Stand, modulepreload, Ladefehler-Hinweis`.

### Task 3: UI-Kleinkorrekturen

**Files:** `js/ui/load-wizard.js`, `js/ui/view3d.js`, `js/ui/inspector.js`, `js/app.js`,
`js/model/actions.js` (nur Kommentar), `js/data/case-library.js` (nur Kommentar), `css/app.css`
(falls Banner-Stil nötig).

- [ ] **3a Wizard hängt nicht.** In `load-wizard.js` (`onClose`, Zweig `suspended`):
  `let fresh = null; try { fresh = await opts.onOpenMaterial(); } catch (err) { console.warn(err); }`.
  Danach `cases = refreshWizardCases(counts, fresh ?? cases)` und den Wizard in jedem Fall wieder
  öffnen (`finally`-Struktur).
- [ ] **3b 3D rendert einmal.** In `view3d.js` `update()`: den Aufruf `resize(); render();` am Ende
  durch `ensureSize(); render();` ersetzen.
  - `ensureSize()` liest `clientWidth`/`clientHeight` und ruft nur bei Abweichung von der zuletzt
    gesetzten Größe `renderer.setSize`/die Kamera-Anpassung auf, ohne selbst zu rendern.
  - `resize()` (ResizeObserver) bleibt: `ensureSize(); render()`.
  - Browser-Probe: Fenstergröße ändern (`Emulation.setDeviceMetricsOverride` geht über `p.send`),
    2D↔3D wechseln, Auswahl ändern, je Screenshot ansehen.
- [ ] **3c `NaN%`.** In `inspector.js` (~l.35):
  `const pct = t.payload > 0 ? Math.min(100, Math.round(t.weight / t.payload * 100)) : 0;`.
- [ ] **3d Truck löschen ohne toten Undo-Schritt.** `js/app.js` `editTruck`, letzte Zeile des
  Löschzweigs: `edit(..., false)` statt mit Verlauf und danach `store.resetHistory()`. So kann
  Undo keinen gelöschten `truckId` zurückholen.
- [ ] **3e Immer wahre Bedingung.** `js/app.js` (~l.725) `if (next) autosave.markKnown(next);` und
  den irreführenden Kommentar dahinter entfernen.
- [ ] **3f Globaler Fehlerhinweis.** `window.addEventListener('unhandledrejection', …)` in `app.js`.
  Nutzt den vorhandenen Banner-Mechanismus (`#storage-warning`, s. Funktion um ~l.50–64) oder
  ein eigenes `.banner`. Text: „Unerwarteter Fehler: <message>“ mit `textContent`. Dazu
  `console.error`. Nicht für Fehler, die schon per `showAlert` gemeldet wurden. Die werden
  gefangen und erreichen den Handler nicht.
- [ ] **3g Texte.**
  - „kippen“ → „tippen“ im Kommentar `js/model/actions.js:278`.
  - Schließende Anführungszeichen in `js/app.js:114` („Alles neu packen“, „Rest einpacken“) und
    `js/data/case-library.js:17` korrigieren.
- [ ] `npm test`; Browser-Probe aus dem Review Focus 4 und 5. Commit `fix: Wizard hängt nicht nach Materialfehler, 3D rendert einmal, kleine Korrekturen`.

### Task 4: Version 0.13.5

- [ ] Version an allen sechs Stellen (`js/version.js`, `package.json`, `README.md`, `index.html`,
  `sw.js`-Cache, CHANGELOG) auf 0.13.5. CHANGELOG-Eintrag in Nutzersprache: falsche
  Import-Warnung weg, stabiler bei schlechtem Netz, Firmen umbenennen/löschen in einem Zug,
  kleinere Korrekturen. `npm test` grün. Commit `chore: Version 0.13.5 – Aufräumen Phase A`.
