import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lkwsOf, isMultiLkw, lkwView, unassignedView, mergeLkwView,
  convertToMulti, addLkw, resolveLkwId, updateLkw, removeLkw, moveToLkw,
} from '../js/model/lkw.js';
import { MAX_LKW, NAME_MAX } from '../js/model/limits.js';
import { checkPlan } from '../js/store/io.js';
import { plan, P, counter } from './fixtures.js';

const noStamp = p => { const { updatedAt, ...rest } = p; return rest; };
const ids = p => [...p.placements, ...p.unplaced].map(x => x.id).sort();

// Mehr-LKW-Plan von Hand: zwei LKW, Stücke verteilt, ein Stück ohne Zuordnung.
const multi = () => ({
  ...plan(
    [P('p1', 'a', 0, 0, 0, { lkw: 'L1' }), P('p2', 'a', 50, 0, 0, { lkw: 'L2' }), P('p3', 'a', 100, 0, 0, { lkw: 'L1' })],
    [{ id: 'u1', caseId: 'a', lkw: 'L1' }, { id: 'u2', caseId: 'b', lkw: 'L2' }, { id: 'u3', caseId: 'b' }, { id: 'u4', caseId: 'b', lkw: 'GONE' }],
  ),
  truckId: 't1',
  lkws: [
    { id: 'L1', name: 'LKW 1', truckId: 't1', categories: [] },
    { id: 'L2', name: 'LKW 2', truckId: 't2', categories: ['Ton'] },
  ],
});

test('lkwsOf / isMultiLkw: Ein-LKW-Plan (auch mit leerer Liste) ist kein Mehr-LKW-Plan', () => {
  assert.deepEqual(lkwsOf(plan([])), []);
  assert.equal(isMultiLkw(plan([])), false);
  assert.equal(isMultiLkw({ ...plan([]), lkws: [] }), false);
  assert.equal(isMultiLkw(multi()), true);
  assert.equal(lkwsOf(multi()).length, 2);
});

test('lkwView: normaler Ein-LKW-Plan mit Fahrzeug des LKW, nur dessen Stücke, ohne lkws/lkw-Felder', () => {
  const v = lkwView(multi(), 'L2');
  assert.equal(v.truckId, 't2');
  assert.equal('lkws' in v, false);
  assert.deepEqual(v.placements.map(p => p.id), ['p2']);
  assert.deepEqual(v.unplaced.map(u => u.id), ['u2']);
  assert.ok(v.placements.concat(v.unplaced).every(x => !('lkw' in x)));
  assert.equal(v.id, 'plan');
});

test('unassignedView: Ablage-Stücke ohne gültigen lkw, Platzierungen ohne lkw wandern in die Ablage', () => {
  const p = multi();
  p.placements.push(P('p4', 'a', 0, 0, 0), P('p5', 'a', 0, 0, 0, { lkw: 'GONE' }));
  const v = unassignedView(p);
  assert.deepEqual(v.placements, []);
  assert.deepEqual(v.unplaced.map(u => u.id).sort(), ['p4', 'p5', 'u3', 'u4']);
  const p4 = v.unplaced.find(u => u.id === 'p4');
  assert.deepEqual(Object.keys(p4).sort(), ['caseId', 'id']);
  assert.ok(v.unplaced.every(u => !('lkw' in u)));
});

test('mergeLkwView mit der Identität lässt den Plan unverändert (Reihenfolge inklusive)', () => {
  const p = multi();
  for (const id of ['L1', 'L2']) {
    assert.deepEqual(noStamp(mergeLkwView(p, id, lkwView(p, id))), noStamp(p));
  }
});

test('mergeLkwView: setzt lkw an Stücken der Ansicht, fremde und nicht zugeordnete bleiben unberührt', () => {
  const p = multi();
  const v = lkwView(p, 'L1');
  // Aktion in der Ansicht: p1 in die Ablage, neues Stück, p3 weg.
  const edited = {
    ...v,
    placements: [],
    unplaced: [...v.unplaced, { id: 'p1', caseId: 'a' }, { id: 'new', caseId: 'a' }],
    notes: 'neu',
  };
  const m = mergeLkwView(p, 'L1', edited);
  assert.deepEqual(m.placements.map(x => x.id), ['p2']);
  const byId = Object.fromEntries(m.unplaced.map(x => [x.id, x.lkw]));
  assert.equal(byId.u1, 'L1'); assert.equal(byId.p1, 'L1'); assert.equal(byId.new, 'L1');
  assert.equal(byId.u2, 'L2'); assert.equal(byId.u3, undefined); assert.equal(byId.u4, 'GONE');
  assert.deepEqual(m.placements[0], p.placements[1]);
  assert.equal(m.notes, 'neu');
  assert.deepEqual(m.lkws, p.lkws);
  assert.equal(m.truckId, 't1');
  assert.ok(m.updatedAt);
});

test('mergeLkwView: Reihenfolge deterministisch – Plätze des LKW werden in Ansichts-Reihenfolge belegt, Überzählige hinten', () => {
  const p = multi();
  const v = lkwView(p, 'L1');
  const swapped = { ...v, placements: [...v.placements].reverse() };
  const m = mergeLkwView(p, 'L1', swapped);
  assert.deepEqual(m.placements.map(x => x.id), ['p3', 'p2', 'p1']);
  const more = { ...v, placements: [...v.placements, { id: 'p9', caseId: 'a', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 }] };
  assert.deepEqual(mergeLkwView(p, 'L1', more).placements.map(x => x.id), ['p1', 'p2', 'p3', 'p9']);
});

test('resolveLkwId: bekannte ID, sonst erster LKW, sonst null', () => {
  assert.equal(resolveLkwId(multi(), 'L2'), 'L2');
  assert.equal(resolveLkwId(multi(), 'nix'), 'L1');
  assert.equal(resolveLkwId(multi(), undefined), 'L1');
  assert.equal(resolveLkwId(plan([]), 'L1'), null);
});

test('veraltete LKW-ID (Reiter nach Rückgängig/Löschen): fällt auf den ersten LKW, nichts stürzt oder geht verloren', () => {
  const p = multi();
  assert.deepEqual(lkwView(p, 'nix'), lkwView(p, 'L1'));
  const v = lkwView(p, 'nix');
  const edited = { ...v, unplaced: [...v.unplaced, { id: 'neu', caseId: 'a' }] };
  const m = mergeLkwView(p, 'nix', edited);
  assert.equal(m.unplaced.find(u => u.id === 'neu').lkw, 'L1');
  assert.deepEqual(noStamp(mergeLkwView(p, 'nix', v)), noStamp(p));
  assert.equal(updateLkw(p, 'nix', { name: 'Z' }).lkws[0].name, 'Z');
  assert.equal(moveToLkw(p, 'p2', 'nix').unplaced.find(u => u.id === 'p2').lkw, 'L1');
  assert.deepEqual(removeLkw(p, 'nix').lkws.map(l => l.id), ['L2']);
  // Ein-LKW-Plan: Ansicht ist der Plan selbst, Zurückschreiben liefert die Ansicht.
  const single = plan([P('p1', 'a', 0, 0, 0)]);
  assert.equal(lkwView(single, 'x'), single);
  const edit = { ...single, notes: 'n' };
  assert.equal(mergeLkwView(single, 'x', edit), edit);
  assert.equal(updateLkw(single, 'x', { name: 'a' }), single);
  assert.equal(removeLkw(single, 'x'), single);
  assert.equal(moveToLkw(single, 'p1', 'x'), single);
});

test('convertToMulti: ein LKW „LKW 1“ mit dem bisherigen Fahrzeug, alle Stücke zugeordnet', () => {
  const p = plan([P('p1', 'a', 0, 0, 0)], [{ id: 'u1', caseId: 'a' }]);
  const m = convertToMulti(p, counter('L'));
  assert.deepEqual(m.lkws, [{ id: 'L1', name: 'LKW 1', truckId: 't', categories: [] }]);
  assert.equal(m.truckId, 't');
  assert.equal(m.placements[0].lkw, 'L1');
  assert.equal(m.unplaced[0].lkw, 'L1');
  assert.equal(convertToMulti(m, counter('Z')), m, 'schon Mehr-LKW: unverändert');
  // Ansicht des einzigen LKW entspricht dem Ausgangsplan.
  assert.deepEqual(noStamp(lkwView(m, 'L1')), noStamp(p));
});

test('addLkw: hängt an, bereinigt Eingaben, wandelt Ein-LKW-Pläne erst um, Grenze MAX_LKW', () => {
  const nid = counter('L');
  const p = plan([P('p1', 'a', 0, 0, 0)]);
  const m = addLkw(p, { name: '  Zweiter  ', truckId: 't2', categories: ['Ton', 'Ton', 'Unfug', 'Licht'] }, nid);
  assert.deepEqual(m.lkws.map(l => l.name), ['LKW 1', 'Zweiter']);
  assert.deepEqual(m.lkws[1].categories, ['Ton', 'Licht']);
  assert.equal(m.lkws[1].truckId, 't2');
  assert.equal(m.truckId, 't', 'plan.truckId bleibt am ersten LKW');
  assert.equal(addLkw(m, { name: 'x'.repeat(200), truckId: 't' }, nid).lkws[2].name.length, NAME_MAX);
  assert.equal(addLkw(m, { name: '', truckId: 't' }, nid).lkws[2].name, 'LKW 3');
  let q = m;
  while (q.lkws.length < MAX_LKW) q = addLkw(q, { name: 'n', truckId: 't' }, nid);
  assert.equal(addLkw(q, { name: 'n', truckId: 't' }, nid), q);
});

test('updateLkw: ändert Name/Fahrzeug/Gewerke, hält plan.truckId am ersten LKW', () => {
  const p = multi();
  const a = updateLkw(p, 'L1', { truckId: 'tX', name: 'Neu', categories: ['Strom', 'Quatsch'] });
  assert.equal(a.lkws[0].truckId, 'tX');
  assert.equal(a.lkws[0].name, 'Neu');
  assert.deepEqual(a.lkws[0].categories, ['Strom']);
  assert.equal(a.truckId, 'tX');
  const b = updateLkw(p, 'L2', { truckId: 'tY' });
  assert.equal(b.truckId, 't1');
  assert.equal(a.lkws[0].id, 'L1', 'id nicht änderbar');
  assert.equal(updateLkw(p, 'L1', { id: 'Z' }).lkws[0].id, 'L1');
});

test('removeLkw: Stücke werden nicht zugeordnet, Platzierungen wandern in die Ablage; plan.truckId folgt dem neuen ersten LKW', () => {
  const p = multi();
  const m = removeLkw(p, 'L1');
  assert.deepEqual(m.lkws.map(l => l.id), ['L2']);
  assert.equal(m.truckId, 't2');
  assert.deepEqual(m.placements.map(x => x.id), ['p2']);
  assert.deepEqual(ids(m), ids(p));
  const moved = m.unplaced.filter(u => ['p1', 'p3', 'u1'].includes(u.id));
  assert.equal(moved.length, 3);
  assert.ok(moved.every(u => !('lkw' in u)));
  assert.ok(m.unplaced.every(u => !('x' in u) && !('orientation' in u)));
});

test('removeLkw des letzten LKW: Ein-LKW-Plan ohne lkws, kein lkw-Feld, Fahrzeug bleibt', () => {
  const one = convertToMulti(plan([P('p1', 'a', 0, 0, 0)]), counter('L'));
  const m = removeLkw(one, 'L1');
  assert.equal('lkws' in m, false);
  assert.equal(m.truckId, 't');
  assert.equal(m.placements.length, 0);
  assert.deepEqual(m.unplaced.map(u => u.id), ['p1']);
  assert.ok(!('lkw' in m.unplaced[0]));
});

test('moveToLkw: Platzierung -> Ablage des Ziels, Ablage-Zeile -> Ziel, null = ohne LKW', () => {
  const p = multi();
  const a = moveToLkw(p, 'p1', 'L2');
  assert.equal(a.placements.some(x => x.id === 'p1'), false);
  assert.equal(a.unplaced.find(u => u.id === 'p1').lkw, 'L2');
  const b = moveToLkw(p, 'u1', 'L2');
  assert.equal(b.unplaced.find(u => u.id === 'u1').lkw, 'L2');
  assert.equal(b.placements.length, p.placements.length);
  const c = moveToLkw(p, 'u1', null);
  assert.ok(!('lkw' in c.unplaced.find(u => u.id === 'u1')));
  const d = moveToLkw(p, 'p2', null);
  assert.ok(!('lkw' in d.unplaced.find(u => u.id === 'p2')));
  assert.equal(moveToLkw(p, 'nix', 'L2'), p);
  assert.equal(moveToLkw(p, 'p1', 'L1'), p, 'gleicher LKW: unverändert');
  assert.equal(moveToLkw(plan([]), 'x', null).lkws, undefined);
});

// ---- Eigenschaftstest -------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('Eigenschaft: Stückzahl und IDs bleiben nach beliebigen Folgen erhalten (250 Pläne, fester Seed)', () => {
  const r = rng(20261010);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  for (let n = 0; n < 250; n++) {
    const nPl = Math.floor(r() * 6), nUn = Math.floor(r() * 6);
    const placements = Array.from({ length: nPl }, (_, i) => P(`p${i}`, 'a', i * 10, 0, 0));
    const unplaced = Array.from({ length: nUn }, (_, i) => ({ id: `u${i}`, caseId: 'a' }));
    let p = plan(placements, unplaced);
    if (r() < 0.5) p = convertToMulti(p, counter('c'));
    const want = ids(p);
    const nid = counter(`g${n}-`);
    for (let step = 0; step < 12; step++) {
      const op = pick(['add', 'remove', 'move', 'merge']);
      const lk = lkwsOf(p);
      const all = [...p.placements, ...p.unplaced];
      if (op === 'add') p = addLkw(p, { name: `n${step}`, truckId: pick(['t', 't2']), categories: r() < 0.5 ? ['Ton'] : [] }, nid);
      else if (op === 'remove' && lk.length) p = removeLkw(p, pick(lk).id);
      else if (op === 'move' && all.length) p = moveToLkw(p, pick(all).id, r() < 0.2 ? null : (lk.length ? pick(lk).id : null));
      else if (op === 'merge' && lk.length) {
        const id = pick(lk).id;
        const v = lkwView(p, id);
        // zufällige Ansichtsänderung: Platzierungen in die Ablage, Reihenfolge mischen
        const moved = v.placements.filter(() => r() < 0.5);
        const keep = v.placements.filter(x => !moved.includes(x));
        const edited = { ...v, placements: keep.reverse(), unplaced: [...v.unplaced, ...moved.map(x => ({ id: x.id, caseId: x.caseId }))] };
        p = mergeLkwView(p, id, edited);
      }
      assert.deepEqual(ids(p), want, `Plan ${n} Schritt ${step} (${op})`);
      const all2 = [...p.placements, ...p.unplaced].map(x => x.id);
      assert.equal(new Set(all2).size, all2.length);
      assert.equal(all2.length, want.length);
      if (isMultiLkw(p)) {
        assert.equal(p.truckId, p.lkws[0].truckId);
        const known = new Set(p.lkws.map(l => l.id));
        assert.ok([...p.placements, ...p.unplaced].every(x => x.lkw === undefined || known.has(x.lkw)));
        assert.ok(p.placements.every(x => known.has(x.lkw)), 'Platzierungen sind immer zugeordnet');
      }
    }
  }
});

test('addLkw/updateLkw: truckId bleibt ein nichtleerer String (Rückfall: erster LKW, sonst plan.truckId)', () => {
  const nid = counter('N');
  const m = addLkw(multi(), { name: 'x' }, nid);
  assert.equal(m.lkws[2].truckId, 't1');
  assert.equal(addLkw(multi(), { name: 'x', truckId: '' }, nid).lkws[2].truckId, 't1');
  assert.equal(addLkw(multi(), { name: 'x', truckId: 5 }, nid).lkws[2].truckId, 't1');
  assert.equal(addLkw(plan([]), {}, nid).lkws[1].truckId, 't');
  for (const bad of ['', 7, null, {}]) {
    assert.equal(updateLkw(multi(), 'L2', { truckId: bad }).lkws[1].truckId, 't2');
  }
  assert.equal(updateLkw(multi(), 'L2', { truckId: 'tZ' }).lkws[1].truckId, 'tZ');
  assert.doesNotThrow(() => checkPlan(m));
  assert.doesNotThrow(() => checkPlan(addLkw(plan([]), {}, counter('Q'))));
});
