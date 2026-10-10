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

// ---- Mehrere LKW (Spec 2026-10-10) ----------------------------------------------------------
import { createStore } from '../js/store/state.js';
import { activeLkwOf, activeViewOf, applyEdit, applyEditWhole, NO_LKW, hasUnassigned, mergeUnassignedView,
  packAllOf, repointTruck, distributionNotices, wholeCtxOf } from '../js/app/core.js';
import { lkwView, convertToMulti, addLkw } from '../js/model/lkw.js';
import * as A from '../js/model/actions.js';
import { mkCase, mkTruck, byId } from './fixtures.js';

const TRK = mkTruck({ id: DEFAULT_TRUCK_ID, l: 1360, w: 248, h: 270, payload: 24000 });
const TRK2 = mkTruck({ id: 'klein', l: 400, w: 200, h: 200, payload: 1000 });
const cases = [mkCase('li', 60, 60, 60, { category: 'Licht' }), mkCase('to', 60, 60, 60, { category: 'Ton' })];
const mkState = (plan, extra = {}) => ({ plan, plans: [], cases, trucks: [TRK, TRK2], selectedId: null, activeLkw: null, ...extra });
const twoLkw = () => {
  let n = 0; const nid = () => `id${++n}`;
  let p = { id: 'P', name: 'P', truckId: DEFAULT_TRUCK_ID, placements: [], unplaced: [] };
  p = A.addUnplaced(p, 'li', 2, nid);
  p = A.addUnplaced(p, 'to', 1, nid);
  p = addLkw(p, { name: 'Licht-LKW', truckId: DEFAULT_TRUCK_ID, categories: ['Licht'] }, nid);
  p = addLkw(p, { name: 'Ton-LKW', truckId: 'klein', categories: ['Ton'] }, nid);
  return p; // LKW 1 (Rest) hält alle Stücke
};

test('activeLkwOf: Ein-LKW-Plan -> null, egal was gewählt war', () => {
  assert.equal(activeLkwOf(mk('a'), 'irgendwas'), null);
  assert.equal(activeLkwOf(null, null), null);
});
test('activeLkwOf: gültige ID bleibt, veraltete/fehlende fällt auf den ersten LKW', () => {
  const p = twoLkw();
  const [a, , c] = p.lkws.map(l => l.id);
  assert.equal(activeLkwOf(p, c), c);
  assert.equal(activeLkwOf(p, 'gelöscht'), a);
  assert.equal(activeLkwOf(p, null), a);
  assert.equal(activeLkwOf(p, undefined), a);
});
test('activeLkwOf: „Ohne LKW“ nur solange es nicht zugeordnete Stücke gibt', () => {
  const p = twoLkw();
  assert.equal(hasUnassigned(p), false);
  assert.equal(activeLkwOf(p, NO_LKW), p.lkws[0].id);
  const free = { ...p, unplaced: p.unplaced.map((u, i) => (i === 0 ? { id: u.id, caseId: u.caseId } : u)) };
  assert.equal(hasUnassigned(free), true);
  assert.equal(activeLkwOf(free, NO_LKW), NO_LKW);
});
test('activeViewOf: Ein-LKW-Plan = der Plan selbst; Mehr-LKW = Ansicht des Reiters', () => {
  const single = mk('a');
  assert.equal(activeViewOf(single, null), single);
  const p = twoLkw();
  const v = activeViewOf(p, p.lkws[1].id);
  assert.equal(v.lkws, undefined);
  assert.equal(v.truckId, DEFAULT_TRUCK_ID);
  assert.equal(v.unplaced.length, 0);
  assert.equal(activeViewOf(p, p.lkws[0].id).unplaced.length, 3);
});

test('ctxOf: Ein-LKW-Plan liefert exakt die bisherigen Schlüssel (kein truckById)', () => {
  const c = ctxOf(mkState(mk('a', { truckId: 'klein' })), () => 'x');
  assert.deepEqual(Object.keys(c).sort(), ['caseById', 'newId', 'truck']);
  assert.equal(c.truck.id, 'klein');
});
test('ctxOf: Mehr-LKW-Plan nimmt das Fahrzeug des gewählten LKW, dazu truckById', () => {
  const p = twoLkw();
  const c = ctxOf(mkState(p, { activeLkw: p.lkws[2].id }), () => 'x');
  assert.equal(c.truck.id, 'klein');
  assert.equal(c.truckById.get('klein').id, 'klein');
  // veralteter Reiter: erster LKW
  assert.equal(ctxOf(mkState(p, { activeLkw: 'weg' }), () => 'x').truck.id, DEFAULT_TRUCK_ID);
  assert.equal(wholeCtxOf(mkState(p, { activeLkw: p.lkws[2].id }), () => 'x').truck.id, DEFAULT_TRUCK_ID);
});

test('deriveOf: Ein-LKW-Plan validiert den Plan selbst (view === plan)', () => {
  const plan = mk('a', { truckId: DEFAULT_TRUCK_ID });
  const d = deriveOf(mkState(plan), () => 'x');
  assert.equal(d.view, plan);
  assert.equal(d.activeLkw, null);
});
test('deriveOf: Mehr-LKW-Plan validiert die Ansicht des gewählten LKW mit dessen Fahrzeug', () => {
  const p = twoLkw();
  const nid = () => 'x';
  const d1 = deriveOf(mkState(p, { activeLkw: p.lkws[0].id }), nid);
  assert.equal(d1.view.placements.length + d1.view.unplaced.length, 3);
  const d2 = deriveOf(mkState(p, { activeLkw: p.lkws[2].id }), nid);
  assert.equal(d2.truck.id, 'klein');
  assert.equal(d2.result.totals.payload, 1000);
  assert.equal(d2.activeLkw, p.lkws[2].id);
  // Auswahlwechsel allein rechnet nichts neu
  const s = mkState(p, { activeLkw: p.lkws[2].id });
  const d3 = deriveOf(s, nid);
  assert.equal(deriveOf({ ...s, selectedId: 'q' }, nid), d3);
});

test('applyEdit Ein-LKW-Plan: wie bisher fn(plan, ctx), No-Op liefert denselben Zustand', () => {
  const s = mkState(mk('a', { truckId: DEFAULT_TRUCK_ID }));
  assert.equal(applyEdit(s, p => p, () => 'x'), s);
  const n = applyEdit(s, p => ({ ...p, name: 'neu' }), () => 'x');
  assert.equal(n.plan.name, 'neu');
});
test('applyEdit Mehr-LKW: fn sieht die Ansicht des Reiters, Ergebnis wird zurückgemergt', () => {
  const p = twoLkw();
  const a = p.lkws[0].id;
  const s = mkState(p, { activeLkw: a });
  let seen;
  const n = applyEdit(s, (view, c) => { seen = { view, truck: c.truck.id }; return A.packRest(view, c); }, () => 'x');
  assert.equal(seen.view.lkws, undefined);
  assert.equal(seen.view.unplaced.length, 3);
  assert.equal(n.plan.lkws, p.lkws);
  assert.ok(n.plan.placements.length > 0);
  assert.ok(n.plan.placements.every(x => x.lkw === a));
});
test('applyEdit Mehr-LKW im anderen LKW: Stücke der übrigen bleiben unberührt', () => {
  const p = twoLkw();
  const s = mkState(p, { activeLkw: p.lkws[1].id });
  const n = applyEdit(s, (view, c) => A.packRest(view, c), () => 'x');
  assert.equal(n, s, 'leere Ansicht: nichts zu tun');
  const s2 = mkState(p, { activeLkw: p.lkws[0].id });
  const n2 = applyEdit(s2, (v, c) => A.packRest(v, c), () => 'x');
  assert.deepEqual(n2.plan.unplaced.filter(u => u.lkw !== p.lkws[0].id), []);
});
test('applyEdit mit Store: Mehr-LKW-Bearbeitung = genau ein Rückgängig-Schritt', () => {
  const p = twoLkw();
  const store = createStore(mkState(p, { activeLkw: p.lkws[0].id }));
  store.update(s => applyEdit(s, (v, c) => A.packRest(v, c), () => 'x'), { history: true });
  assert.ok(store.get().plan.placements.length > 0);
  assert.equal(store.canUndo(), true);
  store.undo();
  assert.equal(store.get().plan, p);
  assert.equal(store.canUndo(), false);
});
test('applyEdit auf „Ohne LKW“: Ablage der nicht zugeordneten Stücke bearbeiten, LKW bleiben', () => {
  const p0 = twoLkw();
  const p = { ...p0, unplaced: [...p0.unplaced, { id: 'frei', caseId: 'li' }] };
  const s = mkState(p, { activeLkw: NO_LKW });
  const n = applyEdit(s, pl => A.setItemLabel(pl, 'frei', { label: 'X' }), () => 'x');
  const frei = n.plan.unplaced.find(u => u.id === 'frei');
  assert.equal(frei.label, 'X');
  assert.equal(frei.lkw, undefined);
  assert.equal(n.plan.unplaced.length, p.unplaced.length);
  assert.equal(n.plan.lkws, p.lkws);
  assert.equal(n.plan.unplaced.filter(u => u.lkw).length, 3);
});
test('mergeUnassignedView: Platzierungen ohne gültigen LKW werden zu Ablage-Einträgen', () => {
  const p = twoLkw();
  const alt = { ...p, placements: [{ id: 'alt', caseId: 'li', x: 0, y: 0, z: 0, rot: 0, orientation: 'standing' }] };
  const view = activeViewOf(alt, NO_LKW);
  assert.deepEqual(view.unplaced.map(u => u.id), ['alt']);
  const m = mergeUnassignedView(alt, view);
  assert.deepEqual(m.placements, []);
  assert.ok(m.unplaced.some(u => u.id === 'alt'));
});
test('applyEditWhole: fn bekommt den ganzen Plan', () => {
  const p = twoLkw();
  const n = applyEditWhole(mkState(p, { activeLkw: p.lkws[1].id }), pl => ({ ...pl, name: 'g' }), () => 'x');
  assert.equal(n.plan.name, 'g');
  assert.equal(n.plan.lkws, p.lkws);
  assert.equal(applyEditWhole(mkState(p), pl => pl, () => 'x').plan, p);
});

test('packAllOf: Ein-LKW-Plan = packAll; Mehr-LKW verteilt nach Gewerken', () => {
  const single = A.addUnplaced({ id: 'S', name: 'S', truckId: DEFAULT_TRUCK_ID, placements: [], unplaced: [] }, 'li', 2, (() => { let i = 0; return () => `s${++i}`; })());
  const ctx = { caseById: byId(...cases), truck: TRK, newId: () => 'n' };
  assert.deepEqual(packAllOf(single, ctx), A.packAll(single, ctx));
  const p = twoLkw();
  const m = packAllOf(p, { ...ctx, truckById: new Map([[TRK.id, TRK], ['klein', TRK2]]) });
  const lkwOf = id => [...m.placements, ...m.unplaced].find(x => x.id === id).lkw;
  const [rest, licht, ton] = p.lkws.map(l => l.id);
  assert.equal(lkwOf('id1'), licht);
  assert.equal(lkwOf('id3'), ton);
  assert.ok(rest);
});

test('repointTruck: Ein-LKW-Plan', () => {
  const p = mk('a', { truckId: 'weg' });
  assert.equal(repointTruck(p, 'weg').truckId, DEFAULT_TRUCK_ID);
  const q = mk('b', { truckId: 'da' });
  assert.equal(repointTruck(q, 'weg'), q);
});
test('repointTruck: Mehr-LKW-Plan biegt betroffene LKW um und hält plan.truckId am ersten LKW', () => {
  const p = twoLkw();
  const r = repointTruck(p, 'klein');
  assert.equal(r.lkws[2].truckId, DEFAULT_TRUCK_ID);
  assert.equal(r.lkws[0].truckId, DEFAULT_TRUCK_ID);
  const first = { ...p, lkws: p.lkws.map((l, i) => (i === 0 ? { ...l, truckId: 'klein' } : l)), truckId: 'klein' };
  const r2 = repointTruck(first, 'klein');
  assert.equal(r2.truckId, DEFAULT_TRUCK_ID);
  assert.ok(r2.lkws.every(l => l.truckId === DEFAULT_TRUCK_ID));
  assert.equal(repointTruck(p, 'unbekannt'), p);
});
test('truckUsage zählt auch Fahrzeuge der LKW', () => {
  const p = twoLkw();
  assert.equal(truckUsage({ plan: p, plans: [mk('x', { truckId: 'klein' })] }, 'klein'), 2);
});

test('distributionNotices: Stücke ohne LKW je Gewerk, unbekannter Case, Rest in der Ablage', () => {
  const p = twoLkw();
  const free = { ...p, unplaced: [
    { id: 'u1', caseId: 'li' }, { id: 'u2', caseId: 'li' }, { id: 'u3', caseId: 'to' }, { id: 'u4', caseId: 'weg' },
    { id: 'u5', caseId: 'li', lkw: p.lkws[0].id },
  ] };
  assert.deepEqual(distributionNotices(free, byId(...cases)), [
    '2 Stücke ohne LKW (Licht)', '1 Stück ohne LKW (Ton)', '1 Stück mit unbekanntem Case',
    '1 Stück passt nicht in den LKW und bleibt in „Noch nicht geladen“',
  ]);
  assert.deepEqual(distributionNotices(mk('a'), byId(...cases)), []);
});
test('Altschema: Plan ohne lkws und ohne activeLkw im Zustand verhält sich wie vorher', () => {
  const old = { id: 'old', name: 'Alt', truckId: DEFAULT_TRUCK_ID, placements: [], unplaced: [{ id: 'z', caseId: 'li' }] };
  const s = { plan: old, plans: [], cases, trucks: [TRK], selectedId: null };
  assert.equal(deriveOf(s, () => 'x').view, old);
  assert.equal(applyEdit(s, (p, c) => A.packAll(p, c), () => 'x').plan.placements.length, 1);
  assert.equal(lkwView(old, undefined), old);
  assert.equal(convertToMulti(old, () => 'L').lkws[0].id, 'L');
});

test('mergeUnassignedView: Platzierungen der Ansicht gehen in die Ablage statt verloren', () => {
  const p = twoLkw();
  const view = { ...activeViewOf({ ...p, unplaced: [...p.unplaced, { id: 'f', caseId: 'li' }] }, NO_LKW),
    placements: [{ id: 'pl', caseId: 'li', x: 0, y: 0, z: 0, rot: 0, orientation: 'standing' }] };
  const m = mergeUnassignedView(p, view);
  assert.deepEqual(m.placements.filter(x => x.id === 'pl'), []);
  const row = m.unplaced.find(u => u.id === 'pl');
  assert.ok(row);
  assert.equal(row.lkw, undefined);
  assert.ok(m.unplaced.some(u => u.id === 'f'));
});
