import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPack, buildStacks } from '../js/model/packer.js';
import { planRows } from '../js/model/rowPlanner.js';
import { freeFloorArea, floorGaps } from '../js/model/rows.js';
import { validatePlan } from '../js/model/validate.js';
import { boxOf, overlaps } from '../js/model/geometry.js';
import { mkCase, mkTruck, SPRINTER, plan, byId } from './fixtures.js';

const TRUCK = mkTruck({ l: 1360, w: 245 });
const mkItem = (c, id) => ({ id, caseId: c.id, c });
const many = (c, n, pre) => Array.from({ length: n }, (_, i) => mkItem(c, `${pre ?? c.id}${i + 1}`));
const boxesOf = (placements, cs) => {
  const m = byId(...cs);
  return placements.map(p => ({ id: p.id, caseId: p.caseId, ...boxOf(m.get(p.caseId), p) }));
};
const run = (items, cs, truck, opts = {}) => {
  const { placements, unplaced } = autoPack(items, truck, opts);
  return { placements, unplaced, boxes: boxesOf(placements, cs) };
};
// Licht: 4 × 100 breit (vorn, größer), 2 × 40 breit; stehend, nicht stapelbar → je Stück ein Stapel.
const A = mkCase('a', 100, 100, 80, { wheels: false, category: 'Licht', stackable: false });
const B = mkCase('b', 100, 40, 80, { wheels: false, category: 'Licht', stackable: false });
const T = mkCase('t', 100, 40, 80, { wheels: false, category: 'Ton', stackable: false });

test('rowPlan füllt 100er-Reihe mit 40er-Stapel desselben Gewerks', () => {
  const items = [...many(A, 4), ...many(B, 2)];
  const off = run(items, [A, B], TRUCK);
  const on = run(items, [A, B], TRUCK, { rowPlan: true });
  assert.equal(on.unplaced.length, 0);
  assert.deepEqual(floorGaps(on.boxes, TRUCK, { minSize: 40 }), [], 'keine Reihe mit Rest ≥ 40');
  const fOff = freeFloorArea(off.boxes, TRUCK), fOn = freeFloorArea(on.boxes, TRUCK);
  assert.ok(fOn < fOff, `an ${fOn} < aus ${fOff}`);
  assert.equal(fOn, 5 * 100, 'je Reihe 5 cm Rest, nur die erste zählt (die zweite ist die letzte)');
});

test('rowPlan holt nichts aus fremdem Gewerk', () => {
  const items = [...many(A, 4), ...many(T, 2)];
  const on = run(items, [A, T], TRUCK, { rowPlan: true });
  const licht = on.boxes.filter(b => b.caseId === 'a'), ton = on.boxes.filter(b => b.caseId === 't');
  assert.equal(ton.length, 2);
  for (const t of ton) for (const l of licht) assert.ok(t.x0 >= l.x1 - 1e-6 || t.x1 <= l.x0 + 1e-6, 'Ton steht nie in einer Licht-Reihe');
  assert.ok(floorGaps(on.boxes, TRUCK, { minSize: 40 }).length >= 1, 'Restbreite bleibt');
});

test('rowPlan: Traversenwagen nie als Füllstück und zuletzt', () => {
  const TR = mkCase('tr', 100, 40, 80, { wheels: false, category: 'Licht', stackable: false, kind: 'truss', truss: { length: 100, width: 40, count: 1, standing: true, height: 80 } });
  const items = [...many(A, 4), ...many(TR, 2)];
  const on = run(items, [A, TR], TRUCK, { rowPlan: true });
  const licht = on.boxes.filter(b => b.caseId === 'a'), truss = on.boxes.filter(b => b.caseId === 'tr');
  assert.equal(truss.length, 2);
  const lastLicht = Math.max(...licht.map(b => b.x1));
  for (const t of truss) {
    assert.ok(t.x0 >= lastLicht - 1e-6, 'zuletzt');
    for (const l of licht) assert.ok(t.x0 >= l.x1 - 1e-6 || t.x1 <= l.x0 + 1e-6, 'nie in einer Licht-Reihe');
  }
});

test('rowPlan: schwerere Stapel einer Sorte weiter vorn', () => {
  const mk = (id, w) => ({ key: '120x100', dx: 120, dy: 100, height: 80, weight: w, ownWeight: w, sort: 0, block: [], items: [{ it: { id }, c: A, o: {}, z: 0 }] });
  const stacks = [mk('s1', 50), mk('s2', 90), mk('s3', 10), mk('s4', 70)];
  const { placed } = planRows(stacks, TRUCK, []);
  const byX = [...placed].sort((a, b) => a.box.x0 - b.box.x0 || a.box.y0 - b.box.y0).map(p => p.stack.ownWeight);
  assert.deepEqual(byX, [90, 70, 50, 10]);
});

test('rowPlan: Rest einpacken – nichts vor startX', () => {
  const items = [...many(A, 4), ...many(B, 2)];
  const on = run(items, [A, B], TRUCK, { rowPlan: true, startX: 300 });
  assert.equal(on.unplaced.length, 0);
  assert.ok(on.boxes.every(b => b.x0 >= 300 - 1e-6), 'nichts vor startX');
  assert.deepEqual(floorGaps(on.boxes, TRUCK, { minSize: 40 }), []);
});

test('rowPlan: Transporter mit Radkästen – alle Stapel platziert oder in failed, keine Überlappung', () => {
  const cs = [A, B, mkCase('c', 80, 60, 60, { category: 'Licht', stackable: false })];
  const items = [...many(A, 6), ...many(B, 5), ...many(cs[2], 7)];
  const { stacks } = buildStacks(items, SPRINTER);
  const obstacles = [{ x0: 0, y0: 0, z0: 0, x1: 50, y1: 60, z1: 40 }];
  const { placed, failed } = planRows(stacks, SPRINTER, obstacles);
  assert.equal(placed.length + failed.length, stacks.length);
  const boxes = placed.map(p => p.box);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlaps(boxes[i], boxes[j]), `${i}/${j}`);
  for (const b of boxes) { assert.ok(!overlaps(b, obstacles[0])); assert.ok(b.x1 <= SPRINTER.l + 1e-6 && b.y1 <= SPRINTER.w + 1e-6); }
  const r = run(items, cs, SPRINTER, { rowPlan: true });
  const pl = plan(r.placements);
  const bad = validatePlan(pl, byId(...cs), SPRINTER).issues.filter(i => ['collision', 'outOfBounds', 'arch'].includes(i.code));
  assert.deepEqual(bad, []);
  assert.equal(r.placements.length + r.unplaced.length, items.length);
});

test('rowPlan: 300 Stücke < 1000 ms (Median aus 3 Läufen)', () => {
  const cs = Array.from({ length: 12 }, (_, i) => mkCase(`p${i}`, 40 + (i * 13) % 90, 30 + (i * 17) % 80, 40 + (i * 7) % 50,
    { category: ['Licht', 'Ton'][i % 2], stackable: false, tippable: i % 4 === 0, weight: 20 + i * 9 }));
  const items = Array.from({ length: 300 }, (_, i) => mkItem(cs[i % cs.length], `u${i}`));
  const times = [];
  for (let k = 0; k < 3; k++) {
    const t0 = performance.now();
    const r = autoPack(items, TRUCK, { rowPlan: true });
    times.push(performance.now() - t0);
    assert.equal(r.placements.length + r.unplaced.length, 300);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[1] < 1000, `Median ${times[1].toFixed(0)} ms`);
});
