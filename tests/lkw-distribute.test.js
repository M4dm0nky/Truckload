import test from 'node:test';
import assert from 'node:assert/strict';
import { distributeLkws, packAllLkws, unassignedByCategory } from '../js/model/lkw-distribute.js';
import { lkwView } from '../js/model/lkw.js';
import { packAll } from '../js/model/actions.js';
import { mkCase, mkTruck, plan, P, byId } from './fixtures.js';

const noStamp = p => { const { updatedAt, ...rest } = p; return rest; };
const allIds = p => [...p.placements, ...p.unplaced].map(x => x.id).sort();
const lkwOfId = (p, id) => [...p.placements, ...p.unplaced].find(x => x.id === id)?.lkw;
const assignment = p => Object.fromEntries([...p.placements, ...p.unplaced].map(x => [x.id, x.lkw ?? null]));

const BIG = mkTruck({ id: 'big', l: 1360, w: 248, h: 270, payload: 24000 });
const SMALL = mkTruck({ id: 'small', l: 100, w: 100, h: 100, payload: 24000 });
const mkCtx = (cases, trucks) => ({ caseById: byId(...cases), truck: trucks[0], truckById: new Map(trucks.map(t => [t.id, t])), newId: () => 'x' });
const multiPlan = (lkws, unplaced, placements = [], extra = {}) => ({
  ...plan(placements, unplaced), truckId: lkws[0].truckId, lkws, ...extra,
});
const L = (id, truckId, categories = []) => ({ id, name: id, truckId, categories });
const U = (id, caseId) => ({ id, caseId });
const cat = (id, category, l = 60, w = 60, h = 60, extra = {}) => mkCase(id, l, w, h, { category, ...extra });

test('zwei Gewerke auf zwei LKW: genau nach Haken zugeteilt', () => {
  const cases = [cat('li', 'Licht'), cat('to', 'Ton')];
  const p = multiPlan([L('A', 'big', ['Licht']), L('B', 'big', ['Ton'])],
    [U('p1', 'li'), U('p2', 'to'), U('p3', 'li'), U('p4', 'to'), U('p5', 'to')]);
  const d = distributeLkws(p, mkCtx(cases, [BIG]));
  assert.deepEqual(assignment(d), { p1: 'A', p2: 'B', p3: 'A', p4: 'B', p5: 'B' });
  assert.deepEqual(d.placements, [], 'nach der Verteilung liegt alles in der Ablage');
});

test('ein Gewerk auf zwei LKW: gleichmäßig nach Volumen absteigend, Gleichstand -> früherer LKW', () => {
  const cases = [cat('big', 'Licht', 100, 100, 100), cat('sm', 'Licht', 50, 50, 50)];
  const p = multiPlan([L('A', 'big', ['Licht']), L('B', 'big', ['Licht'])],
    [U('s1', 'sm'), U('b1', 'big'), U('s2', 'sm'), U('b2', 'big')]);
  const d = distributeLkws(p, mkCtx(cases, [BIG]));
  // Reihenfolge der Zuteilung: b1, b2, s1, s2 -> b1:A (Gleichstand), b2:B, s1:A (Gleichstand), s2:B
  assert.deepEqual(assignment(d), { s1: 'A', b1: 'A', s2: 'B', b2: 'B' });
});

test('Rest-LKW nimmt Gewerke, die kein LKW angehakt hat', () => {
  const cases = [cat('li', 'Licht'), cat('st', 'Strom')];
  const p = multiPlan([L('A', 'big', ['Licht']), L('R', 'big', [])], [U('p1', 'li'), U('p2', 'st'), U('p3', 'st')]);
  const d = distributeLkws(p, mkCtx(cases, [BIG]));
  assert.deepEqual(assignment(d), { p1: 'A', p2: 'R', p3: 'R' });
});

test('ohne Rest-LKW bleibt ein nicht angehaktes Gewerk nicht zugeordnet; unassignedByCategory zählt es', () => {
  const cases = [cat('li', 'Licht'), cat('st', 'Strom'), cat('ba', 'Backline')];
  const p = multiPlan([L('A', 'big', ['Licht'])], [U('p1', 'li'), U('p2', 'st'), U('p3', 'st'), U('p4', 'ba')]);
  const ctx = mkCtx(cases, [BIG]);
  const d = distributeLkws(p, ctx);
  assert.deepEqual(assignment(d), { p1: 'A', p2: null, p3: null, p4: null });
  assert.ok(allIds(d).length === 4);
  assert.deepEqual(unassignedByCategory(d, ctx.caseById), [{ category: 'Strom', count: 2 }, { category: 'Backline', count: 1 }]);
  assert.deepEqual(unassignedByCategory(plan([]), ctx.caseById), []);
  const packed = packAllLkws(p, ctx);
  assert.deepEqual(unassignedByCategory(packed, ctx.caseById), [{ category: 'Strom', count: 2 }, { category: 'Backline', count: 1 }]);
});

test('Überlauf eines LKW geht an den zweiten zulässigen LKW', () => {
  // Fläche 60x60 = 0,36 in SMALL (100x100), 0,09 im langen Wagen WIDE (400x100).
  const WIDE = mkTruck({ id: 'wide', l: 400, w: 100, h: 100, payload: 24000 });
  const cases = [cat('c', 'Licht', 60, 60, 100, { stackable: false })];
  const p = multiPlan([L('A', 'small', ['Licht']), L('B', 'wide', ['Licht'])],
    ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => U(id, 'c')));
  const ctx = mkCtx(cases, [SMALL, WIDE]);
  assert.deepEqual(assignment(distributeLkws(p, ctx)), { p1: 'A', p2: 'B', p3: 'B', p4: 'B', p5: 'A' });
  const r = packAllLkws(p, ctx);
  assert.equal(r.unplaced.length, 0, 'alles verladen');
  assert.equal(r.placements.filter(x => x.lkw === 'A').length, 1);
  assert.equal(r.placements.filter(x => x.lkw === 'B').length, 4);
  assert.deepEqual(allIds(r), ['p1', 'p2', 'p3', 'p4', 'p5']);
});

test('was auch beim zweiten LKW nicht passt, bleibt in der Ablage seines ersten LKW', () => {
  const cases = [cat('c', 'Licht', 100, 100, 100, { stackable: false })];
  const p = multiPlan([L('A', 'small', ['Licht']), L('B', 'small', ['Licht'])], ['p1', 'p2', 'p3'].map(id => U(id, 'c')));
  const r = packAllLkws(p, mkCtx(cases, [SMALL]));
  assert.deepEqual(r.placements.map(x => [x.id, x.lkw]).sort(), [['p1', 'A'], ['p2', 'B']]);
  assert.deepEqual(r.unplaced.map(x => [x.id, x.lkw]), [['p3', 'A']]);
});

test('Gewicht 0 zählt 0 (unbekannt), Gewicht gegen Nutzlast', () => {
  const T = mkTruck({ id: 'tk', l: 1360, w: 248, h: 270, payload: 1000 });
  const cases = [cat('heavy', 'Licht', 20, 20, 20, { weight: 800 }), cat('zero', 'Licht', 10, 10, 10, { weight: 0 })];
  const p = multiPlan([L('A', 'tk', ['Licht']), L('B', 'tk', ['Licht'])], [U('z1', 'zero'), U('h1', 'heavy'), U('z2', 'zero')]);
  const d = distributeLkws(p, mkCtx(cases, [T]));
  // h1 (größeres Volumen) zuerst -> A; Auslastung A 0,8 -> beide Gewicht-0-Stücke zu B
  assert.deepEqual(assignment(d), { z1: 'B', h1: 'A', z2: 'B' });
  // Nur Gewicht 0 überall: nur die Fläche zählt, keine NaN-Auslastung -> abwechselnd
  const q = multiPlan([L('A', 'tk', ['Licht']), L('B', 'tk', ['Licht'])], [U('a', 'zero'), U('b', 'zero'), U('c', 'zero')]);
  assert.deepEqual(assignment(distributeLkws(q, mkCtx(cases, [T]))), { a: 'A', b: 'B', c: 'A' });
});

test('Stück ohne passende Orientierung: geht an den Rest-LKW mit passendem Fahrzeug, sonst nicht zugeordnet', () => {
  const cases = [cat('long', 'Licht', 150, 50, 50), cat('ok', 'Licht', 50, 50, 50), cat('huge', 'Licht', 5000, 50, 50)];
  const p = multiPlan([L('A', 'small', ['Licht']), L('R', 'big', [])], [U('p1', 'long'), U('p2', 'ok'), U('p3', 'huge')]);
  const d = distributeLkws(p, mkCtx(cases, [SMALL, BIG]));
  assert.deepEqual(assignment(d), { p1: 'R', p2: 'A', p3: null });
  // Ohne Rest-LKW: nicht zuordenbar
  const q = multiPlan([L('A', 'small', ['Licht'])], [U('p1', 'long'), U('p2', 'ok')]);
  assert.deepEqual(assignment(distributeLkws(q, mkCtx(cases, [SMALL]))), { p1: null, p2: 'A' });
});

test('Platzierungen werden mit verteilt; Summe und IDs bleiben; deterministisch; plan.truckId am ersten LKW', () => {
  const cases = [cat('li', 'Licht'), cat('to', 'Ton')];
  const p = multiPlan([L('A', 'big', ['Licht']), L('B', 'small', ['Ton'])],
    [U('u1', 'li'), U('u2', 'to')], [P('p1', 'li', 0, 0, 0, { lkw: 'B' }), P('p2', 'to', 100, 0, 0)]);
  const ctx = mkCtx(cases, [BIG, SMALL]);
  const r1 = packAllLkws(p, ctx), r2 = packAllLkws(p, ctx);
  assert.deepEqual(noStamp(r1), noStamp(r2));
  assert.deepEqual(allIds(r1), ['p1', 'p2', 'u1', 'u2']);
  assert.equal(lkwOfId(r1, 'p1'), 'A');
  assert.equal(lkwOfId(r1, 'p2'), 'B');
  assert.equal(r1.truckId, 'big');
  assert.deepEqual(r1.lkws, p.lkws);
  assert.ok(r1.updatedAt);
});

test('Pack-Regeln des Plans gelten je LKW', () => {
  const T = mkTruck({ id: 'narrow', l: 300, w: 60, h: 100, payload: 24000 });
  const cases = [cat('a', 'Licht', 60, 60, 60), cat('b', 'Licht', 60, 60, 60)];
  const mk = pos => multiPlan([L('A', 'narrow', ['Licht'])], [U('pa', 'a'), U('pb', 'b')],
    [], { packRules: [{ by: 'case', pos, value: 'a' }] });
  const ctx = mkCtx(cases, [T]);
  const first = packAllLkws(mk('first'), ctx), last = packAllLkws(mk('last'), ctx);
  const x = (r, id) => r.placements.find(q => q.id === id).x;
  assert.ok(x(first, 'pa') < x(first, 'pb'));
  assert.ok(x(last, 'pa') > x(last, 'pb'));
});

test('Ein-LKW-Plan: packAllLkws ist exakt packAll', () => {
  const cases = [cat('a', 'Licht'), cat('b', 'Ton', 80, 50, 70)];
  const p = plan([P('p1', 'a', 0, 0, 0)], [U('u1', 'b'), U('u2', 'a'), U('u3', 'b')]);
  const ctx = mkCtx(cases, [BIG]);
  const a = packAllLkws(p, ctx), b = packAll(p, ctx);
  assert.deepEqual(noStamp(a), noStamp(b));
  assert.equal('lkws' in a, false);
  // Ansicht eines Mehr-LKW-Plans ist selbst ein Ein-LKW-Plan
  const m = multiPlan([L('A', 'big', [])], [U('u1', 'a')]);
  assert.equal('lkws' in lkwView(m, 'A'), false);
});
