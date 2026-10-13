# Sammlungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jede Case-Sammlung ist ein eigener Datensatz und damit ein eigenes JSON (Store `collections`); „Firma“ heißt in der Oberfläche „Sammlung“, Sammlungen lassen sich verschachteln, einzeln exportieren und importieren.

**Architecture:** Im Speicher bleibt die flache Case-Liste (`state.cases`), jedes eigene Case trägt zusätzlich `collectionId`. Gespeichert wird je Sammlung ein Datensatz `{ id, name, parentId?, updatedAt, cases[] }`. Mitgeliefert werden `data/standard.json` (Vorlagen) und `data/meine.json` (Listen-Cases), die als JSON-Module hinter den bisherigen Namen `PRESET_CASES`/`CASE_LIBRARY` stehen, damit kein Verbraucher geändert werden muss. Eigene Cases und Überlagerungen der Listen-Cases liegen im Datensatz `meine`.

**Tech Stack:** Reine ES-Module, keine Abhängigkeiten, `node --test`; JSON-Module (`import … with { type: 'json' }`), IndexedDB bzw. NYX-Host.

**Spec:** `docs/superpowers/specs/2026-10-13-sammlungen-design.md`

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt. `package.json` behält genau ein Skript: `npm test`.
- Nutzereingaben nur über `esc()` aus `js/ui/dom.js`, wenn sie in HTML landen.
- Oberfläche auf Deutsch mit typografischen Anführungszeichen „…“; der Begriff heißt „tippen“, nie „kippen“.
- Eine Versionsnummer überall (`js/version.js`, `package.json`, `README.md`, `index.html`, Cache-Name in `sw.js`, oberster CHANGELOG-Eintrag); `tests/version.test.js` erzwingt das. Vorschlag **0.16.1**, vor dem Commit bestätigen lassen.
- Jede neue Datei unter `js/`, `css/`, `data/` gehört in die Asset-Liste in `sw.js`; jede neue `js/`-Datei zusätzlich als `modulepreload` in `index.html` (`tests/pwa.test.js`).
- Alte Daten müssen weiter laden: alter Store `cases`, alte Sicherungen ohne `collections`, Pläne per `caseId`. Regressionstest mit einem Datensatz im alten Schema ist Pflicht.
- Gewichte und Maße nie raten; Cases dürfen ihre Maße nicht unbemerkt ändern.
- Nur neutrale Cases in Tests und Demos, keine firmen-gebrandeten als Beispiel in der UI.
- Arbeitsbranch `feat/sammlungen`; Merge nach `main` erst nach bestätigter Version.

## Review Focus

Eingaben und Bedingungen, die die Spec nahelegt, die aber leicht durchrutschen:

1. **Migration scheitert** (Schreiben von `meine` wirft): App startet trotzdem mit allen Cases; der nächste Speichervorgang verliert nichts, weil Schreiben bei fehlendem Datensatz `meine` aus dem alten Store aufbaut. → Task 3.
2. **Alte Sicherung** ohne `collections`, mit `lib-`-Überlagerung, `legacy` und `onlyInPlan`: importiert, alles landet in „Meine Sammlung“, Pläne laden. → Task 4.
3. **Zyklus, Tiefe, Namenskollision** (Sammlung unter sich selbst, fünfte Ebene, gleicher Name in Groß-/Kleinschreibung, Datei mit `parentId`-Schleife). → Task 2 und 4.
4. **Listen-Case in eine eigene Sammlung verschoben, Sammlung gelöscht:** das Case wird ausgeblendet (`legacy`-Überlagerung in „Meine Sammlung“), nicht gelöscht und nicht verdoppelt; Pläne behalten das Stück. → Task 5.
5. **Sammlungsdatei mit bekannter ID oder doppeltem Namen:** gleiche ID wird gemischt (neuerer Stand gewinnt), gleicher Name mit anderer ID bekommt ein Suffix; ein Case mit `collectionId` auf eine unbekannte Sammlung landet in „Meine Sammlung“. → Task 4.

---

## File Structure

| Datei | Aufgabe |
|---|---|
| `data/standard.json`, `data/meine.json` (neu) | die zwei mitgelieferten Sammlungen |
| `js/data/preset-cases.js`, `js/data/case-library.js` | dünne Wrapper auf die JSON-Module, gleiche Exporte wie bisher |
| `js/model/collections.js` (neu) | reine Logik: Zusammensetzen, Baum, Namen/Ebenen prüfen, Ziel-Sammlung, Verschieben, Datensätze nach Änderungen |
| `js/model/limits.js` | `MAX_COLLECTIONS` |
| `js/store/db.js` | Store `collections`, `DB_VERSION` 3 |
| `js/store/repo.js` | Laden aus Datensätzen mit Migration, `writeCases`, Import-Gewinner |
| `js/store/io.js` | `collections` im Bundle, Sammlungsdatei (Export, Parsen, Import-Plan) |
| `js/app/download.js` (neu) | `downloadJSON`, von Sicherung und Sammlungsexport geteilt |
| `js/app/persistence.js` | Case speichern/löschen über Sammlungen; Sammlung anlegen, umbenennen, verschieben, löschen, importieren |
| `js/app/materialScreen.js`, `js/ui/material.js` | Baum, Aktionen, „Verschieben“ |
| `js/ui/stock-target.js`, `js/ui/wizard-items.js`, `js/ui/load-wizard.js`, `js/ui/caseGroups.js` | Ablageziel und Filter „Suchen in“ über Sammlungen |
| `docs/nyx-sammlungen.md` (neu), `docs/architektur.md`, `README.md`, `CHANGELOG.md`, `docs/offene-punkte.md` | Dokumentation |

---

### Task 1: Mitgelieferte Daten als JSON

**Files:**
- Create: `data/standard.json`, `data/meine.json`, `tests/dataJson.test.js`
- Modify: `js/data/preset-cases.js`, `js/data/case-library.js`, `sw.js` (ASSETS), `tests/pwa.test.js`

**Interfaces:**
- Produces: `PRESET_CASES` (57 Einträge, alle `builtin: true`, IDs `preset-…`) und `CASE_LIBRARY` (137 Einträge, IDs `lib-…`), unverändert benannt; JSON-Format `{ format: 'truckload-collection', version: 1, id, name, cases }`.

- [ ] **Step 1: Zustand vor dem Umbau festhalten**

Run: `npm test 2>&1 | tail -8`
Expected: alle Tests grün (1181). Zahl notieren.

- [ ] **Step 2: Branch anlegen**

Run: `git checkout -b feat/sammlungen`

- [ ] **Step 3: JSON aus den heutigen Modulen erzeugen**

Skript im Scratchpad `gen-collections.mjs` (nicht im Repo), muss **vor** dem Umschreiben der Module laufen:

```js
import { writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('file:///Users/marcohoch/Library/CloudStorage/Dropbox-Privat/Incomming/github/Truckload/');
const { PRESET_CASES } = await import(new URL('js/data/preset-cases.js', root));
const { CASE_LIBRARY } = await import(new URL('js/data/case-library.js', root));
mkdirSync(new URL('data/', root), { recursive: true });
const file = (id, name, cases) =>
  JSON.stringify({ format: 'truckload-collection', version: 1, id, name, cases }, null, 1) + '\n';
writeFileSync(new URL('data/standard.json', root), file('standard', 'Standard', PRESET_CASES));
writeFileSync(new URL('data/meine.json', root), file('meine', 'Meine Sammlung', CASE_LIBRARY));
console.log('standard', PRESET_CASES.length, 'meine', CASE_LIBRARY.length);
```

Run: `node <scratchpad>/gen-collections.mjs`
Expected: `standard 57 meine 137`

- [ ] **Step 4: Failing test schreiben**

`tests/dataJson.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';

const file = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

test('standard.json: Format, ID, 57 Vorlagen mit preset-ID, alle mitgeliefert', () => {
  const f = file('standard');
  assert.equal(f.format, 'truckload-collection');
  assert.equal(f.id, 'standard');
  assert.equal(f.cases.length, 57);
  assert.ok(f.cases.every(c => c.builtin === true && c.id.startsWith('preset-')));
  assert.equal(new Set(f.cases.map(c => c.id)).size, 57);
});

test('meine.json: 137 Listen-Cases mit lib-ID, alle mitgeliefert', () => {
  const f = file('meine');
  assert.equal(f.id, 'meine');
  assert.equal(f.cases.length, 137);
  assert.ok(f.cases.every(c => c.builtin === true && c.id.startsWith('lib-')));
  assert.equal(new Set(f.cases.map(c => c.id)).size, 137);
});

test('Die Module PRESET_CASES und CASE_LIBRARY liefern genau den Inhalt der Dateien', () => {
  assert.deepEqual(PRESET_CASES, file('standard').cases);
  assert.deepEqual(CASE_LIBRARY, file('meine').cases);
});
```

Run: `node --test tests/dataJson.test.js`
Expected: FAIL (`data/standard.json` existiert noch nicht im Modul, deepEqual schlägt an oder die Dateien fehlen). Hat Step 3 schon die Dateien erzeugt, schlägt nur der dritte Test **nicht** an; dann gilt: erst Step 5 macht die Wrapper, danach alle drei grün. Der Test dient als Gleichheits-Beleg nach dem Umschreiben.

- [ ] **Step 5: Module durch Wrapper ersetzen**

`js/data/preset-cases.js` vollständig ersetzen:

```js
// Standardvorlagen (nur lesbar). Der Inhalt steht seit V 0.16.1 in data/standard.json, einer
// Sammlung wie jede andere (docs/nyx-sammlungen.md). Hier bleibt nur der alte Name, unter dem
// Verbraucher und Tests die Vorlagen kennen. Recherche und Rechenweg der Gewichte:
// docs/casemasse-gewichte.md, docs/mlt-truss-gewichte.md.
import standard from '../../data/standard.json' with { type: 'json' };

export const PRESET_CASES = standard.cases;
```

`js/data/case-library.js`: die Kopfkommentare (Zeilen 1–29) behalten, alles ab `import { colorFor }` ersetzen:

```bash
SP=<scratchpad>
head -n 29 js/data/case-library.js > "$SP/cl-head.js"
cat "$SP/cl-head.js" - > js/data/case-library.js <<'EOF'

// Seit V 0.16.1 steht der Inhalt in data/meine.json („Meine Sammlung“); dieses Modul behält nur
// den alten Namen CASE_LIBRARY für Verbraucher und Tests.
import meine from '../../data/meine.json' with { type: 'json' };

export const CASE_LIBRARY = meine.cases;
EOF
```


- [ ] **Step 6: sw.js und pwa-Test**

In `sw.js` `ASSETS` nach `'js/version.js',` einfügen: `'data/standard.json',` und `'data/meine.json',`.
In `tests/pwa.test.js` bei `needed` ergänzen: `...filesIn('data')` (nach `...filesIn('css')`).

- [ ] **Step 7: Tests laufen lassen**

Run: `npm test 2>&1 | tail -15`
Expected: alle Tests grün (Zahl aus Step 1 plus 3). Schlägt ein bestehender Test an, weil JSON `undefined`-Felder nicht kennt, den Test auf das echte Verhalten prüfen und nur die Erwartung anpassen, nie die Daten.

- [ ] **Step 8: Commit**

```bash
git add data js/data sw.js tests/dataJson.test.js tests/pwa.test.js
git commit -m "feat: Standardvorlagen und Listen-Cases als JSON-Sammlungen (data/)"
```

---

### Task 2: Sammlungslogik (rein)

**Files:**
- Create: `js/model/collections.js`, `tests/collections.test.js`
- Modify: `js/model/limits.js` (+`MAX_COLLECTIONS = 200`)

**Interfaces:**
- Produces (alle aus `js/model/collections.js`):
  - Konstanten `STANDARD_ID = 'standard'`, `MEINE_ID = 'meine'`, `MEINE_NAME = 'Meine Sammlung'`, `MAX_DEPTH = 4`
  - `withBuiltins(metas) → meta[]`: Standard und Meine vorn, eigene alphabetisch; `meta = { id, name, parentId?, updatedAt?, readOnly? }`
  - `collectionIdOf(c) → string`
  - `composeRecords(records) → { collections: meta[], cases: Case[] }` (Cases mit `collectionId`)
  - `collectionRows(collections) → [{ collection, depth }]`
  - `descendantIds(collections, id) → Set<string>` (enthält `id`)
  - `depthOf(collections, id) → number` (oberste Ebene = 1)
  - `collectionNameError(name, collections, exceptId?) → string | null`
  - `parentError(collections, id | null, parentId | null) → string | null`
  - `resolveTarget(c, existing, collections, newId) → { id, created? }`
  - `moveCase(c, target) → Case`
  - `recordsAfterChanges(records, metas, { upserts, removeIds, touchIds }, stampFn) → record[]` (nur geänderte)
  - `userCollectionNames(collections) → string[]`
  - `planCollectionImport(collections, file, newId) → { meta, cases, merged }`

- [ ] **Step 1: Grenze ergänzen**

In `js/model/limits.js` neben `MAX_LKW`: `export const MAX_COLLECTIONS = 200;`

- [ ] **Step 2: Failing tests**

`tests/collections.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_ID, MEINE_ID, withBuiltins, collectionIdOf, composeRecords, collectionRows, descendantIds,
  depthOf, collectionNameError, parentError, resolveTarget, moveCase, recordsAfterChanges,
  userCollectionNames, planCollectionImport,
} from '../js/model/collections.js';

const stampFn = r => ({ ...r, updatedAt: 'T' });
const tse = { id: 't', name: 'TSE' };
const robe = { id: 'r', name: 'Robe', parentId: 't' };
const metas = withBuiltins([robe, tse]);

test('withBuiltins: Standard und Meine vorn, eigene alphabetisch, Name und readOnly der festen sind fest', () => {
  const m = withBuiltins([{ id: 'meine', name: 'Falsch' }, { id: 'z', name: 'Zeta' }, { id: 'a', name: 'Alpha' }]);
  assert.deepEqual(m.map(x => x.id), ['standard', 'meine', 'a', 'z']);
  assert.equal(m[0].readOnly, true);
  assert.equal(m[1].name, 'Meine Sammlung');
});

test('collectionIdOf: eigene ID, sonst Standard für preset-, sonst Meine', () => {
  assert.equal(collectionIdOf({ id: 'x', collectionId: 't' }), 't');
  assert.equal(collectionIdOf({ id: 'preset-a', builtin: true }), STANDARD_ID);
  assert.equal(collectionIdOf({ id: 'lib-a', builtin: true }), MEINE_ID);
  assert.equal(collectionIdOf({ id: 'u1' }), MEINE_ID);
});

test('composeRecords: Cases bekommen collectionId, Standard-Datensatz wird ignoriert, Meine fehlt nie', () => {
  const { collections, cases } = composeRecords([
    { id: 't', name: 'TSE', cases: [{ id: 'c1' }] },
    { id: 'standard', name: 'x', cases: [{ id: 'bad' }] },
  ]);
  assert.deepEqual(collections.map(c => c.id), ['standard', 'meine', 't']);
  assert.deepEqual(cases, [{ id: 'c1', collectionId: 't' }]);
});

test('collectionRows: Baum mit Tiefe, Kinder unter dem Elternteil, Schleife geht nicht verloren', () => {
  const rows = collectionRows(metas);
  assert.deepEqual(rows.map(r => [r.collection.id, r.depth]), [['standard', 0], ['meine', 0], ['t', 0], ['r', 1]]);
  const loop = [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }];
  assert.equal(collectionRows(loop).length, 2);
});

test('descendantIds und depthOf', () => {
  assert.deepEqual([...descendantIds(metas, 't')].sort(), ['r', 't']);
  assert.equal(depthOf(metas, 't'), 1);
  assert.equal(depthOf(metas, 'r'), 2);
});

test('collectionNameError: leer, zu lang, reserviert, doppelt (ohne Groß-/Kleinschreibung), Ausnahme-ID', () => {
  assert.match(collectionNameError('  ', metas), /fehlt/);
  assert.match(collectionNameError('x'.repeat(81), metas), /höchstens/);
  assert.match(collectionNameError('__x__', metas), /reserviert/);
  assert.match(collectionNameError('tse', metas), /gibt es schon/);
  assert.equal(collectionNameError('tse', metas, 't'), null);
  assert.equal(collectionNameError('Neu', metas), null);
});

test('parentError: Standard nie Oberebene, kein Zyklus, höchstens 4 Ebenen', () => {
  assert.match(parentError(metas, null, 'standard'), /nicht möglich/);
  assert.match(parentError(metas, 't', 'r'), /in sich selbst/);
  const deep = withBuiltins([
    { id: '1', name: '1' }, { id: '2', name: '2', parentId: '1' },
    { id: '3', name: '3', parentId: '2' }, { id: '4', name: '4', parentId: '3' },
  ]);
  assert.match(parentError(deep, null, '4'), /Ebenen/);
  assert.equal(parentError(deep, null, '3'), null);
  assert.equal(parentError(metas, 'r', null), null);
});

test('resolveTarget: ausdrückliche ID, vorhandenes Case, Name der Firma, sonst Meine', () => {
  let n = 0;
  const newId = () => `n${++n}`;
  assert.deepEqual(resolveTarget({ id: 'a', collectionId: 't' }, null, metas, newId), { id: 't' });
  assert.deepEqual(resolveTarget({ id: 'a' }, { id: 'a', collectionId: 'r' }, metas, newId), { id: 'r' });
  assert.deepEqual(resolveTarget({ id: 'a', company: 'tse' }, null, metas, newId), { id: 't' });
  assert.deepEqual(resolveTarget({ id: 'a', company: 'Neu' }, null, metas, newId), { id: 'n1', created: { id: 'n1', name: 'Neu' } });
  assert.deepEqual(resolveTarget({ id: 'a' }, null, metas, newId), { id: 'meine' });
  assert.deepEqual(resolveTarget({ id: 'a', company: 'Meine Sammlung' }, null, metas, newId), { id: 'meine' });
  // Listen-Case mit company „CAB“, bearbeitet: bleibt in Meine, legt keine Sammlung „CAB“ an
  assert.deepEqual(resolveTarget({ id: 'lib-x', company: 'CAB' }, { id: 'lib-x', builtin: true }, metas, newId), { id: 'meine' });
});

test('moveCase: eigene Sammlung setzt company, Meine löscht sie, Listen-Case wird zur Überlagerung', () => {
  const lib = { id: 'lib-x', builtin: true, company: 'CAB', name: 'K1' };
  const moved = moveCase(lib, { id: 't', name: 'TSE' });
  assert.deepEqual([moved.id, moved.builtin, moved.company, moved.collectionId], ['lib-x', false, 'TSE', 't']);
  const back = moveCase(moved, { id: MEINE_ID, name: 'Meine Sammlung' });
  assert.equal(back.company, undefined);
  assert.equal(back.collectionId, 'meine');
});

test('recordsAfterChanges: Case wandert zwischen Datensätzen, nur geänderte kommen zurück, collectionId wird nicht gespeichert', () => {
  const records = [
    { id: 'meine', name: 'Meine Sammlung', cases: [{ id: 'a' }, { id: 'b' }] },
    { id: 't', name: 'TSE', cases: [{ id: 'c' }] },
  ];
  const out = recordsAfterChanges(records, metas, { upserts: [{ id: 'a', collectionId: 't', x: 1 }] }, stampFn);
  assert.deepEqual(out.map(r => r.id).sort(), ['meine', 't']);
  assert.deepEqual(out.find(r => r.id === 'meine').cases, [{ id: 'b' }]);
  assert.deepEqual(out.find(r => r.id === 't').cases, [{ id: 'c' }, { id: 'a', x: 1 }]);
  assert.equal(out[0].updatedAt, 'T');
});

test('recordsAfterChanges: fehlender Datensatz entsteht aus der Meta (Meine), Löschen und touchIds', () => {
  const out = recordsAfterChanges([], metas, { upserts: [{ id: 'a', collectionId: 'meine' }], touchIds: ['t'] }, stampFn);
  assert.deepEqual(out.map(r => [r.id, r.name]).sort(), [['meine', 'Meine Sammlung'], ['t', 'TSE']]);
  const rem = recordsAfterChanges([{ id: 't', name: 'TSE', cases: [{ id: 'c' }] }], metas, { removeIds: ['c'] }, stampFn);
  assert.deepEqual(rem[0].cases, []);
  assert.throws(() => recordsAfterChanges([], metas, { upserts: [{ id: 'a', collectionId: 'weg' }] }, stampFn), /unbekannt/);
});

test('userCollectionNames: ohne Standard und Meine', () => {
  assert.deepEqual(userCollectionNames(metas), ['Robe', 'TSE']);
});

test('planCollectionImport: gleiche ID mischt in die vorhandene, gleicher Name anderer ID bekommt Suffix, neue ID bleibt', () => {
  let n = 0;
  const newId = () => `n${++n}`;
  const file = { collection: { id: 't', name: 'TSE' }, cases: [{ id: 'k1', name: 'K' }] };
  const same = planCollectionImport(metas, file, newId);
  assert.equal(same.meta.id, 't');
  assert.deepEqual(same.cases.map(c => [c.id, c.collectionId, c.company]), [['k1', 't', 'TSE']]);

  const clash = planCollectionImport(metas, { collection: { id: 'andere', name: 'tse' }, cases: [] }, newId);
  assert.equal(clash.meta.id, 'andere');
  assert.equal(clash.meta.name, 'tse (2)');

  const fresh = planCollectionImport(metas, { collection: { id: 'neu', name: 'Mac' }, cases: [{ id: 'x' }] }, newId);
  assert.ok(fresh.merged.some(c => c.id === 'neu'));
});
```


Run: `node --test tests/collections.test.js`
Expected: FAIL (`Cannot find module …/collections.js`)

- [ ] **Step 3: Implementation**

`js/model/collections.js`:

```js
import { MAX_FIRM } from './limits.js';

// Sammlungen (docs/superpowers/specs/2026-10-13-sammlungen-design.md). Reine Funktionen ohne DOM
// und ohne Store. Eine Sammlung ist ein Datensatz { id, name, parentId?, updatedAt, cases[] };
// im Speicher der App steht die flache Case-Liste, jedes eigene Case trägt `collectionId`.
export const STANDARD_ID = 'standard';
export const MEINE_ID = 'meine';
export const MEINE_NAME = 'Meine Sammlung';
export const MAX_DEPTH = 4;

const BUILTIN = [
  { id: STANDARD_ID, name: 'Standard', readOnly: true },
  { id: MEINE_ID, name: MEINE_NAME },
];
const isBuiltinId = id => id === STANDARD_ID || id === MEINE_ID;

// Meta-Liste ohne Cases. Die zwei festen Sammlungen stehen immer vorn, Name und readOnly kommen
// von hier (ein Datensatz kann sie nicht umbenennen); eigene alphabetisch.
export function withBuiltins(metas) {
  const own = metas
    .filter(m => !isBuiltinId(m.id))
    .map(({ id, name, parentId, updatedAt }) => ({
      id, name, ...(parentId ? { parentId } : {}), ...(updatedAt ? { updatedAt } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return [...BUILTIN, ...own];
}

// Zu welcher Sammlung ein Case gehört: die gesetzte ID; sonst die Standardvorlagen (preset-,
// mitgeliefert) in „Standard“, alles andere in „Meine Sammlung“.
export const collectionIdOf = c =>
  c.collectionId ?? (c.builtin && typeof c.id === 'string' && c.id.startsWith('preset-') ? STANDARD_ID : MEINE_ID);

export function composeRecords(records) {
  const real = records.filter(r => r && r.id !== STANDARD_ID);
  const collections = withBuiltins(real.map(({ cases: _c, ...meta }) => meta));
  const cases = real.flatMap(r => (Array.isArray(r.cases) ? r.cases : []).map(c => ({ ...c, collectionId: r.id })));
  return { collections, cases };
}

export function collectionRows(collections) {
  const known = new Set(collections.map(c => c.id));
  const kids = new Map();
  for (const c of collections) {
    const p = c.parentId && c.parentId !== c.id && known.has(c.parentId) ? c.parentId : null;
    kids.set(p, [...(kids.get(p) ?? []), c]);
  }
  const rows = [];
  const seen = new Set();
  const walk = (parent, depth) => {
    for (const c of kids.get(parent) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      rows.push({ collection: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  // Eine Schleife aus fremden Daten (A unter B, B unter A) hat keine Wurzel: trotzdem anzeigen.
  for (const c of collections) if (!seen.has(c.id)) { seen.add(c.id); rows.push({ collection: c, depth: 0 }); walk(c.id, 1); }
  return rows;
}

export function descendantIds(collections, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of collections) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; }
    }
  }
  return out;
}

// Oberste Ebene = 1. Eine Schleife bricht ab, statt zu hängen.
export function depthOf(collections, id) {
  let depth = 1;
  let cur = collections.find(c => c.id === id);
  const seen = new Set();
  while (cur?.parentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = collections.find(c => c.id === cur.parentId);
    if (cur) depth++;
  }
  return depth;
}

function subtreeHeight(collections, id) {
  const kids = collections.filter(c => c.parentId === id && c.id !== id);
  return 1 + (kids.length ? Math.max(...kids.map(k => subtreeHeight(collections, k.id))) : 0);
}

export function collectionNameError(name, collections, exceptId = null) {
  const n = String(name ?? '').trim();
  if (!n) return 'Sammlungsname fehlt.';
  if (n.length > MAX_FIRM) return `Sammlungsname: höchstens ${MAX_FIRM} Zeichen.`;
  if (/^__.*__$/.test(n)) return 'Dieser Sammlungsname ist reserviert.';
  if (collections.some(c => c.id !== exceptId && c.name.toLowerCase() === n.toLowerCase()))
    return `Eine Sammlung „${n}“ gibt es schon.`;
  return null;
}

// id = null: neue Sammlung. parentId = null: oberste Ebene.
export function parentError(collections, id, parentId) {
  if (!parentId) return null;
  const parent = collections.find(c => c.id === parentId);
  if (!parent || parent.readOnly) return 'Unter dieser Sammlung lässt sich nichts ablegen.';
  if (id && descendantIds(collections, id).has(parentId)) return 'Eine Sammlung lässt sich nicht in sich selbst verschieben.';
  const below = id ? subtreeHeight(collections, id) : 1;
  if (depthOf(collections, parentId) + below > MAX_DEPTH) return `Höchstens ${MAX_DEPTH} Ebenen.`;
  return null;
}

// Ziel-Sammlung eines zu speichernden Cases, in dieser Reihenfolge: ausdrückliche collectionId;
// die des schon vorhandenen Cases gleicher ID (ein bearbeitetes Listen-Case bleibt in „Meine
// Sammlung“, auch wenn es `company: 'CAB'` trägt); eine Sammlung mit dem Namen aus `company`
// (so entsteht „+ Neue Sammlung …“ im Wizard); sonst „Meine Sammlung“.
export function resolveTarget(c, existing, collections, newId) {
  const writable = id => collections.some(x => x.id === id && !x.readOnly);
  const own = c.collectionId ?? (existing ? collectionIdOf(existing) : null);
  if (own && writable(own)) return { id: own };
  const company = typeof c.company === 'string' ? c.company.trim() : '';
  if (company && company.toLowerCase() !== MEINE_NAME.toLowerCase()) {
    const byName = collections.find(x => !x.readOnly && x.id !== MEINE_ID && x.name.toLowerCase() === company.toLowerCase());
    if (byName) return { id: byName.id };
    const id = newId();
    return { id, created: { id, name: company } };
  }
  return { id: MEINE_ID };
}

// Verschiebt ein Case in eine Sammlung. Eine eigene Sammlung setzt `company` auf ihren Namen (so
// bleiben Dolly-IDs, Traversen-Treffer und die Anzeige „· Name“ wie bisher), „Meine Sammlung“
// entfernt es. Ein mitgeliefertes Listen-Case wird dabei zur eigenen Überlagerung gleicher ID.
export function moveCase(c, target) {
  const named = !isBuiltinId(target.id);
  return {
    ...c,
    builtin: false,
    collectionId: target.id,
    company: named ? target.name : undefined,
  };
}

// Aus den gespeicherten Datensätzen und den Änderungen die Datensätze, die geschrieben werden
// müssen (nur geänderte). upserts: Cases mit gesetzter `collectionId`; removeIds: Cases, die
// entfallen; touchIds: Sammlungen, deren Datensatz (Name, Oberebene) ohne Case-Änderung neu
// geschrieben wird. `metas` ist die Wahrheit für Name und parentId. Fehlt ein Datensatz, entsteht er
// aus der Meta; fehlt auch die, ist das ein Fehler.
export function recordsAfterChanges(records, metas, { upserts = [], removeIds = [], touchIds = [] }, stampFn) {
  const byId = new Map(records.map(r => [r.id, r]));
  const touched = new Map();
  const touch = id => {
    if (!touched.has(id)) {
      const cur = byId.get(id);
      const meta = metas.find(m => m.id === id);
      if (!meta) throw new Error(`Sammlung „${id}“ unbekannt`);
      const { parentId: _p, ...rest } = cur ?? {};
      touched.set(id, {
        ...rest, id, name: meta.name, ...(meta.parentId ? { parentId: meta.parentId } : {}),
        cases: [...(cur?.cases ?? [])],
      });
    }
    return touched.get(id);
  };
  const drop = new Set([...removeIds, ...upserts.map(c => c.id)]);
  for (const r of records) {
    if (Array.isArray(r.cases) && r.cases.some(c => drop.has(c.id))) {
      const t = touch(r.id);
      t.cases = t.cases.filter(c => !drop.has(c.id));
    }
  }
  for (const c of upserts) {
    const { collectionId, ...rest } = c;
    touch(collectionId).cases.push(rest);
  }
  for (const id of touchIds) touch(id);
  return [...touched.values()].map(stampFn);
}

export const userCollectionNames = collections =>
  collections.filter(c => !isBuiltinId(c.id)).map(c => c.name);

// Eine eingelesene Sammlungsdatei (parseCollectionFile) in den Bestand einordnen: gleiche ID
// mischt in die vorhandene Sammlung (die Aufrufer lassen den neueren Stand gewinnen), gleicher
// Name unter anderer ID bekommt ein Suffix. Die Sammlung kommt auf die oberste Ebene.
export function planCollectionImport(collections, file, newId) {
  const { id: fileId, name: fileName } = file.collection;
  const existing = collections.find(c => c.id === fileId && !c.readOnly && c.id !== MEINE_ID);
  let meta;
  if (existing) {
    meta = existing;
  } else {
    let name = String(fileName).trim().slice(0, MAX_FIRM);
    const taken = n => collections.some(c => c.name.toLowerCase() === n.toLowerCase());
    for (let i = 2; taken(name); i++) name = `${String(fileName).trim().slice(0, MAX_FIRM - 6)} (${i})`;
    const idClash = collections.some(c => c.id === fileId);
    meta = { id: idClash ? newId() : fileId, name };
  }
  const cases = file.cases.map(c => ({ ...c, builtin: false, collectionId: meta.id, company: meta.name }));
  const merged = withBuiltins(existing ? collections : [...collections, meta]);
  return { meta, cases, merged };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test tests/collections.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/model/collections.js js/model/limits.js tests/collections.test.js
git commit -m "feat(model): Sammlungslogik (Baum, Namen, Ziel, Datensätze nach Änderungen)"
```

---

### Task 3: Speicherung über Sammlungs-Datensätze

**Files:**
- Modify: `js/store/db.js` (STORES, DB_VERSION), `js/store/repo.js`, `tests/repo.test.js`, `tests/db-host.test.js`
- Create: `tests/collections-repo.test.js`

**Interfaces:**
- Consumes: `composeRecords`, `withBuiltins`, `recordsAfterChanges`, `MEINE_ID`, `MEINE_NAME`, `STANDARD_ID` aus Task 2; `stamp` aus `js/model/stamp.js`.
- Produces:
  - `loadAll() → { cases, collections, trucks, plans, ruleSets }`; `loadAllFallback()` mit `collections: withBuiltins([])`
  - `writeCases({ upserts?, removeIds?, touchIds?, deleteCollectionIds?, collections }) → Promise<void>` (ein `writeMany`)
  - entfernt: `saveCase`, `deleteCase`, `saveCases`, `saveAndDelete`, `buildCaseItems`, `buildSaveAndDelete`

- [ ] **Step 1: Failing test mit Speicher-Attrappe**

`tests/collections-repo.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.indexedDB = { open() { throw new Error('IndexedDB benutzt'); } };
const repo = await import('../js/store/repo.js');
const { PRESET_CASES } = await import('../js/data/preset-cases.js');
const { CASE_LIBRARY } = await import('../js/data/case-library.js');

function memoryHost(seed = {}) {
  const data = { cases: [], collections: [], trucks: [], plans: [], ruleSets: [], ...seed };
  const put = (s, v) => { data[s] = [...data[s].filter(x => x.id !== v.id), structuredClone(v)]; };
  return {
    data,
    getAll: async s => structuredClone(data[s]),
    put: async (s, v) => put(s, v),
    del: async (s, id) => { data[s] = data[s].filter(x => x.id !== id); },
    writeMany: async ({ puts = [], deletes = [] }) => {
      for (const { store, value } of puts) put(store, value);
      for (const { store, id } of deletes) data[store] = data[store].filter(x => x.id !== id);
    },
  };
}
async function withHost(host, fn) {
  globalThis.truckloadHost = host;
  try { return await fn(); } finally { delete globalThis.truckloadHost; }
}
const own = (id, extra = {}) => ({ id, name: id, builtin: false, l: 60, w: 60, h: 60, weight: 1, ...extra });

test('loadAll: leere Datenbank liefert Standard, Meine, alle mitgelieferten Cases', async () => {
  const host = memoryHost();
  const d = await withHost(host, () => repo.loadAll());
  assert.deepEqual(d.collections.map(c => c.id), ['standard', 'meine']);
  assert.equal(d.cases.length, PRESET_CASES.length + CASE_LIBRARY.length);
  assert.equal(host.data.collections.length, 0, 'nichts zu migrieren, nichts geschrieben');
});

test('Migration: eigene Cases aus dem alten Store landen in „Meine Sammlung“, in einem Schreibvorgang; alter Store bleibt', async () => {
  const host = memoryHost({ cases: [own('a'), own('lib-x', { company: 'CAB', legacy: true })] });
  const d = await withHost(host, () => repo.loadAll());
  const rec = host.data.collections.find(r => r.id === 'meine');
  assert.deepEqual(rec.cases.map(c => c.id).sort(), ['a', 'lib-x']);
  assert.equal(host.data.cases.length, 2, 'alter Store wird nicht gelöscht');
  assert.equal(d.cases.find(c => c.id === 'a').collectionId, 'meine');
  assert.equal(d.cases.find(c => c.id === 'lib-x').legacy, true);
  assert.equal(d.cases.filter(c => c.id === 'lib-x').length, 1, 'Überlagerung ersetzt die mitgelieferte Vorlage');
});

test('Migration scheitert: App startet trotzdem, das nächste Speichern verliert nichts', async () => {
  const host = memoryHost({ cases: [own('a'), own('b')] });
  const realWrite = host.writeMany;
  host.writeMany = async () => { throw new Error('Platte voll'); };
  const d = await withHost(host, () => repo.loadAll());
  assert.deepEqual(d.cases.filter(c => c.collectionId === 'meine' && !c.builtin).map(c => c.id).sort(), ['a', 'b']);
  assert.equal(host.data.collections.length, 0);
  host.writeMany = realWrite;
  await withHost(host, () => repo.writeCases({ upserts: [{ ...own('c'), collectionId: 'meine' }], collections: d.collections }));
  const rec = host.data.collections.find(r => r.id === 'meine');
  assert.deepEqual(rec.cases.map(c => c.id).sort(), ['a', 'b', 'c']);
});

test('Datensätze gewinnen: ist „meine“ da, wird der alte Store nicht mehr gelesen', async () => {
  const host = memoryHost({
    cases: [own('alt')],
    collections: [{ id: 'meine', name: 'Meine Sammlung', cases: [own('neu')] }, { id: 't', name: 'TSE', cases: [own('t1')] }],
  });
  const d = await withHost(host, () => repo.loadAll());
  const ids = d.cases.filter(c => !c.builtin).map(c => [c.id, c.collectionId]);
  assert.deepEqual(ids.sort(), [['neu', 'meine'], ['t1', 't']]);
  assert.deepEqual(d.collections.map(c => c.id), ['standard', 'meine', 't']);
});

test('writeCases: Case wandert, collectionId wird nicht gespeichert, ein einziger writeMany', async () => {
  const host = memoryHost({ collections: [{ id: 'meine', name: 'Meine Sammlung', cases: [own('a')] }] });
  let calls = 0;
  const wm = host.writeMany;
  host.writeMany = async arg => { calls++; return wm(arg); };
  const collections = [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }, { id: 't', name: 'TSE' }];
  await withHost(host, () => repo.writeCases({ upserts: [{ ...own('a'), collectionId: 't', company: 'TSE' }], collections }));
  assert.equal(calls, 1);
  const t = host.data.collections.find(r => r.id === 't');
  assert.deepEqual(t.cases.map(c => c.id), ['a']);
  assert.equal('collectionId' in t.cases[0], false);
  assert.deepEqual(host.data.collections.find(r => r.id === 'meine').cases, []);
});

test('writeCases: deleteCollectionIds löscht den Datensatz in derselben Transaktion', async () => {
  const host = memoryHost({ collections: [{ id: 't', name: 'TSE', cases: [own('x')] }] });
  const collections = [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }];
  await withHost(host, () => repo.writeCases({
    upserts: [{ ...own('lib-y', { legacy: true }), collectionId: 'meine' }], deleteCollectionIds: ['t'], collections,
  }));
  assert.deepEqual(host.data.collections.map(r => r.id), ['meine']);
});

test('Alter Datensatz im alten Schema (Cases mit company, Überlagerung, onlyInPlan) lädt vollständig', async () => {
  const host = memoryHost({ cases: [
    own('a', { company: 'TSE' }), own('lib-k', { company: 'CAB', builtin: false }), own('tmp', { onlyInPlan: true }),
  ] });
  const d = await withHost(host, () => repo.loadAll());
  for (const id of ['a', 'lib-k', 'tmp']) assert.ok(d.cases.some(c => c.id === id), id);
  assert.equal(d.cases.find(c => c.id === 'a').company, 'TSE', 'company bleibt ein gewöhnliches Feld');
  assert.equal(d.cases.find(c => c.id === 'tmp').onlyInPlan, true);
});

test('loadAllFallback: Standard und Meine, keine eigenen Cases', () => {
  const f = repo.loadAllFallback();
  assert.deepEqual(f.collections.map(c => c.id), ['standard', 'meine']);
  assert.equal(f.cases.length, PRESET_CASES.length + CASE_LIBRARY.length);
});
```

Run: `node --test tests/collections-repo.test.js`
Expected: FAIL (`repo.writeCases` ist keine Funktion o. ä.)

- [ ] **Step 2: db.js**

`STORES = ['cases', 'collections', 'trucks', 'plans', 'ruleSets']`, `DB_VERSION = 3`, Kommentar: „Version 3 ergänzt den Store collections (Sammlungen).“ `tests/db-host.test.js` bleibt gültig.

- [ ] **Step 3: repo.js umbauen**

Importe ergänzen:

```js
import { stamp } from '../model/stamp.js';
import { composeRecords, withBuiltins, recordsAfterChanges, MEINE_ID, MEINE_NAME, STANDARD_ID } from '../model/collections.js';
```

`loadAll` und `loadAllFallback` ersetzen:

```js
export async function loadAll() {
  await db.persist();
  const [legacyCases, collRecords, trucks, plans, ruleSets] = await Promise.all([
    db.getAll('cases'), db.getAll('collections'), db.getAll('trucks'), db.getAll('plans'), db.getAll('ruleSets'),
  ]);
  const clean = await sanitizeAndWriteBack({ collections: collRecords, trucks, plans, ruleSets });
  let records = clean.collections.filter(r => r.id !== STANDARD_ID);
  // Einmalige Migration (V 0.16.1): eigene Cases des alten Stores `cases` werden „Meine Sammlung“.
  // Der alte Store bleibt als Sicherheitsnetz liegen und wird danach nicht mehr gelesen. Scheitert
  // das Schreiben, läuft die App mit dem berechneten Stand weiter; writeCases baut den Datensatz
  // dann beim nächsten Speichern aus dem alten Store auf (readRecords), es geht nichts verloren.
  if (legacyCases.length > 0 && !records.some(r => r.id === MEINE_ID)) {
    const meine = stamp({ id: MEINE_ID, name: MEINE_NAME, cases: sanitizeUpdatedAt(legacyCases) });
    try {
      await db.writeMany({ puts: [{ store: 'collections', value: meine }] });
    } catch (err) {
      console.error('Migration nach „Sammlungen“ nicht gespeichert:', err);
    }
    records = [...records, meine];
  }
  const { collections, cases: stored } = composeRecords(
    records.map(r => ({ ...r, cases: sanitizeUpdatedAt(Array.isArray(r.cases) ? r.cases : []) })),
  );
  return {
    cases: mergeOwnWithBuiltins(normalizeOwnCases(stored), [...PRESET_CASES, ...CASE_LIBRARY]),
    collections,
    trucks: [...PRESET_TRUCKS, ...clean.trucks],
    plans: clean.plans,
    ruleSets: clean.ruleSets,
  };
}

export function loadAllFallback() {
  return {
    cases: mergeOwnWithBuiltins([], [...PRESET_CASES, ...CASE_LIBRARY]),
    collections: withBuiltins([]),
    trucks: [...PRESET_TRUCKS], plans: [], ruleSets: [],
  };
}
```

Den Abschnitt `saveCase … saveAndDelete` (die Zeilen `export const saveCase`, `deleteCase`, `buildCaseItems`, `saveCases`, `buildSaveAndDelete`, `saveAndDelete`) ersetzen durch:

```js
// Gespeicherte Sammlungs-Datensätze. Fehlt „meine“ (Migration noch nicht geschrieben), entsteht er
// aus dem alten Store `cases`, damit ein Schreibvorgang nie nur einen Teil des Bestands anlegt.
async function readRecords() {
  const [records, legacy] = await Promise.all([db.getAll('collections'), db.getAll('cases')]);
  const real = records.filter(r => r.id !== STANDARD_ID);
  if (real.some(r => r.id === MEINE_ID) || legacy.length === 0) return real;
  return [...real, { id: MEINE_ID, name: MEINE_NAME, cases: legacy }];
}

// Alle Case-Schreibvorgänge laufen hier durch, in EINEM writeMany (alles oder nichts).
// upserts: Cases mit `collectionId`; removeIds: entfallende Cases; touchIds: Sammlungen, deren
// Datensatz ohne Case-Änderung neu geschrieben wird (Name, Oberebene, neu angelegt);
// deleteCollectionIds: Datensätze, die verschwinden. `collections` ist die Meta-Liste nach der
// Änderung (Name und Oberebene kommen von dort).
export async function writeCases({ upserts = [], removeIds = [], touchIds = [], deleteCollectionIds = [], collections }) {
  if (!upserts.length && !removeIds.length && !touchIds.length && !deleteCollectionIds.length) return;
  const records = await readRecords();
  const gone = new Set(deleteCollectionIds);
  const puts = recordsAfterChanges(records, collections, { upserts, removeIds, touchIds }, stamp)
    .filter(r => !gone.has(r.id))
    .map(value => ({ store: 'collections', value }));
  const deletes = deleteCollectionIds.map(id => ({ store: 'collections', id }));
  await db.writeMany({ puts, deletes });
}
```

`buildImportWinnerItems` und `saveImportWinners` ersetzen (Cases laufen nicht mehr über `cases`):

```js
// Gewinner eines Imports ohne die Cases (die gehen über writeCases/recordsAfterChanges).
export function buildImportWinnerItems(winners) {
  return [
    ...winners.trucks.map(value => ({ store: 'trucks', value })),
    ...winners.plans.map(value => ({ store: 'plans', value })),
    ...(winners.ruleSets ?? []).map(value => ({ store: 'ruleSets', value })),
  ];
}

// Cases und Sammlungen der Gewinner als Datensätze zu schreiben. `collections` ist die Meta-Liste
// nach dem Mischen. Ein Case ohne bekannte `collectionId` kommt nach „Meine Sammlung“ (alte
// Sicherungen kennen keine Sammlungen).
export async function saveImportWinners(winners, collections = withBuiltins([])) {
  const known = new Set(collections.filter(c => !c.readOnly).map(c => c.id));
  const upserts = winners.cases.map(c => ({
    ...c, collectionId: c.collectionId && known.has(c.collectionId) ? c.collectionId : MEINE_ID,
  }));
  const touchIds = (winners.collections ?? []).map(c => c.id).filter(id => known.has(id));
  const records = await readRecords();
  const caseWrites = recordsAfterChanges(records, collections, { upserts, touchIds }, stamp)
    .map(value => ({ store: 'collections', value }));
  return db.writeMany({ puts: [...caseWrites, ...buildImportWinnerItems(winners)] });
}
```

In `mergeImportedBundle` den Zustand um `collections` erweitern:

```js
export function mergeImportedBundle({ cases, trucks, plans, plan, ruleSets = [], collections = withBuiltins([]) }, bundle) {
  const mergedCases = mergeById(cases, bundle.cases);
  const mergedCollections = withBuiltins(
    mergeById(collections.filter(c => !c.readOnly && c.id !== MEINE_ID), bundle.collections ?? []),
  );
  // … übrige Zeilen unverändert …
  return {
    cases: mergedCases,
    collections: mergedCollections,
    // … übrige Felder unverändert …
    winners: {
      cases: bundle.cases.filter(x => mergedCases.find(m => m.id === x.id) === x),
      collections: (bundle.collections ?? []).filter(x => mergedCollections.find(m => m.id === x.id) === x),
      // … trucks, plans, ruleSets unverändert …
    },
  };
}
```

- [ ] **Step 4: Bestehende Repo-Tests anpassen**

In `tests/repo.test.js`: Importzeile ohne `buildCaseItems`, `saveCases`; die Tests `buildCaseItems: …` (Zeile ~372), `saveCases: leere Liste …` (~379) und `buildSaveAndDelete: …` (~427) ersatzlos entfernen (ersetzt durch `collections-repo.test.js`). Die Tests `buildImportWinnerItems: …` auf die neue Form anpassen: Cases erscheinen nicht mehr in der Liste, nur `trucks`, `plans`, `ruleSets`. `mergeImportedBundle`-Tests: unverändert grün, da `collections` optional ist. `loadAllFallback`-Test um `collections` ergänzen.

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test 2>&1 | tail -20`
Expected: alle grün außer Aufrufstellen in `js/app/persistence.js` und `js/app/importExport.js`, die in Task 5 folgen (kein Test importiert sie). Schlägt ein anderer Test an, ist es meist `collectionId` an einem Case im `deepEqual`; dort die Erwartung ergänzen, nicht den Code.

- [ ] **Step 6: Commit**

```bash
git add js/store tests
git commit -m "feat(store): Cases in Sammlungs-Datensätzen, Migration aus dem alten Store"
```

---

### Task 4: Bundle und Sammlungsdatei

**Files:**
- Modify: `js/store/io.js`, `tests/io.test.js`
- Create: `tests/collections-io.test.js`

**Interfaces:**
- Consumes: `withBuiltins`, `MEINE_ID`, `STANDARD_ID`, `MAX_COLLECTIONS` aus Task 2.
- Produces:
  - `exportBundle({ cases, trucks, plans, ruleSets, collections })` schreibt zusätzlich `collections` (ohne Standard und Meine)
  - `parseBundle(text)` liefert zusätzlich `collections: meta[]`
  - `checkCollection(m)`
  - `exportCollectionFile(meta, cases, now) → string` (`format: 'truckload-collection'`)
  - `parseCollectionFile(text) → { collection: { id, name }, cases }`
  - `collectionFileName(name, now) → string`

- [ ] **Step 1: Failing tests**

`tests/collections-io.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, exportCollectionFile, parseCollectionFile, collectionFileName, checkCollection } from '../js/store/io.js';

const c = (id, extra = {}) => ({ id, name: id, builtin: false, l: 60, w: 60, h: 60, weight: 1, ...extra });
const plan = { id: 'p', name: 'P', truckId: 'x', placements: [], unplaced: [], notes: '' };

test('exportBundle schreibt eigene Sammlungen, nicht Standard und Meine; parseBundle liest sie zurück', () => {
  const text = exportBundle({
    cases: [c('a', { collectionId: 't' })], trucks: [], plans: [plan], ruleSets: [],
    collections: [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }, { id: 't', name: 'TSE', updatedAt: 'T' }],
  });
  const raw = JSON.parse(text);
  assert.deepEqual(raw.collections.map(x => x.id), ['t']);
  const back = parseBundle(text);
  assert.deepEqual(back.collections.map(x => x.name), ['TSE']);
  assert.equal(back.cases[0].collectionId, 't');
});

test('Alte Sicherung ohne collections lädt: Cases ohne collectionId, leere Sammlungsliste', () => {
  const old = JSON.stringify({
    format: 'truckload', version: 1, cases: [c('a', { company: 'TSE' }), c('lib-k', { company: 'CAB', legacy: true }), c('t', { onlyInPlan: true })],
    trucks: [], plans: [plan], ruleSets: [],
  });
  const b = parseBundle(old);
  assert.equal(b.cases.length, 3);
  assert.deepEqual(b.collections, []);
  assert.ok(b.cases.every(x => x.collectionId === undefined));
});

test('Case mit collectionId auf eine Sammlung, die die Datei nicht kennt, verliert das Feld und wird gemeldet', () => {
  const text = JSON.stringify({ format: 'truckload', version: 1, cases: [c('a', { collectionId: 'weg' }), c('b', { collectionId: 'meine' })], trucks: [], plans: [plan], ruleSets: [], collections: [] });
  const b = parseBundle(text);
  assert.equal(b.cases.find(x => x.id === 'a').collectionId, undefined);
  assert.equal(b.cases.find(x => x.id === 'b').collectionId, 'meine');
  assert.ok(b.repairs.some(r => /Sammlung/.test(r)));
});

test('checkCollection: Name, ID, Zeitstempel, parentId', () => {
  assert.doesNotThrow(() => checkCollection({ id: 'a', name: 'A' }));
  assert.throws(() => checkCollection({ id: 'a' }), /ohne ID oder Name/);
  assert.throws(() => checkCollection({ id: 'a', name: 'x'.repeat(81) }), /zu lang/);
  assert.throws(() => checkCollection({ id: 'a', name: 'A', parentId: 5 }), /ungültig/);
  assert.throws(() => checkCollection({ id: 'a', name: 'A', updatedAt: 3 }), /Zeitstempel/);
});

test('parseBundle: Sammlungen mit parentId-Schleife werden angenommen und gemeldet statt abgelehnt', () => {
  const text = JSON.stringify({ format: 'truckload', version: 1, cases: [], trucks: [], plans: [plan], ruleSets: [],
    collections: [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }] });
  const b = parseBundle(text);
  assert.ok(b.collections.every(x => x.parentId === undefined));
  assert.ok(b.repairs.some(r => /Oberebene|Schleife/.test(r)));
});

test('Sammlungsdatei: Export und Parsen, mitgelieferte Cases bleiben draußen', () => {
  const text = exportCollectionFile({ id: 't', name: 'TSE' }, [c('a', { collectionId: 't' }), c('lib-x', { builtin: true })], new Date('2026-10-13T10:00:00Z'));
  const raw = JSON.parse(text);
  assert.equal(raw.format, 'truckload-collection');
  assert.deepEqual(raw.cases.map(x => x.id), ['a']);
  assert.equal('collectionId' in raw.cases[0], false);
  const back = parseCollectionFile(text);
  assert.deepEqual(back.collection, { id: 't', name: 'TSE' });
  assert.equal(back.cases.length, 1);
  assert.equal(collectionFileName('Robe & Co', new Date('2026-10-13T10:00:00Z')), 'sammlung-robe-co-2026-10-13.json');
});

test('Sammlungsdatei: falsches Format, neuere Version, Fremdes, leer', () => {
  assert.throws(() => parseCollectionFile('{}'), /Sammlungsdatei/);
  assert.throws(() => parseCollectionFile(JSON.stringify({ format: 'truckload-collection', version: 99, collection: { id: 'a', name: 'A' }, cases: [] })), /neueren Version/);
  assert.throws(() => parseCollectionFile(JSON.stringify({ format: 'truckload-collection', version: 1, collection: { id: 'a', name: 'A' }, cases: [{ id: 'x' }] })), /Case/);
  assert.throws(() => parseCollectionFile('kein json'), /kein gültiges JSON/);
});
```

Run: `node --test tests/collections-io.test.js`
Expected: FAIL (Exporte fehlen)

- [ ] **Step 2: io.js**

Importe: `import { MAX_COLLECTIONS } from '../model/limits.js';` (in die vorhandene limits-Importzeile) und `import { slug } from '../model/slug.js';`.

Nach `checkRuleSet` ergänzen:

```js
// Sammlung als Meta (im Bundle): nur Kennung, Name und Oberebene. Die Cases stehen im Bundle
// flach in `cases` und tragen `collectionId`.
export function checkCollection(m) {
  if (!m || typeof m.id !== 'string' || typeof m.name !== 'string') throw new Error('Sammlung ohne ID oder Name in der Datei.');
  const tooLong = nameTooLong('Sammlung', m);
  if (tooLong) throw tooLong;
  if (!m.name.trim()) throw new Error('Sammlung ohne Namen in der Datei.');
  if (m.parentId !== undefined && typeof m.parentId !== 'string') throw new Error(`Sammlung „${m.name}“ hat eine ungültige Oberebene.`);
  if (!updatedAtOk(m)) throw new Error(`Sammlung „${m.name}“ hat einen ungültigen Zeitstempel.`);
}
```

`exportBundle` ersetzen:

```js
export function exportBundle({ cases, trucks, plans, ruleSets = [], collections = [] }, now = new Date()) {
  return JSON.stringify({
    format: FORMAT, version: VERSION, appVersion: APP_VERSION, exportedAt: now.toISOString(),
    cases: cases.filter(c => !c.builtin), trucks: trucks.filter(t => !t.builtin), plans, ruleSets,
    // Standard und Meine sind fest; nur eigene Sammlungen gehören in die Datei.
    collections: collections.filter(c => !c.readOnly && c.id !== 'meine')
      .map(({ id, name, parentId, updatedAt }) => ({ id, name, ...(parentId ? { parentId } : {}), ...(updatedAt ? { updatedAt } : {}) })),
  }, null, 2);
}
```

`FIELD_LABELS` um `collections: 'Sammlungen'` ergänzen, die Schleife `for (const field of ['cases', …])` in `parseBundle` um `'collections'` erweitern.

In `parseBundle`, nach `const ruleSets = arr(data.ruleSets);`:

```js
  if (arr(data.collections).length > MAX_COLLECTIONS) throw new Error('Die Datei enthält zu viele Sammlungen.');
  const rawCollections = arr(data.collections).filter(m => m?.id !== 'standard' && m?.id !== 'meine');
```

Die Leer-Prüfung (`rawCases.length === 0 && …`) um `&& rawCollections.length === 0` ergänzen. Nach den Plan-Reparaturen, vor `cases.forEach(checkCase)…`:

```js
  rawCollections.forEach(checkCollection);
  // Oberebenen: unbekannte Verweise und Schleifen aus fremden Dateien werden entfernt und gemeldet,
  // statt die Datei abzulehnen (eigene Entscheidung, wie bei LKW-Verweisen).
  const collectionIds = new Set(rawCollections.map(m => m.id));
  let parentRepairs = 0;
  const collections = rawCollections.map(m => {
    if (m.parentId === undefined) return m;
    const seen = new Set([m.id]);
    let p = m.parentId;
    let ok = collectionIds.has(p);
    while (ok && p !== undefined) {
      if (seen.has(p)) { ok = false; break; }
      seen.add(p);
      p = rawCollections.find(x => x.id === p)?.parentId;
    }
    if (ok) return m;
    parentRepairs++;
    const { parentId: _p, ...rest } = m;
    return rest;
  });
  // collectionId auf eine Sammlung, die die Datei nicht kennt: Feld entfernen (Meine Sammlung).
  let unknownCollectionRefs = 0;
  const casesWithCollection = cases.map(c => {
    if (c.collectionId === undefined || c.collectionId === 'meine' || collectionIds.has(c.collectionId)) return c;
    unknownCollectionRefs++;
    const { collectionId: _x, ...rest } = c;
    return rest;
  });
```

(`cases` weiter unten durch `casesWithCollection` ersetzen: das `return` am Ende nimmt `cases: casesWithCollection.map(c => normalizeCase(dropStrayLegacy(c)))`, `collections`, und die Doppel-ID-Prüfung bekommt `['collections', collections]`.) Reparaturmeldungen ergänzen:

```js
  if (parentRepairs > 0)
    repairs.push(`${parentRepairs} Sammlung${parentRepairs === 1 ? '' : 'en'}: Oberebene unbekannt oder Schleife – auf die oberste Ebene gesetzt.`);
  if (unknownCollectionRefs > 0)
    repairs.push(`${unknownCollectionRefs} Case${unknownCollectionRefs === 1 ? '' : 's'}: Sammlung unbekannt – nach „Meine Sammlung“ gelegt.`);
```

Am Dateiende (vor `backupFileName`) die Sammlungsdatei:

```js
const COLLECTION_FORMAT = 'truckload-collection';

// Eine einzelne Sammlung als eigene Datei: zum Weitergeben (z. B. eine Hersteller-Bibliothek).
// Mitgelieferte Cases und die interne `collectionId` bleiben draußen.
export function exportCollectionFile({ id, name }, cases, now = new Date()) {
  return JSON.stringify({
    format: COLLECTION_FORMAT, version: 1, appVersion: APP_VERSION, exportedAt: now.toISOString(),
    collection: { id, name },
    cases: cases.filter(c => !c.builtin).map(({ collectionId: _x, ...rest }) => rest),
  }, null, 2);
}

export function parseCollectionFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (data?.format !== COLLECTION_FORMAT) throw new Error('Keine Sammlungsdatei von Truckload.');
  if (!num(data.version)) throw new Error('Die Datei hat keine gültige Versionsangabe.');
  if (data.version > 1) throw new Error('Die Datei stammt aus einer neueren Version.');
  const m = data.collection;
  if (!m || typeof m.id !== 'string' || typeof m.name !== 'string' || !m.name.trim())
    throw new Error('Die Sammlung in der Datei hat keine ID oder keinen Namen.');
  if (m.name.length > NAME_MAX) throw new Error(`Sammlungsname zu lang (höchstens ${NAME_MAX} Zeichen).`);
  if (!Array.isArray(data.cases)) throw new Error('Das Feld „Cases“ in der Datei ist beschädigt.');
  const cases = data.cases.filter(c => !isPreset(c));
  cases.forEach(checkCase);
  const ids = cases.map(c => c.id);
  if (new Set(ids).size !== ids.length) throw new Error('Die Datei enthält doppelte Case-IDs.');
  return {
    collection: { id: m.id, name: m.name.trim() },
    cases: cases.map(c => normalizeCase(dropStrayLegacy(c))),
  };
}

export const collectionFileName = (name, now = new Date()) =>
  `sammlung-${slug(name) || 'ohne-namen'}-${now.toISOString().slice(0, 10)}.json`;
```

(`slug('Robe & Co')` muss `robe-co` liefern; prüfen: `js/model/slug.js`. Liefert es anderes, die Testerwartung an `slug` anpassen, nicht umgekehrt.)

- [ ] **Step 3: Tests laufen lassen**

Run: `node --test tests/collections-io.test.js && npm test 2>&1 | tail -10`
Expected: PASS. In `tests/io.test.js` greifen Tests, die `parseBundle(...)` per `deepEqual` auf das Ergebnisobjekt prüfen; dort `collections: []` in die Erwartung aufnehmen.

- [ ] **Step 4: Commit**

```bash
git add js/store/io.js tests
git commit -m "feat(io): Sammlungen im Bundle, Sammlungsdatei exportieren und einlesen"
```

---

### Task 5: App-Verdrahtung (Zustand und Speicherpfade)

**Files:**
- Create: `js/app/download.js`
- Modify: `js/app/persistence.js`, `js/app/importExport.js`, `js/app.js`, `js/app/core.js` (nur falls `allPlansOf`/Zustand `collections` braucht), `index.html`, `sw.js`
- Test: `tests/persistence-collections.test.js`

**Interfaces:**
- Consumes: Task 2 und 3 (`writeCases`, `resolveTarget`, `moveCase`, `collectionNameError`, `parentError`, `descendantIds`, `planCollectionImport`, `withBuiltins`), Task 4 (`exportCollectionFile`, `collectionFileName`).
- Produces `createPersistence(...)` mit zusätzlich: `createCollection(name, parentId) → id | null`, `renameCollection(id, name) → bool`, `moveCollection(id, parentId) → bool`, `deleteCollection(id) → bool`, `moveCaseTo(caseId, collectionId) → bool`, `importCollectionFile(parsed) → meta | null`; `renameCompany`/`deleteCompany` entfallen.
- `store.get().collections` ist die Meta-Liste (`withBuiltins`).

- [ ] **Step 1: download.js**

`js/app/download.js`:

```js
// Gemeinsamer Datei-Download (Sicherung und Sammlungsexport). Kein Import von js/app.js.
export function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
```

In `js/app/importExport.js` die lokale `downloadJSON`-Funktion löschen und oben `import { downloadJSON } from './download.js';` ergänzen. `exportBundle(...)`-Aufrufe um `collections: s.collections` (bzw. `s0.collections`) erweitern. `repo.saveImportWinners(merge.winners)` → `repo.saveImportWinners(merge.winners, merge.collections)`. Der Store-Updater im Import übernimmt `collections: merge.collections`, der Rollback `collections: s0.collections`. Den Hinweistext um „, N Sammlungen“ ergänzen.

`sw.js` ASSETS und `index.html` modulepreload: `js/app/download.js` und `js/model/collections.js` ergänzen (alphabetisch einsortiert wie die übrigen).

- [ ] **Step 2: Failing Test für die Speicherpfade**

`tests/persistence-collections.test.js` prüft `createPersistence` mit Attrappen für `repo`, `store`, `showAlert`, `showConfirm`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersistence } from '../js/app/persistence.js';
import { withBuiltins } from '../js/model/collections.js';
import { createStore } from '../js/store/state.js';
import { stamp } from '../js/model/stamp.js';

const own = (id, extra = {}) => ({ id, name: id, builtin: false, l: 60, w: 60, h: 60, weight: 1, ...extra });
function setup(cases = [], collections = withBuiltins([])) {
  const writes = [];
  const repo = { writeCases: async arg => { writes.push(arg); }, savePlan: async () => {}, deleteTruck: async () => {}, saveTruck: async () => {} };
  const store = createStore({ cases, collections, trucks: [], plans: [], plan: null, ruleSets: [], selectedId: null });
  let n = 0;
  const alerts = [];
  const p = createPersistence({
    repo, store, stamp, uid: () => `id${++n}`,
    showAlert: async m => { alerts.push(m); }, showConfirm: async () => true,
  });
  return { p, store, writes, alerts };
}

test('saveCase: neue Firma im Wizard legt die Sammlung an, ein Schreibvorgang, Store hat Case und Sammlung', async () => {
  const { p, store, writes } = setup();
  const saved = await p.saveCase(own('a', { company: 'TSE' }));
  assert.equal(writes.length, 1);
  assert.equal(saved.collectionId, 'id1');
  assert.deepEqual(store.get().collections.map(c => c.name), ['Standard', 'Meine Sammlung', 'TSE']);
});

test('saveCase: ohne company und ohne Vorgänger landet das Case in Meine Sammlung', async () => {
  const { p } = setup();
  assert.equal((await p.saveCase(own('a'))).collectionId, 'meine');
});

test('createCollection: Namenskollision und Ebenen werden gemeldet, nichts geschrieben', async () => {
  const { p, writes, alerts } = setup([], withBuiltins([{ id: 't', name: 'TSE' }]));
  assert.equal(await p.createCollection('tse', null), null);
  assert.equal(writes.length, 0);
  assert.match(alerts[0], /gibt es schon/);
  const id = await p.createCollection('Robe', 't');
  assert.equal(id, 'id1');
  assert.deepEqual(writes[0].touchIds, ['id1']);
});

test('renameCollection: company der enthaltenen Cases zieht mit, in einem Schreibvorgang', async () => {
  const cases = [own('a', { collectionId: 't', company: 'TSE' })];
  const { p, store, writes } = setup(cases, withBuiltins([{ id: 't', name: 'TSE' }]));
  assert.equal(await p.renameCollection('t', 'TSE Berlin'), true);
  assert.equal(writes.length, 1);
  assert.equal(store.get().cases[0].company, 'TSE Berlin');
  assert.equal(store.get().collections.find(c => c.id === 't').name, 'TSE Berlin');
});

test('moveCollection: Zyklus wird abgelehnt', async () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }, { id: 'r', name: 'Robe', parentId: 't' }]);
  const { p, alerts } = setup([], cols);
  assert.equal(await p.moveCollection('t', 'r'), false);
  assert.match(alerts[0], /in sich selbst/);
});

test('deleteCollection: Listen-Case wird in Meine ausgeblendet statt gelöscht, eigene Cases fallen weg, Unterbaum geht mit', async () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }, { id: 'r', name: 'Robe', parentId: 't' }]);
  const lib = { id: 'lib-x', builtin: false, name: 'K1', source: 'liste', company: 'TSE', collectionId: 't', l: 1, w: 1, h: 1, weight: 0 };
  const cases = [lib, own('u', { collectionId: 'r', company: 'Robe' })];
  const { p, store, writes } = setup(cases, cols);
  assert.equal(await p.deleteCollection('t'), true);
  assert.deepEqual(writes[0].deleteCollectionIds.sort(), ['r', 't']);
  const hidden = writes[0].upserts.find(c => c.id === 'lib-x');
  assert.equal(hidden.legacy, true);
  assert.equal(hidden.collectionId, 'meine');
  assert.deepEqual(store.get().cases.map(c => c.id), ['lib-x']);
  assert.deepEqual(store.get().collections.map(c => c.id), ['standard', 'meine']);
});

test('moveCaseTo: setzt company und collectionId, Standardvorlage lässt sich nicht verschieben', async () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }]);
  const preset = { id: 'preset-a', builtin: true, name: 'P', l: 1, w: 1, h: 1, weight: 1 };
  const { p, store, alerts } = setup([own('a'), preset], cols);
  assert.equal(await p.moveCaseTo('a', 't'), true);
  assert.equal(store.get().cases.find(c => c.id === 'a').company, 'TSE');
  assert.equal(await p.moveCaseTo('preset-a', 't'), false);
  assert.equal(alerts.length, 1);
});

test('importCollectionFile: neue Sammlung mit Cases, company = Name, ein Schreibvorgang', async () => {
  const { p, store, writes } = setup();
  const meta = await p.importCollectionFile({ collection: { id: 'x', name: 'Robe' }, cases: [own('k1')] });
  assert.equal(meta.name, 'Robe');
  assert.equal(writes.length, 1);
  assert.equal(store.get().cases[0].company, 'Robe');
  assert.equal(store.get().cases[0].collectionId, 'x');
});
```

Run: `node --test tests/persistence-collections.test.js`
Expected: FAIL (Funktionen fehlen).

- [ ] **Step 3: persistence.js**

Importe: `import { resolveTarget, moveCase, collectionNameError, parentError, descendantIds, planCollectionImport, withBuiltins, collectionIdOf, MEINE_ID } from '../model/collections.js';` Der Import `casesOf, deletionFor, renameCompany` entfällt bis auf `deletionFor`.

Zeile `NO_BUILTIN_DELETE` ändern zu:
`'Standardvorlagen lassen sich nicht löschen – „Kopieren“ legt eine eigene Version in einer Sammlung an.'`

`saveCase`, `removeFromStock`, `renameCompanyTo`, `deleteCompany` ersetzen durch:

```js
  const setCollections = (st, collections) => (collections === st.collections ? st : { ...st, collections });

  // Das Ziel steht fest (ausdrückliche collectionId, vorhandenes Case, Name aus `company`, sonst
  // Meine Sammlung, s. resolveTarget); entsteht dabei eine Sammlung, schreibt derselbe Vorgang sie.
  async function saveCase(rawValue) {
    const st = store.get();
    const existing = st.cases.find(x => x.id === rawValue.id);
    const target = resolveTarget(rawValue, existing, st.collections, uid);
    const value = stamp({ ...rawValue, collectionId: target.id });
    const collections = target.created ? withBuiltins([...st.collections, stamp(target.created)]) : st.collections;
    const r = await run('Case konnte nicht gespeichert werden', () => repo.writeCases({
      upserts: [value], touchIds: target.created ? [target.id] : [], collections,
    }));
    if (!r.ok) return undefined;
    store.update(s => ({ ...setCollections(s, collections), cases: [...s.cases.filter(x => x.id !== value.id), value] }));
    return value;
  }

  // `confirmed`: die Rückfrage kam schon (Editor bzw. Sammlung-löschen-Dialog).
  async function removeFromStock(c, { confirmed = false } = {}) {
    if (!c) return false;
    const d = deletionFor(c);
    if (!d) { await showAlert(NO_BUILTIN_DELETE); return false; }
    if (!confirmed) {
      const used = usage(store.get(), c.id);
      const msg = used ? `„${c.name}“ wird in ${used} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${c.name}“ löschen?`;
      if (!await showConfirm(msg, { okLabel: 'Löschen', danger: true })) return false;
    }
    if (d.save) return !!await saveCase(d.save);
    const r = await run('Case konnte nicht gelöscht werden', () => repo.writeCases({ removeIds: [d.remove], collections: store.get().collections }));
    if (!r.ok) return false;
    store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== d.remove) }));
    return true;
  }

  async function createCollection(name, parentId = null) {
    const st = store.get();
    const err = collectionNameError(name, st.collections) ?? parentError(st.collections, null, parentId);
    if (err) { await showAlert(err); return null; }
    const meta = stamp({ id: uid(), name: name.trim(), ...(parentId ? { parentId } : {}) });
    const collections = withBuiltins([...st.collections, meta]);
    const r = await run('Sammlung konnte nicht angelegt werden', () => repo.writeCases({ touchIds: [meta.id], collections }));
    if (!r.ok) return null;
    store.update(s => ({ ...s, collections }));
    return meta.id;
  }

  async function renameCollection(id, name) {
    const st = store.get();
    const err = collectionNameError(name, st.collections, id);
    if (err) { await showAlert(err); return false; }
    const to = name.trim();
    const collections = withBuiltins(st.collections.map(c => (c.id === id ? stamp({ ...c, name: to }) : c)));
    // `company` einer eigenen Sammlung ist ihr Name; die Cases ziehen mit.
    const renamed = st.cases.filter(c => c.collectionId === id).map(c => stamp({ ...c, company: to }));
    const r = await run('Sammlung konnte nicht umbenannt werden', () => repo.writeCases({ upserts: renamed, touchIds: [id], collections }));
    if (!r.ok) return false;
    const ids = new Set(renamed.map(c => c.id));
    store.update(s => ({ ...s, collections, cases: [...s.cases.filter(x => !ids.has(x.id)), ...renamed] }));
    return true;
  }

  async function moveCollection(id, parentId) {
    const st = store.get();
    const err = parentError(st.collections, id, parentId);
    if (err) { await showAlert(err); return false; }
    const collections = withBuiltins(st.collections.map(c => {
      if (c.id !== id) return c;
      const { parentId: _p, ...rest } = c;
      return stamp({ ...rest, ...(parentId ? { parentId } : {}) });
    }));
    const r = await run('Sammlung konnte nicht verschoben werden', () => repo.writeCases({ touchIds: [id], collections }));
    if (!r.ok) return false;
    store.update(s => ({ ...s, collections }));
    return true;
  }

  // Löscht die Sammlung samt Untersammlungen. Mitgelieferte Listen-Cases (lib-) in ihr werden
  // ausgeblendet und kommen als Überlagerung nach „Meine Sammlung“, damit alte Ladepläne ihr Stück
  // behalten; alles andere fällt mit dem Datensatz weg.
  async function deleteCollection(id) {
    const st = store.get();
    const gone = descendantIds(st.collections, id);
    const inside = st.cases.filter(c => gone.has(collectionIdOf(c)));
    if (!await showConfirm(`Sammlung „${st.collections.find(c => c.id === id)?.name}“ mit ${inside.length} Einträgen${gone.size > 1 ? ` und ${gone.size - 1} Untersammlungen` : ''} löschen?`, { okLabel: 'Löschen', danger: true })) return false;
    const ds = inside.map(deletionFor);
    if (ds.includes(null)) { await showAlert(NO_BUILTIN_DELETE); return false; }
    const hidden = ds.filter(d => d.save).map(d => stamp({ ...d.save, collectionId: MEINE_ID }));
    const collections = withBuiltins(st.collections.filter(c => !gone.has(c.id)));
    const r = await run('Sammlung konnte nicht gelöscht werden', () => repo.writeCases({ upserts: hidden, deleteCollectionIds: [...gone], collections }));
    if (!r.ok) return false;
    const keep = new Set(hidden.map(c => c.id));
    store.update(s => ({
      ...s, collections,
      cases: [...s.cases.filter(x => !gone.has(collectionIdOf(x)) && !keep.has(x.id)), ...hidden],
    }));
    return true;
  }

  async function moveCaseTo(caseId, collectionId) {
    const st = store.get();
    const c = st.cases.find(x => x.id === caseId);
    const target = st.collections.find(x => x.id === collectionId && !x.readOnly);
    if (!c || !target) return false;
    if (c.builtin && c.id.startsWith('preset-')) { await showAlert(NO_BUILTIN_DELETE.replace('lassen sich nicht löschen', 'lassen sich nicht verschieben')); return false; }
    return !!await saveCase(stamp(moveCase(c, target)));
  }

  // Eine eingelesene Sammlungsdatei (parseCollectionFile). Gleiche ID: Cases werden gemischt, ein
  // lokal neuerer Stand bleibt. Liefert die Meta der betroffenen Sammlung oder null.
  async function importCollectionFile(file) {
    const st = store.get();
    const plan = planCollectionImport(st.collections, file, uid);
    const local = new Map(st.cases.map(c => [c.id, c]));
    const upserts = plan.cases.filter(c => {
      const cur = local.get(c.id);
      return !cur || cur.builtin || typeof c.updatedAt !== 'string' || typeof cur.updatedAt !== 'string' || c.updatedAt >= cur.updatedAt;
    }).map(c => stamp(c));
    const r = await run('Sammlung konnte nicht importiert werden', () => repo.writeCases({ upserts, touchIds: [plan.meta.id], collections: plan.merged }));
    if (!r.ok) return null;
    const ids = new Set(upserts.map(c => c.id));
    store.update(s => ({ ...s, collections: plan.merged, cases: [...s.cases.filter(x => !ids.has(x.id)), ...upserts] }));
    return plan.meta;
  }
```

Rückgabeobjekt:

```js
  return {
    saveCase, removeFromStock, createCollection, renameCollection, moveCollection, deleteCollection,
    moveCaseTo, importCollectionFile, saveRuleSet, deleteRuleSet, saveTruck, deleteTruck,
  };
```

Wichtig: `stamp(c)` in `importCollectionFile` überschreibt den `updatedAt` des Imports; deshalb vorher mischen (wie oben) und erst für die Gewinner stempeln.

- [ ] **Step 4: app.js**

In `createStore({ … })` ergänzen: `collections: data.collections,`. `renderStartScreen`/`screenOf` brauchen nichts.

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test 2>&1 | tail -15`
Expected: PASS (auch `pwa.test.js`: beide neue `js/`-Dateien in ASSETS und modulepreload).

- [ ] **Step 6: Commit**

```bash
git add js index.html sw.js tests
git commit -m "feat(app): Speicherpfade für Sammlungen (anlegen, umbenennen, verschieben, löschen, importieren)"
```

---

### Task 6: Oberfläche und Texte

**Files:**
- Modify: `js/ui/material.js` (neu schreiben), `js/app/materialScreen.js`, `js/ui/stock-target.js`, `js/ui/wizard-items.js`, `js/ui/load-wizard.js`, `js/ui/caseGroups.js`, `js/app/plans.js`, `js/app/screens.js`, `js/ui/truss-wizard.js`, `js/model/material.js` (nur Meldungstexte), `README.md`, vorhandene Tests mit Firmentexten

**Interfaces:**
- Consumes: Task 2 (`collectionRows`, `descendantIds`, `collectionIdOf`, `userCollectionNames`, `STANDARD_ID`, `MEINE_ID`), Task 4 (`exportCollectionFile`, `parseCollectionFile`, `collectionFileName`), Task 5 (Persistenz).
- Produces: `mountMaterial(el, h)` mit Handlern `onBack, onNewCase(collectionId), onNewTruss(collectionId), onNewDolly(collectionId), onEdit(id), onDelete(id), onCopy(id), onAdopt(id), onCreateCollection(name, parentId), onRenameCollection(id, name), onMoveCollection(id, parentId), onDeleteCollection(id), onExportCollection(id), onImportCollection(), onMoveCase(id, collectionId)`.

- [ ] **Step 1: Failing Test für die reinen UI-Helfer**

In `tests/wizard-items.test.js` (bzw. dem Test, der `searchInOptionsHtml` prüft; mit `grep -ln searchInOptionsHtml tests` finden) ergänzen:

```js
test('searchInOptionsHtml: Standardkatalog, Kompletter Bestand, dann jede Sammlung als Baum', () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }, { id: 'r', name: 'Robe', parentId: 't' }]);
  const html = searchInOptionsHtml(cols, NEUTRAL_COMPANY);
  assert.match(html, /value="__neutral__" selected>Standardkatalog/);
  assert.match(html, /value="">Kompletter Bestand/);
  assert.match(html, /value="t">nur TSE/);
  assert.match(html, /value="r">nur – Robe/);
});

test('stockDefaultFor: Name der gewählten eigenen Sammlung, sonst leer', () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }]);
  assert.equal(stockDefaultFor('t', cols), 'TSE');
  assert.equal(stockDefaultFor('meine', cols), '');
  assert.equal(stockDefaultFor(NEUTRAL_COMPANY, cols), '');
});
```

Run: `node --test tests/wizard-items.test.js`
Expected: FAIL.

- [ ] **Step 2: wizard-items.js**

Importe `collectionRows`, `STANDARD_ID`, `MEINE_ID` aus `../model/collections.js`. Die beiden Funktionen ersetzen:

```js
// Optionen der Auswahl „Suchen in“: Standardkatalog (Vorgabe), kompletter Bestand, je Sammlung
// (als Baum eingerückt; eine Eltern-Sammlung schließt ihre Untersammlungen ein, groupCases).
export function searchInOptionsHtml(collections, selected) {
  const opt = (v, label) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`;
  return opt(NEUTRAL_COMPANY, 'Standardkatalog') + opt('', 'Kompletter Bestand')
    + collectionRows(collections).map(({ collection, depth }) => opt(collection.id, `nur ${'– '.repeat(depth)}${collection.name}`)).join('');
}
// Vorgabe-Ablageziel für neue Cases: der Name der gewählten eigenen Sammlung, sonst keiner
// (= „Meine Sammlung“).
export const stockDefaultFor = (v, collections = []) => {
  const c = collections.find(x => x.id === v);
  return c && c.id !== STANDARD_ID && c.id !== MEINE_ID ? c.name : '';
};
```

- [ ] **Step 3: caseGroups.js**

`groupCases`: Parameter `collection = ''` und `collections = []` ergänzen, und `matchCompany` ersetzen:

```js
  const ids = collection ? descendantIds(collections, collection) : null;
  const matchCompany = c => (ids ? ids.has(collectionIdOf(c))
    : company === NEUTRAL_COMPANY ? !c.company : (!company || c.company === company));
```

Importe `descendantIds, collectionIdOf` aus `../model/collections.js`. Der Kommentar beschreibt `collection` als „Sammlung (mit Untersammlungen)“.

- [ ] **Step 4: load-wizard.js und plans.js**

`openLoadWizard(dlg, opts)` bekommt `opts.getCollections` (Funktion, damit die Liste nach der Rückkehr aus der Materialverwaltung frisch ist). In `js/app/plans.js` am Aufruf (Zeile ~79) ergänzen: `getCollections: () => store.get().collections,`.

In `load-wizard.js`:
- die drei Stellen mit `companiesOf(cases)` (Zeilen ~53, ~161, ~203) ersetzen durch `getCollections()`:
  - Zeile 53: `searchInOptionsHtml(getCollections(), NEUTRAL_COMPANY)`; `title` des Selects: „…oder einer Sammlung“.
  - Zeile ~161–166: `const collections = getCollections(); companyFilterSel.innerHTML = searchInOptionsHtml(collections, prev); if (prev !== NEUTRAL_COMPANY && prev !== '' && !collections.some(c => c.id === prev)) companyFilterSel.value = NEUTRAL_COMPANY;`
  - Zeile ~203: `stockOpt = () => ({ mode: 'choose', companies: userCollectionNames(getCollections()), defaultCompany: stockDefaultFor(companyFilterSel.value, getCollections()) })`
- den Aufruf von `groupCases(...)`: statt `company: companyFilterSel.value` zu übergeben, wenn der Wert weder `''` noch `NEUTRAL_COMPANY` ist: `collection: value, collections: getCollections()`; sonst wie bisher `company`.
- `const getCollections = opts.getCollections ?? (() => []);` am Anfang der Funktion.

- [ ] **Step 5: stock-target.js**

Texte: `Firma: …` → `Sammlung: …`, `Standardliste` → `Meine Sammlung`, `+ Neue Firma …` → `+ Neue Sammlung …`, `Name der neuen Firma` → `Name der neuen Sammlung`. Die Option mit Wert `""` heißt „Meine Sammlung“. `newCompanyError(selectValue, newName, inStock, collections = [])` prüft mit `collectionNameError(newName, collections)` statt `firmNameError`; `wireStockTarget(form, collections)` reicht die Liste durch (Aufrufer: `case-editor.js`, `truss-wizard.js`, `dolly-wizard.js` rufen `wireStockTarget(form)` auf – dort `opts.collections ?? []` mitgeben, Wizard setzt es).

Die Funktion `resolveStockCompany` bleibt (liefert den Namen).

- [ ] **Step 6: material.js (UI) neu schreiben**

Vollständiger Inhalt:

```js
import { esc, swatch, icon } from './dom.js';
import { CASE_TABS, caseKind } from './caseGroups.js';
import { caseLine } from './caseInfo.js';
import { onlyInPlanCases, isInStock } from '../model/material.js';
import { collectionRows, collectionIdOf, STANDARD_ID, MEINE_ID, collectionNameError } from '../model/collections.js';
import { MAX_FIRM } from '../model/limits.js';
import { showPrompt, showAlert, showPick } from './confirmDialog.js';

// Materialverwaltung: eigener Bildschirm, immer erreichbar. Links der Sammlungsbaum, rechts das
// Material der gewählten Sammlung. Löschen gibt es NUR hier.
const ONLY_IN_PLAN = '__onlyInPlan__';

export function mountMaterial(el, h) {
  let last = null;
  let sel = STANDARD_ID;
  let tab = CASE_TABS[0].id;
  let q = '';

  const current = () => last?.collections.find(c => c.id === sel) ?? null;
  const writable = c => c && !c.readOnly;
  const isUser = c => c && c.id !== STANDARD_ID && c.id !== MEINE_ID;
  const countOf = id => last.cases.filter(c => isInStock(c) && collectionIdOf(c) === id).length;

  function rowHtml(c) {
    const readOnly = c.builtin && c.id.startsWith('preset-');
    return `<div class="mat-row" data-case="${esc(c.id)}">
      ${swatch(c.color)}
      <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
      ${readOnly
        ? `<button data-act="copy" title="In eine Sammlung kopieren">Kopieren</button>`
        : `<button data-act="move-case" title="In eine andere Sammlung verschieben">Verschieben</button>
           <button data-act="edit" title="Bearbeiten">${icon('pencil-simple')}</button>
           <button data-act="delete" class="danger" title="Löschen">${icon('trash')}</button>`}
      ${sel === ONLY_IN_PLAN ? '<button data-act="adopt">In Bestand übernehmen</button>' : ''}
    </div>`;
  }

  function renderFrame() {
    if (!last) return;
    const cur = current();
    const rows = collectionRows(last.collections);
    el.innerHTML = `
      <div class="mat-head"><h1>Material</h1><button data-act="back">Zurück</button></div>
      <div class="mat-body">
        <nav class="mat-firms">
          ${rows.map(({ collection, depth }) => `<button data-collection="${esc(collection.id)}" class="${sel === collection.id ? 'on' : ''}" style="padding-left:${10 + depth * 14}px">${esc(collection.name)} <small>${countOf(collection.id)}</small></button>`).join('')}
          <button data-act="new-collection">+ Sammlung</button>
          <button data-act="import-collection">Sammlung importieren</button>
          <button data-collection="${ONLY_IN_PLAN}" class="${sel === ONLY_IN_PLAN ? 'on' : ''}">Nur in Ladeplänen <small>${onlyInPlanCases(last.cases).length}</small></button>
        </nav>
        <section class="mat-list">
          <div class="row">
            <div class="seg case-tabs">${CASE_TABS.map(t => `<button type="button" class="${t.id === tab ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
            <input type="search" class="mat-search" placeholder="Suchen" value="${esc(q)}">
          </div>
          ${sel === ONLY_IN_PLAN ? '' : writable(cur) ? `<div class="row mat-actions">
            <button data-act="new-case">+ Neues Case</button>
            <button data-act="new-truss">+ Traverse</button>
            <button data-act="new-dolly">+ Boxen-Dolly</button>
            <button data-act="new-sub">+ Untersammlung</button>
            <span class="grow"></span>
            <button data-act="export-collection">Sammlung exportieren</button>
            ${isUser(cur) ? '<button data-act="rename-collection">Sammlung umbenennen</button><button data-act="move-collection">Sammlung verschieben</button><button data-act="delete-collection" class="danger">Sammlung löschen</button>' : ''}
          </div>` : '<p class="hint">Mitgelieferte Vorlagen, nur lesbar. „Kopieren“ legt eine eigene Version in einer Sammlung an.</p>'}
          <div class="mat-rows"></div>
        </section>
      </div>`;
  }

  function renderList() {
    const rows = el.querySelector('.mat-rows');
    if (!last || !rows) return;
    const items = sel === ONLY_IN_PLAN
      ? onlyInPlanCases(last.cases)
      : last.cases.filter(c => isInStock(c) && collectionIdOf(c) === sel);
    const needle = q.trim().toLowerCase();
    const matches = items.filter(c => !needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle));
    const shown = matches.filter(c => caseKind(c) === tab).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const empty = matches.length
      ? '<p class="hint">In diesem Reiter nichts – andere Reiter prüfen.</p>'
      : '<p class="hint">Hier ist noch nichts – „+ Neues Case“ legt etwas an.</p>';
    rows.innerHTML = shown.map(rowHtml).join('') || empty;
  }

  function render() { renderFrame(); renderList(); }

  const parentChoices = (exceptId = null) => [
    { value: '', label: 'Oberste Ebene' },
    ...collectionRows(last.collections)
      .filter(({ collection }) => !collection.readOnly && collection.id !== exceptId)
      .map(({ collection, depth }) => ({ value: collection.id, label: `${'– '.repeat(depth)}${collection.name}` })),
  ];
  async function askName(title, initial = '') {
    const raw = await showPrompt(title, initial, { maxlength: MAX_FIRM });
    if (raw == null) return null;
    const err = collectionNameError(raw, last.collections, initial ? sel : null);
    if (err) { await showAlert(err); return null; }
    return raw.trim();
  }

  el.addEventListener('input', e => {
    if (!e.target.matches('.mat-search')) return;
    q = e.target.value; renderList();
  });
  el.addEventListener('click', async e => {
    const colBtn = e.target.closest('[data-collection]');
    if (colBtn) { sel = colBtn.dataset.collection; render(); return; }
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-case]')?.dataset.case;
    // Neues Material kommt nie in „Standard“ (nur lesbar) und nicht in „Nur in Ladeplänen“.
    const target = sel === ONLY_IN_PLAN || sel === STANDARD_ID ? MEINE_ID : sel;
    switch (btn.dataset.act) {
      case 'back': return h.onBack();
      case 'new-collection': {
        const name = await askName('Name der neuen Sammlung');
        if (name == null) return;
        const newId = await h.onCreateCollection(name, null);
        if (newId) { sel = newId; render(); }
        return;
      }
      case 'new-sub': {
        const name = await askName(`Neue Untersammlung in „${current().name}“`);
        if (name == null) return;
        const newId = await h.onCreateCollection(name, sel);
        if (newId) { sel = newId; render(); }
        return;
      }
      case 'rename-collection': {
        const name = await askName(`„${current().name}“ umbenennen in`, current().name);
        if (name == null || name === current().name) return;
        if (await h.onRenameCollection(sel, name)) render();
        return;
      }
      case 'move-collection': {
        const parent = await showPick(`„${current().name}“ verschieben nach`, parentChoices(sel));
        if (parent == null) return;
        if (await h.onMoveCollection(sel, parent || null)) render();
        return;
      }
      case 'delete-collection': {
        if (await h.onDeleteCollection(sel)) { sel = MEINE_ID; render(); }
        return;
      }
      case 'export-collection': return h.onExportCollection(sel);
      case 'import-collection': {
        const meta = await h.onImportCollection();
        if (meta) { sel = meta.id; render(); }
        return;
      }
      case 'move-case': {
        const to = await showPick('In welche Sammlung verschieben?', parentChoices().filter(o => o.value));
        if (to != null) await h.onMoveCase(id, to);
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
      if (last && last.cases === state.cases && last.collections === state.collections) return;
      last = { cases: state.cases, collections: state.collections };
      if (!last.collections.some(c => c.id === sel) && sel !== ONLY_IN_PLAN) sel = STANDARD_ID;
      render();
    },
  };
}
```

(`showPick` liefert `null` bei Abbruch und sonst den Wert, hier auch `''` für „Oberste Ebene“; deshalb `parent == null` und `parent || null`.)

- [ ] **Step 7: materialScreen.js**

Importe: `parseCollectionFile, exportCollectionFile, collectionFileName` aus `../store/io.js`, `downloadJSON` aus `./download.js`, `userCollectionNames, MEINE_ID, STANDARD_ID` aus `../model/collections.js`; `companyList` entfällt. Die Handler:

```js
  const nameOf = id => {
    const c = store.get().collections.find(x => x.id === id);
    return c && c.id !== MEINE_ID && c.id !== STANDARD_ID ? c.name : '';
  };
  // Zielsammlung für „Kopieren“/„In Bestand übernehmen“: Wert = Name ('' = Meine Sammlung).
  const pickCollection = () => showPick('In welche Sammlung?', [
    { value: '', label: 'Meine Sammlung' },
    ...userCollectionNames(store.get().collections).map(n => ({ value: n, label: n })),
  ]);
```

- `pickFirm` → `pickCollection` in `onCopy`/`onAdopt`.
- `onNewCase: async collectionId => { …stock: { mode: 'fixed', company: nameOf(collectionId) } … }`; `onNewTruss`/`onNewDolly` ebenso (`company: nameOf(collectionId)`).
- Der Text „Diesen Traversenwagen gibt es in dieser Firma schon“ → „… in dieser Sammlung schon“.
- Neue Handler:

```js
    onCreateCollection: persistence.createCollection,
    onRenameCollection: persistence.renameCollection,
    onMoveCollection: persistence.moveCollection,
    onDeleteCollection: persistence.deleteCollection,
    onMoveCase: persistence.moveCaseTo,
    onExportCollection: id => {
      const s = store.get();
      const meta = s.collections.find(c => c.id === id);
      if (!meta) return;
      const cases = s.cases.filter(c => collectionIdOf(c) === id);
      downloadJSON(collectionFileName(meta.name), exportCollectionFile(meta, cases));
    },
    onImportCollection: () => new Promise(resolve => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return resolve(null);
        try {
          resolve(await persistence.importCollectionFile(parseCollectionFile(await file.text())));
        } catch (err) {
          await showAlert(`Import fehlgeschlagen: ${err?.message ?? 'unbekannter Fehler'}`);
          resolve(null);
        }
      };
      input.click();
    }),
```

`onRename`/`onDeleteCompany` entfallen. Hinweis: Wird der Dateidialog abgebrochen, feuert kein `change`; die Promise bleibt offen und der Handler hängt nicht, weil der Aufrufer nicht blockiert (der Klick-Handler ist `async`, mehr nicht).

- [ ] **Step 8: Texte „Firma“ → „Sammlung“**

`js/app/screens.js:34` `title`: „Materialverwaltung: Sammlungen, Cases, Lautsprecher, Traversen“. `js/ui/truss-wizard.js:71`: „Wagen unterscheiden sich je Sammlung …“. `js/model/material.js` `firmNameError`: „Sammlungsname fehlt.“, „Sammlungsname: höchstens …“, „Dieser Sammlungsname ist reserviert.“; `tests/material.test.js` die entsprechenden Erwartungen mitziehen. `README.md`: Abschnitt „Materialverwaltung“ und „Neuen Load anlegen“ von Firma auf Sammlung umschreiben (Baum, „+ Sammlung“, „Sammlung importieren/exportieren“, „Verschieben“; „Meine Sammlung“ und „Standard“).

Run: `grep -rn "Firma\|Firmen" js index.html README.md | grep -v "^js/data" | grep -v "^\S*:\s*[0-9]*:\s*//"`
Expected: nur Kommentare und die Bezeichner `companyList`, `firmNameError`, `renameCompany`, `MAX_FIRM` (Code-Namen bleiben).

- [ ] **Step 9: Tests laufen lassen**

Run: `npm test 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add js README.md tests
git commit -m "feat(ui): Sammlungsbaum in der Materialverwaltung, „Firma“ heißt „Sammlung“"
```

---

### Task 7: Dokumentation und NYX-Hinweis

**Files:**
- Create: `docs/nyx-sammlungen.md`
- Modify: `docs/nyx-host.md`, `docs/architektur.md`, `docs/offene-punkte.md`, `docs/casemasse-gewichte.md` (nur der Hinweis auf die Berechnungsformel), `README.md`, `CHANGELOG.md`

- [ ] **Step 1: `docs/nyx-sammlungen.md` schreiben** (für den NYX-Admin)

```markdown
# Sammlungen: was NYX wissen muss

Stand Truckload V 0.16.1. Diese Datei ergänzt [nyx-host.md](nyx-host.md). Sie beschreibt den neuen
Store `collections` und was NYX dafür tun muss. Truckload ändert nichts an NYX; die Punkte unter
„Was NYX tun muss“ sind Aufgaben auf NYX-Seite.

## Worum es geht

Bisher lagen alle Cases einzeln im Store `cases`. Seit dieser Version bildet **eine Sammlung einen
Datensatz** im Store `collections`: ein JSON-Objekt mit Name, optionaler Oberebene und allen Cases
der Sammlung. Beim Zusammenführen kann NYX so je Sammlung entscheiden, was mitgenommen wird, und
Bibliotheken (zum Beispiel von einem Hersteller) lassen sich als eigene Datei verteilen und
nachträglich einspielen.

Ein Nutzer ordnet seine Cases in einem Baum: Oberfirma (TSE, CAB, BBM) → Hersteller (Robe) →
Geräte oder Packkisten. Jede Ebene ist eine eigene Sammlung mit eigenem Datensatz.

## Datensatz im Store `collections`

```json
{
  "id": "3f6c1c0a-8d1e-4a58-9d7e-0f2d5b1c9a11",
  "name": "Robe",
  "parentId": "b7e2…",
  "updatedAt": "2026-10-13T09:30:00.000Z",
  "cases": [ { "id": "…", "name": "…", "l": 120, "w": 60, "h": 80, "weight": 100 } ]
}
```

| Feld | Bedeutung |
|---|---|
| `id` | nicht leerer String. `meine` ist fest vergeben („Meine Sammlung“), `standard` nie gespeichert. Sonst UUID |
| `name` | Anzeigename, höchstens 80 Zeichen, innerhalb einer Installation eindeutig (ohne Groß-/Kleinschreibung) |
| `parentId` | optional, `id` der Oberebene, höchstens 4 Ebenen |
| `updatedAt` | ISO-Zeitstempel, beim Zusammenführen gewinnt der neuere |
| `cases` | die Cases der Sammlung in der Form, in der sie bisher im Store `cases` lagen |

Die Form ist ansonsten die bisherige Ablage (`put`, `getAll`, `del`, `writeMany` mit
`store: 'collections'`).

## Was NYX tun muss

1. **Den Store `collections` freigeben.** NYX lehnt unbekannte Stores ab. Er gehört wie `cases`,
   `trucks` und `ruleSets` zu den projektübergreifenden Stores (`~/.lpm/lpm_types.db`). Ohne ihn
   scheitert das Laden in Truckload (die App zeigt die Ersatzansicht, Schreiben ist gesperrt).
2. **Zusammenführen je Datensatz.** Ein Datensatz ist eine Einheit. Wer Sammlungen auswählen will,
   wählt Datensätze nach `id` oder `name`. Gleiche `id` mit neuerem `updatedAt` gewinnt.
3. **Hersteller-Bibliotheken einspielen** kann NYX als Datensatz (`put`) oder Truckload über die
   Sammlungsdatei (unten).

## Was Truckload selbst tut

- **Migration:** Beim ersten Start nach dem Update schreibt Truckload alle eigenen Cases aus dem
  alten Store `cases` als Datensatz `meine` nach `collections`. Der alte Store wird **nicht
  gelöscht**, aber nicht mehr gelesen. Scheitert das Schreiben, läuft die App weiter, und der
  nächste Speichervorgang holt es nach.
- **Mitgeliefert** werden zwei Sammlungen als Dateien in der App, nicht im Store: `data/standard.json`
  (Standardvorlagen, nur lesbar) und `data/meine.json` (Listen-Cases). Bearbeiten oder Verschieben
  eines Listen-Cases schreibt eine Überlagerung gleicher ID in den Datensatz der Sammlung.
- **Sammlungsdatei:** „Sammlung exportieren“ und „Sammlung importieren“ in der Materialverwaltung.
  Format `truckload-collection`, Version 1:

  ```json
  { "format": "truckload-collection", "version": 1, "appVersion": "0.16.1",
    "exportedAt": "…", "collection": { "id": "…", "name": "Robe" }, "cases": [ … ] }
  ```

  Beim Import mischt dieselbe `id` in die vorhandene Sammlung (neuerer Stand gewinnt); ein gleicher
  Name unter anderer `id` bekommt ein Suffix „(2)“.
- **Sicherung („Sichern“)** trägt zusätzlich ein Feld `collections` (Name, Oberebene je Sammlung);
  die Cases stehen weiter flach in `cases`, jedes mit `collectionId`. Alte Sicherungen ohne dieses
  Feld laden: alle Cases kommen nach „Meine Sammlung“.

## Nicht Teil dieser Version

- Cases einer Sammlung kann Truckload nicht automatisch einer Firma zuordnen; die Zuordnung macht
  der Nutzer („Verschieben“).
- Pläne verweisen weiter nur per `caseId`. Eine Sammlung zu löschen entfernt die Cases daraus
  (Listen-Cases werden ausgeblendet); Pläne behalten ihr Stück, solange das Case in der App
  bekannt ist.
```

- [ ] **Step 2: `docs/nyx-host.md`**

Im Abschnitt „Wo NYX speichert“ die Tabelle um `collections` ergänzen (projektübergreifend, wie `cases`) und einen Verweis: „Sammlungen: siehe [nyx-sammlungen.md](nyx-sammlungen.md).“ Die Zeile über „Ein neuer Store braucht eine Absprache mit NYX“ um „Seit 0.16.1 gilt das für `collections`.“ ergänzen.

- [ ] **Step 3: `docs/architektur.md`**

Im Abschnitt „Materialbestand“ die Punkte „Firma = `company`-String am Case“ und „Löschen entscheidet `deletionFor`“ anpassen und einen neuen Abschnitt „Sammlungen (seit V 0.16.1)“ anfügen:
Datenmodell (`{ id, name, parentId?, updatedAt, cases[] }`), Store `collections`, feste IDs, `collectionIdOf`, Zusammensetzen beim Laden (`composeRecords`), Schreiben nur über `repo.writeCases`, Migration, `company` = Name der eigenen Sammlung (Verschieben und Umbenennen halten das ein), Wrapper `preset-cases.js`/`case-library.js` hinter `data/*.json`. Den Satz zu `PACK`/`PACK_REF_KG` („die Formel steht im Code“) auf „die Werte stehen in `data/standard.json`“ ändern. In der Datentabelle „Mitgelieferte Daten“ die Spalte „Datei“ auf `data/standard.json` und `data/meine.json` umstellen.

- [ ] **Step 4: `docs/offene-punkte.md`**

Neuer Abschnitt „Aus Sammlungen (V 0.16.1) offen“:
- Die Listen-Cases (CAB, BBM, Motion …) liegen noch gemeinsam in „Meine Sammlung“; eine Aufteilung je Firma in eigene JSONs ist nicht erfolgt (Entscheidung: erst Struktur, dann Sortierung).
- Verschieben einer Sammlung kopiert `company` nicht für Unterebenen; `company` ist immer der Name der direkten Sammlung.
- `meine.json` wird nicht nachgesät; ein Katalog-Update erreicht gelöschte oder verschobene Cases nicht.
- Der alte Store `cases` wird nicht aufgeräumt.
- Wizard-Filter „Standardkatalog“ zeigt Cases ohne `company`, auch eigene in „Meine Sammlung“.

- [ ] **Step 5: `CHANGELOG.md`**

Oberster Eintrag:

```markdown
## V 0.16.1 – 2026-10-13

**Sammlungen: jede Case-Sammlung ist ein eigenes JSON.**

- **„Firma“ heißt jetzt „Sammlung“** und lässt sich verschachteln (Oberfirma → Hersteller → Geräte).
  „+ Sammlung“, „+ Untersammlung“, Umbenennen, Verschieben, Löschen und „Verschieben“ je Case in
  der Materialverwaltung.
- **Jede Sammlung ist ein eigener Datensatz**, und „Sammlung exportieren“ / „Sammlung
  importieren“ machen sie zu einer eigenen Datei, zum Beispiel für die Bibliothek eines Herstellers.
- **Mitgeliefert** sind `data/standard.json` (Vorlagen, nur lesbar) und `data/meine.json`
  (Listen-Cases). Neue und bisherige eigene Cases liegen in „Meine Sammlung“.
- **Alte Daten laden weiter:** Beim ersten Start wandern eigene Cases in „Meine Sammlung“, alte
  Sicherungen importieren wie bisher, Ladepläne bleiben unverändert.
- Für NYX: neuer Store `collections`, siehe `docs/nyx-sammlungen.md`.
```

- [ ] **Step 6: Commit**

```bash
git add docs README.md CHANGELOG.md
git commit -m "docs: Sammlungen, Hinweis für den NYX-Admin"
```

---

### Task 8: Browser-Prüfung, Version, Abschluss

**Files:**
- Modify (nach Bestätigung): `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js` (Cache-Name), `CHANGELOG.md`

- [ ] **Step 1: Volltest**

Run: `npm test 2>&1 | tail -10`
Expected: alles grün, Zahl höher als vor Task 1.

- [ ] **Step 2: Im Browser fahren (`tools/cdp.mjs`)**

```bash
python3 -m http.server 8766        # im Projektverzeichnis, im Hintergrund
node tools/cdp.mjs <scratchpad>/sammlungen.mjs <scratchpad>/out
```

Szenario `sammlungen.mjs` (ES-Modul, `export default async function (p)`): frisches Profil; vorab per `p.eval` einen Altbestand in IndexedDB schreiben (Store `cases`: ein eigenes neutrales Case „Testcase“, eine `lib-`-Überlagerung mit `legacy: true`), Seite laden, dann prüfen und `p.shot` je Schritt:
1. Materialverwaltung: Baum zeigt „Standard“, „Meine Sammlung“; „Testcase“ steht in „Meine Sammlung“.
2. „+ Sammlung“ → „TSE“, darunter „+ Untersammlung“ → „Robe“; Baum eingerückt.
3. Ein Case in „Meine Sammlung“ per „Verschieben“ nach „Robe“; Zähler stimmen.
4. „Sammlung umbenennen“ TSE → „TSE Berlin“; Untersammlung bleibt darunter.
5. „Sammlung exportieren“ (Download abfangen) und in einem zweiten Profil „Sammlung importieren“: Sammlung samt Case da.
6. Wizard „Suchen in“: „nur TSE Berlin“ zeigt auch die Cases aus „Robe“; „Standardkatalog“ zeigt sie nicht.
7. Neu laden: alles bleibt (IndexedDB), Alt-Ladeplan öffnet mit allen Stücken.
8. „Sammlung löschen“ TSE Berlin: Untersammlung und Cases weg, ein verschobenes Listen-Case erscheint wieder als ausgeblendet, nicht doppelt.

Erwartet: keine Konsolenfehler (`p.logs`), Screenshots mit sichtbarem Material in jedem Schritt (Screenshots ohne das geprüfte Element sind kein Beleg).

- [ ] **Step 3: Offline-Gegenprobe**

Seite einmal laden, Netz weg (Server stoppen), neu laden: App startet, `data/standard.json` und `data/meine.json` kommen aus dem Service-Worker-Cache.

- [ ] **Step 4: Version vorschlagen und bestätigen lassen**

Nutzer fragen: „Vorschlag 0.16.1 (Patch nach Projektregel; Minor 0.17.0 wäre wegen des Speichermodells vertretbar). Welche Nummer?“ Erst nach Antwort die Versionsstellen setzen (siehe Global Constraints), `npm test`.

- [ ] **Step 5: Abschluss**

`superpowers:finishing-a-development-branch`: Merge nach `main` (`--no-ff`), `git push origin main`, bei Minor/Major annotierter Tag. Danach auf `https://m4dm0nky.github.io/Truckload/js/version.js` warten, bis die neue Nummer steht; gegebenenfalls `gh api -X POST repos/m4dm0nky/Truckload/pages/builds`. Dem Nutzer `docs/nyx-sammlungen.md` als Übergabe für den NYX-Admin nennen.
