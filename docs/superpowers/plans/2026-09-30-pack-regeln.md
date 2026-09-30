# Pack-Regeln (Teil A) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Nutzer legt je Load eine Rangliste von Pack-Regeln fest. Beispiele: „Gruppe „Motoren“: zuletzt (Tür)“, „Traversen: zuerst (Stirnwand)“, „Große zuerst“. Stücke bekommen einen frei wählbaren Gruppennamen. Ranglisten lassen sich als Regelset speichern und in anderen Loads übernehmen.

**Architecture:**
- Neues reines Modul `js/model/packRules.js`. Es enthält Regel-Datentyp, Prüfung, Komparator und Texte.
- `orderSorts` im Packer bildet Blöcke aus Case-Typ und Gruppe und sortiert sie mit `blockComparator(rules)`.
- Stapeln und Stellen (`buildStacks`/`placeStacks`) bleiben unverändert.
- Das Plan-Feld `packRules` ersetzt `packOrder` für neue Einstellungen. Fehlt es, übersetzt `legacyRules(packOrder)` die alte Einstellung exakt.
- Regelsets liegen in einem neuen IndexedDB-Store `ruleSets` und kommen mit ins Sicherungs-Bundle.

**Tech Stack:** Reine ES-Module, `node --test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-09-30-pack-regeln-design.md`

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt; Tests mit `npm test`.
- Oberfläche auf Deutsch, typografische Anführungszeichen „…“. „tippen“, nie „kippen“.
- Nutzertexte (Gruppennamen, Case-Namen, Regelset-Namen) in HTML nur über `esc()` aus `js/ui/dom.js`.
- Alte Daten laden unverändert:
  - Plan ohne `packRules` packt wie bisher nach `packOrder`.
  - Stück ohne `group` gehört zu keiner Gruppe.
  - Bundle ohne `ruleSets` wird angenommen.
  - Jede Änderung braucht einen Regressionstest mit Daten im alten Schema.
- Neue Dateien unter `js/` gehören in die `ASSETS`-Liste von `sw.js` (`tests/pwa.test.js`).
- „zuerst“ = Stirnwand, „zuletzt“ = Tür. Anzeigetexte: `zuerst (Stirnwand)` / `zuletzt (Tür)`.
- `group`: getrimmt, höchstens `MAX_LABEL` (40) Zeichen, leer = Feld fehlt.
- `packRules`: höchstens `MAX_RULES` = 20 Regeln. `value` höchstens 200 Zeichen (`MAX_RULE_VALUE`).
- Version erst am Ende nach Rückfrage: Vorschlag 0.8.4 → 0.8.5 (CLAUDE.md „Versionierung“).
- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Gleicher Case-Typ, teils mit Gruppe, teils ohne:** Das ergibt zwei Blöcke, und die Gruppenregel verschiebt nur die Gruppe. Test in Task 2.
- **Regel auf eine Gruppe oder einen Case-Typ, die im Load nicht (mehr) vorkommen:** Die Regel wirkt nicht und erzeugt keinen Fehler. Der Dialog zeigt „(nicht in diesem Load)“. Test in Task 1.
- **Importdatei mit kaputten `packRules` oder `ruleSets`** (unbekanntes `by`, zu langer Wert): Die Datei wird mit deutscher Meldung abgelehnt. Eine Datei ohne diese Felder geht durch. Test in Task 4.
- **„Rest einpacken“ mit Regeln:** Neue Blöcke schließen hinten an. Die Regeln ordnen nur die neuen Blöcke untereinander. Test in Task 3.
- **Duplizieren, In Ablage, Truck entladen, Alles neu packen, Ziehen aus der Ablage:** `group` bleibt erhalten. Test in Task 3.

---

### Task 1: Reines Modul `packRules.js`

**Files:**
- Create: `js/model/packRules.js`
- Create: `tests/packRules.test.js`
- Modify: `sw.js` (ASSETS: `'js/model/packRules.js'` nach `'js/model/packer.js'`)

**Interfaces:**
- Produces:
  - `MAX_RULES = 20`, `MAX_RULE_VALUE = 200`, `RULE_KINDS` (Liste für die Oberfläche, s. u.), `POS_LABEL`
  - `legacyRules(order?: 'volume'|'count') → Rule[]`
  - `rulesFor(plan) → Rule[]`
  - `ruleOk(rule) → boolean`
  - `normalizeRules(rules) → Rule[]`
  - `ruleKey(rule) → string`
  - `addRule(rules, rule) → Rule[]`, `moveRule(rules, i, delta) → Rule[]`, `removeRule(rules, i) → Rule[]`
  - `blockComparator(rules) → (a: Item[], b: Item[]) => number`. Ein Block ist ein Array von Stücken `{ caseId, c, group? }`.
  - `ruleTargets(pieces, caseById) → { groups: string[], cases: {id,name}[], categories: string[], hasTruss: boolean }`
  - `ruleActive(rule, targets) → boolean`
  - `describeRule(rule, caseById) → string`
  - `volumeOf(c) → number`
- Rule = `{ by: 'truss', pos }` | `{ by: 'group'|'case'|'category', value: string, pos }` | `{ by: 'volume' }` | `{ by: 'count' }`, mit `pos` ∈ `'first'|'last'`.

- [ ] **Step 1: Failing Tests schreiben** – `tests/packRules.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyRules, rulesFor, ruleOk, normalizeRules, addRule, moveRule, removeRule,
  blockComparator, ruleTargets, ruleActive, describeRule, MAX_RULES,
} from '../js/model/packRules.js';
import { mkCase, byId } from './fixtures.js';

const big = mkCase('big', 120, 80, 80);
const small = mkCase('small', 60, 60, 60, { category: 'Ton' });
const truss = mkCase('truss', 300, 62, 115, { kind: 'truss', truss: { length: 300, width: 62, count: 1, standing: true, height: 115 } });
const block = (c, n, group) => Array.from({ length: n }, (_, i) => ({ id: `${c.id}${group ?? ''}${i}`, caseId: c.id, c, ...(group ? { group } : {}) }));
const order = (blocks, rules) => [...blocks].sort(blockComparator(rules))
  .map(b => b[0].caseId + (b[0].group ? `/${b[0].group}` : ''));

test('legacyRules: volume/fehlt = Traversen zuletzt, Große, Stückzahl; count = Stückzahl, Große', () => {
  const vol = [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }];
  assert.deepEqual(legacyRules('volume'), vol);
  assert.deepEqual(legacyRules(undefined), vol);
  assert.deepEqual(legacyRules('count'), [{ by: 'count' }, { by: 'volume' }]);
});

test('rulesFor: packRules gewinnt, sonst packOrder (Altdaten)', () => {
  const rules = [{ by: 'count' }];
  assert.deepEqual(rulesFor({ packRules: rules, packOrder: 'volume' }), rules);
  assert.deepEqual(rulesFor({ packOrder: 'count' }), legacyRules('count'));
  assert.deepEqual(rulesFor({}), legacyRules('volume'));
});

test('ruleOk: gültige und ungültige Regeln', () => {
  assert.ok(ruleOk({ by: 'volume' }));
  assert.ok(ruleOk({ by: 'truss', pos: 'first' }));
  assert.ok(ruleOk({ by: 'group', value: 'Motoren', pos: 'last' }));
  assert.ok(!ruleOk({ by: 'group', value: '   ', pos: 'last' }), 'leerer Wert');
  assert.ok(!ruleOk({ by: 'group', value: 'x'.repeat(201), pos: 'last' }), 'zu lang');
  assert.ok(!ruleOk({ by: 'case', value: 'a', pos: 'middle' }), 'unbekannte Position');
  assert.ok(!ruleOk({ by: 'foo' }), 'unbekannte Art');
  assert.ok(!ruleOk({ by: 'volume', pos: 'first' }), 'Maßregel ohne Position');
  assert.ok(!ruleOk({ by: 'truss', value: 'x', pos: 'last' }), 'Traversen ohne Wert');
  assert.ok(!ruleOk(null));
});

test('normalizeRules: verwirft Ungültiges, trimmt, entfernt Doppelte (erste bleibt), deckelt auf MAX_RULES', () => {
  const out = normalizeRules([
    { by: 'group', value: ' Motoren ', pos: 'last' }, { by: 'foo' },
    { by: 'group', value: 'Motoren', pos: 'first' }, { by: 'volume', extra: 1 },
  ]);
  assert.deepEqual(out, [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }]);
  const many = Array.from({ length: 30 }, (_, i) => ({ by: 'group', value: `g${i}`, pos: 'last' }));
  assert.equal(normalizeRules(many).length, MAX_RULES);
  assert.deepEqual(normalizeRules('kaputt'), []);
});

test('addRule ersetzt dieselbe Regel und hängt hinten an; moveRule/removeRule', () => {
  const r0 = [{ by: 'truss', pos: 'last' }, { by: 'volume' }];
  assert.deepEqual(addRule(r0, { by: 'truss', pos: 'first' }), [{ by: 'volume' }, { by: 'truss', pos: 'first' }]);
  assert.deepEqual(moveRule(r0, 1, -1), [{ by: 'volume' }, { by: 'truss', pos: 'last' }]);
  assert.deepEqual(moveRule(r0, 0, -1), r0, 'oben bleibt oben');
  assert.deepEqual(removeRule(r0, 0), [{ by: 'volume' }]);
});

test('blockComparator: Traversen zuerst oder zuletzt', () => {
  const blocks = [block(small, 2), block(truss, 2), block(big, 2)];
  assert.deepEqual(order(blocks, [{ by: 'truss', pos: 'last' }, { by: 'volume' }]), ['big', 'small', 'truss']);
  assert.deepEqual(order(blocks, [{ by: 'truss', pos: 'first' }, { by: 'volume' }]), ['truss', 'big', 'small']);
});

test('blockComparator: Gruppe zuletzt trifft nur die Gruppe, nicht den ganzen Case-Typ', () => {
  const blocks = [block(big, 20, 'Motoren'), block(big, 3), block(small, 5)];
  assert.deepEqual(order(blocks, [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }]),
    ['big', 'small', 'big/Motoren']);
});

test('blockComparator: Case-Typ zuerst und Gewerk zuletzt', () => {
  const blocks = [block(big, 1), block(small, 1)];
  assert.deepEqual(order(blocks, [{ by: 'case', value: 'small', pos: 'first' }, { by: 'volume' }]), ['small', 'big']);
  assert.deepEqual(order(blocks, [{ by: 'category', value: 'Sonstiges', pos: 'last' }]), ['small', 'big']);
});

test('blockComparator: oberste Regel entscheidet, bei Gleichstand die nächste', () => {
  const blocks = [block(small, 9), block(big, 1), block(truss, 4)];
  assert.deepEqual(order(blocks, [{ by: 'count' }, { by: 'volume' }]), ['small', 'truss', 'big']);
  assert.deepEqual(order(blocks, [{ by: 'truss', pos: 'first' }, { by: 'count' }]), ['truss', 'small', 'big']);
});

test('blockComparator: Regel auf eine Gruppe, die es im Load nicht gibt, ändert nichts', () => {
  const blocks = [block(small, 1), block(big, 1)];
  assert.deepEqual(order(blocks, [{ by: 'group', value: 'Gibt es nicht', pos: 'first' }, { by: 'volume' }]), ['big', 'small']);
});

test('blockComparator: ohne Regel entscheidet der Name, dann die Gruppe', () => {
  const blocks = [block(small, 1, 'B'), block(big, 1), block(small, 1, 'A')];
  assert.deepEqual(order(blocks, []), ['big', 'small/A', 'small/B']);
});

test('ruleTargets: Gruppen, Case-Typen und Gewerke des Loads, sortiert; Traversen erkannt', () => {
  const pieces = [
    { caseId: 'big', group: 'Motoren' }, { caseId: 'small' }, { caseId: 'truss' }, { caseId: 'weg' },
    { caseId: 'big', group: 'FOH' },
  ];
  const t = ruleTargets(pieces, byId(big, small, truss));
  assert.deepEqual(t.groups, ['FOH', 'Motoren']);
  assert.deepEqual(t.cases, [{ id: 'big', name: 'big' }, { id: 'small', name: 'small' }, { id: 'truss', name: 'truss' }]);
  assert.deepEqual(t.categories, ['Sonstiges', 'Ton']);
  assert.equal(t.hasTruss, true);
});

test('ruleActive: Auswahlregel nur aktiv, wenn ihr Ziel im Load vorkommt', () => {
  const t = { groups: ['Motoren'], cases: [{ id: 'big', name: 'big' }], categories: ['Ton'], hasTruss: false };
  assert.equal(ruleActive({ by: 'group', value: 'Motoren', pos: 'last' }, t), true);
  assert.equal(ruleActive({ by: 'group', value: 'FOH', pos: 'last' }, t), false);
  assert.equal(ruleActive({ by: 'case', value: 'big', pos: 'first' }, t), true);
  assert.equal(ruleActive({ by: 'category', value: 'Licht', pos: 'first' }, t), false);
  assert.equal(ruleActive({ by: 'truss', pos: 'last' }, t), false);
  assert.equal(ruleActive({ by: 'volume' }, t), true);
});

test('describeRule: deutsche Texte mit typografischen Anführungszeichen', () => {
  const cases = byId(big);
  assert.equal(describeRule({ by: 'truss', pos: 'last' }, cases), 'Traversen: zuletzt (Tür)');
  assert.equal(describeRule({ by: 'group', value: 'Motoren', pos: 'last' }, cases), 'Gruppe „Motoren“: zuletzt (Tür)');
  assert.equal(describeRule({ by: 'case', value: 'big', pos: 'first' }, cases), 'Case-Typ „big“: zuerst (Stirnwand)');
  assert.equal(describeRule({ by: 'case', value: 'weg', pos: 'first' }, cases), 'Case-Typ „weg“: zuerst (Stirnwand)');
  assert.equal(describeRule({ by: 'category', value: 'Ton', pos: 'first' }, cases), 'Gewerk „Ton“: zuerst (Stirnwand)');
  assert.equal(describeRule({ by: 'volume' }, cases), 'Große zuerst');
  assert.equal(describeRule({ by: 'count' }, cases), 'Stückzahl zuerst');
});
```

- [ ] **Step 2: Test laufen lassen** – `node --test tests/packRules.test.js`, Erwartung: FAIL, weil das Modul fehlt.

- [ ] **Step 3: Modul schreiben** – `js/model/packRules.js`:

```js
import { outerDims } from './geometry.js';
import { isTruss } from './truss.js';

// Pack-Regeln je Load (Nutzerwunsch 2026-09-30, Spec docs/superpowers/specs/2026-09-30-pack-regeln-
// design.md): eine Rangliste, die die sortenreinen Blöcke (Case-Typ + Gruppe) von der Stirnwand
// zur Tür ordnet. Die oberste Regel entscheidet, bei Gleichstand die nächste. Auswahlregeln
// schieben einen Block nach vorn (first = Stirnwand) oder hinten (last = Tür), Maßregeln ordnen
// nach Einzelvolumen bzw. Stückzahl absteigend.
export const MAX_RULES = 20;
export const MAX_RULE_VALUE = 200;
const SELECT_BY = ['truss', 'group', 'case', 'category'];
const MEASURE_BY = ['volume', 'count'];
const POSITIONS = ['first', 'last'];
export const POS_LABEL = { first: 'zuerst (Stirnwand)', last: 'zuletzt (Tür)' };
// Reihenfolge und Beschriftung für die Auswahl „Regel hinzufügen“ (js/ui/pack-rules.js).
export const RULE_KINDS = [
  { by: 'group', label: 'Gruppe' },
  { by: 'case', label: 'Case-Typ' },
  { by: 'category', label: 'Gewerk' },
  { by: 'truss', label: 'Traversen' },
  { by: 'volume', label: 'Große zuerst' },
  { by: 'count', label: 'Stückzahl zuerst' },
];

export const volumeOf = c => { const { l, w, h } = outerDims(c); return l * w * h; };

// Die bis V 0.8.4 festen Reihenfolgen, als Regeln ausgedrückt – liefert exakt dieselbe Ordnung wie
// die früheren Komparatoren in orderSorts (Regressionstest in tests/packer.test.js).
export function legacyRules(order) {
  return order === 'count'
    ? [{ by: 'count' }, { by: 'volume' }]
    : [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }];
}

export const rulesFor = plan => (Array.isArray(plan?.packRules) ? plan.packRules : legacyRules(plan?.packOrder));

export function ruleOk(r) {
  if (!r || typeof r !== 'object') return false;
  if (MEASURE_BY.includes(r.by)) return r.pos === undefined && r.value === undefined;
  if (!SELECT_BY.includes(r.by) || !POSITIONS.includes(r.pos)) return false;
  if (r.by === 'truss') return r.value === undefined;
  return typeof r.value === 'string' && r.value.trim().length > 0 && r.value.length <= MAX_RULE_VALUE;
}

const canonical = r => (MEASURE_BY.includes(r.by) ? { by: r.by }
  : r.by === 'truss' ? { by: 'truss', pos: r.pos }
  : { by: r.by, value: r.value.trim(), pos: r.pos });

// Eine Regel je Art und Ziel: „Gruppe Motoren“ kann nicht zugleich zuerst und zuletzt stehen.
export const ruleKey = r => (r.value === undefined ? r.by : `${r.by}\u0000${r.value.trim()}`);

export function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  const seen = new Set(), out = [];
  for (const r of rules) {
    if (!ruleOk(r)) continue;
    const c = canonical(r), k = ruleKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length === MAX_RULES) break;
  }
  return out;
}

export const addRule = (rules, rule) =>
  normalizeRules([...rules.filter(r => ruleKey(r) !== ruleKey(canonical(rule))), rule]);

export function moveRule(rules, i, delta) {
  const j = i + delta;
  if (i < 0 || i >= rules.length || j < 0 || j >= rules.length) return rules;
  const next = [...rules];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const removeRule = (rules, i) => rules.filter((_, k) => k !== i);

const matches = (r, blk) => {
  const it = blk[0];
  if (r.by === 'truss') return isTruss(it.c);
  if (r.by === 'group') return (it.group ?? '') === r.value;
  if (r.by === 'case') return it.caseId === r.value;
  return it.c.category === r.value;
};

// Ein Block = Array von Stücken { caseId, c, group? } desselben Case-Typs und derselben Gruppe.
// Schlusskriterien: Name, dann Gruppe (ohne Gruppe zuerst). Bei völligem Gleichstand bleibt die
// Eingabereihenfolge (Array.prototype.sort ist stabil) – wie bisher in orderSorts.
export function blockComparator(rules) {
  const cmps = normalizeRules(rules).map(r => {
    if (r.by === 'volume') return (a, b) => volumeOf(b[0].c) - volumeOf(a[0].c);
    if (r.by === 'count') return (a, b) => b.length - a.length;
    const rank = blk => (matches(r, blk) ? (r.pos === 'first' ? -1 : 1) : 0);
    return (a, b) => rank(a) - rank(b);
  });
  const nameOf = blk => String(blk[0].c.name ?? blk[0].caseId);
  cmps.push((a, b) => nameOf(a).localeCompare(nameOf(b), 'de'));
  cmps.push((a, b) => (a[0].group ?? '').localeCompare(b[0].group ?? '', 'de'));
  return (a, b) => {
    for (const f of cmps) { const d = f(a, b); if (d) return d; }
    return 0;
  };
}

// Was sich im aktuellen Load ansprechen lässt. pieces = Placements + Ablage, Stücke ohne
// bekannten Case-Typ zählen nicht.
export function ruleTargets(pieces, caseById) {
  const groups = new Set(), cases = new Map(), categories = new Set();
  let hasTruss = false;
  for (const x of pieces) {
    const c = caseById.get(x.caseId);
    if (!c) continue;
    if (x.group) groups.add(x.group);
    cases.set(c.id, String(c.name ?? c.id));
    if (c.category) categories.add(c.category);
    if (isTruss(c)) hasTruss = true;
  }
  const de = (a, b) => a.localeCompare(b, 'de');
  return {
    groups: [...groups].sort(de),
    cases: [...cases].map(([id, name]) => ({ id, name })).sort((a, b) => de(a.name, b.name)),
    categories: [...categories].sort(de),
    hasTruss,
  };
}

export function ruleActive(r, t) {
  if (r.by === 'truss') return t.hasTruss;
  if (r.by === 'group') return t.groups.includes(r.value);
  if (r.by === 'case') return t.cases.some(c => c.id === r.value);
  if (r.by === 'category') return t.categories.includes(r.value);
  return true;
}

export function describeRule(r, caseById) {
  if (r.by === 'volume') return 'Große zuerst';
  if (r.by === 'count') return 'Stückzahl zuerst';
  const pos = POS_LABEL[r.pos];
  if (r.by === 'truss') return `Traversen: ${pos}`;
  if (r.by === 'group') return `Gruppe „${r.value}“: ${pos}`;
  if (r.by === 'case') return `Case-Typ „${caseById.get(r.value)?.name ?? r.value}“: ${pos}`;
  return `Gewerk „${r.value}“: ${pos}`;
}
```

- [ ] **Step 4:** `'js/model/packRules.js'` in `sw.js` ASSETS nach `'js/model/packer.js'` eintragen.
- [ ] **Step 5:** `npm test` ausführen. Erwartung: alles grün, einschließlich `pwa.test.js`.
- [ ] **Step 6: Commit** – `git add js/model/packRules.js tests/packRules.test.js sw.js && git commit -m "feat: Pack-Regeln als reines Modul (Rangliste, Komparator, Texte)"`

---

### Task 2: Packer ordnet Blöcke aus Case-Typ und Gruppe nach Regeln

**Files:**
- Modify: `js/model/packer.js` (`orderSorts`, `buildStacks`-Signatur, `autoPack`)
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `legacyRules`, `blockComparator`, `volumeOf` aus Task 1.
- Produces:
  - `orderSorts(itemList, rules: Rule[] | 'volume' | 'count' = 'volume') → Item[][]`
  - `buildStacks(itemList, truck, { order?, rules? })`
  - `autoPack(items, truck, { obstacles?, order?, rules?, startX? })`. `rules` hat Vorrang vor `order`.
  - Placements tragen `group`, falls das Stück eine Gruppe hat.

- [ ] **Step 1: Failing Tests** am Ende von `tests/packer.test.js` anhängen:

```js
// Pack-Regeln (Spec 2026-09-30): Blöcke = Case-Typ + Gruppe, Reihenfolge per Rangliste.
test('orderSorts: gleicher Case-Typ mit und ohne Gruppe ergibt zwei Blöcke', () => {
  const c = mkCase('mot', 60, 60, 60);
  const list = [...items(c, 3, 'a'), ...items(c, 2, 'g').map(it => ({ ...it, group: 'Motoren' }))];
  const blocks = orderSorts(list, [{ by: 'group', value: 'Motoren', pos: 'last' }]);
  assert.deepEqual(blocks.map(b => [b[0].group ?? '', b.length]), [['', 3], ['Motoren', 2]]);
});

test('orderSorts: Regel-Array und alter String liefern bei Altdaten dieselbe Reihenfolge', () => {
  const big = mkCase('big', 120, 80, 80), small = mkCase('small', 60, 60, 60);
  const tr = mkCase('tr', 300, 62, 115, { kind: 'truss', truss: { length: 300, width: 62, count: 1, standing: true, height: 115 } });
  const list = [...items(small, 5, 's'), ...items(tr, 2, 't'), ...items(big, 1, 'b')];
  const ids = bl => bl.map(b => b[0].caseId);
  assert.deepEqual(ids(orderSorts(list, 'volume')), ['big', 'small', 'tr']);
  assert.deepEqual(ids(orderSorts(list, [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }])), ['big', 'small', 'tr']);
  assert.deepEqual(ids(orderSorts(list, 'count')), ['small', 'tr', 'big']);
});

test('autoPack: Gruppe „Motoren“ zuletzt steht an der Tür, Traversen zuerst an der Stirnwand', () => {
  const mot = mkCase('mot', 80, 60, 60, { weight: 45 });
  const pack = mkCase('pack', 120, 60, 60, { weight: 50 });
  const tr = mkCase('tr', 240, 62, 115, { kind: 'truss', stackable: false, weight: 120, truss: { length: 240, width: 62, count: 1, standing: true, height: 115 } });
  const list = [
    ...items(mot, 8, 'm').map(it => ({ ...it, group: 'Motoren' })),
    ...items(pack, 8, 'p'), ...items(tr, 4, 't'),
  ];
  const rules = [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'truss', pos: 'first' }, { by: 'volume' }];
  const { placements, unplaced } = autoPack(list, mkTruck(), { rules });
  assert.equal(unplaced.length, 0);
  const maxX = id => Math.max(...placements.filter(p => p.caseId === id).map(p => p.x));
  const minX = id => Math.min(...placements.filter(p => p.caseId === id).map(p => p.x));
  assert.equal(minX('tr'), 0, 'Traversen beginnen an der Stirnwand');
  assert.ok(minX('mot') >= maxX('pack'), 'Motoren stehen hinter den Packcases');
  assert.ok(placements.filter(p => p.caseId === 'mot').every(p => p.group === 'Motoren'), 'Gruppe wandert ins Placement');
  assert.ok(placements.filter(p => p.caseId === 'pack').every(p => !('group' in p)), 'ohne Gruppe kein Feld');
});

test('autoPack: order-String bleibt gültig und entspricht legacyRules (Altdaten)', () => {
  const a = mkCase('a', 120, 60, 60), b = mkCase('b', 60, 60, 60);
  const list = [...items(a, 3, 'a'), ...items(b, 6, 'b')];
  for (const order of ['volume', 'count']) {
    const viaOrder = autoPack(list, mkTruck(), { order });
    const viaRules = autoPack(list, mkTruck(), { rules: order === 'count'
      ? [{ by: 'count' }, { by: 'volume' }]
      : [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }] });
    assert.deepEqual(viaRules, viaOrder, order);
  }
});
```

- [ ] **Step 2:** `node --test tests/packer.test.js` ausführen. Erwartung: Die neuen Tests schlagen fehl (orderSorts ignoriert Gruppe und Regel-Array, kein `group` im Placement).

- [ ] **Step 3: Implementierung** in `js/model/packer.js`:
  - Import ergänzen: `import { legacyRules, blockComparator, volumeOf } from './packRules.js';`
  - Die lokale Zeile `const volumeOf = …` entfernen. Sie liegt jetzt in `packRules.js`.
  - `orderSorts` ersetzen durch:

```js
// Sortenrein packen: ein Block ist ein Case-Typ (caseId) PLUS Gruppe (Stück-Feld `group`, Spec
// 2026-09-30) – so lassen sich z. B. 20 von 30 gleichen Cases als „Motoren“ an die Tür schieben.
// `rules` ist die Rangliste des Loads (js/model/packRules.js); ein String 'volume'/'count' (Altdaten,
// alte Aufrufer) wird über legacyRules übersetzt und ergibt exakt die frühere Reihenfolge.
export function orderSorts(itemList, rules = 'volume') {
  const list = typeof rules === 'string' ? legacyRules(rules) : rules;
  const groups = new Map();
  for (const it of itemList) {
    const key = `${it.caseId}\u0000${it.group ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return [...groups.values()].sort(blockComparator(list));
}
```

  - `PACK_ORDERS` und den Kommentar darüber stehen lassen. `io.js` braucht es für `packOrder` in alten Dateien. Den Kommentar um den Satz ergänzen: „Seit V 0.8.5 nur noch für Altdaten; neue Loads tragen `packRules`.“
  - `buildStacks(itemList, truck, { order = 'volume', rules } = {})`, darin `orderSorts(itemList, rules ?? order)`.
  - `autoPack(items, truck, { obstacles = [], order = 'volume', rules, startX = 0 } = {})` ruft `buildStacks(items, truck, { order, rules })` auf. Im Placement-Objekt nach der `tipped`-Zeile ergänzen: `...(it.group ? { group: it.group } : {}),`
  - Kopfkommentar von `autoPack` ergänzen: `order: 'volume' | 'count' (Altdaten), rules: Rangliste (packRules.js, hat Vorrang)`.

- [ ] **Step 4:** `npm test` ausführen. Erwartung: alles grün. Alle bisherigen Packer-Tests mit `order: 'volume'|'count'` laufen unverändert, das ist die Regression für Altdaten.
- [ ] **Step 5: Commit** – `git add js/model/packer.js tests/packer.test.js && git commit -m "feat: Packer ordnet Blöcke (Case-Typ + Gruppe) nach Pack-Regeln"`

---

### Task 3: Aktionen – `group` durch alle Wege, `setPieceGroup`, `setPackRules`

**Files:**
- Modify: `js/model/actions.js`
- Test: `tests/actions.test.js`

**Interfaces:**
- Consumes: `rulesFor`, `normalizeRules` (Task 1). `autoPack(…, { rules })` (Task 2).
- Produces:
  - `setPieceGroup(plan, id, group: string|null) → plan`
  - `setPackRules(plan, rules: Rule[]) → plan`
  - `addUnplaced(plan, caseId, n, newId, { …, group })`

- [ ] **Step 1: Failing Tests** an `tests/actions.test.js` anhängen. Die vorhandenen Helfer der Datei nutzen (`ctxBS`, `unplacedMix`, `firstAtWall` stehen um Zeile 605). Dazu:

```js
// Pack-Regeln und Gruppen (Spec 2026-09-30).
import { rulesFor } from '../js/model/packRules.js'; // (Import an den Dateianfang verschieben)

const gCase = mkCase('g', 60, 60, 60);
const gCtx = () => ({ caseById: byId(gCase), truck: mkTruck(), newId: counter('n') });

test('addUnplaced: group getrimmt und gekürzt, leer = kein Feld', () => {
  const p = A.addUnplaced(plan([]), 'g', 2, counter(), { group: '  Motoren  ' });
  assert.deepEqual(p.unplaced.map(u => u.group), ['Motoren', 'Motoren']);
  const long = A.addUnplaced(plan([]), 'g', 1, counter(), { group: 'x'.repeat(60) });
  assert.equal(long.unplaced[0].group.length, 40);
  const none = A.addUnplaced(plan([]), 'g', 1, counter(), { group: '   ' });
  assert.ok(!('group' in none.unplaced[0]));
});

test('setPieceGroup: setzt, ändert und entfernt; unverändert = gleiche Referenz', () => {
  const p0 = plan([P('a', 'g', 0, 0, 0)], [{ id: 'u', caseId: 'g' }]);
  const p1 = A.setPieceGroup(p0, 'a', ' FOH ');
  assert.equal(p1.placements[0].group, 'FOH');
  assert.equal(A.setPieceGroup(p1, 'a', 'FOH'), p1);
  assert.ok(!('group' in A.setPieceGroup(p1, 'a', '').placements[0]));
  assert.equal(A.setPieceGroup(p0, 'u', 'Motoren').unplaced[0].group, 'Motoren');
  assert.equal(A.setPieceGroup(p0, 'fehlt', 'x'), p0);
});

test('setPackRules: normalisiert, schreibt packRules, unverändert = gleiche Referenz', () => {
  const p0 = { ...plan([]), packOrder: 'count' };
  const p1 = A.setPackRules(p0, [{ by: 'group', value: ' Motoren ', pos: 'last' }, { by: 'foo' }]);
  assert.deepEqual(p1.packRules, [{ by: 'group', value: 'Motoren', pos: 'last' }]);
  assert.equal(A.setPackRules(p1, [{ by: 'group', value: 'Motoren', pos: 'last' }]), p1);
  assert.deepEqual(rulesFor(p1), p1.packRules, 'packRules gewinnt gegen packOrder');
});

test('packAll: Gruppe bleibt erhalten und Regel „Gruppe zuletzt“ wirkt', () => {
  const big = mkCase('big', 120, 60, 60);
  const ctx = { caseById: byId(gCase, big), truck: mkTruck(), newId: counter('n') };
  let p = A.addUnplaced(plan([]), 'g', 4, counter('g'), { group: 'Motoren' });
  p = A.addUnplaced(p, 'big', 4, counter('b'));
  p = A.setPackRules(p, [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }]);
  const packed = A.packAll(p, ctx);
  const mot = packed.placements.filter(q => q.caseId === 'g');
  assert.equal(mot.length, 4);
  assert.ok(mot.every(q => q.group === 'Motoren'));
  const maxBig = Math.max(...packed.placements.filter(q => q.caseId === 'big').map(q => q.x));
  assert.ok(Math.min(...mot.map(q => q.x)) >= maxBig);
});

test('group überlebt In Ablage, Truck entladen, Duplizieren (Ablage-Zweig) und Ziehen aus der Ablage', () => {
  const ctx = gCtx();
  const p0 = plan([P('a', 'g', 0, 0, 0, { group: 'FOH' })]);
  assert.equal(A.toTray(p0, 'a').unplaced[0].group, 'FOH');
  assert.equal(A.unloadAll(p0).unplaced[0].group, 'FOH');
  const tiny = { ...ctx, truck: mkTruck({ l: 60, w: 60 }) };
  assert.equal(A.duplicate(p0, 'a', tiny).unplaced[0].group, 'FOH', 'Kopie ohne Platz landet mit Gruppe in der Ablage');
  const back = A.placeCase(A.toTray(p0, 'a'), 'g', { x: 0, y: 0 }, ctx, { fromUnplacedId: 'a' });
  assert.equal(back.placements[0].group, 'FOH');
});

test('packRest: Regeln ordnen nur die neuen Blöcke, sie schließen hinter der vorhandenen Ladung an', () => {
  const big = mkCase('big', 120, 60, 60);
  const ctx = { caseById: byId(gCase, big), truck: mkTruck(), newId: counter('n') };
  let p = plan([P('x', 'big', 0, 0, 0)]);
  p = A.addUnplaced(p, 'g', 2, counter('g'), { group: 'Motoren' });
  p = A.addUnplaced(p, 'big', 2, counter('b'));
  p = A.setPackRules(p, [{ by: 'group', value: 'Motoren', pos: 'first' }]);
  const r = A.packRest(p, ctx);
  assert.equal(r.unplaced.length, 0);
  assert.equal(r.placements.find(q => q.id === 'x').x, 0, 'vorhandene Ladung bleibt stehen');
  const mot = r.placements.filter(q => q.caseId === 'g');
  const newBig = r.placements.filter(q => q.caseId === 'big' && q.id !== 'x');
  assert.ok(Math.min(...mot.map(q => q.x)) <= Math.min(...newBig.map(q => q.x)), 'Motoren zuerst unter den neuen');
});

test('packAll: Plan im alten Schema (nur packOrder, kein group) packt wie vorher', () => {
  const old = { ...unplacedMix(), packOrder: 'count' };
  assert.equal(firstAtWall(A.packAll(old, ctxBS())), 'small');
});
```

Hinweis für die Umsetzung: `P`, `plan`, `mkCase`, `mkTruck`, `byId`, `counter` kommen aus `tests/fixtures.js`. Nur fehlende Importe ergänzen.

- [ ] **Step 2:** `node --test tests/actions.test.js` ausführen. Erwartung: Die neuen Tests schlagen fehl.

- [ ] **Step 3: Implementierung** in `js/model/actions.js`:
  - Imports: `import { rulesFor, normalizeRules } from './packRules.js';`
  - Helfer unter `touch`:

```js
// Gruppenname eines Stücks (Pack-Regeln, Spec 2026-09-30): getrimmt, auf MAX_LABEL gekürzt, leer = kein Feld.
const cleanGroup = g => (typeof g === 'string' ? g.trim().slice(0, MAX_LABEL) : '');
const groupField = g => { const v = cleanGroup(g); return v ? { group: v } : {}; };
```

  - `addUnplaced`: Optionsobjekt um `group = null` ergänzen. Im erzeugten Stück nach `tipped` einfügen: `...groupField(group),`
  - `placeCase`: `const { label, color, layers, tipped, group } = src ?? {};` und in `srcExtra` `...groupField(group)` anhängen.
  - `duplicate` im `trayEntry` anhängen: `...groupField(p.group)`. Die Platzierungskopie spreadet `p` und behält `group` ohnehin.
  - `placementToUnplaced` anhängen: `...groupField(p.group)`. Den Kommentar darüber um `group?` ergänzen.
  - `toPiece` anhängen: `...groupField(x.group)`
  - Neue Aktionen nach `setPieceTipped`:

```js
export function setPieceGroup(plan, id, group) {
  const found = findPiece(plan, id);
  if (!found) return plan;
  const next = cleanGroup(group);
  if ((found.item.group ?? '') === next) return plan;
  const patch = it => {
    if (it.id !== id) return it;
    const { group: _drop, ...rest } = it;
    return next ? { ...rest, group: next } : rest;
  };
  return touch({ ...plan, placements: plan.placements.map(patch), unplaced: plan.unplaced.map(patch) });
}
```

  - `setPackOrder` bleibt, wird aber nicht mehr von der Oberfläche aufgerufen. Darunter:

```js
// Rangliste der Pack-Regeln je Load (Spec 2026-09-30). Einmal gesetzt, wird packOrder nicht mehr
// gelesen (rulesFor). Unveränderte Regeln = gleiche Referenz, damit kein leerer Undo-Schritt entsteht.
export function setPackRules(plan, rules) {
  const next = normalizeRules(rules);
  if (Array.isArray(plan.packRules) && JSON.stringify(plan.packRules) === JSON.stringify(next)) return plan;
  return touch({ ...plan, packRules: next });
}
```

  - `packAll`: `autoPack(list, ctx.truck, { rules: rulesFor(plan) })`. `packRest`: `{ obstacles: …, rules: rulesFor(plan), startX }`.

- [ ] **Step 4:** `npm test` ausführen. Erwartung: alles grün.
- [ ] **Step 5: Commit** – `git add js/model/actions.js tests/actions.test.js && git commit -m "feat: Gruppe je Stück und Pack-Regeln je Load in den Aktionen"`

---

### Task 4: Speicherung und Austausch – `packRules`, `group`, Regelsets

**Files:**
- Modify: `js/store/io.js`, `js/store/repo.js`, `js/store/db.js`
- Test: `tests/io.test.js`, `tests/repo.test.js`

**Interfaces:**
- Consumes: `ruleOk`, `MAX_RULES` (Task 1).
- Produces:
  - `exportBundle({ cases, trucks, plans, ruleSets = [] })`
  - `parseBundle(text) → { …, ruleSets }`
  - `checkRuleSet(rs)`
  - `repo.loadAll()`/`loadAllFallback()` liefern zusätzlich `ruleSets`.
  - `repo.mergeImportedBundle({ …, ruleSets }, bundle) → { …, ruleSets, winners: { …, ruleSets } }`
  - `repo.saveRuleSet(rs)`, `repo.deleteRuleSet(id)`
  - `buildImportWinnerItems` ordnet `ruleSets` dem Store `'ruleSets'` zu.
- RuleSet = `{ id: string, name: string (1–80 Zeichen), rules: Rule[] (≤ 20, alle ruleOk), updatedAt?: string }`

- [ ] **Step 1: Failing Tests** – an `tests/io.test.js` anhängen. Die vorhandenen Importe (`exportBundle`, `parseBundle`, `plan`, `P`) nutzen:

```js
// Pack-Regeln (Spec 2026-09-30)
test('Import: Plan mit gültigen packRules und Stücken mit group', () => {
  const p = { ...plan([P('a', 'x', 0, 0, 0, { group: 'Motoren' })], [{ id: 'u', caseId: 'x', group: 'FOH' }]),
    packRules: [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }] };
  const b = parseBundle(exportBundle({ cases: [], trucks: [], plans: [p] }));
  assert.deepEqual(b.plans[0].packRules, p.packRules);
  assert.equal(b.plans[0].placements[0].group, 'Motoren');
  assert.equal(b.plans[0].unplaced[0].group, 'FOH');
});

test('Import: kaputte packRules oder group werden mit Meldung abgelehnt', () => {
  const bad = [
    { ...plan([]), packRules: [{ by: 'foo' }] },
    { ...plan([]), packRules: 'volume' },
    { ...plan([]), packRules: Array.from({ length: 21 }, (_, i) => ({ by: 'group', value: `g${i}`, pos: 'last' })) },
  ];
  for (const p of bad) assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [p] })), /Pack-Regeln/);
  const badGroup = plan([P('a', 'x', 0, 0, 0, { group: 'x'.repeat(41) })]);
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [badGroup] })), /ungültige Platzierungen/);
});

test('Import: Regelsets kommen mit, kaputte werden abgelehnt, Datei ohne ruleSets (altes Schema) geht', () => {
  const rs = { id: 'rs1', name: 'Tour-Standard', rules: [{ by: 'truss', pos: 'first' }], updatedAt: '2026-09-30T10:00:00Z' };
  const b = parseBundle(exportBundle({ cases: [], trucks: [], plans: [], ruleSets: [rs] }));
  assert.deepEqual(b.ruleSets, [rs], 'eine Datei nur mit Regelsets ist nicht „leer“');
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [], ruleSets: [{ ...rs, rules: [{ by: 'x' }] }] })), /Regelset/);
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [], ruleSets: [{ ...rs, name: '' }] })), /Regelset/);
  const old = JSON.parse(exportBundle({ cases: [], trucks: [], plans: [plan([])] }));
  delete old.ruleSets;
  assert.deepEqual(parseBundle(JSON.stringify(old)).ruleSets, []);
});
```

  An `tests/repo.test.js` anhängen, dazu die Importliste um nichts Neues erweitern:

```js
test('mergeImportedBundle: Regelsets per ID, neuerer Stand gewinnt, Gewinner werden gemeldet', () => {
  const local = { id: 'r1', name: 'Alt', rules: [], updatedAt: '2026-09-01T00:00:00Z' };
  const file = { id: 'r1', name: 'Neu', rules: [{ by: 'volume' }], updatedAt: '2026-09-30T00:00:00Z' };
  const r = mergeImportedBundle({ cases: [], trucks: [], plans: [], plan: null, ruleSets: [local] },
    { cases: [], trucks: [], plans: [], ruleSets: [file] });
  assert.deepEqual(r.ruleSets, [file]);
  assert.deepEqual(r.winners.ruleSets, [file]);
});

test('mergeImportedBundle: Zustand und Bundle ohne ruleSets (altes Schema) ergeben leere Listen', () => {
  const r = mergeImportedBundle({ cases: [], trucks: [], plans: [], plan: null }, { cases: [], trucks: [], plans: [] });
  assert.deepEqual(r.ruleSets, []);
  assert.deepEqual(r.winners.ruleSets, []);
});

test('buildImportWinnerItems: Regelsets landen im Store ruleSets', () => {
  const rs = { id: 'r1', name: 'X', rules: [] };
  assert.deepEqual(buildImportWinnerItems({ cases: [], trucks: [], plans: [], ruleSets: [rs] }), [{ store: 'ruleSets', value: rs }]);
});

test('loadAllFallback: liefert leere Regelsets', () => {
  assert.deepEqual(loadAllFallback().ruleSets, []);
});
```

- [ ] **Step 2:** `node --test tests/io.test.js tests/repo.test.js` ausführen. Erwartung: Die neuen Tests schlagen fehl.

- [ ] **Step 3: Implementierung `js/store/io.js`:**
  - Import: `import { ruleOk, MAX_RULES } from '../model/packRules.js';`
  - Neben `tippedOk`: `const groupOk = x => x.group === undefined || (typeof x.group === 'string' && x.group.trim().length > 0 && x.group.length <= MAX_LABEL);`
  - `const rulesOk = r => Array.isArray(r) && r.length <= MAX_RULES && r.every(ruleOk);`
  - In `checkPlan` nach der `packOrder`-Prüfung:
    `if (p.packRules !== undefined && !rulesOk(p.packRules)) throw new Error(\`Ladeplan „${p.name}“ hat ungültige Pack-Regeln.\`);`
  - `placementOk` und `unplacedOk` jeweils `&& groupOk(pl)` / `&& groupOk(u)` anhängen.
  - Neu nach `checkPlan`:

```js
export function checkRuleSet(rs) {
  const name = typeof rs?.name === 'string' ? rs.name : '';
  if (!rs || typeof rs.id !== 'string' || !name.trim() || name.length > 80 || !rulesOk(rs.rules) || !updatedAtOk(rs))
    throw new Error(`Regelset „${name || '?'}“ ist ungültig.`);
}
```

  - `exportBundle({ cases, trucks, plans, ruleSets = [] }, now)` schreibt zusätzlich `ruleSets`.
  - `FIELD_LABELS` um `ruleSets: 'Regelsets'` ergänzen. Die Feld-Schleife in `parseBundle` läuft über `['cases', 'trucks', 'plans', 'ruleSets']`.
  - In `parseBundle`: `const ruleSets = arr(data.ruleSets);`. Die Leer-Prüfung um `&& ruleSets.length === 0` ergänzen. Nach `plans.forEach(checkPlan)` folgt `ruleSets.forEach(checkRuleSet);`. Die Rückgabe erhält `ruleSets`.

- [ ] **Step 4: Implementierung `js/store/db.js`:** `DB_VERSION = 2`, `STORES = ['cases', 'trucks', 'plans', 'ruleSets']`. Den Kommentar darüber so fassen: „V 2 (0.8.5): Store ruleSets. onupgradeneeded legt nur fehlende Stores an, vorhandene Daten bleiben.“

- [ ] **Step 5: Implementierung `js/store/repo.js`:**
  - `loadAll`: `db.getAll('ruleSets')` mit in das `Promise.all`, Rückgabe `ruleSets: sanitizeUpdatedAt(ruleSets)`.
  - `loadAllFallback`: `ruleSets: []`.
  - `mergeImportedBundle({ cases, trucks, plans, plan, ruleSets = [] }, bundle)`: `const mergedRuleSets = mergeById(ruleSets, bundle.ruleSets ?? []);`. Die Rückgabe erhält `ruleSets: mergedRuleSets` und `winners.ruleSets: (bundle.ruleSets ?? []).filter(x => mergedRuleSets.find(m => m.id === x.id) === x)`.
  - `buildImportWinnerItems`: `...(winners.ruleSets ?? []).map(value => ({ store: 'ruleSets', value }))`
  - `export const saveRuleSet = rs => db.put('ruleSets', rs);` und `export const deleteRuleSet = id => db.del('ruleSets', id);`

- [ ] **Step 6:** `npm test` ausführen. Erwartung: alles grün. Falls bestehende Tests `winners` per `deepEqual` als Ganzes vergleichen, das Feld `ruleSets: []` im Erwartungswert ergänzen und nichts anderes ändern.
- [ ] **Step 7: Commit** – `git add js/store tests/io.test.js tests/repo.test.js && git commit -m "feat: Pack-Regeln, Gruppen und Regelsets in Speicherung und Sicherung"`

---

### Task 5: Dialog „Pack-Regeln“ und Werkzeugleiste

**Files:**
- Create: `js/ui/pack-rules.js`
- Modify: `index.html` (Knopf statt `#pack-order`, neues `<dialog id="dlg-rules">`), `js/app.js`, `css/app.css`, `sw.js` (ASSETS: `'js/ui/pack-rules.js'` nach `'js/ui/load-wizard.js'`)

**Interfaces:**
- Consumes: `RULE_KINDS`, `POS_LABEL`, `addRule`, `moveRule`, `removeRule`, `describeRule`, `ruleActive`, `ruleTargets`, `rulesFor` (Task 1). `A.setPackRules`, `A.packAll` (Task 3). `repo.saveRuleSet`/`deleteRuleSet`, `ruleSets` im Zustand (Task 4).
- Produces: `openPackRules(dlg, { rules, targets, caseById, ruleSets, onSaveRuleSet(name, rules) → Promise<RuleSet|undefined>, onDeleteRuleSet(id) → Promise<boolean> }) → Promise<{ rules, repack: boolean } | null>`

- [ ] **Step 1: `index.html`:**
  - Das `<select id="pack-order">…</select>` ersetzen durch `<button id="pack-rules" type="button">Pack-Regeln …</button>`.
  - Nach `<dialog id="dlg-truss"></dialog>` einfügen: `<dialog id="dlg-rules"></dialog>`.

- [ ] **Step 2: `js/ui/pack-rules.js`** schreiben:

```js
import { esc } from './dom.js';
import { RULE_KINDS, POS_LABEL, addRule, moveRule, removeRule, describeRule, ruleActive } from '../model/packRules.js';

// Dialog „Pack-Regeln“ (Spec 2026-09-30). Store-unwissend wie openCaseEditor/openLoadWizard: bekommt
// Regeln, Ziele des Loads und Regelsets als Argumente, speichert Regelsets über die Rückrufe von
// app.js und liefert { rules, repack } oder null (Abbrechen/Esc).
// Eigene Entscheidung: Reihenfolge über „↑“/„↓“ statt Ziehen – per Tastatur bedienbar, ohne
// Drag-Sonderfälle im <dialog>.
export function openPackRules(dlg, { rules, targets, caseById, ruleSets = [], onSaveRuleSet, onDeleteRuleSet }) {
  let cur = [...rules];
  let sets = [...ruleSets];

  dlg.innerHTML = `
    <form method="dialog" class="editor pack-rules">
      <h2>Pack-Regeln</h2>
      <p class="hint">Oben steht die wichtigste Regel, bei Gleichstand entscheidet die nächste. Jeder Case-Typ bleibt
        ein eigener Block, Stücke mit Gruppe bilden einen eigenen Block. „zuerst“ heißt an der Stirnwand, „zuletzt“ an der Tür.</p>
      <ol class="rule-list"></ol>
      <fieldset class="rule-add">
        <legend>Regel hinzufügen</legend>
        <div class="rule-add-row">
          <select name="by">${RULE_KINDS.map(k => `<option value="${k.by}">${esc(k.label)}</option>`).join('')}</select>
          <select name="value"></select>
          <select name="pos">${Object.entries(POS_LABEL).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
          <button type="button" data-act="add">+ Regel</button>
        </div>
      </fieldset>
      <fieldset class="rule-sets">
        <legend>Regelsets</legend>
        <div class="rule-add-row">
          <select name="set"></select>
          <button type="button" data-act="apply-set">Übernehmen</button>
          <button type="button" data-act="delete-set" class="danger">Löschen</button>
        </div>
        <div class="rule-add-row">
          <input name="setName" maxlength="80" placeholder="Name, z. B. „Tour-Standard“">
          <button type="button" data-act="save-set">Als Regelset speichern</button>
        </div>
        <small class="hint rule-set-hint" hidden></small>
      </fieldset>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save">Speichern</button>
        <button value="repack" class="primary">Speichern und neu packen</button>
      </menu>
    </form>`;

  const f = dlg.querySelector('form').elements;
  const listEl = dlg.querySelector('.rule-list');
  const addBtn = dlg.querySelector('[data-act="add"]');
  const setHint = dlg.querySelector('.rule-set-hint');

  const valueOptions = by => {
    if (by === 'group') return targets.groups.map(g => ({ value: g, label: g }));
    if (by === 'case') return targets.cases.map(c => ({ value: c.id, label: c.name }));
    if (by === 'category') return targets.categories.map(c => ({ value: c, label: c }));
    return null;
  };
  function syncAddRow() {
    const opts = valueOptions(f.by.value);
    f.value.hidden = !opts;
    f.pos.hidden = f.by.value === 'volume' || f.by.value === 'count';
    f.value.innerHTML = opts?.length
      ? opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')
      : '<option value="">(keine in diesem Load)</option>';
    addBtn.disabled = !!opts && !opts.length;
  }
  function renderList() {
    listEl.innerHTML = cur.map((r, i) => {
      const active = ruleActive(r, targets);
      return `
        <li class="rule ${active ? '' : 'inactive'}" data-i="${i}">
          <span class="rule-text">${esc(describeRule(r, caseById))}${active ? '' : ' <small>(nicht in diesem Load)</small>'}</span>
          <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} title="Nach oben">↑</button>
          <button type="button" data-act="down" ${i === cur.length - 1 ? 'disabled' : ''} title="Nach unten">↓</button>
          <button type="button" data-act="remove" title="Regel entfernen">×</button>
        </li>`;
    }).join('') || '<li class="hint">Keine Regel – dann entscheidet der Name.</li>';
  }
  function renderSets() {
    f.set.innerHTML = sets.length
      ? sets.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')
      : '<option value="">(noch keine Regelsets)</option>';
    dlg.querySelector('[data-act="apply-set"]').disabled = !sets.length;
    dlg.querySelector('[data-act="delete-set"]').disabled = !sets.length;
  }
  const showSetHint = text => { setHint.textContent = text; setHint.hidden = !text; };

  f.by.addEventListener('change', syncAddRow);
  dlg.querySelector('form').addEventListener('click', async e => {
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (!act) return;
    const i = Number(e.target.closest('[data-i]')?.dataset.i);
    if (act === 'up') cur = moveRule(cur, i, -1);
    if (act === 'down') cur = moveRule(cur, i, 1);
    if (act === 'remove') cur = removeRule(cur, i);
    if (act === 'add') {
      const by = f.by.value;
      const rule = by === 'volume' || by === 'count' ? { by }
        : by === 'truss' ? { by, pos: f.pos.value }
        : { by, value: f.value.value, pos: f.pos.value };
      cur = addRule(cur, rule);
    }
    if (act === 'apply-set') {
      const s = sets.find(x => x.id === f.set.value);
      if (s) { cur = [...s.rules]; showSetHint(`Regelset „${s.name}“ übernommen.`); }
    }
    if (act === 'delete-set') {
      const s = sets.find(x => x.id === f.set.value);
      if (s && await onDeleteRuleSet?.(s.id)) { sets = sets.filter(x => x.id !== s.id); showSetHint(`Regelset „${s.name}“ gelöscht.`); }
      renderSets();
    }
    if (act === 'save-set') {
      const name = f.setName.value.trim();
      if (!name) { f.setName.focus(); return; }
      const saved = await onSaveRuleSet?.(name, cur);
      if (saved) {
        sets = [...sets.filter(x => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'de'));
        f.setName.value = '';
        renderSets();
        f.set.value = saved.id;
        showSetHint(`Regelset „${saved.name}“ gespeichert.`);
      }
    }
    renderList();
  });

  syncAddRow();
  renderList();
  renderSets();

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const v = dlg.returnValue;
      resolve(v === 'save' || v === 'repack' ? { rules: cur, repack: v === 'repack' } : null);
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
```

- [ ] **Step 3: `js/app.js`:**
  - Imports: `import { openPackRules } from './ui/pack-rules.js';` und `import { rulesFor, ruleTargets, describeRule } from './model/packRules.js';`
  - `createStore({ …, ruleSets: data.ruleSets ?? [], … })`
  - Die Zeile `$('#pack-order').onchange = …` samt Kommentar ersetzen durch:

```js
// Pack-Regeln je Load (Spec 2026-09-30): Rangliste im eigenen Dialog, Regelsets als Vorlage.
async function saveRuleSetValue(name, rules) {
  const existing = store.get().ruleSets.find(r => r.name.toLowerCase() === name.toLowerCase());
  const value = stamp({ id: existing?.id ?? uid(), name, rules });
  try {
    await repo.saveRuleSet(value);
  } catch (err) {
    await showAlert(`Regelset konnte nicht gespeichert werden: ${err?.message ?? 'unbekannter Fehler'}`);
    return undefined;
  }
  store.update(s => ({ ...s, ruleSets: [...s.ruleSets.filter(r => r.id !== value.id), value] }));
  return value;
}
async function deleteRuleSetValue(id) {
  try {
    await repo.deleteRuleSet(id);
  } catch (err) {
    await showAlert(`Regelset konnte nicht gelöscht werden: ${err?.message ?? 'unbekannter Fehler'}`);
    return false;
  }
  store.update(s => ({ ...s, ruleSets: s.ruleSets.filter(r => r.id !== id) }));
  return true;
}
$('#pack-rules').onclick = async () => {
  const s = store.get(), c = ctx(s);
  const res = await openPackRules($('#dlg-rules'), {
    rules: rulesFor(s.plan),
    targets: ruleTargets([...s.plan.placements, ...s.plan.unplaced], c.caseById),
    caseById: c.caseById,
    ruleSets: [...s.ruleSets].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    onSaveRuleSet: saveRuleSetValue,
    onDeleteRuleSet: deleteRuleSetValue,
  });
  if (!res) return;
  // Ein einziger Undo-Schritt für „Regeln setzen und neu packen“.
  edit((p, cx) => { const next = A.setPackRules(p, res.rules); return res.repack ? A.packAll(next, cx) : next; });
  if (res.repack) await warnIfUnplaced();
};
```

  - Im Toolbar-Render-Hook `$('#pack-order').value = …` ersetzen durch:
    `$('#pack-rules').title = \`Reihenfolge beim automatischen Packen: ${rulesFor(s.plan).map(r => describeRule(r, d.caseById)).join(' · ') || 'nach Name'}\`;`
  - `$('#export').onclick`: `exportBundle({ cases: s.cases, trucks: s.trucks, plans, ruleSets: s.ruleSets })`
  - Import-Handler:
    - `backupText` mit `ruleSets: s0.ruleSets`.
    - Store-Update nach dem Mischen mit `ruleSets: merge.ruleSets`.
    - Rollback mit `ruleSets: s0.ruleSets`.
    - Erfolgsmeldung: nach `${merge.winners.plans.length} Ladepläne` ergänzen: `, ${merge.winners.ruleSets.length} Regelsets`.

- [ ] **Step 4: `css/app.css`** ans Ende des Editor-Blocks (nach `.editor .kind-switch …`):

```css
.pack-rules { min-width: min(560px, 90vw); }
.rule-list { margin: 0; padding-left: 22px; display: grid; gap: 6px; }
.rule-list .rule { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px; align-items: center; }
.rule-list .rule.inactive .rule-text { color: var(--muted); }
.rule-add-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rule-add-row input { flex: 1; min-width: 160px; }
```

- [ ] **Step 5:** `'js/ui/pack-rules.js'` in `sw.js` ASSETS eintragen und dann `npm test` ausführen. Erwartung: grün, einschließlich `pwa.test.js` und `smoke.test.js`.
- [ ] **Step 6: Browser-Kurzprüfung.**
  - `python3 -m http.server 8766` im Projektordner, Szenario im Scratchpad.
  - Das Szenario öffnet die App, legt per `p.eval` einen Load an, klickt `#pack-rules`, fügt „Traversen: zuerst“ hinzu und macht einen Screenshot des Dialogs.
  - Es prüft `p.logs` auf Fehler.
  - Screenshot ansehen: Texte lesbar, Knöpfe da.
- [ ] **Step 7: Commit** – `git add index.html js/ui/pack-rules.js js/app.js css/app.css sw.js && git commit -m "feat: Dialog „Pack-Regeln“ mit Rangliste und Regelsets"`

---

### Task 6: Gruppe im Wizard und im Inspector

**Files:**
- Modify: `js/ui/load-wizard.js`, `js/ui/inspector.js`, `js/app.js`
- Test: `tests/load-wizard.test.js`

**Interfaces:**
- Consumes: `A.setPieceGroup`, `addUnplaced(…, { group })` (Task 3). `ruleTargets` (Task 1).
- Produces:
  - `reduceWizardItem(it, c)` liefert zusätzlich `group`, falls es nach dem Trimmen nicht leer ist.
  - `openLoadWizard` nimmt die Option `groups: string[]` an (vorhandene Gruppen des Loads für die Vorschlagsliste).
  - `renderInspector` nimmt die Option `groups: string[]` an.

- [ ] **Step 1: Failing Test** in `tests/load-wizard.test.js`, im Stil der vorhandenen `reduceWizardItem`-Tests, mit deren `c`-Fixture:

```js
test('reduceWizardItem: Gruppe getrimmt und gekürzt übernommen, leer entfällt', () => {
  const c = mkCase('a', 60, 60, 60);
  const base = { layers: [1, 2, 3, 4], tipped: false };
  assert.equal(reduceWizardItem({ ...base, group: '  Motoren ' }, c).group, 'Motoren');
  assert.equal(reduceWizardItem({ ...base, group: 'x'.repeat(50) }, c).group.length, 40);
  assert.ok(!('group' in reduceWizardItem({ ...base, group: '  ' }, c)));
  assert.ok(!('group' in reduceWizardItem(base, c)), 'altes Wizard-Stück ohne Feld');
});
```

  `mkCase` aus `./fixtures.js` importieren, falls die Datei es noch nicht tut.

- [ ] **Step 2:** `node --test tests/load-wizard.test.js` ausführen. Erwartung: FAIL.

- [ ] **Step 3: `js/ui/load-wizard.js`:**
  - `reduceWizardItem`: In der Rückgabe `...(it.group?.trim() ? { group: it.group.trim().slice(0, MAX_LABEL) } : {}),` ergänzen und den Kommentar um einen Satz zur Gruppe erweitern.
  - Vorbelegung in `buildItemsState` und im Rückfall beim Schließen: `group: ''`.
  - Im Schritt „Beschriften“ vor `<div class="wiz-groups">` einfügen: `<datalist id="wiz-group-list"></datalist>`.
  - Je Zeile nach dem Farbfeld: `<input name="group" list="wiz-group-list" maxlength="${MAX_LABEL}" placeholder="Gruppe" value="${esc(it.group ?? '')}">`
  - Legende: `<button type="button" data-act="group-all">Gruppe auf alle übernehmen</button>` neben „Farbe auf alle übernehmen“.
  - `renderGroups()` füllt am Ende die Datalist:

```js
const known = [...new Set([...(opts.groups ?? []), ...allEntries().map(e => e.it.group?.trim()).filter(Boolean)])]
  .sort((a, b) => a.localeCompare(b, 'de'));
dlg.querySelector('#wiz-group-list').innerHTML = known.map(g => `<option value="${esc(g)}">`).join('');
```

  - `input`-Handler: `if (e.target.name === 'group') it.group = e.target.value;`
  - `click`-Handler der Gruppen: `group-all` analog zu `color-all`. Er nimmt den Wert des ersten `input[name="group"]` der Legende, setzt ihn bei allen Stücken des Case-Typs und ruft danach `renderGroups()` auf.
  - Die Ergebniszeile bleibt `items.push({ caseId, label, color, ...reduceWizardItem(it, c) })`. Die Gruppe kommt über `reduceWizardItem`.
  - Den Kopfkommentar zum Ergebnis auf `{ caseId, label, color, layers?, tipped?, group? }` aktualisieren und die Option `groups` aufführen.

- [ ] **Step 4: `js/app.js`:**
  - `runLoadWizard`: `groups: s.plan ? ruleTargets([...s.plan.placements, ...s.plan.unplaced], ctx().caseById).groups : []` übergeben und in `A.addUnplaced(…)` `group: it.group` ergänzen.
  - Inspector-Hook: `groups: ruleTargets([...s.plan.placements, ...s.plan.unplaced], d.caseById).groups` an `renderInspector` übergeben.
  - `change`-Handler des Inspectors: `if (name === 'group') return edit(p => A.setPieceGroup(p, id, e.target.value));`

- [ ] **Step 5: `js/ui/inspector.js`:**
  - Signatur `renderInspector(el, { selected, selectedUnplaced, result, truck, groups = [] })`.
  - In beiden `insp-label`-Blöcken nach „Farbe“:

```js
<label>Gruppe<input type="text" name="group" list="insp-group-list" maxlength="${MAX_LABEL}" placeholder="keine" value="${esc(PIECE.group ?? '')}"></label>
```

    mit `PIECE` = `selected.p` bzw. `selectedUnplaced.item`.
  - Vor `${sel}` im `el.innerHTML` einfügen: `<datalist id="insp-group-list">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>`.

- [ ] **Step 6:** `npm test` ausführen. Erwartung: grün.
- [ ] **Step 7: Commit** – `git add js/ui/load-wizard.js js/ui/inspector.js js/app.js tests/load-wizard.test.js && git commit -m "feat: Gruppe je Stück im Wizard und im Inspector"`

---

### Task 7: Browser-Abnahme, Doku, Version

**Files:**
- Modify: `README.md`, `docs/architektur.md`, `docs/offene-punkte.md`, `CHANGELOG.md`
- Nach Freigabe der Nummer zusätzlich: `js/version.js`, `package.json`, `index.html`, `sw.js`

- [ ] **Step 1: Browser-Szenario** (Scratchpad, `node tools/cdp.mjs ./szenario.mjs ./ausgabe`, Server auf 8766). Das Szenario macht per `p.eval` über `import('/js/app.js')` und `js/data/*` Folgendes:
  - Ein neuer Load im Sattelauflieger (`DEFAULT_TRUCK_ID`).
  - 20 × „D8+ 1t -BBM“ (in `CASE_LIBRARY` per Name suchen) mit `group: 'Motoren'`.
  - 8 × „MLT TWO …“ (in `PRESET_CASES` per Name, erster Treffer).
  - 12 × Packcase 120×60×60 (in `PRESET_CASES` per Name).
  - Regeln `[Gruppe Motoren zuletzt, Traversen zuerst, Große zuerst]` über `app.edit(p => A.setPackRules(p, …))`, danach `A.packAll`.
  - Prüfen per `p.eval`: kleinstes `x` der MLTs = 0, kleinstes `x` der Motoren ≥ größtes `x` der Packcases, `unplaced.length === 0`.
  - Screenshot der Draufsicht und des geöffneten Dialogs.
  - Ein Regelset „Test“ über den Dialog speichern (Namensfeld füllen, „Als Regelset speichern“ klicken).
  - Einen neuen Load anlegen, Dialog öffnen, Regelset übernehmen, „Speichern“. Prüfen, dass `packRules` gleich ist.
  - Einen Load mit `packOrder: 'count'` ohne `packRules` anlegen. Prüfen, dass der Dialog „Stückzahl zuerst“ und „Große zuerst“ zeigt.
  - Die Screenshots ansehen. Nur Aufnahmen, auf denen die geprüften Cases zu sehen sind, zählen als Beleg.
- [ ] **Step 2: README.md** – den Absatz „Automatisch gepackt wird sortenrein …“ neu fassen:
  - Neben „Alles neu packen“ öffnet „Pack-Regeln …“ die Rangliste.
  - Beispiele für Regeln.
  - Gruppe je Stück im Wizard („Gruppe auf alle übernehmen“) und im Inspector.
  - Regelsets.
  - Vorgabe für alte Loads.
  - Die Liste „Große zuerst / Stückzahl zuerst“ wird zu den beiden Maßregeln.
- [ ] **Step 3: docs/architektur.md:**
  - Kopf „Stand V 0.8.5“.
  - Im Abschnitt „Zwei Datenebenen“ das Stück-Feld `group` ergänzen, mit dem Hinweis, dass es wie `tipped` in `toPiece`, `placementToUnplaced`, `duplicate`, `placeCase` und `autoPack` mitwandert.
  - Im Absatz „Sortenrein“:
    - Blöcke = `caseId` + `group`.
    - `plan.packRules` und `rulesFor`/`legacyRules` in `js/model/packRules.js`.
    - Komparator und Schlusskriterien.
    - Store `ruleSets` (DB-Version 2) im Abschnitt „Speicherung und Austausch“ nennen.
  - `js/model/packRules.js` in die Schichtenübersicht aufnehmen, falls dort Module einzeln stehen.
- [ ] **Step 4: docs/offene-punkte.md** – neuen Abschnitt „Aus den Pack-Regeln (2026-09-30) offen“ anlegen:
  - **Teil B „Mischen erlaubt“** (schwer nach unten, leicht und klein nach oben, Stapel mit unterschiedlichen Grundflächen), vom Nutzer gewünscht, eigene Spec.
  - Keine automatische Motor-Erkennung. Motoren spricht man über Gruppe oder Case-Typ an.
  - Regeln auf Gruppen- oder Case-Namen verweisen per Wert. Nach dem Umbenennen einer Gruppe greift die Regel nicht mehr (Anzeige „nicht in diesem Load“).
  - Regelsets überschreiben sich beim Speichern unter demselben Namen ohne Rückfrage (eigene Entscheidung).
- [ ] **Step 5: CHANGELOG.md** – Eintrag in Nutzersprache für die neue Version (Nummer nach Rückfrage, s. Step 6).
- [ ] **Step 6: Version.** Beim Nutzer die Nummer **0.8.5** vorschlagen und bestätigen lassen. Danach an allen Stellen setzen: `js/version.js`, `package.json`, `README.md`, `index.html`, Cache-Name `sw.js` = `truckload-v0.8.5`, oberster CHANGELOG-Eintrag. `npm test` muss grün sein (`version.test.js`).
- [ ] **Step 7: Commit, Push, Pages.**
  - `git commit -m "docs+chore: Pack-Regeln dokumentiert, Version 0.8.5"`, danach `git push origin main`.
  - Falls kein Pages-Build startet: `gh api -X POST repos/m4dm0nky/Truckload/pages/builds`.
  - Warten, bis `https://m4dm0nky.github.io/Truckload/js/version.js` die Nummer 0.8.5 zeigt.
