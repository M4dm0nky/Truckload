import test from 'node:test';
import assert from 'node:assert/strict';
import { gruppenAus, planeLkws, nichtGeladen } from '../js/model/lkw-import.js';
import { MAX_LKW } from '../js/model/limits.js';
import { mkCase, mkTruck, plan, byId, counter } from './fixtures.js';

const noStamp = p => { const { updatedAt, ...rest } = p; return rest; };
// 240 x 120 x 200: Cases 120 x 60 x 100 ohne Stapeln -> genau 4 je LKW.
const TRUCK = mkTruck({ id: 'k', l: 240, w: 120, h: 200, payload: 24000 });
const mkCtx = (cases, newId = counter('L')) => ({ caseById: byId(...cases), truck: TRUCK, truckById: new Map([[TRUCK.id, TRUCK]]), newId });
const cat = (id, category, l = 120, w = 60, h = 100) => mkCase(id, l, w, h, { category, stackable: false });
const pieces = (caseId, n, prefix = caseId) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, caseId }));
const einst = (extra = {}) => ({ verhalten: 'neu', truckId: 'k', art: 'je-gewerk', getrennt: false, gewerke: {}, neu: [], ...extra });
const ids = p => [...p.placements, ...p.unplaced].map(x => x.id);
const perLkw = p => p.lkws.map(l => p.placements.filter(x => x.lkw === l.id).length);

test('gruppenAus: Licht mit Ton -> eine Gruppe [Ton, Licht] mit Tons Modus', () => {
  const e = einst({ gewerke: { Licht: { modus: 'mit', mit: 'Ton' }, Ton: { modus: 'n', n: 2 } } });
  assert.deepEqual(gruppenAus(['Licht', 'Ton'], e), [{ gewerke: ['Ton', 'Licht'], modus: 'n', n: 2 }]);
});

test('gruppenAus: Kreis Licht <-> Ton -> eine Gruppe, offen', () => {
  const e = einst({ gewerke: { Licht: { modus: 'mit', mit: 'Ton' }, Ton: { modus: 'mit', mit: 'Licht' } } });
  assert.deepEqual(gruppenAus(['Licht', 'Ton'], e), [{ gewerke: ['Licht', 'Ton'], modus: 'offen' }]);
});

test('gruppenAus: Kette A -> B -> C eine Gruppe; fehlender Eintrag und Ziel ausserhalb -> offen; Reihenfolge', () => {
  const e = einst({ gewerke: { Ton: { modus: 'mit', mit: 'Video' }, Licht: { modus: 'mit', mit: 'Ton' }, Strom: { modus: 'mit', mit: 'Bühne' } } });
  assert.deepEqual(gruppenAus(['Strom', 'Zeta', 'Licht', 'Ton', 'Video', 'Alpha'], e), [
    { gewerke: ['Video', 'Licht', 'Ton'], modus: 'offen' },
    { gewerke: ['Strom'], modus: 'offen' },
    { gewerke: ['Alpha'], modus: 'offen' },
    { gewerke: ['Zeta'], modus: 'offen' },
  ]);
});

test('offen: 10 Licht-Stuecke, 4 je LKW -> 3 LKW (4/4/2)', () => {
  const ctx = mkCtx([cat('li', 'Licht')]);
  const r = planeLkws(plan([], pieces('li', 10)), ctx, einst());
  assert.deepEqual(perLkw(r), [4, 4, 2]);
  assert.deepEqual(r.lkws.map(l => l.categories), [['Licht'], ['Licht'], ['Licht']]);
  assert.deepEqual(r.lkws.map(l => l.name), ['LKW 1', 'LKW 2', 'LKW 3']);
  assert.ok(r.lkws.every(l => l.truckId === 'k'));
  assert.equal(r.truckId, 'k');
  assert.deepEqual(nichtGeladen(r, ids(r)), []);
});

test('zwei Gewerke offen: je Gewerk eigene LKW, bestehende LKW werden verworfen', () => {
  const ctx = mkCtx([cat('li', 'Licht'), cat('to', 'Ton')]);
  const alt = { ...plan([], [...pieces('li', 5), ...pieces('to', 2)]), lkws: [{ id: 'alt', name: 'Alt', truckId: 'k', categories: [] }] };
  alt.unplaced = alt.unplaced.map(u => ({ ...u, lkw: 'alt' }));
  const r = planeLkws(alt, ctx, einst());
  assert.deepEqual(r.lkws.map(l => l.categories), [['Licht'], ['Licht'], ['Ton']]);
  assert.deepEqual(perLkw(r), [4, 1, 2]);
  assert.ok(!r.lkws.some(l => l.id === 'alt'));
});

test('feste Anzahl 1 fuer 10 Licht-Stuecke -> 1 LKW, 6 nicht geladen, ohne lkw-Feld', () => {
  const ctx = mkCtx([cat('li', 'Licht')]);
  const r = planeLkws(plan([], pieces('li', 10)), ctx, einst({ gewerke: { Licht: { modus: 'n', n: 1 } } }));
  assert.equal(r.lkws.length, 1);
  assert.deepEqual(r.lkws[0].categories, ['Licht']);
  const ng = nichtGeladen(r, ids(r));
  assert.equal(ng.length, 6);
  assert.ok(r.unplaced.every(u => u.lkw === undefined));
});

test('feste Anzahl 2 mit Gruppe Licht+Ton: beide Gewerke werden auf 2 LKW verteilt', () => {
  const ctx = mkCtx([cat('li', 'Licht'), cat('to', 'Ton')]);
  const e = einst({ gewerke: { Ton: { modus: 'n', n: 2 }, Licht: { modus: 'mit', mit: 'Ton' } } });
  const r = planeLkws(plan([], [...pieces('li', 4), ...pieces('to', 4)]), ctx, e);
  assert.equal(r.lkws.length, 2);
  assert.deepEqual(r.lkws.map(l => l.categories), [['Ton', 'Licht'], ['Ton', 'Licht']]);
  assert.deepEqual(nichtGeladen(r, ids(r)), []);
});

test('Kreis laedt alles, kein Haenger', { timeout: 2000 }, () => {
  const ctx = mkCtx([cat('li', 'Licht'), cat('to', 'Ton')]);
  const e = einst({ gewerke: { Licht: { modus: 'mit', mit: 'Ton' }, Ton: { modus: 'mit', mit: 'Licht' } } });
  const r = planeLkws(plan([], [...pieces('li', 5), ...pieces('to', 5)]), ctx, e);
  assert.deepEqual(nichtGeladen(r, ids(r)), []);
  assert.equal(r.placements.length, 10);
});

test('Case groesser als das Fahrzeug: kein LKW dafuer, steht in nichtGeladen', { timeout: 2000 }, () => {
  const ctx = mkCtx([cat('riese', 'Licht', 500, 500, 500)]);
  const r = planeLkws(plan([], pieces('riese', 2)), ctx, einst());
  assert.equal((r.lkws ?? []).length, 0);
  assert.deepEqual(nichtGeladen(r, ids(r)).map(x => x.id), ['riese1', 'riese2']);
  const gemischt = planeLkws(plan([], [...pieces('riese', 1), ...pieces('li', 1)]), mkCtx([cat('riese', 'Licht', 500, 500, 500), cat('li', 'Licht')]), einst());
  assert.equal(gemischt.lkws.length, 1);
  assert.deepEqual(nichtGeladen(gemischt, ids(gemischt)).map(x => x.id), ['riese1']);
});

test('MAX_LKW: 60 Stuecke, 4 je LKW, offen -> genau 12 LKW, 12 nicht geladen', () => {
  const ctx = mkCtx([cat('li', 'Licht')]);
  const r = planeLkws(plan([], pieces('li', 60)), ctx, einst());
  assert.equal(r.lkws.length, MAX_LKW);
  assert.equal(nichtGeladen(r, ids(r)).length, 12);
});

test('MAX_LKW gilt auch fuer feste Anzahl', () => {
  const ctx = mkCtx([cat('li', 'Licht')]);
  const r = planeLkws(plan([], pieces('li', 8)), ctx, einst({ gewerke: { Licht: { modus: 'n', n: 99 } } }));
  assert.equal(r.lkws.length, MAX_LKW);
});

test('Determinismus: zweimal mit frischem Zaehler-newId gleich', () => {
  const cases = [cat('li', 'Licht'), cat('to', 'Ton')];
  const p = plan([], [...pieces('li', 6), ...pieces('to', 3)]);
  const a = planeLkws(p, mkCtx(cases), einst());
  const b = planeLkws(p, mkCtx(cases), einst());
  assert.deepStrictEqual(noStamp(a), noStamp(b));
});

test('nichtGeladen: nur Stuecke aus ids, die in der Ablage liegen', () => {
  const p = plan([{ id: 'a', caseId: 'c', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 }], [{ id: 'b', caseId: 'c2' }, { id: 'z', caseId: 'c' }]);
  assert.deepEqual(nichtGeladen(p, ['a', 'b']), [{ id: 'b', caseId: 'c2' }]);
});

test('nichts passt, alter Plan mit LKW und Ladung: Einzel-LKW-Form, alles in der Ablage ohne lkw', () => {
  const cases = [cat('riese', 'Licht', 500, 500, 500)];
  const alt = {
    ...plan([{ id: 'r1', caseId: 'riese', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0, lkw: 'alt' }], [{ id: 'r2', caseId: 'riese', lkw: 'alt' }]),
    lkws: [{ id: 'alt', name: 'Alt', truckId: 'k', categories: [] }],
  };
  const r = planeLkws(alt, mkCtx(cases), einst());
  assert.equal(r.lkws, undefined);
  assert.deepEqual(r.placements, []);
  assert.equal(r.truckId, 'k');
  assert.deepEqual(r.unplaced.map(u => u.id).sort(), ['r1', 'r2']);
  assert.ok(r.unplaced.every(u => u.lkw === undefined));
  assert.deepEqual(nichtGeladen(r, ['r1', 'r2']).map(x => x.id).sort(), ['r1', 'r2']);
});

test('unbekanntes truckId: Rückfall auf ctx.truck, es wird trotzdem geplant', () => {
  const ctx = mkCtx([cat('li', 'Licht')]);
  const r = planeLkws(plan([], pieces('li', 5)), ctx, einst({ truckId: 'gibts-nicht' }));
  assert.deepEqual(perLkw(r), [4, 1]);
  assert.ok(r.lkws.every(l => l.truckId === 'k'));
});

test('feste Anzahl: MAX_LKW-Budget schon verbraucht -> Stücke bleiben in der Ablage', () => {
  const ctx = mkCtx([cat('li', 'Licht'), cat('to', 'Ton')]);
  const e = einst({ gewerke: { Licht: { modus: 'n', n: 99 }, Ton: { modus: 'n', n: 2 } } });
  const r = planeLkws(plan([], [...pieces('li', 8), ...pieces('to', 3)]), ctx, e);
  assert.equal(r.lkws.length, MAX_LKW);
  assert.deepEqual(r.lkws.map(l => l.categories[0]).filter(c => c === 'Ton'), []);
  assert.deepEqual(nichtGeladen(r, ids(r)).map(x => x.id).filter(i => i.startsWith('to')), ['to1', 'to2', 'to3']);
});
