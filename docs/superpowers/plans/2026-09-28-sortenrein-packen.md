# Sortenrein packen – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der automatische Packer lädt sortenrein, also Case-Typ für Case-Typ als Block von der Stirnwand zur Tür, in einer je Load umschaltbaren Reihenfolge.

**Architecture:** Der bestehende Packer (`buildStacks` → `placeStacks` → `autoPack` in `js/model/packer.js`) bleibt im Kern:
- `orderSorts` gruppiert die Stücke nach `caseId` und ordnet die Gruppen.
- `buildStacks` stapelt je Sorte. Die nächste Sorte darf nur den letzten offenen Stapel der vorigen auffüllen.
- `placeStacks` stellt Sorte für Sorte. Jede Sorte darf erst ab der letzten Reihe der vorigen beginnen (`minX`).
- Ein neues Plan-Feld `packOrder` wählt die Reihenfolge.

**Tech Stack:** Reine ES-Module, `node --test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-09-28-sortenrein-packen-design.md`

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt; Tests mit `npm test`.
- Oberfläche auf Deutsch, typografische Anführungszeichen „…“.
- Alte Daten müssen weiter laden: Plan ohne `packOrder` ⇒ `'volume'`; Regressionstest mit Plan im alten Schema.
- Nutzereingaben in HTML nur über `esc()` (hier keine neuen Nutzertexte).
- Keine neue Datei unter `js/`/`css/` (sonst `sw.js`-Liste ergänzen).
- `packOrder` ist genau `'volume'` („Große zuerst“: Einzelvolumen L×B×H absteigend, Traversen immer zuletzt) oder `'count'` („Stückzahl zuerst“: Anzahl absteigend, dann Volumen, dann Name).
- Version erst am Ende nach Rückfrage: 0.8.2 → 0.8.3 (CLAUDE.md).

## Review Focus

- **Stück ohne Lage 1**, dessen vorige Sorte keinen passenden offenen Stapel hat: Es landet in der Ablage und wird nicht auf irgendeinen fremden Stapel gesetzt. Test in Task 1.
- **„Rest einpacken“ bei vorhandener Ladung:** Neue Sorten schließen hinter der Ladung an (`startX` = größtes `x1`). Sie füllen keine Lücken weiter vorn; was hinten nicht passt, geht in die Ablage. Test in Task 3.
- **Plan aus älterer Version ohne `packOrder`** lädt, importiert und packt wie „Große zuerst“. Test in Task 3.
- **Radkästen (Sprinter):** Der sortenreine Packer erzeugt weiter keine Überschneidungen und verliert nichts. Der bestehende Test „Sprinter mit Radkästen“ bleibt grün. Task 2.
- **Gleiche Sorte, unterschiedlich getippt** (einzelne Stücke `tipped:false`): Sie bilden eigene Stapel (Schlüssel enthält die Grundfläche), bleiben aber in derselben Sorte. Test in Task 1.

---

### Task 1: Sorten ordnen und sortenrein stapeln

**Files:**
- Modify: `js/model/packer.js` (Imports, neue `PACK_ORDERS`, `orderSorts`, `buildStacks`)
- Test: `tests/packer.test.js`

**Interfaces:**
- Produces:
  - `export const PACK_ORDERS = ['volume', 'count']`
  - `export function orderSorts(itemList, mode = 'volume')` → `Array<Array<item>>` (Gruppen je `caseId`, geordnet)
  - `export function buildStacks(itemList, truck, { order = 'volume' } = {})` → `{ stacks, unplaced }`; jeder Stapel trägt zusätzlich `sort` (Index der Sorte, die ihn begonnen hat), Stapel stehen in Sorten-Reihenfolge im Array.

- [ ] **Step 1: Write the failing tests** (am Ende von `tests/packer.test.js` anhängen; Import-Zeile 3 um `orderSorts, PACK_ORDERS` ergänzen)

```js
// Sortenrein packen (Spec docs/superpowers/specs/2026-09-28-sortenrein-packen-design.md).
const sortsOf = groups => groups.map(g => g[0].caseId);

test('PACK_ORDERS: genau volume und count', () => {
  assert.deepEqual(PACK_ORDERS, ['volume', 'count']);
});

test('orderSorts volume: größtes Einzelvolumen zuerst, Traversen immer zuletzt', () => {
  const big = mkCase('big', 120, 60, 100);
  const small = mkCase('small', 60, 60, 60);
  const truss = mkCase('truss', 300, 62, 115, { kind: 'truss', truss: { length: 300, width: 62, count: 1, standing: true, height: 115 } });
  const list = [...items(small, 5, 's'), ...items(truss, 2, 't'), ...items(big, 1, 'b')];
  assert.deepEqual(sortsOf(orderSorts(list, 'volume')), ['big', 'small', 'truss']);
});

test('orderSorts count: meiste gleiche Stücke zuerst, Gleichstand nach Volumen', () => {
  const a = mkCase('a', 120, 60, 60);
  const b = mkCase('b', 120, 60, 100);
  const c = mkCase('c', 60, 60, 60);
  const list = [...items(a, 2, 'a'), ...items(b, 2, 'b'), ...items(c, 7, 'c')];
  assert.deepEqual(sortsOf(orderSorts(list, 'count')), ['c', 'b', 'a']);
});

test('buildStacks: Stapel mischen keine Sorten, außer dem letzten offenen Stapel der vorigen Sorte', () => {
  const heavy = mkCase('heavy', 120, 60, 60, { weight: 300 });
  const light = mkCase('light', 120, 60, 60, { weight: 30 });
  // 3 × heavy → Stapel [h,h,h] (4 Lagen erlaubt, Truck 270 hoch: 3×60 + 60 = 240 passt),
  // danach 3 × light: das erste light füllt den offenen heavy-Stapel auf, der Rest bildet eigene.
  const { stacks } = buildStacks([...items(light, 3, 'l'), ...items(heavy, 3, 'h')], mkTruck(), { order: 'count' });
  const ids = stacks.map(s => s.items.map(i => i.c.id));
  assert.deepEqual(ids[0], ['heavy', 'heavy', 'heavy', 'light']);
  assert.deepEqual(ids.slice(1), [['light', 'light']]);
  assert.deepEqual(stacks.map(s => s.sort), [0, 1]);
});

test('buildStacks: nur der LETZTE offene Stapel der vorigen Sorte wird aufgefüllt, nie ein früherer', () => {
  const a = mkCase('a', 120, 60, 60, { weight: 100, layers: [1, 2] });
  const b = mkCase('b', 120, 60, 60, { weight: 10 });
  // a: 3 Stück, höchstens 2 Lagen → Stapel [a,a] und [a]. b füllt nur den letzten ([a]) auf,
  // bis er voll ist (4 Lagen, 240 cm ≤ 270), nie den früheren [a,a] – der hat noch Platz für
  // Lage 3 und 4 und bleibt trotzdem sortenrein.
  const { stacks } = buildStacks([...items(a, 3, 'a'), ...items(b, 3, 'b')], mkTruck(), { order: 'count' });
  const ids = stacks.map(s => s.items.map(i => i.c.id));
  assert.deepEqual(ids, [['a', 'a'], ['a', 'b', 'b', 'b']]);
});

test('buildStacks: Stück ohne Lage 1 ohne passenden offenen Stapel der vorigen Sorte → Ablage, nie fremder Stapel', () => {
  const first = mkCase('first', 120, 60, 60, { weight: 50 });
  const mid = mkCase('mid', 80, 60, 60, { weight: 40 });
  const onlyTop = mkCase('onlyTop', 120, 60, 60, { weight: 10, layers: [2] });
  // count: first ×3, mid ×2, onlyTop ×1 → die unmittelbar vorige Sorte von onlyTop ist mid (andere
  // Grundfläche). Die passenden first-Stapel gehören nicht dazu → onlyTop geht in die Ablage.
  const { unplaced, stacks } = buildStacks([...items(first, 3, 'f'), ...items(mid, 2, 'm'), ...items(onlyTop, 1, 'o')], mkTruck(), { order: 'count' });
  assert.deepEqual(unplaced.map(u => u.caseId), ['onlyTop']);
  assert.ok(stacks.every(s => !s.items.some(i => i.c.id === 'onlyTop')));
});

test('buildStacks: gleiche Sorte mit unterschiedlichem tipped bleibt eine Sorte (gleiches sort)', () => {
  const t = mkCase('t', 120, 60, 100, { tippable: true });
  const list = [mkItem(t, 'a', { tipped: true }), mkItem(t, 'b', { tipped: false })];
  const { stacks } = buildStacks(list, mkTruck());
  assert.ok(stacks.length >= 1);
  assert.ok(stacks.every(s => s.sort === 0));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/packer.test.js`
Expected: FAIL (Import von `orderSorts`/`PACK_ORDERS` schlägt fehl).

- [ ] **Step 3: Implementation** in `js/model/packer.js`

Imports in Zeile 1 ergänzen und `isTruss` importieren:

```js
import { ROTATIONS, effectiveDims, overlaps, wheelFace, DOOR_FACE, pieceLayers, pieceOrientations, outerDims } from './geometry.js';
import { archBoxes } from './validate.js';
import { isTruss } from './truss.js';
```

Direkt vor `buildStacks` einfügen:

```js
// Sortenrein packen (Nutzerwunsch 2026-09-28, Spec docs/superpowers/specs/2026-09-28-sortenrein-
// packen-design.md): eine Sorte ist ein Case-Typ (caseId) und wird als Block geladen.
// 'volume' = „Große zuerst“ (Einzelvolumen absteigend, Traversen immer zuletzt),
// 'count' = „Stückzahl zuerst“ (Anzahl absteigend, dann Volumen, dann Name).
export const PACK_ORDERS = ['volume', 'count'];
const volumeOf = c => { const { l, w, h } = outerDims(c); return l * w * h; };

export function orderSorts(itemList, mode = 'volume') {
  const groups = new Map();
  for (const it of itemList) {
    if (!groups.has(it.caseId)) groups.set(it.caseId, []);
    groups.get(it.caseId).push(it);
  }
  const nameOf = g => String(g[0].c.name ?? g[0].caseId);
  const byVolume = (a, b) => volumeOf(b[0].c) - volumeOf(a[0].c);
  const byCount = (a, b) => b.length - a.length;
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), 'de');
  const trussLast = (a, b) => (isTruss(a[0].c) ? 1 : 0) - (isTruss(b[0].c) ? 1 : 0);
  return [...groups.values()].sort(mode === 'count'
    ? (a, b) => byCount(a, b) || byVolume(a, b) || byName(a, b)
    : (a, b) => trussLast(a, b) || byVolume(a, b) || byCount(a, b) || byName(a, b));
}
```

`buildStacks` vollständig ersetzen durch:

```js
// itemList: Stücke { id, caseId, c, label?, color?, layers?, tipped? } mit bereits aufgelöstem Case `c`.
// Stapel entstehen je Sorte (orderSorts). Einzige Ausnahme vom „nur Gleiches auf Gleichem“: die
// nächste Sorte darf zuerst den LETZTEN noch offenen Stapel der unmittelbar vorigen Sorte
// auffüllen (Nutzerregel „Letzter Stapel darf aufgefüllt werden“) – mit denselben Grenzen wie
// immer (gleiche Grundfläche, Lagen je Stück, höchstens 4 Lagen, nichts Schweres auf Leichtes,
// maxTopLoad). Jeder Stapel trägt `sort` = Index der Sorte, die ihn begonnen hat.
export function buildStacks(itemList, truck, { order = 'volume' } = {}) {
  const stacks = [], unplaced = [];
  const maxLayer = (it, c) => Math.max(...pieceLayers(it, c));
  const minLayer = (it, c) => Math.min(...pieceLayers(it, c));
  const fits = (s, it, c, o) => s.key === `${o.d.dx}x${o.d.dy}` && s.items.length < 4
    && pieceLayers(it, c).includes(s.items.length + 1) && canAddToStack(s, c, o.d.dz, truck);
  const push = (s, it, c, o) => {
    s.items.push({ it, c, o, z: s.height });
    s.height += o.d.dz;
    s.weight += c.weight;
  };
  let prevLast = null; // letzter Stapel, in dem die vorige Sorte zuletzt etwas abgelegt hat

  orderSorts(itemList, order).forEach((group, sort) => {
    const entries = group.map(it => ({ it, c: it.c, o: chooseOrientation(it.c, truck, it) }));
    for (const e of entries) if (!e.o) unplaced.push(e.it);
    const ready = entries.filter(e => e.o);
    const withFloor = ready.filter(e => pieceLayers(e.it, e.c).includes(1)).sort((a, b) =>
      maxLayer(a.it, a.c) - maxLayer(b.it, b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);
    const withoutFloor = ready.filter(e => !pieceLayers(e.it, e.c).includes(1)).sort((a, b) =>
      minLayer(a.it, a.c) - minLayer(b.it, b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);

    const own = [];
    let last = null;
    const addTo = (list, onMiss) => {
      for (const { it, c, o } of list) {
        const target = (prevLast && fits(prevLast, it, c, o) ? prevLast : null) ?? own.find(s => fits(s, it, c, o));
        if (target) { push(target, it, c, o); last = target; } else onMiss({ it, c, o });
      }
    };
    addTo(withFloor, ({ it, c, o }) => {
      const s = { key: `${o.d.dx}x${o.d.dy}`, dx: o.d.dx, dy: o.d.dy, height: o.d.dz, weight: c.weight, sort, items: [{ it, c, o, z: 0 }] };
      own.push(s);
      stacks.push(s);
      last = s;
    });
    addTo(withoutFloor, ({ it }) => unplaced.push(it));
    if (last) prevLast = last;
  });
  return { stacks, unplaced };
}
```

Hinweis zur Reihenfolge `prevLast ?? own`: Die Spec sagt „die nächste Sorte darf **zuerst** den letzten offenen Stapel der vorigen auffüllen“. Deshalb wird `prevLast` vor den eigenen Stapeln geprüft.

- [ ] **Step 4: Run tests**

Run: `node --test tests/packer.test.js`
Expected: alle neuen Tests PASS. Die bestehenden Tests „Case mit nur Lage 1 …“, „Case, das Lage 1 nicht erlaubt …“, „Case ohne Lage 1 findet einen später aufgebauten Basis-Stapel“, „Case mit nur Lage 3 …“ und „Schwer auf leicht …“ bleiben grün, denn bei gleichem Volumen und gleicher Stückzahl entscheidet der Name, und die zweite Sorte füllt den letzten Stapel der ersten. Schlägt einer fehl, die Ursache mit `superpowers:systematic-debugging` klären. Den Test nur dann anpassen, wenn er ausdrücklich sortenübergreifendes Stapeln verlangt, das die Spec verbietet, und das im Commit begründen.

- [ ] **Step 5: Commit**

```bash
git add js/model/packer.js tests/packer.test.js
git commit -m "feat: Packer stapelt sortenrein (orderSorts, PACK_ORDERS)"
```

---

### Task 2: Sortenrein platzieren (Block für Block, Lücke der letzten Reihe)

**Files:**
- Modify: `js/model/packer.js` (`placeStacks`, `autoPack`)
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `buildStacks(itemList, truck, { order })` mit `stack.sort` (Task 1)
- Produces:
  - `export function placeStacks(stacks, truck, obstacles = [], { startX = 0 } = {})` → `{ placed, failed }`
  - `export function autoPack(items, truck, { obstacles = [], order = 'volume', startX = 0 } = {})` → `{ placements, unplaced }`

- [ ] **Step 1: Write the failing tests** (anhängen; die drei zusätzlichen Imports gehören zu den übrigen Imports oben in der Datei)

```js
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { PRESET_TRUCKS } from '../js/data/preset-trucks.js';

// Beispiel-Load des Nutzers (2026-09-28): 10 × Mac Viper x2, 16 × MLT TWO 2,4 m, 30 × Packcase
// 120×60×60 im Sattelauflieger; Viper und Packcases wie aus dem Wizard (Lage 1+2, getippt).
const ALLC = new Map([...PRESET_CASES, ...CASE_LIBRARY].map(c => [c.id, c]));
const SATTEL = PRESET_TRUCKS.find(t => t.id === 'preset-sattel');
function exampleLoad() {
  const out = [];
  const add = (caseId, n, extra) => { for (let i = 0; i < n; i++) out.push({ id: `${caseId}#${i}`, caseId, c: ALLC.get(caseId), ...extra }); };
  add('lib-mac-viper-x2-cab', 10, { layers: [1, 2], tipped: true });
  add('preset-hof-mlt2-240', 16, {});
  add('preset-packcase-120x60x60', 30, { layers: [1, 2], tipped: true });
  return out;
}
// Je Säule (x,y) die caseIds von unten nach oben.
function columns(placements) {
  const cols = new Map();
  for (const p of [...placements].sort((a, b) => a.z - b.z)) {
    const k = `${p.x}|${p.y}`;
    if (!cols.has(k)) cols.set(k, []);
    cols.get(k).push(p);
  }
  return [...cols.values()];
}
function checkSortenrein(placements, sortOrder) {
  const rank = new Map(sortOrder.map((id, i) => [id, i]));
  // Stapel: unten eine Sorte, oben höchstens die direkt folgende.
  for (const col of columns(placements)) {
    const r = col.map(p => rank.get(p.caseId));
    for (let i = 1; i < r.length; i++) assert.ok(r[i] === r[i - 1] || r[i] === r[i - 1] + 1, `Stapel gemischt: ${col.map(p => p.caseId)}`);
    assert.ok(new Set(r).size <= 2);
  }
  // Blöcke: die Bodenstapel einer Sorte beginnen nie vor der letzten Reihe der vorigen.
  const floor = placements.filter(p => p.z === 0);
  for (let i = 1; i < sortOrder.length; i++) {
    const prev = floor.filter(p => p.caseId === sortOrder[i - 1]);
    const cur = floor.filter(p => p.caseId === sortOrder[i]);
    if (!prev.length || !cur.length) continue;
    assert.ok(Math.min(...cur.map(p => p.x)) >= Math.max(...prev.map(p => p.x)),
      `${sortOrder[i]} beginnt vor der letzten Reihe von ${sortOrder[i - 1]}`);
  }
}

test('Beispiel-Load, Große zuerst: Viper → Packcase → MLT, sortenrein, alles geladen, fehlerfrei', () => {
  const { placements, unplaced } = autoPack(exampleLoad(), SATTEL, { order: 'volume' });
  assert.deepEqual(unplaced, []);
  assert.equal(placements.length, 56);
  checkSortenrein(placements, ['lib-mac-viper-x2-cab', 'preset-packcase-120x60x60', 'preset-hof-mlt2-240']);
  assert.equal(placements.find(p => p.x === 0 && p.y === 0 && p.z === 0).caseId, 'lib-mac-viper-x2-cab');
  assert.deepEqual(placementIssues(validatePlan(plan(placements), ALLC, SATTEL)), []);
});

test('Beispiel-Load, Stückzahl zuerst: Packcase → MLT → Viper, sortenrein, alles geladen, fehlerfrei', () => {
  const { placements, unplaced } = autoPack(exampleLoad(), SATTEL, { order: 'count' });
  assert.deepEqual(unplaced, []);
  checkSortenrein(placements, ['preset-packcase-120x60x60', 'preset-hof-mlt2-240', 'lib-mac-viper-x2-cab']);
  assert.equal(placements.find(p => p.x === 0 && p.y === 0 && p.z === 0).caseId, 'preset-packcase-120x60x60');
  assert.deepEqual(placementIssues(validatePlan(plan(placements), ALLC, SATTEL)), []);
});

test('Lücke der letzten Reihe: die nächste Sorte füllt freie Spuren, steht aber nie davor', () => {
  // 5 Wagen à 62 cm (4 passen in eine Reihe) → Reihe 2 hat 1 Wagen und 3 freie Spuren.
  const wagon = mkCase('wagon', 240, 62, 115, { stackable: false });
  const box = mkCase('box', 60, 60, 60, { stackable: false });
  const list = [...items(wagon, 5, 'w'), ...items(box, 3, 'b')];
  const { placements } = autoPack(list, mkTruck(), { order: 'volume' });
  const lastRowX = Math.max(...placements.filter(p => p.caseId === 'wagon').map(p => p.x));
  const boxes = placements.filter(p => p.caseId === 'box');
  assert.equal(boxes.length, 3);
  assert.ok(boxes.every(p => p.x >= lastRowX), 'box nie vor der letzten Wagenreihe');
  assert.ok(boxes.some(p => p.x === lastRowX), 'box füllt die freie Spur der letzten Reihe');
});

test('placeStacks: startX schiebt die erste Sorte hinter eine vorhandene Ladung', () => {
  const K = mkCase('k', 120, 60, 60);
  const { placements } = autoPack([mkItem(K, 'k1')], mkTruck(), { startX: 300 });
  assert.equal(placements[0].x, 300);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/packer.test.js`
Expected: FAIL (Blöcke gemischt, `startX` wirkungslos).

- [ ] **Step 3: Implementation** – `placeStacks` und `autoPack` in `js/model/packer.js` ersetzen:

```js
// Stellt die Stapel Sorte für Sorte (stack.sort, Reihenfolge wie von buildStacks geliefert) per
// Bottom-Left in den Truck. Jede Sorte sucht nur Punkte mit x ≥ minX: für die erste Sorte ist das
// `startX` (0 bzw. hinter einer vorhandenen Ladung), für jede weitere das x0 der letzten Reihe der
// vorigen Sorte – so füllt sie deren freie Spuren (Nutzerregel „Lücke auffüllen“), kommt aber nie
// weiter nach vorn. Innerhalb einer Sorte stehen schwerere Stapel weiter vorn (wie bisher).
export function placeStacks(stacks, truck, obstacles = [], { startX = 0 } = {}) {
  const blocked = [...archBoxes(truck), ...obstacles];
  const points = [{ x: startX, y: 0 }, { x: 0, y: 0 }, ...blocked.flatMap(b => [
    { x: b.x1, y: b.y0 }, { x: b.x0, y: b.y1 }, { x: b.x1, y: 0 }, { x: 0, y: b.y1 },
  ])];
  const placed = [], failed = [];
  let minX = startX;
  const sorts = [...new Set(stacks.map(s => s.sort ?? 0))];
  for (const sort of sorts) {
    const group = stacks.filter(s => (s.sort ?? 0) === sort).sort((a, b) => b.weight - a.weight);
    const boxesHere = [];
    for (const s of group) {
      points.sort((p, q) => p.x - q.x || p.y - q.y);
      let hit = null;
      for (const pt of points) {
        if (pt.x < minX - 1e-6) continue;
        // swap dreht den Stapel im Grundriss um 90°, wenn er sonst nirgends passt.
        // Das gibt eine zuvor gewählte Rollenrichtung bewusst auf — Platz geht vor
        // Rollenrichtung, sonst wäre der Stapel gar nicht unterzubringen (siehe autoPack).
        for (const swap of s.dx === s.dy ? [false] : [false, true]) {
          const dx = swap ? s.dy : s.dx, dy = swap ? s.dx : s.dy;
          const box = { x0: pt.x, y0: pt.y, z0: 0, x1: pt.x + dx, y1: pt.y + dy, z1: s.height };
          if (box.x1 > truck.l + 1e-6 || box.y1 > truck.w + 1e-6) continue;
          if (blocked.some(b => overlaps(b, box))) continue;
          hit = { box, swap };
          break;
        }
        if (hit) break;
      }
      if (!hit) { failed.push(s); continue; }
      blocked.push(hit.box);
      boxesHere.push(hit.box);
      placed.push({ stack: s, ...hit });
      points.push({ x: hit.box.x1, y: hit.box.y0 }, { x: hit.box.x0, y: hit.box.y1 });
    }
    if (boxesHere.length) minX = Math.max(...boxesHere.map(b => b.x0));
  }
  return { placed, failed };
}

// items: Stücke { id, caseId, c, label?, color?, layers?, tipped? } mit bereits aufgelöstem Case `c`.
// Die erzeugten Placements übernehmen id/label/color/layers/tipped des Stücks statt eine neue ID zu vergeben.
// order: 'volume' | 'count' (PACK_ORDERS), startX: frühestes x der ersten Sorte (Rest einpacken).
export function autoPack(items, truck, { obstacles = [], order = 'volume', startX = 0 } = {}) {
  const { stacks, unplaced } = buildStacks(items, truck, { order });
  const { placed, failed } = placeStacks(stacks, truck, obstacles, { startX });
```

Der Rest von `autoPack` bleibt unverändert, ab `const placements = [];`.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS. Achtung bei „10 Kabelcases: 3 Stapel an der Stirnwand“, „Sprinter mit Radkästen“ und „Hindernisse werden umgangen“: Das ist eine einzige Sorte, das Verhalten ist also unverändert. Wenn etwas rot wird, die Ursache mit `superpowers:systematic-debugging` klären, bevor ein Test angefasst wird.

- [ ] **Step 5: Commit**

```bash
git add js/model/packer.js tests/packer.test.js
git commit -m "feat: Packer platziert Sorte für Sorte, Lücke der letzten Reihe, startX"
```

---

### Task 3: Plan-Feld `packOrder`, Aktionen, Import

**Files:**
- Modify: `js/model/actions.js` (`packAll`, `packRest`, neue `setPackOrder`; Import von `PACK_ORDERS`)
- Modify: `js/store/io.js` (`checkPlan`)
- Test: `tests/actions.test.js`, `tests/io.test.js`

**Interfaces:**
- Consumes: `autoPack(items, truck, { obstacles, order, startX })`, `PACK_ORDERS` (Task 1/2)
- Produces: `export function setPackOrder(plan, order)` → neuer Plan (unverändert bei ungültigem `order`)

- [ ] **Step 1: Write the failing tests**

In `tests/actions.test.js` anhängen:

```js
// Sortenrein packen: Reihenfolge je Load (plan.packOrder), Altdaten ohne Feld = 'volume'.
const BIG = mkCase('big', 120, 60, 100);
const SMALL = mkCase('small', 60, 60, 60);
const ctxBS = () => ({ caseById: byId(BIG, SMALL), truck: mkTruck(), newId: counter('n') });
const firstAtWall = pl => pl.placements.find(p => p.x === 0 && p.y === 0 && p.z === 0).caseId;
const unplacedMix = () => plan([], [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, caseId: 'small' })),
  { id: 'b0', caseId: 'big' },
]);

test('setPackOrder: nur volume/count, sonst unverändert', () => {
  const p0 = plan([]);
  assert.equal(A.setPackOrder(p0, 'count').packOrder, 'count');
  assert.equal(A.setPackOrder(p0, 'quatsch'), p0);
});

test('packAll: ohne packOrder (Altdaten) = Große zuerst', () => {
  assert.equal(firstAtWall(A.packAll(unplacedMix(), ctxBS())), 'big');
});

test('packAll: packOrder count = Stückzahl zuerst', () => {
  assert.equal(firstAtWall(A.packAll({ ...unplacedMix(), packOrder: 'count' }, ctxBS())), 'small');
});

test('packRest: neue Sorten schließen hinter der vorhandenen Ladung an, keine Lücke weiter vorn', () => {
  const pl0 = plan([P('a', 'big', 0, 0, 0)], [{ id: 's0', caseId: 'small' }]);
  const pl = A.packRest(pl0, ctxBS());
  const s = pl.placements.find(p => p.id === 's0');
  assert.ok(s.x >= 120, `small bei x=${s.x}, sollte hinter der Ladung (x ≥ 120) stehen`);
});
```

In `tests/io.test.js` anhängen:

```js
test('Import: Plan ohne packOrder (altes Schema) lädt unverändert', () => {
  const text = exportBundle({ cases: [], trucks: [], plans: [plan([])] });
  const b = parseBundle(text);
  assert.equal(b.plans[0].packOrder, undefined);
});

test('Import: packOrder volume/count erlaubt, anderer Wert wird abgewiesen', () => {
  for (const packOrder of ['volume', 'count']) {
    const b = parseBundle(exportBundle({ cases: [], trucks: [], plans: [{ ...plan([]), packOrder }] }));
    assert.equal(b.plans[0].packOrder, packOrder);
  }
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [{ ...plan([]), packOrder: 'x' }] })));
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test tests/actions.test.js tests/io.test.js`
Expected: FAIL (`A.setPackOrder` fehlt; `packRest` stellt small bei x = 0 in die freie Spur; `packOrder: 'x'` wird nicht abgewiesen).

- [ ] **Step 3: Implementation**

`js/model/actions.js`, Zeile 3:

```js
import { autoPack, PACK_ORDERS } from './packer.js';
```

`packAll` / `packRest` ersetzen und `setPackOrder` ergänzen:

```js
// Reihenfolge des sortenreinen Packens je Load (Nutzerwunsch 2026-09-28). Fehlt das Feld
// (Altdaten), packt autoPack mit seiner Vorgabe 'volume' („Große zuerst“).
export function setPackOrder(plan, order) {
  if (!PACK_ORDERS.includes(order) || plan.packOrder === order) return plan;
  return touch({ ...plan, packOrder: order });
}

export function packAll(plan, ctx) {
  const list = [...plan.placements, ...plan.unplaced].map(x => toPiece(x, ctx)).filter(Boolean);
  const { placements, unplaced } = autoPack(list, ctx.truck, { order: plan.packOrder });
  return touch({
    ...plan,
    placements,
    unplaced: [...unplaced, ...orphans(plan, ctx), ...missingCasePlacements(plan, ctx).map(placementToUnplaced)],
  });
}

// Rest einpacken: neue Sorten schließen sortenrein HINTER der vorhandenen Ladung an (startX = deren
// Tür-Kante) statt Lücken weiter vorn zu füllen – sonst stünde die Nachladung mitten in fremden
// Blöcken (eigene Entscheidung, Spec 2026-09-28).
export function packRest(plan, ctx) {
  const { items } = buildItems(plan, ctx.caseById);
  const list = plan.unplaced.map(u => toPiece(u, ctx)).filter(Boolean);
  const missing = missingCasePlacements(plan, ctx);
  if (!list.length && !missing.length) return plan;
  const startX = items.length ? Math.max(...items.map(it => it.box.x1)) : 0;
  const { placements, unplaced } = list.length
    ? autoPack(list, ctx.truck, { obstacles: items.map(it => it.box), order: plan.packOrder, startX })
    : { placements: [], unplaced: [] };
```

Der Rest von `packRest` bleibt, ab `return touch({`. `autoPack` bekommt `order: undefined`, wenn das Feld fehlt, und dann greift die Vorgabe `'volume'` aus dem Destructuring.

`js/store/io.js`: Import ergänzen (bei den anderen Model-Imports oben):

```js
import { PACK_ORDERS } from '../model/packer.js';
```

In `checkPlan` nach der `notes`-Prüfung:

```js
  if (p.packOrder !== undefined && !PACK_ORDERS.includes(p.packOrder))
    throw new Error(`Ladeplan „${p.name}“ hat eine unbekannte Pack-Reihenfolge.`);
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS. Falls ein bestehender `packRest`-Test erwartet, dass Lücken vor der Ladung gefüllt werden: Er widerspricht der Spec. Dann an die neue Regel anpassen und im Commit begründen.

- [ ] **Step 5: Commit**

```bash
git add js/model/actions.js js/store/io.js tests/actions.test.js tests/io.test.js
git commit -m "feat: packOrder je Load (Große zuerst/Stückzahl zuerst), Rest einpacken schließt hinten an"
```

---

### Task 4: Umschalter in der Oberfläche, Doku, Browser-Abnahme

**Files:**
- Modify: `index.html` (Gruppe mit `#pack-all`, Zeilen ~50–54)
- Modify: `js/app.js` (Handler bei `#pack-rest`, Render-Sync bei `#unload-all`)
- Modify: `README.md`, `docs/architektur.md`
- Test: Browser über `tools/cdp.mjs`

**Interfaces:**
- Consumes: `A.setPackOrder(plan, order)`, `plan.packOrder` (Task 3)

- [ ] **Step 1: Umschalter einbauen**

`index.html`, in der Gruppe nach `<button id="pack-rest">Rest einpacken</button>`:

```html
      <select id="pack-order" title="Reihenfolge beim automatischen Packen (sortenrein)">
        <option value="volume">Große zuerst</option>
        <option value="count">Stückzahl zuerst</option>
      </select>
```

`js/app.js`, direkt nach der Zeile `$('#pack-rest').onclick = …`:

```js
// Sortenreine Reihenfolge je Load; wirkt beim nächsten „Alles neu packen“/„Rest einpacken“.
$('#pack-order').onchange = e => edit(p => A.setPackOrder(p, e.target.value));
```

`js/app.js`, im Render-Hook direkt nach `$('#unload-all').disabled = …`:

```js
  $('#pack-order').value = s.plan.packOrder ?? 'volume';
```

- [ ] **Step 2: Doku**

`README.md`, nach dem Absatz „„Fertig“ legt den Load an und packt ihn …“ einfügen:

```markdown
Automatisch gepackt wird **sortenrein**: Jeder Case-Typ kommt als eigener Block von der Stirnwand
zur Tür. Die Reihenfolge wählt man je Load neben „Alles neu packen“:
- **Große zuerst** – nach Einzelvolumen, Traversen immer zuletzt (Vorgabe).
- **Stückzahl zuerst** – der Case-Typ mit den meisten gleichen Stücken zuerst.

Füllt eine Sorte ihre letzte Reihe nicht, darf die nächste die freien Spuren dieser Reihe
belegen und den letzten, nicht vollen Stapel auffüllen – weiter vorn wird nie gemischt.
„Rest einpacken“ hängt neue Sorten hinter die vorhandene Ladung.
```

`docs/architektur.md`, im Abschnitt „Lagen“, nach dem Satz über `chooseOrientation`, einen Absatz ergänzen:

```markdown
**Sortenrein (seit V 0.8.3):** `orderSorts(items, mode)` gruppiert nach `caseId` und ordnet nach
`plan.packOrder` (`'volume'`: Einzelvolumen absteigend, Traversen zuletzt; `'count'`: Stückzahl,
dann Volumen, dann Name; fehlt das Feld, gilt `'volume'`). `buildStacks` stapelt je Sorte; die
nächste Sorte darf nur den letzten offenen Stapel der vorigen auffüllen. `placeStacks` stellt
Sorte für Sorte, jede nur ab dem x0 der letzten Reihe der vorigen (`minX`), und `packRest`
beginnt hinter der vorhandenen Ladung (`startX`). Spec:
`docs/superpowers/specs/2026-09-28-sortenrein-packen-design.md`.
```

- [ ] **Step 3: Browser-Abnahme** (Server: `python3 -m http.server 8766`)

Ein Szenario im Scratchpad lädt `~/Downloads/truckload-backup-2026-09-28.json`, setzt `plans[0]` per `app.store.update` als aktuellen Plan und wählt dann nacheinander „Große zuerst“ und „Stückzahl zuerst“:

```js
document.getElementById('pack-order').value = 'count';
document.getElementById('pack-order').dispatchEvent(new Event('change'));
```

Danach packt es über `app.edit((p, c) => A.packAll(p, c))`. Für jede Reihenfolge macht es Screenshots von 2D und 3D und gibt `app.derive().result.issues.length` aus.
Expected: sortenreine Blöcke von vorn nach hinten, 0 Warnungen außer eventuellen Gewichts- oder Schwerpunktwarnungen, der Umschalter zeigt nach dem Neuladen des Plans die gespeicherte Wahl.

- [ ] **Step 4: Tests + Commit**

Run: `npm test` → PASS

```bash
git add index.html js/app.js README.md docs/architektur.md
git commit -m "feat: Umschalter Große zuerst/Stückzahl zuerst, Doku sortenrein packen"
```

- [ ] **Step 5: Abschluss** (`superpowers:finishing-a-development-branch`, CLAUDE.md)

Versionsnummer 0.8.3 vorschlagen und bestätigen lassen. Danach `js/version.js`, `package.json`, `README.md`, `index.html`, den Cache-Namen in `sw.js` und einen CHANGELOG-Eintrag anpassen, `npm test`, committen, `git push origin main --tags` und warten, bis Pages 0.8.3 zeigt.
