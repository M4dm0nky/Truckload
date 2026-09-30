import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyRules, rulesFor, ruleOk, normalizeRules, addRule, moveRule, removeRule,
  blockComparator, ruleTargets, ruleActive, describeRule, MAX_RULES,
} from '../js/model/packRules.js';
import { mkCase, byId } from './fixtures.js';

const big = mkCase('big', 120, 80, 80);
const small = mkCase('small', 60, 60, 60, { category: 'Ton' });
const truss = mkCase('truss', 300, 62, 115, { kind: 'truss', truss: { length: 300, width: 62, count: 1, standing: true, height: 115 } });
const block = (c, n, group) => Array.from({ length: n }, (_, i) => ({ id: `${c.id}${group ?? ''}${i}`, caseId: c.id, c, ...(group ? { group } : {}) }));
const order = (blocks, rules) => [...blocks].sort(blockComparator(rules))
  .map(b => b[0].caseId + (b[0].group ? `/${b[0].group}` : ''));

test('legacyRules: volume/fehlt = Traversen zuletzt, Große, Stückzahl; count = Stückzahl, Große', () => {
  const vol = [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }];
  assert.deepEqual(legacyRules('volume'), vol);
  assert.deepEqual(legacyRules(undefined), vol);
  assert.deepEqual(legacyRules('count'), [{ by: 'count' }, { by: 'volume' }]);
});

test('rulesFor: packRules gewinnt, sonst packOrder (Altdaten)', () => {
  const rules = [{ by: 'count' }];
  assert.deepEqual(rulesFor({ packRules: rules, packOrder: 'volume' }), rules);
  assert.deepEqual(rulesFor({ packOrder: 'count' }), legacyRules('count'));
  assert.deepEqual(rulesFor({}), legacyRules('volume'));
});

test('ruleOk: gültige und ungültige Regeln', () => {
  assert.ok(ruleOk({ by: 'volume' }));
  assert.ok(ruleOk({ by: 'truss', pos: 'first' }));
  assert.ok(ruleOk({ by: 'group', value: 'Motoren', pos: 'last' }));
  assert.ok(!ruleOk({ by: 'group', value: '   ', pos: 'last' }), 'leerer Wert');
  assert.ok(!ruleOk({ by: 'group', value: 'x'.repeat(201), pos: 'last' }), 'zu lang');
  assert.ok(!ruleOk({ by: 'case', value: 'a', pos: 'middle' }), 'unbekannte Position');
  assert.ok(!ruleOk({ by: 'foo' }), 'unbekannte Art');
  assert.ok(!ruleOk({ by: 'volume', pos: 'first' }), 'Maßregel ohne Position');
  assert.ok(!ruleOk({ by: 'truss', value: 'x', pos: 'last' }), 'Traversen ohne Wert');
  assert.ok(!ruleOk(null));
});

test('normalizeRules: verwirft Ungültiges, trimmt, entfernt Doppelte (erste bleibt), deckelt auf MAX_RULES', () => {
  const out = normalizeRules([
    { by: 'group', value: ' Motoren ', pos: 'last' }, { by: 'foo' },
    { by: 'group', value: 'Motoren', pos: 'first' }, { by: 'volume', extra: 1 },
  ]);
  assert.deepEqual(out, [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }]);
  const many = Array.from({ length: 30 }, (_, i) => ({ by: 'group', value: `g${i}`, pos: 'last' }));
  assert.equal(normalizeRules(many).length, MAX_RULES);
  assert.deepEqual(normalizeRules('kaputt'), []);
});

test('addRule ersetzt dieselbe Regel und hängt hinten an; moveRule/removeRule', () => {
  const r0 = [{ by: 'truss', pos: 'last' }, { by: 'volume' }];
  assert.deepEqual(addRule(r0, { by: 'truss', pos: 'first' }), [{ by: 'volume' }, { by: 'truss', pos: 'first' }]);
  assert.deepEqual(moveRule(r0, 1, -1), [{ by: 'volume' }, { by: 'truss', pos: 'last' }]);
  assert.deepEqual(moveRule(r0, 0, -1), r0, 'oben bleibt oben');
  assert.deepEqual(removeRule(r0, 0), [{ by: 'volume' }]);
});

test('blockComparator: Traversen zuerst oder zuletzt', () => {
  const blocks = [block(small, 2), block(truss, 2), block(big, 2)];
  assert.deepEqual(order(blocks, [{ by: 'truss', pos: 'last' }, { by: 'volume' }]), ['big', 'small', 'truss']);
  assert.deepEqual(order(blocks, [{ by: 'truss', pos: 'first' }, { by: 'volume' }]), ['truss', 'big', 'small']);
});

test('blockComparator: Gruppe zuletzt trifft nur die Gruppe, nicht den ganzen Case-Typ', () => {
  const blocks = [block(big, 20, 'Motoren'), block(big, 3), block(small, 5)];
  assert.deepEqual(order(blocks, [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }]),
    ['big', 'small', 'big/Motoren']);
});

test('blockComparator: Case-Typ zuerst und Gewerk zuletzt', () => {
  const blocks = [block(big, 1), block(small, 1)];
  assert.deepEqual(order(blocks, [{ by: 'case', value: 'small', pos: 'first' }, { by: 'volume' }]), ['small', 'big']);
  assert.deepEqual(order(blocks, [{ by: 'category', value: 'Sonstiges', pos: 'last' }]), ['small', 'big']);
});

test('blockComparator: oberste Regel entscheidet, bei Gleichstand die nächste', () => {
  const blocks = [block(small, 9), block(big, 1), block(truss, 4)];
  assert.deepEqual(order(blocks, [{ by: 'count' }, { by: 'volume' }]), ['small', 'truss', 'big']);
  assert.deepEqual(order(blocks, [{ by: 'truss', pos: 'first' }, { by: 'count' }]), ['truss', 'small', 'big']);
});

test('blockComparator: Regel auf eine Gruppe, die es im Load nicht gibt, ändert nichts', () => {
  const blocks = [block(small, 1), block(big, 1)];
  assert.deepEqual(order(blocks, [{ by: 'group', value: 'Gibt es nicht', pos: 'first' }, { by: 'volume' }]), ['big', 'small']);
});

test('blockComparator: ohne Regel entscheidet der Name, dann die Gruppe', () => {
  const blocks = [block(small, 1, 'B'), block(big, 1), block(small, 1, 'A')];
  assert.deepEqual(order(blocks, []), ['big', 'small/A', 'small/B']);
});

test('ruleTargets: Gruppen, Case-Typen und Gewerke des Loads, sortiert; Traversen erkannt', () => {
  const pieces = [
    { caseId: 'big', group: 'Motoren' }, { caseId: 'small' }, { caseId: 'truss' }, { caseId: 'weg' },
    { caseId: 'big', group: 'FOH' },
  ];
  const t = ruleTargets(pieces, byId(big, small, truss));
  assert.deepEqual(t.groups, ['FOH', 'Motoren']);
  assert.deepEqual(t.cases, [{ id: 'big', name: 'big' }, { id: 'small', name: 'small' }, { id: 'truss', name: 'truss' }]);
  assert.deepEqual(t.categories, ['Sonstiges', 'Ton']);
  assert.equal(t.hasTruss, true);
});

test('ruleActive: Auswahlregel nur aktiv, wenn ihr Ziel im Load vorkommt', () => {
  const t = { groups: ['Motoren'], cases: [{ id: 'big', name: 'big' }], categories: ['Ton'], hasTruss: false };
  assert.equal(ruleActive({ by: 'group', value: 'Motoren', pos: 'last' }, t), true);
  assert.equal(ruleActive({ by: 'group', value: 'FOH', pos: 'last' }, t), false);
  assert.equal(ruleActive({ by: 'case', value: 'big', pos: 'first' }, t), true);
  assert.equal(ruleActive({ by: 'category', value: 'Licht', pos: 'first' }, t), false);
  assert.equal(ruleActive({ by: 'truss', pos: 'last' }, t), false);
  assert.equal(ruleActive({ by: 'volume' }, t), true);
});

test('describeRule: deutsche Texte mit typografischen Anführungszeichen', () => {
  const cases = byId(big);
  assert.equal(describeRule({ by: 'truss', pos: 'last' }, cases), 'Traversen: zuletzt (Tür)');
  assert.equal(describeRule({ by: 'group', value: 'Motoren', pos: 'last' }, cases), 'Gruppe „Motoren“: zuletzt (Tür)');
  assert.equal(describeRule({ by: 'case', value: 'big', pos: 'first' }, cases), 'Case-Typ „big“: zuerst (Stirnwand)');
  assert.equal(describeRule({ by: 'case', value: 'weg', pos: 'first' }, cases), 'Case-Typ „weg“: zuerst (Stirnwand)');
  assert.equal(describeRule({ by: 'category', value: 'Ton', pos: 'first' }, cases), 'Gewerk „Ton“: zuerst (Stirnwand)');
  assert.equal(describeRule({ by: 'volume' }, cases), 'Große zuerst');
  assert.equal(describeRule({ by: 'count' }, cases), 'Stückzahl zuerst');
});
