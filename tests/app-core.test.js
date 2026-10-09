import test from 'node:test';
import assert from 'node:assert/strict';
import { allPlansOf, piecesOf, usage, truckUsage, deriveOf, ctxOf } from '../js/app/core.js';
import { DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';

const mk = (id, extra = {}) => ({ id, name: id, truckId: 't1', placements: [], unplaced: [], ...extra });
const ids = ps => ps.map(p => p.id);

test('allPlansOf: aktueller Plan zuerst, dann die übrigen', () => {
  const s = { plan: mk('a'), plans: [mk('b'), mk('c')] };
  assert.deepEqual(ids(allPlansOf(s)), ['a', 'b', 'c']);
});
test('allPlansOf: ohne Dublette, wenn der aktuelle Plan auch in plans liegt', () => {
  const s = { plan: mk('a'), plans: [mk('a'), mk('b')] };
  assert.deepEqual(ids(allPlansOf(s)), ['a', 'b']);
});
test('allPlansOf: ohne aktuellen Plan nur die gespeicherten', () => {
  assert.deepEqual(ids(allPlansOf({ plan: null, plans: [mk('b')] })), ['b']);
  assert.deepEqual(allPlansOf({ plan: null, plans: [] }), []);
});
test('allPlansOf liefert ein frisches Array (Sortieren verändert s.plans nicht)', () => {
  const s = { plan: null, plans: [mk('b'), mk('a')] };
  allPlansOf(s).sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(ids(s.plans), ['b', 'a']);
});
test('piecesOf: platzierte, dann Ablage', () => {
  const plan = mk('a', { placements: [{ id: 1 }, { id: 2 }], unplaced: [{ id: 3 }] });
  assert.deepEqual(piecesOf(plan).map(x => x.id), [1, 2, 3]);
});
test('usage zählt Pläne mit dem Case, auch in der Ablage', () => {
  const s = {
    plan: mk('a', { placements: [{ caseId: 'k' }] }),
    plans: [mk('b', { unplaced: [{ caseId: 'k' }] }), mk('c', { placements: [{ caseId: 'x' }] })],
  };
  assert.equal(usage(s, 'k'), 2);
  assert.equal(usage(s, 'x'), 1);
  assert.equal(usage(s, 'nix'), 0);
});
test('usage ohne aktuellen Plan', () => {
  const s = { plan: null, plans: [mk('b', { placements: [{ caseId: 'k' }] })] };
  assert.equal(usage(s, 'k'), 1);
});
test('truckUsage über mehrere Pläne und ohne aktuellen Plan', () => {
  const s = { plan: mk('a', { truckId: 't1' }), plans: [mk('b', { truckId: 't2' }), mk('c', { truckId: 't1' })] };
  assert.equal(truckUsage(s, 't1'), 2);
  assert.equal(truckUsage(s, 't2'), 1);
  assert.equal(truckUsage({ ...s, plan: null }, 't1'), 1);
});
test('ctxOf fällt auf das Standardfahrzeug zurück', () => {
  const trucks = [{ id: DEFAULT_TRUCK_ID }, { id: 't1' }];
  const nid = () => 'x';
  const c = ctxOf({ plan: mk('a', { truckId: 'weg' }), cases: [{ id: 'k' }], trucks }, nid);
  assert.equal(c.truck.id, DEFAULT_TRUCK_ID);
  assert.equal(c.newId, nid);
  assert.equal(c.caseById.get('k').id, 'k');
});
test('deriveOf liefert bei gleichen Referenzen dasselbe Objekt', () => {
  const trucks = [{ id: DEFAULT_TRUCK_ID, l: 1000, w: 240, h: 240 }];
  const s = { plan: mk('a', { truckId: DEFAULT_TRUCK_ID }), cases: [], trucks, selectedId: null };
  const nid = () => 'x';
  const d1 = deriveOf(s, nid);
  assert.equal(deriveOf({ ...s, selectedId: 'q' }, nid), d1);
  assert.notEqual(deriveOf({ ...s, plan: { ...s.plan } }, nid), d1);
});
