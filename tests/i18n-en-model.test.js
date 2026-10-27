// Englische Meldungen des Modells (#42, Task 4a): kein deutscher Rest, keine offenen Platzhalter.
// Task 4b ergänzt hier die Store-Meldungen (checkCase, parseBundle).
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLang } from '../js/i18n/i18n.js';
import { looksGerman } from './i18n-scan.js';
import { validatePlan } from '../js/model/validate.js';
import { unplacedReason } from '../js/model/unplacedReason.js';
import { addLkw, convertToMulti } from '../js/model/lkw.js';
import { collectionNameError, parentError, MEINE_NAME, MEINE_NAME_EN, resolveTarget, MEINE_ID } from '../js/model/collections.js';
import { describeRule, POS_LABEL, RULE_KINDS } from '../js/model/packRules.js';
import { trussDims, splitWagons } from '../js/model/truss.js';
import { unassignedLines, stueck } from '../js/model/lkw-distribute.js';
import { truckMarke, truckStiftSperre } from '../js/model/mitgefuehrt.js';
import { mkCase, mkTruck, SPRINTER, P, plan, byId, counter } from './fixtures.js';

beforeEach(() => setLang('en'));
afterEach(() => setLang('de'));

// Der Case-Name „Bühne“ ist Nutzerdaten und bleibt deutsch: vor der Prüfung herausnehmen.
// Die englischen Anführungszeichen “…” zählt looksGerman als deutsch (es kennt „“): ebenfalls entfernen.
const sauber = s => s.replaceAll('Bühne', 'X').replaceAll('bühne', 'x').replace(/[“”]/g, '"');
const englisch = s => { assert.ok(!looksGerman(sauber(s)), `deutscher Rest: ${s}`); assert.ok(!/[{}]/.test(s), `offener Platzhalter: ${s}`); };

test('validatePlan: alle Meldungen englisch', () => {
  const K = mkCase('k', 120, 60, 60, { name: 'Bühne', maxTopLoad: 50, stackable: false });
  const W = mkCase('w', 120, 60, 60, { name: 'Bühne', weight: 100000, layers: [2] });
  const Z = mkCase('z', 60, 60, 60, { name: 'Bühne', weight: 0 });
  const H = mkCase('h', 100, 100, 50, { name: 'Bühne', weight: 500 });
  const pl = plan([
    P('a', 'k', 0, 0, 0), P('b', 'k', 60, 0, 0), P('c', 'k', 2000, 0, 0), P('d', 'k', 0, 100, 0, { orientation: 'tipLong' }),
    P('e', 'k', 0, 150, 0), P('f', 'w', 0, 150, 60), P('g', 'w', 300, 150, 0), P('u', 'k', 700, 0, 60),
    ...[0, 1, 2, 3, 4].map(n => P(`s${n}`, 'z', 900, 0, n * 60)), P('x', 'gibtsnicht', 0, 0, 0, { label: 'Bühne' }),
  ]);
  const seen = new Set();
  for (const [truck, cases, p] of [
    [SPRINTER, byId(K, W, Z), pl],
    [mkTruck(), byId(H, Z), plan([P('a', 'h', 0, 0, 0), P('b', 'h', 110, 0, 0), P('c', 'z', 250, 180, 0)])],
    [mkTruck(), byId(H), plan([P('a', 'h', 0, 0, 0), P('b', 'h', 110, 0, 0)])],
    [mkTruck(), byId(Z), plan([P('a', 'z', 0, 0, 0)])],
  ]) {
    for (const i of validatePlan(p, cases, truck).issues) { englisch(i.message); seen.add(i.code); }
  }
  for (const code of ['missingCase', 'outOfBounds', 'arch', 'notTippable', 'collision', 'notStackable', 'unsupported', 'tooManyLayers', 'tooHeavy', 'imbalance', 'layer'])
    assert.ok(seen.has(code), `Fall ${code} nicht erzeugt (seen: ${[...seen]})`);
});

test('validatePlan: Beispielsatz', () => {
  const K = mkCase('k', 120, 60, 60, { name: 'Bühne' });
  const r = validatePlan(plan([P('a', 'k', 5000, 0, 0)]), byId(K), mkTruck());
  assert.equal(r.issues.find(i => i.code === 'outOfBounds').message, '“Bühne” sticks out of the load space.');
});

test('unplacedReason: jeder Grund englisch', () => {
  const t1 = mkTruck({ l: 200, w: 100, h: 90, payload: 100 });
  const texte = [
    unplacedReason({ id: 'u' }, mkCase('big', 300, 80, 80, { tippable: true }), t1),
    unplacedReason({ id: 'u', tipped: true }, mkCase('hi', 120, 50, 80, { tippable: true }), mkTruck({ l: 200, w: 70, h: 90 })),
    unplacedReason({ id: 'u', tipped: false }, mkCase('lg', 100, 50, 150, { tippable: true }), t1),
    unplacedReason({ id: 'u' }, mkCase('schwer', 100, 50, 50, { weight: 1500 }), t1),
    unplacedReason({ id: 'u', layers: [2, 3] }, mkCase('l', 100, 50, 50), t1),
  ];
  assert.equal(texte.length, 5);
  for (const s of texte) { assert.ok(s); englisch(s); }
  assert.equal(texte[3], 'too heavy for the truck’s payload (1,500 kg, 100 kg allowed)');
});

test('Neuer LKW im Mehr-LKW-Plan heißt „Truck 2“', () => {
  const p = plan([P('p1', 'a', 0, 0, 0)]);
  const m = addLkw(p, { truckId: 't' }, counter('L'));
  assert.deepEqual(m.lkws.map(l => l.name), ['Truck 1', 'Truck 2']);
  assert.equal(convertToMulti(p, counter('L')).lkws[0].name, 'Truck 1');
});

test('Sammlungen: Meldungen englisch, englischer Name der festen Sammlung wird erkannt', () => {
  assert.equal(MEINE_NAME, 'Meine Sammlung');
  assert.equal(MEINE_NAME_EN, 'My collection');
  const cols = [{ id: 'meine', name: MEINE_NAME }, { id: 'x', name: 'Bühne' }];
  for (const s of [collectionNameError('', cols), collectionNameError('__a__', cols), collectionNameError('bühne', cols),
    collectionNameError('x'.repeat(500), cols), parentError(cols, null, 'nix'), parentError([{ id: 'a', name: 'a' }], 'a', 'a')]) englisch(s);
  assert.equal(resolveTarget({ company: 'my COLLECTION' }, null, cols, 'n').id, MEINE_ID);
  assert.equal(resolveTarget({ company: 'meine sammlung' }, null, cols, 'n').id, MEINE_ID);
});

test('Pack-Regeln, Traversen, LKW-Hinweise, Kopien: englisch', () => {
  const cases = new Map([['big', { name: 'Bühne' }]]);
  for (const r of [{ by: 'truss', pos: 'last' }, { by: 'group', value: 'G', pos: 'first' }, { by: 'case', value: 'big', pos: 'first' },
    { by: 'category', value: 'Licht', pos: 'last' }, { by: 'volume' }, { by: 'count' }]) englisch(describeRule(r, cases));
  assert.equal(describeRule({ by: 'category', value: 'Licht', pos: 'last' }, cases), 'Department “Lighting”: last (door)');
  for (const s of [...Object.values(POS_LABEL), ...RULE_KINDS.map(k => k.label)]) englisch(s);
  assert.throws(() => trussDims({ length: 100, width: 500, count: 1 }), e => { englisch(e.message); return true; });
  assert.throws(() => trussDims({ length: 100, width: 40, count: 1, wagonW: 50 }), e => { englisch(e.message); return true; });
  assert.throws(() => splitWagons(0, 1), e => { englisch(e.message); return true; });
  assert.equal(stueck(1), '1 item');
  assert.equal(stueck(3), '3 items');
  const c = new Map([['a', mkCase('a', 10, 10, 10, { category: 'Licht' })]]);
  const mp = { ...plan([P('p1', 'a', 0, 0, 0), P('p2', 'zz', 0, 0, 0)]), lkws: [{ id: 'L', name: 'T', truckId: 't', categories: ['Ton'] }] };
  mp.placements = mp.placements.map(x => ({ ...x, lkw: 'nirgends' }));
  const lines = unassignedLines(mp, c);
  assert.deepEqual(lines, ['1 item without a truck (Lighting)', '1 item with an unknown case']);
  englisch(truckMarke({ id: 'x' }, { trucks: new Set(['x']) }).title);
  englisch(truckStiftSperre({ trucks: new Set(['x']) }, { id: 'x' }).title);
});
