# Dolly-Pflicht für Line-Array-Tops und Subs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jede der 13 Audio-Einzelbox-Vorlagen (8 Line-Array-Tops + 5 Subs, Gewerk „Ton“)
bekommt beim Hinzufügen im Lade-Wizard über einen Dialog immer einen Dolly mit
Schwerlastrollen untergelegt, mit einer vom Nutzer frei gewählten Stückzahl übereinander.

**Architecture:** Ein neuer, rein funktionaler Baustein (`dollyStackCase(baseCase, n)` in
`js/model/audioDolly.js`) berechnet Maße/Gewicht der Dolly-Variante. Ein neuer DOM-Dialog
(`js/ui/dolly-wizard.js`, `openDollyDialog()`) fragt nur die Stückzahl ab und nutzt diesen
Baustein – exakt das Muster von `buildWagonCaseType()`/`openTrussDialog()`
(`js/ui/truss-wizard.js`). `js/ui/load-wizard.js` erkennt die 13 Basis-Vorlagen an einem neuen
Marker-Feld (`dollyPrompt: true`) und öffnet bei „+“ diesen Dialog statt direkt zu
inkrementieren (analog `addTruss()`). Persistenz über den bereits vorhandenen, generischen
`saveCaseValue()` (`js/app.js`) – kein neuer Store-Code nötig. Die 8 bestehenden festen
„…4er/6er (auf Dolly)“-Presets werden **nicht gelöscht**, sondern wie die bestehenden
Legacy-Einträge mit `legacy: true` markiert (CLAUDE.md: alte Ladepläne müssen weiter laden).

**Tech Stack:** Vanilla ES-Module, `node --test`, keine npm-Abhängigkeiten (CLAUDE.md).

**Spec:** [docs/superpowers/specs/2026-10-07-audio-dolly-design.md](../specs/2026-10-07-audio-dolly-design.md)

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt – reine ES-Module (CLAUDE.md).
- Nutzereingaben nur über `esc()` (`js/ui/dom.js`) in HTML, nie `innerHTML` mit rohem Text.
- Oberfläche auf Deutsch, typografische Anführungszeichen „…“ (U+201E/U+201C).
- „tippen“, nie „kippen“.
- Eine Versionsnummer überall: `js/version.js`, `package.json`, `README.md`, `index.html`,
  Cache-Name in `sw.js`, oberster `CHANGELOG.md`-Eintrag (`tests/version.test.js`).
- Jede neue Datei unter `js/` gehört in die Offline-Liste in `sw.js` (`tests/pwa.test.js`).
- Alte Daten müssen weiter laden: entfernte/ersetzte Presets werden `legacy: true`, nie
  gelöscht; jede Datenmodell-Änderung braucht einen Regressionstest mit Alt-Schema-Daten.
- Keine erfundenen Maße/Gewichte – 0/unbekannt mit Quelle ist besser als eine geratene Zahl.
- Dolly-Eigenhöhe **18 cm**, Dolly-Eigengewicht pauschal **15 kg** (aus der Spec, Carvin
  DB521018/SYNQ SQ-218/DAS PL-EV118S, Mittelwert, dokumentiert).
- Dolly-Normbreite (nur für Dokumentation, nicht für Pack-Logik): kleineres Box-Fußmaß
  (`w`-Feld), aufgerundet auf 60 / 80 / 124 cm (= 248 cm Truckbreite ÷ 4 / ÷ 3 / ÷ 2).

## Review Focus

- Entfernte alte Presets dürfen bestehende, bereits gespeicherte Ladepläne nicht zerstören –
  `legacy: true` statt Löschen, mit Regressionstest (wie die bestehenden
  `preset-truss-29-3m`/`preset-truss-dolly`-Tests).
- Der Dialog muss eine ungültige Stückzahl (0, negativ, leer, nicht-numerisch) ablehnen statt
  einen kaputten Case zu erzeugen – wie `openTrussDialog()` bei einer fehlschlagenden
  `splitWagons()`-Eingabe.
- Zweimaliges Anlegen derselben Kombination (gleiche Basisbox, gleiche Stückzahl) darf nicht
  zwei verschiedene Case-Zeilen mit unterschiedlichen IDs erzeugen – die ID muss aus Basisbox
  und Stückzahl deterministisch gebildet werden, damit ein zweiter Dialog-Lauf dieselbe Zeile
  trifft.
- Große Stückzahlen (z. B. 10 schwere Subs) müssen weiterhin ein gültiges, speicherbares Case
  nach `checkCase()` ergeben (`js/store/io.js`) – `h`/`weight` dürfen die Grenzen aus
  `js/model/validate.js` (`CASE_LIMITS`) nicht überschreiten, ohne dass das Programm abstürzt.
- Die 500-Stück-Grenze des Wizards (`MAX_ITEMS`) darf durch eine einzelne Dolly-Dialog-Aktion
  nicht übersprungen werden – wie bei `addTruss()` muss die Addition auf den verbleibenden
  Platz gekappt werden.

---

## Vorarbeit: Bereits gelesene Dateien (Kontext für alle Tasks)

Diese Signaturen sind real aus dem Repo gelesen, nicht erraten:

- `js/ui/truss-wizard.js`: `buildWagonCaseType(id, profileName, length, width, count)` (reine
  Funktion, gibt ein vollständiges Case-Objekt zurück) und
  `openTrussDialog(dlg, opts = {})` mit `opts = { cases, onNewTruss }`, Rückgabe
  `{ newCases: Case[], additions: [{ caseId, n }], gestapelt }` oder `null` bei Abbruch.
- `js/ui/load-wizard.js`: `addTruss()` (Zeile ~288) ruft `openTrussDialog()` auf, übernimmt
  `res.newCases` in die lokale `cases`-Liste und `res.additions` in `counts` (gekappt auf
  `MAX_ITEMS - total()`). Der Listen-Click-Handler (Zeile ~236) liest `btn.dataset.act`
  (`'inc'`/`'dec'`) und `id = btn.closest('[data-case]')?.dataset.case`.
- `js/app.js`: `saveCaseValue(rawValue)` (Zeile 232) ist bereits vollständig generisch – stempelt
  (`updatedAt`), ruft `repo.saveCase()`, aktualisiert den Store, gibt den gespeicherten Case
  zurück oder `undefined` bei Fehler. Wird heute als `onNewTruss: saveCaseValue` an
  `openLoadWizard()` übergeben (Zeile ~300). `runLoadWizard()` übergibt außerdem
  `trussDlg: $('#dlg-truss')`.
- `index.html` Zeile 107/108: `<dialog id="dlg-wizard"></dialog>` / `<dialog
  id="dlg-truss"></dialog>` – leere `<dialog>`-Elemente, Inhalt wird vom jeweiligen
  `open…Dialog()` per `innerHTML` gefüllt.
- `js/store/io.js`: `checkCase(c)` prüft u. a. `wheelH <= CASE_LIMITS.wheelH` und erlaubt
  `wheelH >= h`, wenn `dimsInclWheels === false` ist. `js/model/validate.js`: `CASE_LIMITS`
  (u. a. `wheelH: 200`).
- `js/model/geometry.js`: `outerDims(c)` addiert `wheelHOf(c)` auf `c.h`, wenn
  `c.dimsInclWheels === false`. `js/model/caseShape.js`: `caseShape(c, p, box)` zeichnet die 4
  Eck-Rollen generisch anhand `wheelHOf(c)` – keine Änderung an beiden Dateien nötig.
- `tests/fixtures.js`: `mkCase(id, l, w, h, extra = {})` liefert ein minimal gültiges Case
  (`weight: 100, tippable: false, stackable: true, maxTopLoad: null`, überschreibbar via
  `extra`).

---

### Task 1: 13 Audio-Basisvorlagen als `dollyPrompt`-Vorlagen markieren

**Files:**
- Modify: `js/data/preset-cases.js:107-169` (die 13 `P('k2', …)` … `P('ls18', …)`-Aufrufe)
- Test: `tests/presets.test.js`

**Interfaces:**
- Produces: Case-Feld `dollyPrompt: true` auf genau den 13 IDs `k2, v8v12, leopard, wpc, wps,
  hdl20a, geom620, geom6b, ks28, v-sub, 900-lfc, sub-8006-as, ls18` (mit `preset-`-Präfix).

- [ ] **Step 1: Failing Test schreiben**

In `tests/presets.test.js`, direkt nach dem bestehenden Test
`'Audio-Vorlagen (Gewerk Ton) sind vollständig und neutral'` einfügen:

```javascript
test('Die 13 Audio-Einzelboxen tragen dollyPrompt, die Dolly-Stacks/übrigen Presets nicht', () => {
  const singleBoxIds = [
    'preset-k2', 'preset-v8v12', 'preset-leopard', 'preset-wpc', 'preset-wps', 'preset-hdl20a',
    'preset-geom620', 'preset-geom6b',
    'preset-ks28', 'preset-v-sub', 'preset-900-lfc', 'preset-sub-8006-as', 'preset-ls18',
  ];
  for (const id of singleBoxIds) {
    const c = PRESET_CASES.find(x => x.id === id);
    assert.ok(c, `${id} fehlt`);
    assert.equal(c.dollyPrompt, true, id);
  }
  const others = PRESET_CASES.filter(c => !singleBoxIds.includes(c.id));
  for (const c of others) assert.ok(!c.dollyPrompt, c.id);
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npm test`
Expected: FAIL – `assert.equal(c.dollyPrompt, true, ...)` schlägt für alle 13 IDs fehl
(`undefined !== true`).

- [ ] **Step 3: `dollyPrompt: true` an den 13 Vorlagen ergänzen**

In `js/data/preset-cases.js`, jede der 13 `opts`-Objekte um `dollyPrompt: true` erweitern,
z. B.:

```javascript
P('k2', 'L-Acoustics K2', 'Ton', 138, 40, 35, 56,
  { tippable: false, wheelH: 0, dollyPrompt: true, note: 'K2 Rigging Manual, Appendix C (l-acoustics.com)' }),
```

Genauso bei `v8v12`, `leopard`, `wpc`, `wps`, `hdl20a`, `geom620`, `geom6b`, `ks28`, `v-sub`,
`900-lfc`, `sub-8006-as`, `ls18` – jeweils `dollyPrompt: true` in das bestehende `opts`-Objekt
einfügen, sonst nichts an der Zeile ändern.

- [ ] **Step 4: Test laufen lassen, muss bestehen**

Run: `npm test`
Expected: PASS (alle Tests grün, inkl. der neuen 646+1).

- [ ] **Step 5: Commit**

```bash
git add js/data/preset-cases.js tests/presets.test.js
git commit -m "feat: Audio-Einzelboxen als dollyPrompt-Vorlagen markieren"
```

---

### Task 2: Alte feste Dolly-Stack-Presets als Legacy markieren

**Files:**
- Modify: `js/data/preset-cases.js:124-153` (Kommentarblock + die 8 `P('k2-4er-dolly', …)` …
  `P('geom6b-6er-dolly', …)`-Aufrufe)
- Modify: `tests/presets.test.js` (bestehende Tests, die die 8 alten Presets erwarten)

**Interfaces:**
- Produces: die 8 IDs `k2-4er-dolly, v8v12-4er-dolly, leopard-4er-dolly, wpc-4er-dolly,
  wps-4er-dolly, hdl20a-4er-dolly, geom620-6er-dolly, geom6b-6er-dolly` bleiben in
  `PRESET_CASES` bestehen, bekommen aber `legacy: true` (Maße/Gewicht unverändert) und
  verschwinden damit aus der Katalog-Anzeige (`js/ui/caseGroups.js`, `groupCases()` filtert
  `!c.legacy`), genau wie `preset-truss-29-3m`/`preset-truss-dolly`.

- [ ] **Step 1: Failing Test schreiben (Regression für alte Ladepläne)**

In `tests/presets.test.js`, direkt nach dem bestehenden Test
`'Legacy-Traversen-Presets aus V0.2 existieren weiter (für alte Ladepläne)'` einfügen:

```javascript
test('Legacy-Dolly-Stacks aus V0.10.0 existieren mit unveränderten Maßen weiter (für alte Ladepläne)', () => {
  const byId = id => PRESET_CASES.find(c => c.id === id);
  const k2 = byId('preset-k2-4er-dolly');
  assert.ok(k2, 'preset-k2-4er-dolly fehlt');
  assert.equal(k2.legacy, true);
  assert.equal(k2.l, 148);
  assert.equal(k2.w, 60);
  assert.equal(k2.h, 167);
  assert.equal(k2.weight, 224);
  const ids = [
    'preset-k2-4er-dolly', 'preset-v8v12-4er-dolly', 'preset-leopard-4er-dolly',
    'preset-wpc-4er-dolly', 'preset-wps-4er-dolly', 'preset-hdl20a-4er-dolly',
    'preset-geom620-6er-dolly', 'preset-geom6b-6er-dolly',
  ];
  for (const id of ids) assert.equal(byId(id)?.legacy, true, id);
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npm test`
Expected: FAIL – `legacy` ist bei allen 8 noch `undefined`.

- [ ] **Step 3: Die 8 Presets auf `legacy: true` umstellen, bestehende Tests anpassen**

In `js/data/preset-cases.js` bei jedem der 8 `P('…-dolly', …)`-Aufrufe `legacy: true`
ergänzen, z. B.:

```javascript
P('k2-4er-dolly', 'L-Acoustics K2 4er (auf Dolly)', 'Ton', 148, 60, 167, 224,
  { tippable: false, wheelH: 0, layers: [1], legacy: true, note: 'Gewicht geschätzt: Grundfläche/Höhe aus Boxenmaß hergeleitet, kein Dolly-Eigengewicht enthalten (docs/casemasse-gewichte.md)' }),
```

Den Kommentarblock davor (Zeilen 124-136) um einen Satz ergänzen: dass diese 8 Presets seit
V0.11.0 durch den Dolly-Dialog ersetzt und nur noch für alte Ladepläne als `legacy` erhalten
sind.

Jetzt in `tests/presets.test.js` die beiden Tests korrigieren, die bisher 21/8 aktive Presets
erwarteten:

1. Die `AUDIO_IDS`-Liste (ca. Zeile 51) auf die 13 Einzelboxen reduzieren:

```javascript
const AUDIO_IDS = [
  'preset-k2', 'preset-v8v12', 'preset-leopard', 'preset-wpc', 'preset-wps', 'preset-hdl20a',
  'preset-geom620', 'preset-geom6b',
  'preset-ks28', 'preset-v-sub', 'preset-900-lfc', 'preset-sub-8006-as', 'preset-ls18',
];
```

2. Im Test `'Audio-Vorlagen (Gewerk Ton) sind vollständig und neutral'` die erwartete Anzahl von
   `21` auf `13` ändern:

```javascript
assert.equal(audio.length, 13, 'erwartet: 13 Einzelboxen (Array-Tops + Subs)');
```

3. Den Test `'L-Acoustics K2 4er (auf Dolly): Maße und Gewicht stimmen mit der Dolly-Formel
   überein'` ersetzen (prüft jetzt den Legacy-Zustand statt eines aktiven Presets) – komplett
   löschen, die Prüfung übernimmt bereits der neue Test aus Step 1 dieser Task.

4. Den Test `'Array-Top-Stacks sind nur in Lage 1 erlaubt (der Stack ist bereits der volle
   Turm)'` löschen (prüfte ausschließlich die jetzt zu Legacy gewordenen 8 Presets über den
   Namens-Regex `/\(auf Dolly\)/`; die neue Dolly-Variante aus Task 3/4 unten bekommt
   `layers: [1]` bereits über `dollyStackCase()` und wird dort direkt getestet).

- [ ] **Step 4: Test laufen lassen, muss bestehen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/data/preset-cases.js tests/presets.test.js
git commit -m "fix: alte feste Dolly-Stack-Presets zu Legacy (ersetzt durch Dolly-Dialog)"
```

---

### Task 3: Reine Dolly-Geometrie-Funktion `dollyStackCase()`

**Files:**
- Create: `js/model/audioDolly.js`
- Test: `tests/audioDolly.test.js`

**Interfaces:**
- Consumes: ein Basis-Case-Objekt `{ id, name, category, l, w, h, weight }` (wie aus
  `PRESET_CASES`, Task 1).
- Produces: `dollyStackCase(baseCase, n)` – reine Funktion, gibt ein vollständiges,
  `checkCase()`-gültiges Case-Objekt zurück (Felder: `id, builtin, name, category, color, l,
  w, h, weight, tippable, stackable, wheelH, dimsInclWheels, layers`). Wird in Task 4 von
  `js/ui/dolly-wizard.js` verwendet.

- [ ] **Step 1: Failing Test schreiben**

Neue Datei `tests/audioDolly.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { dollyStackCase, DOLLY_WEIGHT_KG, DOLLY_HEIGHT_CM } from '../js/model/audioDolly.js';
import { checkCase } from '../js/store/io.js';
import { outerDims } from '../js/model/geometry.js';
import { mkCase } from './fixtures.js';

test('dollyStackCase: Konstanten aus der Recherche (Carvin/SYNQ/DAS, docs/casemasse-gewichte.md)', () => {
  assert.equal(DOLLY_HEIGHT_CM, 18);
  assert.equal(DOLLY_WEIGHT_KG, 15);
});

test('dollyStackCase: Fußabdruck bleibt die Basisbox, Höhe/Gewicht nach Formel', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 3);
  assert.equal(c.l, 78);
  assert.equal(c.w, 68);
  assert.equal(c.h, 3 * 51);
  assert.equal(c.weight, 15 + 3 * 56);
});

test('dollyStackCase: Dolly-Höhe steckt in wheelH, nicht in h (outerDims addiert sie)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 2);
  assert.equal(c.wheelH, 18);
  assert.equal(c.dimsInclWheels, false);
  assert.equal(outerDims(c).h, 2 * 51 + 18);
});

test('dollyStackCase: id/name tragen Basis-ID und Stückzahl, ohne company-Feld', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 4);
  assert.equal(c.id, 'preset-ls18-dolly-4');
  assert.equal(c.name, 'Nexo LS18 4er (auf Dolly)');
  assert.equal(c.company, undefined);
  assert.equal(c.category, 'Ton');
});

test('dollyStackCase: nie tippbar, Stack ist der volle Turm (nur Lage 1)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 1);
  assert.equal(c.tippable, false);
  assert.deepEqual(c.layers, [1]);
  assert.ok(c.stackable);
});

test('dollyStackCase: Gegenprobe L-Acoustics K2, Stückzahl 4 (reale Boxmaße)', () => {
  const k2 = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const c = dollyStackCase(k2, 4);
  assert.equal(c.l, 138);
  assert.equal(c.w, 40);
  assert.equal(c.h, 4 * 35);
  assert.equal(c.weight, 15 + 4 * 56);
});

test('dollyStackCase: Ergebnis besteht checkCase() auch bei großer Stückzahl (10 schwere Subs)', () => {
  const sub = mkCase('preset-sub-8006-as', 111, 71, 70, { weight: 96, name: 'RCF SUB 8006-AS', category: 'Ton' });
  const c = dollyStackCase(sub, 10);
  assert.doesNotThrow(() => checkCase(c));
});

test('dollyStackCase: Stückzahl 1 ist gültig (ein Dolly, eine Box)', () => {
  const base = mkCase('preset-geom6b', 37, 26, 19, { weight: 8, name: 'Nexo GEO M6B', category: 'Ton' });
  const c = dollyStackCase(base, 1);
  assert.equal(c.h, 19);
  assert.equal(c.weight, 23);
  assert.doesNotThrow(() => checkCase(c));
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npm test`
Expected: FAIL mit `Cannot find module '../js/model/audioDolly.js'`.

- [ ] **Step 3: `js/model/audioDolly.js` implementieren**

```javascript
import { colorFor } from '../data/categories.js';

// Recherche: Carvin DB521018 (81×75×20 cm, 18,3 kg, 4× 127-mm-Lenkrollen), SYNQ SQ-218 Dolly
// (11 kg, 4× 100-mm-Schwerlastrollen), DAS PL-EV118S (~81×71×18 cm Versandmaß, ~11 kg) –
// docs/casemasse-gewichte.md hat die volle Herleitung. Mittelwert aus den drei Quellen,
// dokumentiert statt erfunden (CLAUDE.md „Haltung“).
export const DOLLY_HEIGHT_CM = 18; // Rollen + Platte
export const DOLLY_WEIGHT_KG = 15; // Dolly-Eigengewicht, pauschal

// Baut den Case-Typ für „<Basisbox> N er (auf Dolly)“ – der Fußabdruck bleibt exakt der der
// Basisbox (Nutzer-Entscheidung: die reale, schmalere Dolly-Normbreite ändert nichts an der
// Pack-Logik, nur an der Dokumentation, s. docs/casemasse-gewichte.md). Die Dolly-Höhe steckt
// in `wheelH`/`dimsInclWheels: false`, nicht in `h` – dadurch zeichnet die bereits vorhandene
// 4-Rollen-Zeichnung in js/model/caseShape.js den Dolly automatisch mit, ohne neuen Zeichencode
// (bei 18 cm Rollenhöhe sichtbar größer/wuchtiger als die case-üblichen 12–16-cm-Blue-Wheels).
// `h` ist deshalb reine Stückzahl × Boxhöhe (Boxen stehen direkt aufeinander), `layers: [1]`,
// weil der Stack bereits der volle Turm ist – nichts kommt obendrauf.
export function dollyStackCase(baseCase, n) {
  return {
    id: `${baseCase.id}-dolly-${n}`,
    builtin: false,
    name: `${baseCase.name} ${n}er (auf Dolly)`,
    content: '',
    category: baseCase.category,
    color: colorFor(baseCase.category),
    l: baseCase.l,
    w: baseCase.w,
    h: n * baseCase.h,
    weight: DOLLY_WEIGHT_KG + n * baseCase.weight,
    tippable: false,
    stackable: true,
    maxTopLoad: null,
    wheelH: DOLLY_HEIGHT_CM,
    dimsInclWheels: false,
    layers: [1],
  };
}
```

- [ ] **Step 4: Test laufen lassen, muss bestehen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: `audioDolly.js` zur Offline-Liste hinzufügen**

In `sw.js`, die `ASSETS`-Liste (oder wie das Array dort heißt) um `js/model/audioDolly.js`
ergänzen, direkt neben den bestehenden Einträgen aus `js/model/`. Mit `grep -n "js/model/"
sw.js` die exakte bestehende Formatierung prüfen und genauso einfügen.

- [ ] **Step 6: Tests (inkl. PWA-Test) laufen lassen**

Run: `npm test`
Expected: PASS (inkl. `tests/pwa.test.js`, das die Vollständigkeit der Offline-Liste prüft).

- [ ] **Step 7: Commit**

```bash
git add js/model/audioDolly.js tests/audioDolly.test.js sw.js
git commit -m "feat: reine Dolly-Geometrie-Funktion dollyStackCase()"
```

---

### Task 4: Dolly-Dialog (`js/ui/dolly-wizard.js`)

**Files:**
- Create: `js/ui/dolly-wizard.js`
- Test: `tests/dolly-wizard.test.js` (nur der pure Anteil, analog `tests/truss-wizard.test.js`)

**Interfaces:**
- Consumes: `dollyStackCase(baseCase, n)` aus Task 3 (`js/model/audioDolly.js`).
- Produces: `openDollyDialog(dlg, opts)` mit `opts = { baseCase, onNewDollyStack }` (DOM-Dialog,
  nicht unit-getestet, analog `openTrussDialog()`). Rückgabe: `Promise<{ newCase, addition:
  { caseId, n } } | null>`. `newCase` ist bereits über `onNewDollyStack` gespeichert (gleiches
  Muster wie `newCases` bei `openTrussDialog()`). Wird in Task 5 von
  `js/ui/load-wizard.js` verwendet.

- [ ] **Step 1: Failing Test schreiben**

Neue Datei `tests/dolly-wizard.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { dollyStackCase } from '../js/model/audioDolly.js';
import { mkCase } from './fixtures.js';

// openDollyDialog() selbst ist ein DOM-Dialog (wie openTrussDialog()) und wird per Browser-
// Probe (tools/cdp.mjs) geprüft, nicht hier. Dieser Test sichert nur den reinen Baustein ab,
// den der Dialog beim Bestätigen aufruft.
test('dollyStackCase liefert ein für den Dialog passendes Case (Smoke-Test der Schnittstelle)', () => {
  const base = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const c = dollyStackCase(base, 2);
  assert.equal(c.id, 'preset-k2-dolly-2');
  assert.equal(c.name, 'L-Acoustics K2 2er (auf Dolly)');
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npm test`
Expected: PASS sofort (reiner Smoke-Test auf bereits vorhandener Funktion – stellt nur sicher,
dass der Import aus `js/ui/dolly-wizard.js`-Umgebung heraus funktioniert; die eigentliche
`openDollyDialog()`-DOM-Logik entsteht erst in Step 3).

- [ ] **Step 3: `js/ui/dolly-wizard.js` implementieren**

```javascript
import { esc } from './dom.js';
import { dollyStackCase } from '../model/audioDolly.js';

// opts: { baseCase, onNewDollyStack(caseType) }
// Ergebnis: { newCase, addition: { caseId, n } } oder null bei Abbruch/ungültiger Eingabe.
// Analog openTrussDialog() (js/ui/truss-wizard.js) – fragt NUR die Stückzahl ab, keine „ohne
// Dolly“-Option (Nutzer-Entscheidung: Line-Array-Tops/Subs stehen in der Praxis immer auf
// einem Dolly) und keine eigene Obergrenze (die bestehende Höhen-/Gewichtsprüfung beim
// Platzieren im Truck greift wie bei jedem anderen Case).
export function openDollyDialog(dlg, opts = {}) {
  if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }
  const base = opts.baseCase;

  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${esc(base.name)} auf Dolly laden</h2>
      <p class="hint">Line-Array-Elemente und Subwoofer stehen immer auf einem Dolly mit
        Schwerlastrollen – wie viele Boxen übereinander?</p>
      <label>Stückzahl auf diesem Dolly<input type="number" name="n" min="1" step="1" value="1" required></label>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save" class="primary">Hinzufügen</button>
      </menu>
    </form>`;

  const form = dlg.querySelector('form');
  const f = form.elements;

  form.addEventListener('submit', e => {
    const act = e.submitter?.value;
    if (act !== 'save') return;
    const n = Number(f.n.value);
    if (!(n > 0) || !Number.isInteger(n)) e.preventDefault();
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', async () => {
      const act = dlg.returnValue;
      if (act !== 'save') return resolve(null);
      const n = Number(f.n.value);
      if (!(n > 0) || !Number.isInteger(n)) return resolve(null);
      const caseType = dollyStackCase(base, n);
      const saved = await opts.onNewDollyStack?.(caseType);
      if (!saved) return resolve(null);
      resolve({ newCase: saved, addition: { caseId: saved.id, n: 1 } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
```

Hinweis zu `addition.n: 1`: Die Stückzahl **auf dem Dolly** (`n` im Dialog) ist bereits voll in
`dollyStackCase()` als EIN Case-Typ eingerechnet (Höhe/Gewicht). `addition.n` meint hier, anders
als bei `openTrussDialog()`, nicht „wie viele Boxen“, sondern „wie viele solcher
Dolly-Stack-Einheiten werden jetzt zur Load hinzugefügt“ – beim ersten Bestätigen immer 1 (der
Nutzer kann danach über den normalen „+“-Stepper der neu entstandenen Zeile weitere, identische
Dolly-Stacks ergänzen, ohne den Dialog erneut zu öffnen).

- [ ] **Step 4: Test laufen lassen, muss weiterhin bestehen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: `dolly-wizard.js` zur Offline-Liste hinzufügen**

In `sw.js`, die Datei `js/ui/dolly-wizard.js` neben den bestehenden `js/ui/`-Einträgen in die
`ASSETS`-Liste eintragen.

- [ ] **Step 6: Tests laufen lassen (inkl. PWA-Test)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/ui/dolly-wizard.js tests/dolly-wizard.test.js sw.js
git commit -m "feat: Dolly-Dialog (openDollyDialog) für Audio-Einzelboxen"
```

---

### Task 5: Dolly-Dialog in `load-wizard.js` einhängen

**Files:**
- Modify: `js/ui/load-wizard.js`
- Test: `tests/load-wizard.test.js`

**Interfaces:**
- Consumes: `openDollyDialog(dlg, opts)` aus Task 4; neues `opts.dollyDlg` (analog
  `opts.trussDlg`) und `opts.onNewDollyStack` (analog `opts.onNewTruss`) auf
  `openLoadWizard(dlg, opts)`.
- Produces: der Listen-Click-Handler öffnet bei `c.dollyPrompt === true` den Dolly-Dialog statt
  direkt zu inkrementieren; alle anderen Cases verhalten sich unverändert.

- [ ] **Step 1: Failing Test schreiben**

`openLoadWizard()` selbst ist (wie `openTrussDialog()`) ein kompletter DOM-Dialog und wird per
Browser-Probe geprüft (Task 7). Die einzige hier sinnvoll unit-testbare Logik ist, dass ein Case
mit `dollyPrompt: true` vom bestehenden, bereits exportierten `caseKind()`/den Filterfunktionen
unangetastet bleibt (kein neues „Dolly“-Tab o. Ä.). Test in `tests/load-wizard.test.js`
ergänzen, direkt nach den bestehenden Importen:

```javascript
import { caseKind } from './caseGroups.js';
```

Und als neuen Test anfügen:

```javascript
test('dollyPrompt-Cases bleiben im normalen "cases"-Tab (kein eigener Reiter nötig)', () => {
  const c = mkCase('preset-k2', 138, 40, 35, { category: 'Ton', dollyPrompt: true });
  assert.equal(caseKind(c), 'cases');
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npm test`
Expected: PASS sofort, falls `caseKind()` Audio-Presets schon korrekt als `'cases'`
klassifiziert (keine Traverse, kein Sonderbau) – dieser Test ist eine Absicherung, dass Task 5
diese bestehende Einordnung nicht versehentlich ändert, kein neues Verhalten.

- [ ] **Step 3: Listen-Click-Handler und `addDollyStack()` in `load-wizard.js` ergänzen**

Import am Dateianfang ergänzen (neben `import { openTrussDialog } from './truss-wizard.js';`):

```javascript
import { openDollyDialog } from './dolly-wizard.js';
```

Die JSDoc-Kommentarzeile über `openLoadWizard` (Zeile ~82-85) um die zwei neuen Opts ergänzen:

```javascript
// opts: { mode: 'new'|'add', cases, trucks, defaultTruckId, defaultName, onNewCase(draft),
//   trussDlg (<dialog> für „Traverse hinzufügen“, optional – ohne wird der Knopf ausgeblendet),
//   onNewTruss(caseType) (speichert einen neu gebauten Traversenwagen-Case-Typ, s. truss-wizard.js),
//   dollyDlg (<dialog> für „… auf Dolly laden“, optional – ohne öffnet „+“ bei dollyPrompt-Cases
//   nichts), onNewDollyStack(caseType) (speichert einen neuen Dolly-Stack-Case-Typ, s. dolly-wizard.js),
//   groups: string[] (vorhandene Gruppen des Loads, für die Vorschlagsliste im Gruppenfeld) }
```

Den bestehenden Click-Handler (Zeile ~236-248) ersetzen:

```javascript
list.addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('[data-case]')?.dataset.case;
  if (!id) return;
  if (btn.dataset.act === 'inc') {
    const c = cases.find(x => x.id === id);
    if (c?.dollyPrompt && opts.dollyDlg) { addDollyStack(c); return; }
  }
  const cur = counts.get(id) ?? 0;
  if (btn.dataset.act === 'inc' && total() < MAX_ITEMS) counts.set(id, cur + 1);
  if (btn.dataset.act === 'dec' && cur > 0) {
    const nv = cur - 1;
    if (nv <= 0) counts.delete(id); else counts.set(id, nv);
  }
  renderCaseList();
});
```

Direkt nach `addTruss()` (nach Zeile ~307, vor `if (opts.trussDlg) newTrussBtn...`) die neue
Funktion einfügen:

```javascript
// „<Box> auf Dolly laden“ (Task 5): öffnet sich automatisch, wenn „+“ bei einer
// dollyPrompt-Vorlage geklickt wird (s. Listen-Click-Handler oben) – dieselbe Mechanik wie
// addTruss(), nur ausgelöst durch den Stepper statt einen eigenen Button. Der erzeugte
// Dolly-Stack-Case-Typ erscheint danach als eigene Zeile mit normalem +/−-Stepper (kein
// dollyPrompt auf dem Ergebnis von dollyStackCase()), weitere gleiche Stacks lassen sich also
// ganz normal per „+“ ergänzen, ohne den Dialog erneut zu öffnen.
async function addDollyStack(baseCase) {
  const res = await openDollyDialog(opts.dollyDlg, { baseCase, onNewDollyStack: opts.onNewDollyStack });
  if (!res) return;
  cases = [...cases.filter(c => c.id !== res.newCase.id), res.newCase];
  const room = MAX_ITEMS - total();
  if (room > 0) counts.set(res.addition.caseId, (counts.get(res.addition.caseId) ?? 0) + Math.min(res.addition.n, room));
  renderCompanyOptions();
  renderCaseList();
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/load-wizard.js tests/load-wizard.test.js
git commit -m "feat: Dolly-Dialog bei dollyPrompt-Vorlagen im Lade-Wizard einhängen"
```

---

### Task 6: Dialog-Element und Store-Wiring

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `sw.js` (falls `index.html`-Änderungen die Offline-Liste berühren – hier nicht der
  Fall, nur zur Vollständigkeit prüfen)

**Interfaces:**
- Consumes: `openLoadWizard(dlg, opts)` aus Task 5 (neue Opts `dollyDlg`, `onNewDollyStack`);
  `saveCaseValue(rawValue)` aus `js/app.js` (bereits vorhanden, Zeile 232).
- Produces: `<dialog id="dlg-dolly"></dialog>` in `index.html`; `runLoadWizard()` übergibt
  `dollyDlg: $('#dlg-dolly')` und `onNewDollyStack: saveCaseValue`.

- [ ] **Step 1: `<dialog>`-Element ergänzen**

In `index.html`, direkt nach Zeile 108 (`<dialog id="dlg-truss"></dialog>`):

```html
  <dialog id="dlg-wizard"></dialog>
  <dialog id="dlg-truss"></dialog>
  <dialog id="dlg-dolly"></dialog>
```

- [ ] **Step 2: Store-Wiring in `js/app.js` ergänzen**

In `runLoadWizard()` (Zeile ~292-304), den bestehenden Aufruf von `openLoadWizard()` um die
zwei neuen Opts erweitern:

```javascript
  const res = await openLoadWizard($('#dlg-wizard'), {
    mode,
    cases: s.cases,
    trucks: s.trucks,
    defaultTruckId: s.plan ? ctx().truck.id : DEFAULT_TRUCK_ID,
    defaultName: `Load ${new Date().toLocaleDateString('de-DE')}`,
    onNewCase: newCaseForWizard,
    trussDlg: $('#dlg-truss'),
    onNewTruss: saveCaseValue,
    dollyDlg: $('#dlg-dolly'),
    onNewDollyStack: saveCaseValue,
    groups: mode === 'add' && s.plan ? ruleTargets([...s.plan.placements, ...s.plan.unplaced], ctx().caseById).groups : [],
  });
```

`saveCaseValue` ist bereits vollständig generisch (stempelt, speichert über `repo.saveCase()`,
aktualisiert den Store) – kein neuer Code in `js/app.js` nötig außer dieser einen Zeile.

- [ ] **Step 3: Tests und Typografie-Prüfung laufen lassen**

Run: `npm test`
Expected: PASS.

Run (Typografie-Check, CLAUDE.md-Pflicht bei jeder Textänderung):

```bash
python3 -c "
import re
for p in ['index.html']:
    s = open(p, encoding='utf-8').read()
    bad = re.findall(chr(0x201e) + '[^' + chr(0x201c) + chr(0x201d) + '\"\n]*\"', s)
    print(p, 'opens=', s.count(chr(0x201e)), 'closes=', s.count(chr(0x201c)), 'ASCII-Treffer:', bad)
"
```

Expected: keine ASCII-Treffer (diese Task fügt kein neues „…“ in `index.html` ein, daher sollte
sich die Zählung gegenüber vorher nicht ändern).

- [ ] **Step 4: Commit**

```bash
git add index.html js/app.js
git commit -m "feat: Dolly-Dialog-Element und Store-Wiring verdrahten"
```

---

### Task 7: Browser-Probe (End-to-End-Verifikation)

**Files:**
- Keine Code-Änderung – reine Verifikation mit `tools/cdp.mjs` (Projektkonvention, CLAUDE.md).

**Interfaces:**
- Consumes: die komplette Dolly-Dialog-Funktionalität aus Task 1–6.

- [ ] **Step 1: Lokalen Server starten**

```bash
python3 -m http.server 8766
```

(im Projektverzeichnis, in einem zweiten Terminal/Hintergrundprozess laufen lassen)

- [ ] **Step 2: Szenario-Skript schreiben**

Im Scratchpad der Sitzung (nicht im Projekt) eine Datei `dolly-probe.mjs` anlegen:

```javascript
export default async function (p) {
  await p.goto('http://localhost:8766/');
  await p.eval(async () => {
    const { store } = await import('/js/store/store.js');
    // Zustand direkt über den Store aufbauen, s. CLAUDE.md "Im Browser" – kein Klicken nötig,
    // um den Lade-Wizard zu öffnen; wir prüfen hier nur, dass die Audio-Presets korrekt
    // markiert aus dem Store kommen.
    const s = store.get();
    const k2 = s.cases.find(c => c.id === 'preset-k2');
    const legacyStack = s.cases.find(c => c.id === 'preset-k2-4er-dolly');
    window.__probe = {
      k2DollyPrompt: k2?.dollyPrompt,
      legacyStackIsLegacy: legacyStack?.legacy,
    };
  });
  const result = await p.eval(() => window.__probe);
  console.log(JSON.stringify(result));
  await p.shot('dolly-probe-store');
}
```

Falls der Store-Importpfad in Schritt 2 nicht exakt `/js/store/store.js` ist: vor dem Schreiben
dieses Skripts mit `grep -n "export const store" js/store/*.js` den tatsächlichen Pfad prüfen
und anpassen.

- [ ] **Step 3: Szenario ausführen**

```bash
node tools/cdp.mjs ./dolly-probe.mjs ./dolly-probe-output
```

Expected: `{"k2DollyPrompt":true,"legacyStackIsLegacy":true}` in der Konsolenausgabe, kein
JS-Fehler in den Logs (`p.logs`).

- [ ] **Step 4: Lade-Wizard-Flow manuell über ein zweites Szenario prüfen**

Erweiterung von `dolly-probe.mjs` (oder zweites Skript), das den Lade-Wizard öffnet, zum Reiter
„Ton“ wechselt, bei „Nexo LS18“ auf „+“ klickt (dollyPrompt-Case → Dialog muss aufgehen statt
direkt zu inkrementieren), Stückzahl 3 einträgt, bestätigt, und prüft, dass danach eine Zeile
„Nexo LS18 3er (auf Dolly)“ mit „1 Stück“ in der Liste erscheint. Beim Klicken auf UI-Elemente,
die `renderCaseList()` neu aufbauen, Elemente bei jedem Schritt frisch über
`document.querySelector` erneut auswählen statt eine zuvor gehaltene Referenz
wiederzuverwenden (CLAUDE.md-Fallstrick, bereits einmal in dieser Codebasis aufgetreten).

- [ ] **Step 5: Ergebnis dokumentieren**

Kein Commit nötig (reine Verifikation) – im Implementierungs-Log/Abschlussbericht kurz
festhalten, dass die Browser-Probe erfolgreich war.

---

### Task 8: Dokumentation

**Files:**
- Modify: `docs/casemasse-gewichte.md`
- Modify: `docs/architektur.md`

**Interfaces:**
- Keine Code-Schnittstelle – reine Dokumentation der in Task 1–6 umgesetzten Entscheidungen.

- [ ] **Step 1: `docs/casemasse-gewichte.md` ergänzen**

Neuen Abschnitt `## Gewerk Audio 2026-10-07: Dolly-Pflicht für Line-Array-Tops und Subs` ganz
oben in die Datei einfügen (vor dem bisher obersten Abschnitt), mit: der Carvin
DB521018/SYNQ SQ-218/DAS PL-EV118S-Tabelle aus der Spec (Task-Kontext oben), der Herleitung
„18 cm Dolly-Höhe, 15 kg Dolly-Gewicht“, der 60/80/124-Breitenregel mit den zwei Beispielen
(K2 → 60 cm, RCF SUB 8006-AS → 80 cm) und einem Satz, dass diese Regel nur die Dokumentation
betrifft, nicht die Pack-Logik (Fußabdruck bleibt `l × w` der Basisbox).

- [ ] **Step 2: `docs/architektur.md` ergänzen**

Im Abschnitt, der den Traversenwagen-Dialog beschreibt (`openTrussDialog()`/`addTruss()`),
einen Absatz zum neuen Dolly-Dialog ergänzen: dass `dollyPrompt`-Vorlagen beim Klick auf „+“
immer `openDollyDialog()` statt des normalen Steppers auslösen, dass der erzeugte Case-Typ
(`dollyStackCase()`, `js/model/audioDolly.js`) danach wie ein Traversenwagen-Typ als normale
Zeile erscheint, und dass die 8 vorherigen festen „…4er/6er (auf Dolly)“-Presets dafür zu
`legacy: true` wurden.

- [ ] **Step 3: Typografie-Prüfung**

```bash
python3 -c "
import re
for p in ['docs/casemasse-gewichte.md', 'docs/architektur.md']:
    s = open(p, encoding='utf-8').read()
    bad = re.findall(chr(0x201e) + '[^' + chr(0x201c) + chr(0x201d) + '\"\n]*\"', s)
    print(p, 'opens=', s.count(chr(0x201e)), 'closes=', s.count(chr(0x201c)), 'ASCII-Treffer:', bad)
"
```

Expected: `opens == closes` für beide Dateien, leere `ASCII-Treffer`-Liste.

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test`
Expected: PASS (reine Doku-Änderung, darf nichts an der Testsuite ändern).

- [ ] **Step 5: Commit**

```bash
git add docs/casemasse-gewichte.md docs/architektur.md
git commit -m "docs: Dolly-Pflicht für Line-Array-Tops und Subs dokumentieren"
```

---

### Task 9: Version, Changelog, Veröffentlichung

**Files:**
- Modify: `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`,
  `CHANGELOG.md`

**Interfaces:**
- Keine Code-Schnittstelle – Versionsritual nach CLAUDE.md.

- [ ] **Step 1: Nächste Versionsnummer mit dem Nutzer abstimmen**

Per `AskUserQuestion` vorschlagen: Patch-Schritt (CLAUDE.md: „Fast immer ein Patch-Schritt –
auch für echte Verhaltensänderungen“), voraussichtlich `0.11.0`, falls der zuletzt
veröffentlichte Stand `0.10.0` ist – vor dem Vorschlag mit
`curl -s https://m4dm0nky.github.io/Truckload/js/version.js` den tatsächlich live stehenden
Stand prüfen, nicht den lokalen HEAD annehmen (CLAUDE.md-Regel bei mehreren Aufgaben in einer
Sitzung).

- [ ] **Step 2: Versionsnummer an allen 6 Stellen setzen**

Nach demselben Muster wie beim V0.10.0-Release: `js/version.js` (`APP_VERSION`),
`package.json` (`"version"`), `sw.js` (`CACHE`-Konstante), `index.html` (`#app-version`-Span),
`README.md` (Versionszeile oben).

- [ ] **Step 3: `CHANGELOG.md`-Eintrag schreiben**

Neuer oberster Eintrag, der beschreibt: Dolly-Pflicht für die 13 Audio-Einzelboxen über einen
neuen Dialog, beliebige Stückzahl statt fester 4er/6er-Pakete, die 8 alten festen Presets sind
jetzt Legacy (alte Ladepläne laden unverändert weiter).

- [ ] **Step 4: `tests/version.test.js` und volle Suite laufen lassen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit, Merge, Push, Veröffentlichen**

Nach CLAUDE.md-Ablauf („Veröffentlichen“): committen, nach `main` pushen ohne weitere
Rückfrage (Versionsnummer wurde in Step 1 bereits abgestimmt), bei Bedarf
`gh api -X POST repos/m4dm0nky/Truckload/pages/builds` auslösen, dann
`https://m4dm0nky.github.io/Truckload/js/version.js` pollen, bis die neue Nummer live ist.

---

## Self-Review

**1. Spec-Abdeckung:** Recherche-Konstanten (Task 3), 60/80/124-Regel (Task 8, Dokumentation
wie in der Spec festgelegt), dynamischer Dialog statt fester Presets (Task 1/2/4/5), Legacy
statt Löschen (Task 2, Korrektur gegenüber einer zu wörtlichen Lesart der Spec – siehe Review
Focus), Geometrie-Formel (Task 3), Store-Wiring über `saveCaseValue` (Task 6), Versionierung
(Task 9) – alle Spec-Abschnitte haben eine Task.

**2. Placeholder-Scan:** Keine TBD/TODO; alle Code-Blöcke sind vollständig, keine
„ähnlich wie Task N“-Verweise ohne Code.

**3. Typkonsistenz:** `dollyStackCase(baseCase, n)` (Task 3) wird in Task 4 exakt mit diesem
Namen und dieser Signatur importiert; `openDollyDialog(dlg, opts)` (Task 4) wird in Task 5
exakt mit `{ baseCase, onNewDollyStack }` aufgerufen; `addDollyStack(baseCase)` (Task 5)
übergibt `baseCase` an `openDollyDialog()` wie dort erwartet.

**4. Review Focus:** Alle 5 Punkte haben einen eigenen Test erhalten: Legacy-Regression
(Task 2, Step 1), ungültige Stückzahl (Task 4, `openDollyDialog()`-Validierung – nicht separat
unit-getestet, da DOM, aber durch Step 3-Implementierung abgedeckt und in Task 7 Browser-Probe
verifizierbar), deterministische ID bei Wiederholung (Task 3, `id` ist rein aus `baseCase.id`
und `n` gebildet, kein `crypto.randomUUID()` wie bei Traversenwagen – bewusst anders, weil hier
Wiederholbarkeit gewollt ist), `checkCase()` bei großer Stückzahl (Task 3, Test „Ergebnis
besteht checkCase() auch bei großer Stückzahl“), `MAX_ITEMS`-Kappung (Task 5,
`addDollyStack()` kappt auf `room = MAX_ITEMS - total()`).
