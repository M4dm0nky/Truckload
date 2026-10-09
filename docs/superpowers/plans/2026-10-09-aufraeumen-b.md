# Aufräumen Phase B – Render-Pfad (V 0.13.6)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Weniger unnötige Arbeit beim Neuzeichnen. Auswahl, Ziehen und Tippen bleiben auch bei
großen Ladungen flüssig. Nichts ändert sich sichtbar außer, dass Fokus und Scrollposition
erhalten bleiben.

**Architecture:** Ein kleiner, getesteter Merk-Helfer (`memoLast`) für `ctx`/`derive` in
`js/app.js`. Gezielte Änderungen in `js/ui/library.js`, `js/ui/material.js`, `js/ui/inspector.js`
und `js/ui/view2d.js`. Keine Strukturumbauten, die kommen in C–E.

**Tech Stack:** ES-Module ohne Build, `node --test`, Browser-Messung mit `tools/cdp.mjs`.

**Spec:** `/Users/marcohoch/.claude/plans/ich-h-tte-gern-eine-stateful-melody.md`, „Phase B“.

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. Jede neue `js/`-Datei in `sw.js` ASSETS **und** als
  `modulepreload` in `index.html` (beide Tests in `tests/pwa.test.js` prüfen das).
- Kein sichtbares Verhalten ändern (außer erhaltener Fokus/Scrollposition). Alte Daten
  unberührt.
- Nutzerstrings in HTML nur über `esc()`. Deutsche Texte mit „…“ (schließend U+201C).
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.6** (bestätigt) erst in Task 3.

## Review Focus

1. **Veraltete Merkwerte:** Nach jeder echten Änderung (Plan, Cases, Trucks, Fahrzeugwechsel)
   muss `derive()` neu rechnen. Die Merkfunktion vergleicht Referenzen auf `s.plan`, `s.cases`
   und `s.trucks`. Der Store erzeugt bei Änderung immer neue Objekte, sonst würde nichts neu
   gezeichnet. Test in Task 1.
2. **Seitenleiste nach Drag:** In der Ansicht „Alles Material“ müssen platzierte Stücke weiter
   aktualisiert werden. Nur in „Noch nicht geladen“ darf ein reiner Placement-Wechsel den
   Neuaufbau sparen. Probe in Task 2.
3. **Inspector:** Ein Fokus in Beschriftung, Farbe oder Gruppe bleibt nach dem Speichern
   (change → Render) erhalten. Ein anderer Auswahl-Case ersetzt den Inhalt wie bisher. Probe
   in Task 2.
4. **Materialsuche:** Tippen behält Fokus, Cursor und Scrollposition. Firmenwechsel und Reiter
   bauen die Liste weiter neu. Probe in Task 2.

---

### Task 1: Merkfunktion für ctx/derive, Schriftart einmal lesen

**Files:** Create `js/model/memo.js`, `tests/memo.test.js`. Modify `js/app.js` (`ctx`, `derive`),
`js/ui/view2d.js` (`textMeasurer`), `sw.js` (ASSETS), `index.html` (modulepreload).

- [ ] **Test zuerst** (`tests/memo.test.js`):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoLast } from '../js/model/memo.js';

test('memoLast: gleiche Referenzen → gleiches Ergebnis ohne Neuberechnung', () => {
  let calls = 0;
  const f = memoLast((a, b) => { calls++; return { a, b }; });
  const x = {}, y = {};
  const r1 = f(x, y), r2 = f(x, y);
  assert.equal(r1, r2); assert.equal(calls, 1);
});
test('memoLast: eine geänderte Referenz → neu rechnen', () => {
  let calls = 0;
  const f = memoLast(a => { calls++; return [a]; });
  const x = {}, y = {};
  f(x); f(y); f(y);
  assert.equal(calls, 2);
});
test('memoLast: andere Anzahl Argumente zählt als Änderung', () => {
  let calls = 0;
  const f = memoLast((...a) => { calls++; return a.length; });
  f(1); f(1, 2);
  assert.equal(calls, 2);
});
```

- [ ] **Implementieren** `js/model/memo.js`:

```js
// Merkt sich das Ergebnis des letzten Aufrufs und liefert es erneut, solange alle Argumente
// dieselben Referenzen (Object.is) sind. Der Store erzeugt bei jeder Änderung neue Objekte, daher
// genügt ein Referenzvergleich – Auswahl- oder Ansichtswechsel rechnen so nichts neu.
export function memoLast(fn) {
  let lastArgs = null, lastResult;
  return (...args) => {
    if (lastArgs && lastArgs.length === args.length && args.every((a, i) => Object.is(a, lastArgs[i]))) return lastResult;
    lastResult = fn(...args);
    lastArgs = args;
    return lastResult;
  };
}
```

- [ ] **`js/app.js`** (~l.106–118):
  - `caseById` über `memoLast(cases => new Map(cases.map(c => [c.id, c])))`.
  - `ctx(s)` nutzt `caseByIdOf(s.cases)` und bleibt ansonsten gleich, inklusive `newId: uid`.
  - `derive(s)` über eine Merkfunktion auf `(s.plan, s.cases, s.trucks)`, die
    `{ ...ctx(s), result: validatePlan(...) }` liefert. Ohne Plan (`s.plan == null`) wie bisher
    unmemoisiert bzw. so, dass kein Aufrufer bricht. Prüfe alle Aufrufer von `derive()`/`ctx()`
    (`grep -n "derive(\|ctx(" js/app.js`).
  - Das Ergebnis darf von keinem Aufrufer verändert werden. Falls ein Aufrufer mutiert, nicht
    memoisieren und im Report nennen.
- [ ] **`js/ui/view2d.js` `textMeasurer`:** `getComputedStyle(svg).fontFamily` nur einmal je
  Seite lesen (Modulvariable `fontFamily ??= …`), nicht bei jedem `renderView`.
- [ ] `sw.js` ASSETS und `index.html` modulepreload um `js/model/memo.js` ergänzen. `npm test`.
- [ ] Messung mit dem Szenario `/private/tmp/claude-501/-Users-marcohoch-Library-CloudStorage-Dropbox-Privat-Incomming-github-Truckload/1d41c3e7-6ff5-420d-9d8c-00affc425a71/scratchpad/perf2.mjs`
  (Port anpassen, Server danach stoppen). Vorher 2D ~33 ms, 3D ~67 ms je Klick. Zahlen in den
  Report.
- [ ] Commit `perf: ctx/derive gemerkt, Schriftart einmal lesen`.

### Task 2: Seitenleiste, Materialsuche, Inspector

**Files:** `js/ui/library.js`, `js/ui/material.js`, `js/ui/inspector.js` (+ ggf. `js/app.js`
Aufrufstelle), Tests wo rein testbar.

- [ ] **`library.js` `update()`** (~l.128–135):
  - `planChanged` hängt von der Ansicht ab. In `'unplaced'` zählt nur `plan.unplaced`, in
    `'all'` `placements` und `unplaced`. Ansichtswechsel rendert immer.
  - Reiner Auswahlwechsel (`selChanged` allein): nur die Klasse `sel` an `.lib-item` umschalten
    (`[data-placed="id"]`/`[data-unplaced="id"]`), kein `innerHTML`.
  - Gruppierung (~l.92) mit `push` statt `[...arr, it]` (O(n) statt O(n²)).
- [ ] **`material.js`:**
  - `render()` aufteilen in `renderFrame()` (Kopf, Firmenliste, Reiter, Suche, Aktionen) und
    `renderList()` (nur die Zeilen und den Leerhinweis in einem eigenen Container
    `.mat-rows`).
  - Tippen in `.mat-search` ruft nur `renderList()` auf. Die Fokus-/Cursor-Wiederherstellung
    (~l.69–73) entfällt.
  - Firmen-/Reiterwechsel und `update(state)` rufen beides auf.
  - Scrollposition von `.mat-list` bleibt beim Tippen erhalten (kein Neuaufbau des Containers).
- [ ] **`inspector.js` `renderInspector`:**
  - Das HTML wie bisher als String bauen. Ist es identisch mit dem zuletzt geschriebenen
    (`el.__lastHtml`), nichts tun.
  - Sonst schreiben und danach den Fokus wiederherstellen: vorher `document.activeElement`
    innerhalb `el` merken (`name` bzw. `data-*`-Selektor und, bei Textfeldern,
    `selectionStart/End`), danach dasselbe Element suchen und fokussieren.
  - Den mehrzeiligen `<!-- … -->`-Kommentar im Template (~l.67–69) in einen `//`-Kommentar
    darüber verlegen.
- [ ] Browser-Probe (Review Focus 2–4) mit Screenshots. Einen Plan über Modul-Importe aufbauen
  wie in `perf2.mjs`.
  - Seitenleiste in beiden Ansichten nach Drag/Packen korrekt.
  - Im Inspector die Beschriftung ändern, mit Tab weiter: der Fokus sitzt im nächsten Feld.
  - Materialsuche: tippen, Scrollposition bleibt.
- [ ] `npm test`; Commit `perf: Seitenleiste, Materialsuche und Inspector bauen nur neu, was sich ändert`.

### Task 3: Version 0.13.6

- [ ] Version an allen sechs Stellen auf 0.13.6. CHANGELOG-Eintrag in Nutzersprache mit den
  gemessenen Zahlen aus Task 1/2. `npm test`. Commit `chore: Version 0.13.6 – Aufräumen Phase B`.
