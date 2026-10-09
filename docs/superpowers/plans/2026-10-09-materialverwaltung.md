# Materialverwaltung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eigener, immer erreichbarer Bereich „Material“, in dem Firmen und ihre Cases, Traversenwagen und Boxen-Dollys gepflegt werden; Löschen nur dort; Anlegen überall mit Häkchen „Im Materialbestand ablegen“.

**Architecture:** Firma bleibt der `company`-String am Case (keine neue DB-Tabelle). Reine Logik in `js/model/material.js` (Firmenliste, Umbenennen, Löschen-als-legacy, Kopieren, Ablageziel). Gemeinsamer Formularblock `js/ui/stock-target.js` für Case-Editor, Traversen- und Dolly-Dialog. Neues UI-Modul `js/ui/material.js` als eigener Bildschirm neben Startbildschirm und Planansicht, verdrahtet in `js/app.js`.

**Tech Stack:** Reine ES-Module ohne Build, `node --test`, IndexedDB über `js/store/repo.js`, Browser-Prüfung über `tools/cdp.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-09-materialverwaltung-design.md` (inkl. „Nachtrag 2026-10-09“)

## Global Constraints

- Keine npm-Abhängigkeit, kein Build-Schritt; `package.json` behält nur `npm test`.
- Nutzereingaben in HTML nur über `esc()` aus `js/ui/dom.js` (Firmennamen kommen aus Importdateien).
- Oberfläche Deutsch, typografische Anführungszeichen „…“.
- Jede neue Datei unter `js/` oder `css/` in `ASSETS` von `sw.js` (`tests/pwa.test.js`).
- Alte Daten laden weiter: fehlende Felder = Vorgabe; Regressionstest mit altem Schema je Modelländerung.
- Version: eine Nummer überall (`js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`-Cache, CHANGELOG). Vorschlag 0.12.5 – vor dem Commit bestätigen lassen.
- Mitgelieferter Standardkatalog (`preset-`-IDs) bleibt nur lesbar; Firmen-Vorlagen (`lib-`-IDs) werden per Überlagerung mit gleicher ID editierbar.
- Commit-Abschluss: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Bearbeitete CAB-Zeile überlebt Sicherung + Import** (heute verwirft `isPreset` jede `lib-`-ID) – Test in Task 2.
2. **„Nur für diesen Load“-Case verdeckt kein Bestands-Case**: ein Dolly-Stack ohne Häkchen darf nicht dieselbe ID wie ein Bestands-Stack bekommen – Test in Task 4.
3. **Firma umbenennen mit Vorlagen-Einträgen**: `lib-`-Einträge werden zu Überlagerungen, Pläne behalten die `caseId` – Test in Task 1.
4. **Materialseite ohne offenen Plan**: `usage()` in `js/app.js` greift auf `s.plan.id` zu und würde auf dem Startbildschirm werfen – null-sicher machen, Browser-Probe in Task 6.
5. **Neu im Wizard angelegtes „nur Load“-Case bleibt im Wizard sichtbar** (sonst lässt sich die Stückzahl nicht mehr ändern) – Test in Task 1 (`keep`), Probe in Task 5.

---

### Task 1: Reine Logik Materialbestand

**Files:**
- Create: `js/model/material.js`
- Modify: `js/ui/caseGroups.js` (`companiesOf`, `groupCases`)
- Test: `tests/material.test.js`, `tests/caseGroups.test.js`

**Interfaces:**
- Produces:
  - `isInStock(c) → boolean` (nicht `legacy`, nicht `onlyInPlan`)
  - `companyList(cases, extra = []) → [{ name, count }]` alphabetisch (de), nur Bestands-Cases mit `company`; `extra`-Namen (leere, frisch angelegte Firmen) mit `count: 0`
  - `casesOf(cases, company) → Case[]`; `company === ''` = Standardliste (ohne `company`)
  - `onlyInPlanCases(cases) → Case[]`
  - `renameCompany(cases, from, to) → Case[]` (zu speichernde Datensätze)
  - `deletionFor(c) → { remove: id } | { save: Case } | null` (`null` = Standardvorlage, nicht löschbar)
  - `copyToCompany(c, company, id) → Case`
  - `applyStockTarget(c, { inStock, company }) → Case`
  - `groupCases(cases, { q, cat, company, keep })` – `keep: Set<id>` zeigt `onlyInPlan`-Cases trotzdem
  - `groupCases(...).own` enthält keine `source: 'liste'`-Einträge mehr; `.list` enthält eigene Überlagerungen mit `source: 'liste'`

- [ ] **Step 1: Failing tests schreiben** – `tests/material.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isInStock, companyList, casesOf, onlyInPlanCases, renameCompany, deletionFor, copyToCompany, applyStockTarget } from '../js/model/material.js';

const lib = { id: 'lib-k1', builtin: true, source: 'liste', name: 'K1 -CAB', company: 'CAB', l: 1, w: 1, h: 1, weight: 0 };
const own = { id: 'u1', builtin: false, name: 'Mein Case', company: 'Test', l: 1, w: 1, h: 1, weight: 1 };
const std = { id: 'u2', builtin: false, name: 'Standard eigen', l: 1, w: 1, h: 1, weight: 1 };
const preset = { id: 'preset-x', builtin: true, name: 'Packcase', l: 1, w: 1, h: 1, weight: 1 };
const gone = { ...lib, id: 'lib-alt', legacy: true };
const tmp = { id: 'u3', builtin: false, name: 'Nur Load', onlyInPlan: true, l: 1, w: 1, h: 1, weight: 1 };
const all = [lib, own, std, preset, gone, tmp];

test('isInStock: legacy und onlyInPlan gehören nicht zum Bestand', () => {
  assert.deepEqual(all.filter(isInStock).map(c => c.id), ['lib-k1', 'u1', 'u2', 'preset-x']);
});
test('companyList: Firmen mit Anzahl, alphabetisch, leere Zusatzfirma mit 0', () => {
  assert.deepEqual(companyList(all, ['Neu']), [{ name: 'CAB', count: 1 }, { name: 'Neu', count: 0 }, { name: 'Test', count: 1 }]);
});
test('casesOf: Firma bzw. Standardliste ohne company', () => {
  assert.deepEqual(casesOf(all, 'CAB').map(c => c.id), ['lib-k1']);
  assert.deepEqual(casesOf(all, '').map(c => c.id), ['u2', 'preset-x']);
});
test('onlyInPlanCases', () => {
  assert.deepEqual(onlyInPlanCases(all).map(c => c.id), ['u3']);
});
test('renameCompany: Vorlagen werden zu Überlagerungen mit gleicher ID', () => {
  const out = renameCompany(all, 'CAB', 'CAB Berlin');
  assert.deepEqual(out.map(c => [c.id, c.builtin, c.company, c.source]), [['lib-k1', false, 'CAB Berlin', 'liste'], ['lib-alt', false, 'CAB Berlin', 'liste']]);
});
test('deletionFor: eigenes Case entfernen, Firmen-Vorlage ausblenden, Standardvorlage nie', () => {
  assert.deepEqual(deletionFor(own), { remove: 'u1' });
  assert.deepEqual(deletionFor(lib), { save: { ...lib, builtin: false, legacy: true } });
  assert.equal(deletionFor(preset), null);
});
test('copyToCompany: neue ID, eigenes Case, Firma gesetzt, Herkunftsfelder weg', () => {
  const c = copyToCompany({ ...preset, note: 'Richtwert', legacy: true }, 'Test', 'n1');
  assert.equal(c.id, 'n1'); assert.equal(c.builtin, false); assert.equal(c.company, 'Test');
  assert.equal(c.note, undefined); assert.equal(c.legacy, undefined); assert.equal(c.source, undefined);
  assert.equal(copyToCompany(preset, '', 'n2').company, undefined);
});
test('applyStockTarget: Firma, Standardliste, nur Load', () => {
  assert.equal(applyStockTarget(std, { inStock: true, company: 'Test' }).company, 'Test');
  const s = applyStockTarget(own, { inStock: true, company: '' });
  assert.equal(s.company, undefined); assert.equal(s.onlyInPlan, undefined);
  const t = applyStockTarget(own, { inStock: false, company: 'Test' });
  assert.equal(t.onlyInPlan, true); assert.equal(t.company, undefined);
});
```

Ergänzung in `tests/caseGroups.test.js`:

```js
test('groupCases: onlyInPlan nur mit keep sichtbar, companiesOf ignoriert es', () => {
  const tmp = { id: 't', builtin: false, name: 'T', company: 'X', onlyInPlan: true, category: 'Ton' };
  assert.equal(groupCases([tmp]).own.length, 0);
  assert.equal(groupCases([tmp], { keep: new Set(['t']) }).own.length, 1);
  assert.deepEqual(companiesOf([tmp]), []);
});
test('groupCases: bearbeitete Listen-Einträge bleiben in „Cases aus deiner Liste“', () => {
  const over = { id: 'lib-a', builtin: false, source: 'liste', name: 'A', category: 'Ton' };
  const g = groupCases([over]);
  assert.equal(g.own.length, 0); assert.equal(g.list.length, 1);
});
```

- [ ] **Step 2: Tests laufen lassen** – `npm test` → FAIL („Cannot find module …/material.js“, die zwei neuen caseGroups-Tests rot).

- [ ] **Step 3: Implementieren** – `js/model/material.js`:

```js
// Materialbestand (V 0.12.5, docs/superpowers/specs/2026-10-09-materialverwaltung-design.md):
// Firma = `company`-String am Case, keine eigene Tabelle. Reine Funktionen, kein DOM, kein Store.
// `legacy` = ausgeblendet (gelöschte Firmen-Vorlage, alte Ladepläne behalten das Stück),
// `onlyInPlan` = im Wizard ohne „Im Materialbestand ablegen“ angelegt, gilt nur für den Load.
export const isInStock = c => !c.legacy && !c.onlyInPlan;

export function companyList(cases, extra = []) {
  const counts = new Map(extra.map(n => [n, 0]));
  for (const c of cases) if (isInStock(c) && c.company) counts.set(c.company, (counts.get(c.company) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export const casesOf = (cases, company) =>
  cases.filter(c => isInStock(c) && (company ? c.company === company : !c.company));

export const onlyInPlanCases = cases => cases.filter(c => c.onlyInPlan && !c.legacy);

// Firmen-Vorlagen (`lib-`) werden dabei zu eigenen Überlagerungen mit gleicher ID
// (mergeOwnWithBuiltins, js/store/repo.js) – Pläne verweisen weiter per caseId.
export const renameCompany = (cases, from, to) =>
  cases.filter(c => c.company === from).map(c => ({ ...c, builtin: false, company: to }));

// Standardvorlagen (`preset-`) sind nur lesbar; Firmen-Vorlagen werden ausgeblendet statt
// entfernt (sonst käme die mitgelieferte Version beim nächsten Start zurück).
export function deletionFor(c) {
  if (!c.builtin) return { remove: c.id };
  if (c.id.startsWith('preset-')) return null;
  return { save: { ...c, builtin: false, legacy: true } };
}

export const copyToCompany = (c, company, id) => ({
  ...c, id, builtin: false, company: company || undefined,
  source: undefined, note: undefined, legacy: undefined, onlyInPlan: undefined,
});

export const applyStockTarget = (c, { inStock, company }) => ({
  ...c,
  company: inStock && company ? company : undefined,
  onlyInPlan: inStock ? undefined : true,
});
```

`js/ui/caseGroups.js`:
- `companiesOf`: `cases.filter(c => !c.legacy && !c.onlyInPlan)`.
- `groupCases(cases, { q = '', cat = '', company = '', keep = new Set() } = {})`: in `match` zusätzlich `(!c.onlyInPlan || keep.has(c.id))`; `own: cases.filter(c => !c.builtin && c.source !== 'liste' && match(c))…`; `list: cases.filter(c => !c.legacy && c.source === 'liste' && match(c))`; `presets` unverändert. Kommentar über `groupCases` um einen Satz zu `keep`/`onlyInPlan` ergänzen.

- [ ] **Step 4: `npm test`** → PASS (alle).
- [ ] **Step 5: Commit** – `git add js/model/material.js js/ui/caseGroups.js tests/material.test.js tests/caseGroups.test.js && git commit -m "feat: reine Logik für den Materialbestand (Firmen, Löschen als legacy, Ablageziel)"`

---

### Task 2: Speichern, Import, Validierung

**Files:**
- Modify: `js/store/io.js:22-23` (`isPreset`), `checkCase` (propsOk)
- Test: `tests/io.test.js`

**Interfaces:**
- Consumes: Case-Felder `company`, `legacy`, `onlyInPlan` aus Task 1.
- Produces: eigene Überlagerungen mit `lib-`-ID überleben `exportBundle` → `parseBundle`.

- [ ] **Step 1: Failing tests** in `tests/io.test.js` (Import-Kopf der Datei hat `exportBundle`, `parseBundle`, `checkCase` bereits – sonst ergänzen):

```js
test('Materialbestand: bearbeitete Firmen-Vorlage (lib-ID, builtin:false) überlebt Sicherung und Import', () => {
  const over = { id: 'lib-k1-cab', builtin: false, source: 'liste', company: 'CAB', name: 'K1 geändert', category: 'Ton', l: 100, w: 60, h: 80, weight: 40 };
  const text = JSON.stringify(exportBundle({ cases: [over], trucks: [], plans: [] }));
  const { cases } = parseBundle(text);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].company, 'CAB');
});
test('Materialbestand: mitgelieferte Einträge (builtin:true) bleiben beim Import ausgefiltert', () => {
  const text = JSON.stringify({ format: 'truckload', version: 1, cases: [
    { id: 'lib-x', builtin: true, name: 'X', l: 1, w: 1, h: 1, weight: 0 },
    { id: 'preset-y', builtin: false, name: 'Y', l: 1, w: 1, h: 1, weight: 0 },
    { id: 'u1', name: 'Z', l: 1, w: 1, h: 1, weight: 0 }] });
  assert.deepEqual(parseBundle(text).cases.map(c => c.id), ['u1']);
});
test('checkCase: company/legacy/onlyInPlan werden geprüft, fehlen darf jedes (altes Schema)', () => {
  const base = { id: 'a', name: 'A', l: 1, w: 1, h: 1, weight: 0 };
  checkCase(base);
  checkCase({ ...base, company: 'CAB', legacy: true, onlyInPlan: true });
  assert.throws(() => checkCase({ ...base, company: 5 }));
  assert.throws(() => checkCase({ ...base, onlyInPlan: 'ja' }));
});
```

Vorher in der Datei nachsehen, welche `format`/`version`-Werte `exportBundle` schreibt (`FORMAT`, `VERSION` in `js/store/io.js`) und den zweiten Test darauf anpassen.

- [ ] **Step 2: `npm test`** → FAIL (erster Test: 0 Cases; dritter: kein throw).
- [ ] **Step 3: Implementieren**

```js
// Mitgeliefertes nie aus fremden Dateien übernehmen. `preset-` (Standardkatalog, nur lesbar)
// immer verwerfen; `lib-` (Firmen-Vorlagen) nur, wenn als mitgeliefert markiert – seit V 0.12.5
// sind eigene Überlagerungen mit gleicher lib-ID gewollt (Materialverwaltung).
const isPreset = x => !!x?.builtin || (typeof x?.id === 'string' && x.id.startsWith('preset-'));
```

In `checkCase` an `propsOk` anhängen:

```js
    && (c.company === undefined || (typeof c.company === 'string' && c.company.length <= 80))
    && (c.legacy === undefined || typeof c.legacy === 'boolean')
    && (c.onlyInPlan === undefined || typeof c.onlyInPlan === 'boolean')
```

Docs-Absatz in `docs/architektur.md` „Speicherung und Austausch“ („IDs, die mit `preset-` oder `lib-` beginnen, werden … verworfen“) entsprechend korrigieren.

- [ ] **Step 4: `npm test`** → PASS. Falls ein bestehender io-Test genau das alte `lib-`-Verwerfen prüft: auf `builtin: true` umstellen und im Commit erwähnen.
- [ ] **Step 5: Commit** – `git commit -am "feat: eigene Überlagerungen von Firmen-Vorlagen überleben Sicherung/Import"`

---

### Task 3: Ablageziel-Block und Case-Editor

**Files:**
- Create: `js/ui/stock-target.js`
- Modify: `js/ui/case-editor.js`, `sw.js` (ASSETS), `js/app.js` (`editCase`, `newCaseForWizard`)
- Test: `tests/stock-target.test.js`

**Interfaces:**
- Consumes: `applyStockTarget` (Task 1).
- Produces:
  - `stockTargetHtml(stock) → string`; `stock` ist `{ mode: 'choose', companies: string[], defaultCompany: string }` (Wizard: Häkchen + Ziel) oder `{ mode: 'fixed', company: string }` (Materialseite: nur Anzeige „Firma: …“, Ziel fest)
  - `readStockTarget(form, stock) → { inStock: boolean, company: string }`
  - `wireStockTarget(form)` – deaktiviert die Zielauswahl, solange das Häkchen aus ist
  - `openCaseEditor(dlg, c, { usedIn, draft, allowDelete = false, stock, overrideBuiltin = false })`:
    - Löschen-Knopf nur bei `allowDelete && !isNew`
    - `overrideBuiltin`: Vorlage wird mit **derselben ID** gespeichert (`builtin:false`, `company`/`source` bleiben, Name ohne „(eigenes)“)
    - mit `stock`: Ergebnis durch `applyStockTarget`; ohne `stock`: vorhandene `company`/`onlyInPlan`/`source` des bearbeiteten Cases bleiben erhalten (heute werden sie geleert)

- [ ] **Step 1: Failing test** `tests/stock-target.test.js` (reine String-/Objektlogik, mit Minimal-Formular-Attrappe):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { stockTargetHtml, readStockTarget } from '../js/ui/stock-target.js';

test('stockTargetHtml (choose): Häkchen an, Standardliste + Firmen, Firmennamen escaped', () => {
  const html = stockTargetHtml({ mode: 'choose', companies: ['CAB', '<b>X'], defaultCompany: 'CAB' });
  assert.match(html, /name="inStock" checked/);
  assert.match(html, /<option value="">Standardliste<\/option>/);
  assert.match(html, /<option value="CAB" selected>CAB<\/option>/);
  assert.match(html, /&lt;b&gt;X/);
});
test('stockTargetHtml (fixed): kein Häkchen, Firma als Hinweis', () => {
  const html = stockTargetHtml({ mode: 'fixed', company: 'CAB' });
  assert.doesNotMatch(html, /inStock/);
  assert.match(html, /Firma: CAB/);
  assert.match(stockTargetHtml({ mode: 'fixed', company: '' }), /Standardliste/);
});
test('readStockTarget', () => {
  const form = { elements: { inStock: { checked: false }, stockCompany: { value: 'CAB' } } };
  assert.deepEqual(readStockTarget(form, { mode: 'choose' }), { inStock: false, company: 'CAB' });
  assert.deepEqual(readStockTarget({ elements: {} }, { mode: 'fixed', company: 'X' }), { inStock: true, company: 'X' });
});
```

- [ ] **Step 2: `npm test`** → FAIL.
- [ ] **Step 3: Implementieren** `js/ui/stock-target.js`:

```js
import { esc } from './dom.js';

// Block „Im Materialbestand ablegen“ (Spec-Nachtrag 2026-10-09) – gemeinsam für Case-Editor,
// Traversen- und Dolly-Dialog. 'choose' = Wizard (Häkchen + Ziel), 'fixed' = Materialseite.
export function stockTargetHtml(stock) {
  if (stock.mode === 'fixed') {
    return `<p class="hint stock-target">${stock.company ? `Firma: ${esc(stock.company)}` : 'Standardliste'}</p>`;
  }
  const opts = stock.companies.map(n =>
    `<option value="${esc(n)}"${n === stock.defaultCompany ? ' selected' : ''}>${esc(n)}</option>`).join('');
  return `<fieldset class="stock-target"><legend>Materialbestand</legend>
      <label class="check"><input type="checkbox" name="inStock" checked> Im Materialbestand ablegen</label>
      <label>Ablegen in<select name="stockCompany"><option value="">Standardliste</option>${opts}</select></label>
      <p class="hint">Ohne Häkchen gilt das Case nur für diesen Load.</p>
    </fieldset>`;
}

export function readStockTarget(form, stock) {
  if (stock.mode === 'fixed') return { inStock: true, company: stock.company ?? '' };
  const f = form.elements;
  return { inStock: f.inStock.checked, company: f.stockCompany.value };
}

export function wireStockTarget(form) {
  const f = form.elements;
  if (!f.inStock) return;
  const sync = () => { f.stockCompany.disabled = !f.inStock.checked; };
  f.inStock.addEventListener('change', sync);
  sync();
}
```

`js/ui/case-editor.js`:
- Signatur `openCaseEditor(dlg, c, { usedIn = 0, draft, allowDelete = false, stock, overrideBuiltin = false } = {})`.
- `const isNew = !c || (c.builtin && !overrideBuiltin);`
- Hinweiszeile für Vorlagen nur, wenn `c?.builtin && !overrideBuiltin`; Name `f.name.value = c?.builtin && !overrideBuiltin ? \`${v.name} (eigenes)\` : v.name;`
- Vor `<menu>`: `${stock ? stockTargetHtml(stock) : ''}`; Löschen-Knopf: `${allowDelete && !isNew ? '<button value="delete" class="danger" formnovalidate>Löschen</button>' : ''}`; nach dem Rendern `wireStockTarget(dlg.querySelector('form'))`.
- In `base`: `company: v.company, source: overrideBuiltin ? v.source : (isNew ? undefined : v.source), note: undefined, onlyInPlan: v.onlyInPlan` statt `company: undefined, source: undefined`.
- Vor `resolve({ action: 'save', value })` (beide Zweige): `value = stock ? applyStockTarget(value, readStockTarget(form, stock)) : value`. Den Kommentar in `js/ui/load-wizard.js` über „case-editor.js hat kein Formularfeld für company“ entsprechend kürzen.

`sw.js`: `'./js/ui/stock-target.js'` und `'./js/model/material.js'` in `ASSETS`.

`js/app.js`: `editCase(caseId)` übergibt **kein** `allowDelete` mehr (Löschen nur in der Materialseite, Task 6). Sein `res.action === 'delete'`-Zweig bleibt für den Aufruf aus der Materialseite, wird aber erst dort genutzt. `newCaseForWizard(draft, stock)` reicht `stock` an `openCaseEditor` durch.

- [ ] **Step 4: `npm test`** → PASS (inkl. `tests/pwa.test.js`).
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Ablageziel-Block, Case-Editor behält Firma, Löschen nur auf Wunsch"`

---

### Task 4: Traversen- und Dolly-Dialog mit Ablageziel

**Files:**
- Modify: `js/model/audioDolly.js` (`dollyStackId`, `dollyStackCase`), `js/data/case-library.js` (`slug` exportieren), `js/ui/dolly-wizard.js`, `js/ui/truss-wizard.js`
- Test: `tests/audioDolly.test.js`, `tests/dolly-wizard.test.js`, `tests/truss-wizard.test.js`

**Interfaces:**
- Consumes: `stockTargetHtml`, `readStockTarget`, `wireStockTarget` (Task 3), `applyStockTarget` (Task 1).
- Produces:
  - `dollyStackId(baseCase, n, company = '') → 'dolly-<slug(company)>-<basis>-<n>'` bzw. ohne Firma unverändert `'dolly-<basis>-<n>'`
  - `dollyStackCase(baseCase, n, wagen = {}, company = '')` setzt `id` und `company`
  - `buildDollyResult(base, n, wagen, target, uuid) → Case` (rein, testbar): Bestand → `dollyStackCase(base, n, wagen, target.company)`; nur Load → dasselbe mit `id: uuid`, `onlyInPlan: true`, ohne `company`
  - `openDollyDialog(dlg, { baseCase, onNewDollyStack, stock })`, `openTrussDialog(dlg, { cases, onNewTruss, stock })` – ohne `stock` gilt `{ mode: 'fixed', company: '' }` (bisheriges Verhalten: Standardliste)

- [ ] **Step 1: Failing tests**

`tests/audioDolly.test.js`:
```js
test('dollyStackId: mit Firma eigener Namensraum, ohne Firma unverändert (alte IDs)', () => {
  const k2 = { id: 'preset-k2' };
  assert.equal(dollyStackId(k2, 2), 'dolly-k2-2');
  assert.equal(dollyStackId(k2, 2, 'CAB Berlin'), 'dolly-cab-berlin-k2-2');
});
test('dollyStackCase: Firma wird gesetzt', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  const c = dollyStackCase(base, 2, {}, 'CAB');
  assert.equal(c.company, 'CAB'); assert.equal(c.id, 'dolly-cab-k2-2');
});
```

`tests/dolly-wizard.test.js`:
```js
import { buildDollyResult } from '../js/ui/dolly-wizard.js';
test('buildDollyResult: „nur Load“ bekommt eigene UUID und verdeckt keinen Bestands-Stack', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  const inStock = buildDollyResult(base, 2, {}, { inStock: true, company: 'CAB' }, 'uuid-1');
  const temp = buildDollyResult(base, 2, {}, { inStock: false, company: 'CAB' }, 'uuid-1');
  assert.equal(inStock.id, 'dolly-cab-k2-2');
  assert.equal(temp.id, 'uuid-1'); assert.equal(temp.onlyInPlan, true); assert.equal(temp.company, undefined);
});
```

`tests/truss-wizard.test.js`:
```js
import { applyStockTarget } from '../js/model/material.js';
test('Traversenwagen + Ablageziel: Firma landet am Case, checkCase akzeptiert es', () => {
  const c = applyStockTarget(buildWagonCaseType('id-f', '34er', 300, 29, 4), { inStock: true, company: 'CAB' });
  assert.equal(c.company, 'CAB');
  assert.equal(checkCase(c), undefined);
});
```

- [ ] **Step 2: `npm test`** → FAIL.
- [ ] **Step 3: Implementieren**
  - `js/data/case-library.js`: `const slug` → `export const slug` (Funktion unverändert).
  - `js/model/audioDolly.js`: `import { slug } from '../data/case-library.js';`
    ```js
    export function dollyStackId(baseCase, n, company = '') {
      const baseId = baseCase.id.replace(/^(preset-|lib-)/, '');
      return company ? `dolly-${slug(company)}-${baseId}-${n}` : `dolly-${baseId}-${n}`;
    }
    ```
    `dollyStackCase(baseCase, n, wagen = {}, company = '')`: `id: dollyStackId(baseCase, n, company)`, zusätzlich `company: company || undefined`. Kommentar: Wagenmaße sind firmenabhängig (V 0.12.3), daher eigener ID-Raum je Firma; `upgradeDollyStack` erkennt die Firmenform nicht und muss es nicht – solche Stacks entstehen erst ab V 0.12.5 mit allen Feldern.
  - `js/ui/dolly-wizard.js`:
    ```js
    export function buildDollyResult(base, n, wagen, target, uuid) {
      if (target.inStock) return dollyStackCase(base, n, wagen, target.company);
      return { ...dollyStackCase(base, n, wagen), id: uuid, company: undefined, onlyInPlan: true };
    }
    ```
    Im Formular vor `<menu>`: `${stockTargetHtml(stock)}` mit `const stock = opts.stock ?? { mode: 'fixed', company: '' };`, danach `wireStockTarget(form)`. Im `close`-Handler: `const caseType = buildDollyResult(base, n, wagen(), readStockTarget(form, stock), crypto.randomUUID());`
  - `js/ui/truss-wizard.js`: `stock` analog; Block nur im klassischen Zweig (`.classic-only`-Fieldset, am Ende). Im `close`-Handler: `const caseType = applyStockTarget(buildWagonCaseType(…), readStockTarget(form, stock));`. Pre-Rig-Zweig unverändert (verweist auf Standardvorlagen, legt nichts an).
- [ ] **Step 4: `npm test`** → PASS.
- [ ] **Step 5: Commit** – `git commit -am "feat: Traversen- und Dolly-Dialog legen im gewählten Materialbestand ab"`

---

### Task 5: Lade-Wizard „Suchen in“ + Seitenleiste ohne Löschen

**Files:**
- Modify: `js/ui/load-wizard.js`, `js/ui/library.js`, `js/app.js` (`runLoadWizard`, `mountLibrary`-Handler)
- Test: `tests/load-wizard.test.js`

**Interfaces:**
- Consumes: `groupCases(…, { keep })`, `companiesOf` (Task 1); `stock`-Optionen der Dialoge (Tasks 3/4).
- Produces:
  - `searchInOptionsHtml(companies, selected) → string` (rein, exportiert): Optionen „Standardkatalog“ (`NEUTRAL_COMPANY`), „Kompletter Bestand“ (`''`), je Firma „nur <Firma>“
  - `stockDefaultFor(filterValue) → string`: Firma, wenn eine Firma gewählt ist, sonst `''`
  - `opts.onNewCase(draft, stock)` – der Wizard übergibt `{ mode: 'choose', companies, defaultCompany }`

- [ ] **Step 1: Failing tests** in `tests/load-wizard.test.js`:

```js
import { searchInOptionsHtml, stockDefaultFor } from '../js/ui/load-wizard.js';
import { NEUTRAL_COMPANY } from '../js/ui/caseGroups.js';
test('„Suchen in“: Standardkatalog ist Vorgabe, dann kompletter Bestand, dann je Firma', () => {
  const html = searchInOptionsHtml(['CAB'], NEUTRAL_COMPANY);
  assert.match(html, new RegExp(`<option value="${NEUTRAL_COMPANY}" selected>Standardkatalog</option><option value="">Kompletter Bestand</option><option value="CAB">nur CAB</option>`));
});
test('stockDefaultFor: Firma nur bei Firmenwahl', () => {
  assert.equal(stockDefaultFor('CAB'), 'CAB');
  assert.equal(stockDefaultFor(''), '');
  assert.equal(stockDefaultFor(NEUTRAL_COMPANY), '');
});
```

- [ ] **Step 2: `npm test`** → FAIL.
- [ ] **Step 3: Implementieren** in `js/ui/load-wizard.js`:

```js
export function searchInOptionsHtml(companies, selected) {
  const opt = (v, label) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`;
  return opt(NEUTRAL_COMPANY, 'Standardkatalog') + opt('', 'Kompletter Bestand') + companies.map(n => opt(n, `nur ${n}`)).join('');
}
export const stockDefaultFor = v => (v && v !== NEUTRAL_COMPANY ? v : '');
```

- Das `<select class="wiz-filter-company">` bekommt ein Label „Suchen in“ und `searchInOptionsHtml(companiesOf(cases), NEUTRAL_COMPANY)`; `renderCompanyOptions()` nutzt dieselbe Funktion mit `prev` (Rückfall-Logik auf `NEUTRAL_COMPANY` bleibt).
- `const created = new Set();` – `addNewCase`, `addTruss`, `addDollyStack` tragen neue IDs ein; `renderCaseList` ruft `groupCases(tabCases, { …, keep: created })`.
- `const stockOpt = () => ({ mode: 'choose', companies: companiesOf(cases), defaultCompany: stockDefaultFor(companyFilterSel.value) });` → `opts.onNewCase?.(draft, stockOpt())`, `openTrussDialog(opts.trussDlg, { cases, onNewTruss: opts.onNewTruss, stock: stockOpt() })`, `openDollyDialog(opts.dollyDlg, { baseCase, onNewDollyStack: opts.onNewDollyStack, stock: stockOpt() })`.
- Leertext `own` → „Noch keine eigenen Cases – „+ Neues Case“ legt eins an.“

`js/ui/library.js`: Löschen-Knopf im `groupHeading` entfernen; `delete`-Eintrag im Click-Mapping entfernen; Kommentar „Löschen nur in der Materialverwaltung (Nutzerwunsch 2026-10-09)“.
`js/app.js`: `onDelete` aus `mountLibrary(...)` entfernen; `deleteCaseDirect` bleibt (wird in Task 6 von der Materialseite genutzt).

- [ ] **Step 4: `npm test`** → PASS.
- [ ] **Step 5: Commit** – `git commit -am "feat: Wizard sucht im Standardkatalog, kompletten Bestand oder einer Firma; Löschen nicht mehr in der Seitenleiste"`

---

### Task 6: Materialseite (eigenes Modul, immer erreichbar)

**Files:**
- Create: `js/ui/material.js`
- Modify: `index.html` (Knopf in Kopfleiste, `<section id="material-screen" hidden>`), `js/app.js` (Umschaltung, Handler, `usage` null-sicher), `css/app.css`, `sw.js` (ASSETS)
- Test: `tests/pwa.test.js` (läuft mit), Browser-Szenario im Scratchpad

**Interfaces:**
- Consumes: `companyList`, `casesOf`, `onlyInPlanCases`, `deletionFor`, `copyToCompany`, `renameCompany` (Task 1); `caseKind`, `CASE_TABS` (`js/ui/caseGroups.js`); `caseLine` (aus `js/ui/load-wizard.js` exportieren); `openCaseEditor` (Task 3), `openTrussDialog`/`openDollyDialog` mit `stock: { mode: 'fixed', company }` (Task 4).
- Produces: `mountMaterial(el, h) → { update(state) }` mit Handlern
  `h = { onBack, onNewCase(company), onEdit(id), onDelete(id), onNewTruss(company), onNewDolly(company), onCopy(id), onRename(from, to), onDeleteCompany(name) → Promise<boolean>, onAdopt(id) }` – Zielfirma bzw. Basisbox wählt `js/app.js` per Auswahldialog

- [ ] **Step 1: `caseLine` exportieren** – in `js/ui/load-wizard.js` `function caseLine` → `export function caseLine`.

- [ ] **Step 2: `js/ui/material.js` schreiben**

```js
import { esc, swatch, icon } from './dom.js';
import { CASE_TABS, caseKind } from './caseGroups.js';
import { caseLine } from './load-wizard.js';
import { companyList, casesOf, onlyInPlanCases } from '../model/material.js';
import { showPrompt, showConfirm } from './confirmDialog.js';

// Materialverwaltung (V 0.12.5, Spec 2026-10-09-materialverwaltung-design.md): eigener Bildschirm,
// immer erreichbar. Links Standardkatalog + Firmen, rechts deren Material. Löschen gibt es NUR hier.
const STANDARD = '';
const ONLY_IN_PLAN = '__onlyInPlan__';

export function mountMaterial(el, h) {
  let last = null;
  let sel = STANDARD;
  let tab = CASE_TABS[0].id;
  let q = '';
  const extra = new Set(); // frisch angelegte, noch leere Firmen (nur UI-Zustand, Spec)

  function rowHtml(c) {
    const readOnly = c.builtin && c.id.startsWith('preset-');
    return `<div class="mat-row" data-case="${esc(c.id)}">
      ${swatch(c.color)}
      <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
      ${readOnly
        ? `<button data-act="copy" title="In eine Firma kopieren">${icon('copy')} Kopieren</button>`
        : `<button data-act="edit" title="Bearbeiten">${icon('pencil-simple')}</button>
           <button data-act="delete" class="danger" title="Löschen">${icon('trash')}</button>`}
      ${sel === ONLY_IN_PLAN ? '<button data-act="adopt">In Bestand übernehmen</button>' : ''}
    </div>`;
  }

  function render() {
    if (!last) return;
    const companies = companyList(last.cases, [...extra]);
    const items = sel === ONLY_IN_PLAN ? onlyInPlanCases(last.cases) : casesOf(last.cases, sel);
    const needle = q.trim().toLowerCase();
    const shown = items.filter(c => caseKind(c) === tab && (!needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const isFirm = sel !== STANDARD && sel !== ONLY_IN_PLAN;
    el.innerHTML = `
      <div class="mat-head"><h1>Material</h1><button data-act="back">Zurück</button></div>
      <div class="mat-body">
        <nav class="mat-firms">
          <button data-firm="${STANDARD}" class="${sel === STANDARD ? 'on' : ''}">Standardkatalog</button>
          ${companies.map(f => `<button data-firm="${esc(f.name)}" class="${sel === f.name ? 'on' : ''}">${esc(f.name)} <small>${f.count}</small></button>`).join('')}
          <button data-act="new-firm">+ Firma</button>
          <button data-firm="${ONLY_IN_PLAN}" class="${sel === ONLY_IN_PLAN ? 'on' : ''}">Nur in Ladeplänen <small>${onlyInPlanCases(last.cases).length}</small></button>
        </nav>
        <section class="mat-list">
          <div class="row">
            <div class="seg case-tabs">${CASE_TABS.map(t => `<button type="button" class="${t.id === tab ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
            <input type="search" class="mat-search" placeholder="Suchen" value="${esc(q)}">
          </div>
          ${sel === ONLY_IN_PLAN ? '' : `<div class="row mat-actions">
            <button data-act="new-case">+ Neues Case</button>
            <button data-act="new-truss">+ Traverse</button>
            <button data-act="new-dolly">+ Boxen-Dolly</button>
            ${isFirm ? '<span class="grow"></span><button data-act="rename-firm">Firma umbenennen</button><button data-act="delete-firm" class="danger">Firma löschen</button>' : ''}
          </div>`}
          ${shown.map(rowHtml).join('') || '<p class="hint">Hier ist noch nichts – „+ Neues Case“ legt etwas an.</p>'}
        </section>
      </div>`;
  }

  el.addEventListener('input', e => {
    if (!e.target.matches('.mat-search')) return;
    q = e.target.value; render();
    const s = el.querySelector('.mat-search'); s.focus(); s.setSelectionRange(q.length, q.length);
  });
  el.addEventListener('click', async e => {
    const firmBtn = e.target.closest('[data-firm]');
    if (firmBtn) { sel = firmBtn.dataset.firm; render(); return; }
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-case]')?.dataset.case;
    const target = sel === ONLY_IN_PLAN ? STANDARD : sel;
    switch (btn.dataset.act) {
      case 'back': return h.onBack();
      case 'new-firm': {
        const name = (await showPrompt('Name der neuen Firma', ''))?.trim();
        if (!name) return;
        extra.add(name); sel = name; return render();
      }
      case 'rename-firm': {
        const to = (await showPrompt(`„${sel}“ umbenennen in`, sel))?.trim();
        if (!to || to === sel) return;
        await h.onRename(sel, to); extra.delete(sel); sel = to; return;
      }
      case 'delete-firm': {
        if (await h.onDeleteCompany(sel)) { extra.delete(sel); sel = STANDARD; render(); }
        return;
      }
      case 'new-case': return h.onNewCase(target);
      case 'new-truss': return h.onNewTruss(target);
      case 'new-dolly': return h.onNewDolly(target);
      case 'edit': return h.onEdit(id);
      case 'delete': return h.onDelete(id);
      case 'copy': return h.onCopy(id);
      case 'adopt': return h.onAdopt(id);
    }
  });

  return {
    update(state) {
      if (last && last.cases === state.cases) return;
      last = { cases: state.cases };
      for (const n of [...extra]) if (state.cases.some(c => c.company === n)) extra.delete(n);
      render();
    },
  };
}
```

Vorher prüfen: `showPrompt` in `js/ui/confirmDialog.js` vorhanden? `grep -n "export" js/ui/confirmDialog.js`. Falls nur `showConfirm`/`showAlert` existieren, dort `showPrompt(message, value) → Promise<string|null>` nach demselben Muster wie `showConfirm` ergänzen (eigener `<dialog>` mit `<input>`, Abbrechen → `null`) und `tests/dom.test.js`-Stil beachten. Ebenso prüfen, dass `icon('copy')` und `icon('trash')` in `js/ui/dom.js` existieren; fehlt `copy`, das Icon weglassen und nur den Text „Kopieren“ verwenden.

`onCopy`/`onNewDolly` brauchen eine Auswahl (Zielfirma bzw. Basisbox) – das erledigt `js/app.js` (Step 4) über einen kleinen Auswahldialog.

- [ ] **Step 3: `index.html`** – in der Kopfleiste vor der Rückgängig-Gruppe eine eigene Gruppe `<div class="group"><button id="material-open" title="Materialverwaltung">Material</button></div>`; nach `#start-screen`: `<section id="material-screen" class="material-screen" hidden></section>`. `<dialog id="dlg-pick"></dialog>` neben den anderen Dialogen.

- [ ] **Step 4: `js/app.js` verdrahten**
  - `const usage = (s, caseId) => …` null-sicher: `[s.plan, ...s.plans.filter(p => p.id !== s.plan?.id)].filter(Boolean)…` (Rest unverändert).
  - `let materialOpen = false;` `const materialEl = $('#material-screen');` In `render()` ganz oben:
    ```js
    if (materialOpen) {
      startScreenEl.hidden = true; headerEl.hidden = true; layoutEl.hidden = true; materialEl.hidden = false;
      material.update(s); return;
    }
    materialEl.hidden = true;
    ```
  - `function openMaterial() { materialOpen = true; scheduleRender(); }` – an `#material-open` und an einen neuen Knopf „Material“ in `renderStartScreen` (`<button id="start-material" type="button">Material</button>`) hängen.
  - `const material = mountMaterial(materialEl, { … })` mit:
    - `onBack: () => { materialOpen = false; scheduleRender(); }`
    - `onNewCase: async company => { const res = await openCaseEditor($('#dlg-case'), null, { stock: { mode: 'fixed', company } }); if (res?.action === 'save') await saveCaseValue(res.value); }`
    - `onEdit: async id => { const s = store.get(); const c = s.cases.find(x => x.id === id); const res = await openCaseEditor($('#dlg-case'), c, { usedIn: usage(s, id), allowDelete: true, overrideBuiltin: c.builtin, stock: c.onlyInPlan ? undefined : { mode: 'fixed', company: c.company ?? '' } }); if (!res) return; if (res.action === 'delete') return removeFromStock(c); await saveCaseValue(res.value); }`
    - `onDelete: id => removeFromStock(store.get().cases.find(x => x.id === id))`
    - `removeFromStock(c)`: Rückfrage wie `deleteCaseDirect` (Text mit `usage`), dann `const d = deletionFor(c)`; `d.remove` → bisheriger Pfad aus `deleteCaseDirect` (`repo.deleteCase` + `store.update`), `d.save` → `saveCaseValue(d.save)`. `deleteCaseDirect` darauf umbauen statt doppelt zu halten. (`onEdit` mit `res.action === 'delete'` hat die Rückfrage schon im Editor gestellt → `removeFromStock(c, { confirmed: true })`.)
    - `onNewTruss: company => openTrussDialog($('#dlg-truss'), { cases: store.get().cases, onNewTruss: saveCaseValue, stock: { mode: 'fixed', company } })`
    - `onNewDolly: async company => { const base = await pickCase('Welche Box kommt auf den Dolly?', store.get().cases.filter(c => c.dollyPrompt)); if (base) await openDollyDialog($('#dlg-dolly'), { baseCase: base, onNewDollyStack: saveCaseValue, stock: { mode: 'fixed', company } }); }`
    - `onCopy: async id => { const firm = await pickFirm(); if (firm != null) await saveCaseValue(copyToCompany(store.get().cases.find(c => c.id === id), firm, crypto.randomUUID())); }`
    - `onAdopt: async id => { const firm = await pickFirm(); if (firm != null) await saveCaseValue(applyStockTarget(store.get().cases.find(c => c.id === id), { inStock: true, company: firm })); }`
    - `onRename: async (from, to) => { for (const c of renameCompany(store.get().cases, from, to)) await saveCaseValue(c); }`
    - `onDeleteCompany: async name => { const list = casesOf(store.get().cases, name); if (list.length && !await showConfirm(\`Firma „${name}“ mit ${list.length} Einträgen löschen?\`, { okLabel: 'Löschen', danger: true })) return false; for (const c of list) await removeFromStock(c, { confirmed: true }); return true; }`
  - `pickCase(title, cases)` / `pickFirm()`: kleiner `<select>`-Dialog in `#dlg-pick` (Optionen mit `esc()`, `pickFirm` = „Standardliste“ + `companyList(...)`), Ergebnis `null` bei Abbruch. Beide als lokale Funktionen in `js/app.js`.
  - Eigene Entscheidung: Ein Case wechselt die Firma nicht im Editor, sondern über „Kopieren“ (Standardkatalog) bzw. „Firma umbenennen“ – der Editor zeigt die Firma nur an (`mode: 'fixed'`). Abweichung von der Spec-Zeile „Feld Firma (Auswahl)“, im Abschlussbericht nennen.
  - `renderHooks` nicht anfassen; `render()` gibt bei offener Materialseite früh zurück.

- [ ] **Step 5: `css/app.css`** – Layout analog Startbildschirm:

```css
.material-screen { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 16px 24px; gap: 12px; overflow: hidden; }
.mat-head { display: flex; align-items: center; justify-content: space-between; }
.mat-head h1 { margin: 0; color: var(--accent); }
.mat-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 240px 1fr; gap: 16px; }
.mat-firms { display: flex; flex-direction: column; gap: 4px; overflow: auto; }
.mat-firms button { text-align: left; display: flex; justify-content: space-between; }
.mat-firms button.on { border-color: var(--accent); }
.mat-list { overflow: auto; display: flex; flex-direction: column; gap: 6px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
.mat-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--line); }
.mat-row .lib-text { flex: 1; }
```

- [ ] **Step 6: `sw.js`** – `'./js/ui/material.js'` in `ASSETS`. `npm test` → PASS.

- [ ] **Step 7: Browser-Probe** (Scratchpad-Szenario, `python3 -m http.server 8766` + `node tools/cdp.mjs`):
  1. Startbildschirm → „Material“ klicken → Materialseite sichtbar, Screenshot.
  2. „+ Firma“ „Test“ → „+ Neues Case“ mit Name „Probe“ speichern → Zeile in „Test“ (Count 1).
  3. „+ Boxen-Dolly“ (K2, 2 Stück) und „+ Traverse“ (34er, 300 cm, 4/4) in „Test“ → je eine Zeile, `company === 'Test'` über `p.eval` am Store geprüft.
  4. CAB-Zeile bearbeiten (Name ändern) → ID bleibt `lib-…`; CAB-Zeile löschen → verschwindet, `legacy: true` im Store.
  5. „Zurück“ → Startbildschirm; neuen Load: „Suchen in“ = „nur Test“ → nur „Probe“, der Dolly und die Traverse; im Wizard „+ Neues Case“ ohne Häkchen → bleibt im Wizard sichtbar, erscheint nicht in der Materialseite unter „Test“, aber unter „Nur in Ladeplänen“.
  6. Plan offen → Kopfleiste „Material“ → Seite öffnet, „Zurück“ → Plan wieder da.
  7. `exportBundle` → `parseBundle` über `p.eval`: bearbeitete CAB-Zeile enthalten.
  Screenshots der Materialseite (Firmenliste + Zeilen) ansehen, keine Konsolenfehler in `p.logs`.

- [ ] **Step 8: Commit** – `git add -A && git commit -m "feat: Materialverwaltung als eigener, immer erreichbarer Bereich"`

---

### Task 7: Doku und Version

**Files:**
- Modify: `README.md` (Abschnitt „Materialverwaltung“ nach „Neuen Load anlegen“), `docs/architektur.md` (neuer Abschnitt „Materialbestand“: Firma = `company`, `legacy`/`onlyInPlan`, Überlagerung `lib-`, Dolly-ID je Firma, Import-Regel), `CHANGELOG.md`, `js/version.js`, `package.json`, `index.html`, `sw.js` (Cache-Name)

- [ ] **Step 1:** Doku schreiben (deutsch, „…“-Anführungszeichen, Begriff „tippen“).
- [ ] **Step 2:** Versionsnummer **nach Bestätigung durch den Nutzer** (Vorschlag 0.12.5) an allen sechs Stellen setzen; `npm test` → PASS (`tests/version.test.js`).
- [ ] **Step 3:** Commit `chore: Version 0.12.5 – Materialverwaltung`, dann `superpowers:finishing-a-development-branch` (Merge nach `main`, Push, ggf. `gh api -X POST repos/m4dm0nky/Truckload/pages/builds`, warten bis `js/version.js` live 0.12.5 zeigt).
