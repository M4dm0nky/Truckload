import test from 'node:test';
import assert from 'node:assert/strict';
import { allPlansOf, piecesOf, usage, truckUsage, deriveOf, ctxOf, bestandOf, printSectionsOf, plaeneMitGeaendertemBestand, createBestandsSync, activeLkwOf, activeViewOf, applyEdit, applyEditWhole, NO_LKW, hasUnassigned, mergeUnassignedView, packAllOf, repointTruck, distributionNotices, wholeCtxOf, planZumSpeichern, wizardTruckId, brauchtAuswahl } from '../js/app/core.js';
import { P, mkCase, mkTruck, byId } from './fixtures.js';
import { DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';
import { createStore } from '../js/store/state.js';
import { lkwView, convertToMulti, addLkw } from '../js/model/lkw.js';
import * as A from '../js/model/actions.js';

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
  assert.deepEqual(Object.keys(c).sort(), ['ausProjekt', 'caseById', 'newId', 'truck']);
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
  const noStamp = x => { const { updatedAt: _u, ...r } = x; return r; }; // Zeitstempel kann um 1 ms abweichen
  assert.deepEqual(noStamp(packAllOf(single, ctx)), noStamp(A.packAll(single, ctx)));
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

test('Entf im Reiter „Ohne LKW“: Platzierung mit unbekanntem LKW ist dort eine Ablage-Zeile und lässt sich entfernen', () => {
  const p = twoLkw();
  const alt = { ...p, placements: [{ id: 'alt', caseId: 'li', x: 0, y: 0, z: 0, rot: 0, orientation: 'standing', lkw: 'gelöscht' }] };
  const s = mkState(alt, { activeLkw: NO_LKW });
  const view = activeViewOf(alt, NO_LKW);
  assert.equal(view.placements.some(x => x.id === 'alt'), false, 'in der Ansicht keine Platzierung');
  const isPlaced = view.placements.some(x => x.id === 'alt');
  const n = applyEdit(s, pl => (isPlaced ? A.removePlacement(pl, 'alt') : A.removeUnplaced(pl, 'alt')), () => 'x');
  assert.notEqual(n, s);
  assert.ok(![...n.plan.placements, ...n.plan.unplaced].some(x => x.id === 'alt'));
});

const fremderPlan = (extra = {}) => ({
  id: 'fp', name: 'Fremd', truckId: 'tf', placements: [P('a', 'cf', 0, 0, 0)], unplaced: [], notes: '',
  mitgefuehrt: { version: 1, cases: [mkCase('cf', 50, 50, 50)], trucks: [mkTruck({ id: 'tf', name: 'Fremd-LKW', l: 700 })] },
  ...extra,
});

test('ctxOf: fehlendes Fahrzeug kommt aus der Kopie, nicht vom Standardfahrzeug', () => {
  const s = { plan: fremderPlan(), cases: [], trucks: [mkTruck({ id: DEFAULT_TRUCK_ID })], activeLkw: null };
  const c = ctxOf(s, () => 'n');
  assert.equal(c.truck.id, 'tf');
  assert.ok(c.caseById.has('cf'));
  assert.ok(c.ausProjekt.cases.has('cf'));
});

test('ctxOf: ohne Kopie fällt ein unbekanntes Fahrzeug wie bisher aufs Standardfahrzeug', () => {
  const { mitgefuehrt, ...ohne } = fremderPlan();
  const s = { plan: ohne, cases: [], trucks: [mkTruck({ id: DEFAULT_TRUCK_ID })], activeLkw: null };
  assert.equal(ctxOf(s, () => 'n').truck.id, DEFAULT_TRUCK_ID);
});

test('deriveOf: Prüfung kennt das Case aus der Kopie, bestand und ausProjekt liegen bei', () => {
  const s = { plan: fremderPlan(), cases: [], trucks: [mkTruck({ id: DEFAULT_TRUCK_ID })], activeLkw: null };
  const d = deriveOf(s, () => 'n');
  assert.equal(d.result.items.length, 1);
  assert.ok(d.bestand.cases.some(c => c.id === 'cf'));
  assert.ok(d.ausProjekt.trucks.has('tf'));
});

test('bestandOf: auf dem eigenen Rechner dieselben Arrays wie die Bibliothek', () => {
  const cases = [mkCase('cf', 50, 50, 50)], trucks = [mkTruck({ id: 'tf' })];
  const b = bestandOf({ plan: fremderPlan(), cases, trucks });
  assert.equal(b.cases, cases);
  assert.equal(b.trucks, trucks);
});

test('printSectionsOf: LKW-Fahrzeug aus der Kopie', () => {
  const p = fremderPlan({ lkws: [{ id: 'l1', name: 'A', truckId: 'tf', categories: [] }] });
  p.placements = [P('a', 'cf', 0, 0, 0, { lkw: 'l1' })];
  const out = printSectionsOf({ plan: p, cases: [], trucks: [mkTruck({ id: DEFAULT_TRUCK_ID })] });
  assert.equal(out.sections[0].truck.id, 'tf');
});

test('applyEdit im Reiter „Ohne LKW“ behält mitgefuehrt', () => {
  const p = fremderPlan({ lkws: [{ id: 'l1', name: 'A', truckId: 'tf', categories: [] }],
    placements: [], unplaced: [{ id: 'u', caseId: 'cf' }] });
  const s = { plan: p, cases: [], trucks: [mkTruck({ id: DEFAULT_TRUCK_ID })], activeLkw: NO_LKW };
  const next = applyEdit(s, view => ({ ...view, notes: 'x' }), () => 'n');
  assert.deepEqual(next.plan.mitgefuehrt, p.mitgefuehrt);
});


test('planZumSpeichern: füllt mitgefuehrt aus der Bibliothek', () => {
  const s = { cases: [mkCase('c1', 1, 1, 1, { collectionId: 'meine' })], trucks: [mkTruck({ id: 't' })] };
  const p = { id: 'p', name: 'P', truckId: 't', placements: [], unplaced: [{ id: 'u', caseId: 'c1' }], notes: '' };
  const out = planZumSpeichern(s, p);
  assert.deepEqual(out.mitgefuehrt.cases.map(c => c.id), ['c1']);
  assert.equal(out.updatedAt, p.updatedAt); // kein neuer Zeitstempel
});

test('planZumSpeichern: ein nicht offener Plan behält seine eigene Kopie als Quelle', () => {
  const s = { cases: [], trucks: [mkTruck({ id: DEFAULT_TRUCK_ID })], plan: null };
  const out = planZumSpeichern(s, fremderPlan());
  assert.deepEqual(out.mitgefuehrt.cases.map(c => c.id), ['cf']);
  assert.deepEqual(out.mitgefuehrt.trucks.map(t => t.id), ['tf']);
});

{
  const st = (cases, trucks, plan, plans = []) => ({ cases, trucks, plan, plans });
  const pl = (id, caseId, truckId = 't') => ({ id, name: id, truckId, placements: [], unplaced: [{ id: `u-${id}`, caseId }], notes: '' });

  test('plaeneMitGeaendertemBestand: unveränderte Listen → keine Pläne', () => {
    const cases = [mkCase('c1', 1, 1, 1)], trucks = [mkTruck({ id: 't' })];
    assert.deepEqual(plaeneMitGeaendertemBestand(st(cases, trucks, pl('a', 'c1')), st(cases, trucks, pl('a', 'c1'))), []);
  });
  test('plaeneMitGeaendertemBestand: geändertes Case trifft offenen und gespeicherten Plan, nicht den unbeteiligten', () => {
    const c1 = mkCase('c1', 1, 1, 1), c2 = mkCase('c2', 1, 1, 1), trucks = [mkTruck({ id: 't' })];
    const a = pl('a', 'c1'), b = pl('b', 'c1'), x = pl('x', 'c2');
    const prev = st([c1, c2], trucks, a, [b, x]);
    const next = st([{ ...c1, weight: 7 }, c2], trucks, a, [b, x]);
    assert.deepEqual(plaeneMitGeaendertemBestand(prev, next).map(p => p.id).sort(), ['a', 'b']);
  });
  test('plaeneMitGeaendertemBestand: geändertes Fahrzeug, auch über lkws', () => {
    const cases = [mkCase('c1', 1, 1, 1)], t = mkTruck({ id: 't' }), t2 = mkTruck({ id: 't2' });
    const multi = { ...pl('m', 'c1'), lkws: [{ id: 'l1', name: 'A', truckId: 't2', categories: [] }] };
    const prev = st(cases, [t, t2], null, [multi, pl('o', 'c1')]);
    const next = st(cases, [t, { ...t2, payload: 1 }], null, [multi, pl('o', 'c1')]);
    assert.deepEqual(plaeneMitGeaendertemBestand(prev, next).map(p => p.id), ['m']);
  });
  test('plaeneMitGeaendertemBestand: entferntes Case zählt als Änderung', () => {
    const c1 = mkCase('c1', 1, 1, 1), trucks = [mkTruck({ id: 't' })];
    assert.deepEqual(plaeneMitGeaendertemBestand(st([c1], trucks, pl('a', 'c1')), st([], trucks, pl('a', 'c1'))).map(p => p.id), ['a']);
  });
}

{
  const pl = (id, caseId) => ({ id, name: id, truckId: 't', placements: [], unplaced: [{ id: `u-${id}`, caseId }], notes: '' });
  const mkSync = (initial) => {
    const saved = [], dirty = [];
    const sync = createBestandsSync({ initial, autosave: { markDirty: p => dirty.push(p.id) }, savePlan: p => { saved.push(p.id); return Promise.resolve(); }, onError() {} });
    return { sync, saved, dirty };
  };
  const base = () => { const c1 = mkCase('c1', 1, 1, 1), t = [mkTruck({ id: 't' })]; return { c1, t, s0: { cases: [c1], trucks: t, plan: pl('a', 'c1'), plans: [pl('b', 'c1'), pl('w', 'c1')] } }; };

  test('createBestandsSync: Änderung außerhalb eines Imports speichert betroffene Pläne', () => {
    const { c1, s0 } = base(); const { sync, saved, dirty } = mkSync(s0);
    sync.change({ ...s0, cases: [{ ...c1, weight: 5 }] });
    assert.deepEqual(saved.sort(), ['b', 'w']); assert.deepEqual(dirty, ['a']);
  });
  test('createBestandsSync: während des Imports nichts, nach Rollback nichts', () => {
    const { c1, s0 } = base(); const { sync, saved, dirty } = mkSync(s0);
    sync.halte();
    const s1 = { ...s0, cases: [{ ...c1, weight: 5 }] };
    sync.change(s1); sync.change(s0);
    sync.ende(s0, { erfolg: false });
    assert.deepEqual([saved, dirty], [[], []]);
    sync.change({ ...s0, plans: [...s0.plans] }); // später kein Phantom-Unterschied
    assert.deepEqual(saved, []);
  });
  test('createBestandsSync: nach Erfolg nur betroffene Nicht-Gewinner; offener Plan über markDirty', () => {
    const { c1, s0 } = base(); const { sync, saved, dirty } = mkSync(s0);
    sync.halte();
    const s1 = { ...s0, cases: [{ ...c1, weight: 5 }] };
    sync.change(s1);
    assert.deepEqual(saved, []);
    sync.ende(s1, { erfolg: true, gewinnerIds: ['w'] });
    assert.deepEqual(saved, ['b']); assert.deepEqual(dirty, ['a']);
    sync.change(s1); assert.deepEqual(saved, ['b']); // vorher nachgezogen
  });
}

test('wizardTruckId: Bibliotheksfahrzeug bleibt, Kopie aus der Projektdatei fällt aufs Standardfahrzeug', () => {
  assert.equal(wizardTruckId([{ id: 'a' }, { id: 'b' }], 'b'), 'b');
  assert.equal(wizardTruckId([{ id: 'a' }], 'nur-kopie'), DEFAULT_TRUCK_ID);
});

test('brauchtAuswahl: Fahrzeug übernehmen läuft auch ohne gewähltes Stück', () => {
  assert.equal(brauchtAuswahl('uebernehmen-truck'), false);
  assert.equal(brauchtAuswahl('uebernehmen-case'), true);
  assert.equal(brauchtAuswahl('rotate'), true);
});
