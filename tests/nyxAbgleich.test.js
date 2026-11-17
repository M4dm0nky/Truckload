import test from 'node:test';
import assert from 'node:assert/strict';
import { mkCase, P, plan, counter } from './fixtures.js';
import {
  stueckProCase, bekannteCases, umhaengen, stand, aufteilen, stueckeAnlegen, reduktion, merken,
} from '../js/model/nyxAbgleich.js';

const GDTF = 'gdtf:aaaa-1111';
const caseMit = (id, name, stueck, keys, extra = {}) =>
  mkCase(id, 60, 40, 40, { name, ...(stueck ? { fasst: { stueck, geraete: keys.map(key => ({ key, name: key })) } } : {}), ...extra });
const nyx = (id, caseId, key, n, extra = {}) => ({ id, caseId, nyxGeraet: key, nyxStueck: n, ...extra });
const gerät = (key, anzahl, extra = {}) => ({ key, name: key, anzahl, vwNamen: [], ...extra });

test('stueckProCase: fasst vor Name vor 1', () => {
  assert.equal(stueckProCase(caseMit('a', 'Viper x2', 4, [GDTF])), 4);
  assert.equal(stueckProCase(caseMit('b', 'Viper x2', null, [])), 2);
  assert.equal(stueckProCase(caseMit('c', 'Viper', null, [])), 1);
});

test('aufteilen', () => {
  assert.deepEqual(aufteilen(24, 2), { cases: 12, rest: 0 });
  assert.deepEqual(aufteilen(25, 2), { cases: 12, rest: 1 });
});

test('stand: verladen aus nyxStueck, Rest in Doppelcase zählt 1', () => {
  const p = plan([P('p1', 'c2', 0, 0, 0, { nyxGeraet: GDTF, nyxStueck: 2 })], [nyx('u1', 'c2', GDTF, 1)]);
  const [s] = stand(p, [gerät(GDTF, 3)], new Map());
  assert.equal(s.verladen, 3);
  assert.equal(s.diff, 0);
});

test('stand: +4 und -2', () => {
  const p = plan([], [nyx('u1', 'c', GDTF, 2), nyx('u2', 'c', 'gdtf:b', 2)]);
  const r = stand(p, [gerät(GDTF, 6), gerät('gdtf:b', 0 + 0)], new Map());
  assert.equal(r.find(s => s.key === GDTF).diff, 4);
  assert.equal(r.find(s => s.key === 'gdtf:b').diff, -2);
});

test('stand: verschwundener key -> anzahl 0, diff = -verladen; Hand-Stück zählt nicht', () => {
  const p = plan([], [nyx('u1', 'c', 'gdtf:weg', 2), { id: 'h', caseId: 'c' }]);
  const r = stand(p, [], new Map());
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].key, r[0].anzahl, r[0].verladen, r[0].diff], ['gdtf:weg', 0, 2, -2]);
});

test('stand: vw-Stück zählt über alias für gdtf-key; nichtLaden aus Plan', () => {
  const p = { ...plan([], [nyx('u1', 'c', 'vw:Viper', 2)]), nyxAbgleich: { nichtLaden: [GDTF] } };
  const [s] = stand(p, [gerät(GDTF, 2)], new Map([['vw:Viper', GDTF]]));
  assert.equal(s.verladen, 2);
  assert.equal(s.nichtLaden, true);
  const [o] = stand(plan([], [nyx('u1', 'c', 'vw:Viper', 2)]), [gerät(GDTF, 2)], new Map());
  assert.equal(o.verladen, 0);
  assert.equal(o.nichtLaden, false);
});

test('stand: Stücke auf LKW (placements mit lkw) und Ablage zählen alle', () => {
  const p = { ...plan([P('p1', 'c', 0, 0, 0, { nyxGeraet: GDTF, nyxStueck: 2, lkw: 'L1' })], [nyx('u1', 'c', GDTF, 2, { lkw: 'L2' })]),
    lkws: [{ id: 'L1' }, { id: 'L2' }] };
  assert.equal(stand(p, [gerät(GDTF, 4)], new Map())[0].verladen, 4);
});

test('bekannteCases: nur mit key, x1 vor x2, gelöschtes fehlt', () => {
  const x2 = caseMit('x2', 'A x2', 2, [GDTF]);
  const x1 = caseMit('x1', 'A x1', 1, [GDTF]);
  const fremd = caseMit('f', 'B', 1, ['gdtf:b']);
  const ohne = caseMit('o', 'C', null, []);
  assert.deepEqual(bekannteCases(GDTF, [x2, fremd, ohne, x1]).map(c => c.id), ['x1', 'x2']);
  assert.deepEqual(bekannteCases(GDTF, [fremd, x1]).map(c => c.id), ['x1']);
});

test('umhaengen: Treffer bei Name in vwNamen, Nicht-Treffer bei anderem', () => {
  const treffer = caseMit('t', 'V', 2, ['vw:MAC Viper']);
  const nicht = caseMit('n', 'W', 2, ['vw:MAC Aura']);
  const r = umhaengen([gerät(GDTF, 2, { vwNamen: ['MAC Viper'] })], [treffer, nicht]);
  assert.deepEqual(r.cases.map(c => c.id), ['t']);
  assert.deepEqual(r.cases[0].fasst.geraete.map(g => g.key), [GDTF]);
  assert.equal(r.cases[0].fasst.stueck, 2);
  assert.equal(r.alias.get('vw:MAC Viper'), GDTF);
  assert.equal(r.alias.has('vw:MAC Aura'), false);
});

test('umhaengen: zwei vw-Namen auf einen gdtf-Key, vw-Eintrag nicht doppelt', () => {
  const a = caseMit('a', 'A', 1, ['vw:V1']);
  const b = caseMit('b', 'B', 1, ['vw:V2', GDTF]);
  const r = umhaengen([gerät(GDTF, 2, { vwNamen: ['V1', 'V2'] })], [a, b]);
  assert.deepEqual(r.cases.map(c => c.id).sort(), ['a', 'b']);
  assert.deepEqual(r.cases.find(c => c.id === 'b').fasst.geraete.map(g => g.key), [GDTF]);
  assert.equal(r.alias.size, 2);
});

test('umhaengen: vw-Eintrag ohne gdtf-Gegenstück ändert nichts', () => {
  const a = caseMit('a', 'A', 1, ['vw:V1']);
  const r = umhaengen([gerät('vw:V1', 2, { vwNamen: ['V1'] })], [a]);
  assert.equal(r.cases.length, 0);
  assert.equal(r.alias.size, 0);
});

const reduPlan = () => ({
  ...plan(
    [P('onLkw', 'c1', 0, 0, 0, { nyxGeraet: GDTF, nyxStueck: 1 })],
    [
      nyx('ohneVoll', 'c2', GDTF, 2),
      nyx('ohneRest', 'c2', GDTF, 1),
      { id: 'hand', caseId: 'c2' },                       // gleiches Case, aber Hand-Stück
      nyx('fremd', 'c2', 'gdtf:other', 1),
    ]),
});

test('reduktion: zuerst ohne LKW, Rest vor voll; Hand- und fremde Stücke bleiben', () => {
  assert.deepEqual(reduktion(reduPlan(), GDTF, 1).entfernen, ['ohneRest']);
  assert.deepEqual(reduktion(reduPlan(), GDTF, 2).entfernen, ['ohneRest', 'ohneVoll']);
  const alle = reduktion(reduPlan(), GDTF, 99).entfernen;
  assert.ok(!alle.includes('hand') && !alle.includes('fremd'));
  assert.deepEqual(reduktion(reduPlan(), GDTF, 1).aufLkw, []);
});

test('reduktion: alle auf LKW -> aufLkw gefüllt; Ablage mit lkw zählt als auf LKW', () => {
  const p = { ...plan([P('p1', 'c', 0, 0, 0, { nyxGeraet: GDTF, nyxStueck: 1, lkw: 'L1' })],
    [nyx('u1', 'c', GDTF, 1, { lkw: 'L1' }), nyx('u2', 'c', GDTF, 1, { lkw: 'gibtsNicht' })]),
    lkws: [{ id: 'L1' }] };
  const r = reduktion(p, GDTF, 2);
  assert.deepEqual(r.entfernen, ['u2', 'p1']);
  assert.deepEqual(r.aufLkw, ['p1']);
  const einLkw = plan([P('p1', 'c', 0, 0, 0, { nyxGeraet: GDTF, nyxStueck: 1 })]);
  assert.deepEqual(reduktion(einLkw, GDTF, 1), { entfernen: ['p1'], aufLkw: ['p1'] });
});

test('reduktion: minus 0 entfernt nichts; alias-Stück zählt', () => {
  assert.deepEqual(reduktion(reduPlan(), GDTF, 0), { entfernen: [], aufLkw: [] });
  const p = plan([], [nyx('v', 'c', 'vw:V', 1)]);
  assert.deepEqual(reduktion(p, GDTF, 1, new Map([['vw:V', GDTF]])).entfernen, ['v']);
  assert.deepEqual(reduktion(p, GDTF, 1).entfernen, []);
});

test('stueckeAnlegen: tipped bei tippbarem Case, nicht bei Rack', () => {
  const tipp = mkCase('t', 60, 40, 40, { tippable: true });
  const rack = mkCase('r', 60, 40, 40, { tippable: false });
  const a = stueckeAnlegen(plan([]), { key: GDTF, caseId: 't', c: tipp, n: 2, stueck: 2 }, counter('n'));
  assert.equal(a.unplaced.length, 2);
  assert.ok(a.unplaced.every(u => u.tipped === true && u.nyxGeraet === GDTF && u.nyxStueck === 2));
  const b = stueckeAnlegen(plan([]), { key: GDTF, caseId: 'r', c: rack, n: 1, stueck: 1 }, counter('m'));
  assert.notEqual(b.unplaced[0].tipped, true);
  assert.equal(b.unplaced[0].nyxGeraet, GDTF);
});

test('merken: kein Doppel-Eintrag, stueck nur wenn nicht gesetzt', () => {
  const c = caseMit('a', 'Viper x2', null, []);
  const m1 = merken(c, GDTF, 'Viper');
  assert.deepEqual(m1.fasst, { stueck: 2, geraete: [{ key: GDTF, name: 'Viper' }] });
  const m2 = merken(m1, GDTF, 'Viper');
  assert.equal(m2.fasst.geraete.length, 1);
  const m3 = merken(caseMit('b', 'x', 5, []), GDTF, 'V');
  assert.equal(m3.fasst.stueck, 5);
  assert.equal(c.fasst, undefined);
});
