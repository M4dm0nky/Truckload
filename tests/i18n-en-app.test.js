// Englische Texte der App-Schicht (#42, Task 5): kein deutscher Rest, keine offenen Platzhalter.
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLang } from '../js/i18n/i18n.js';
import { looksGerman } from './i18n-scan.js';
import { packRulesTitle, distributionNotices } from '../js/app/core.js';
import { limitWarnings, capList, importWarnings } from '../js/app/importExport.js';
import { copyName, multiAddedNotice } from '../js/app/plans.js';
import { druckTitel } from '../js/app/hostPrint.js';
import { guarded } from '../js/app/guarded.js';
import { SCROLL_SHORT, SCROLL_LABELS } from '../js/ui/zoom2d.js';
import { setMixTop } from '../js/model/actions.js';
import { convertToMulti } from '../js/model/lkw.js';
import { mkCase, byId } from './fixtures.js';

beforeEach(() => setLang('en'));
afterEach(() => setLang('de'));

const sauber = s => s.replace(/[“”]/g, '"');
const englisch = s => { assert.ok(!looksGerman(sauber(s)), `deutscher Rest: ${s}`); assert.ok(!/[{}]/.test(s), `offener Platzhalter: ${s}`); };

test('packRulesTitle: Tooltip der Pack-Regeln englisch, mit und ohne Deckschicht', () => {
  const plan = { id: 'p', name: 'P', truckId: 't', placements: [], unplaced: [] };
  const ohne = packRulesTitle(plan, byId());
  englisch(ohne);
  assert.match(ohne, /^Order for automatic packing: /);
  const mit = packRulesTitle(setMixTop(plan, true), byId());
  englisch(mit);
  assert.match(mit, /top layer on$/);
});

test('distributionNotices: Rest-Hinweis in Ein- und Mehrzahl englisch', () => {
  const base = convertToMulti({ id: 'p', name: 'P', truckId: 'T', placements: [], unplaced: [] }, () => 'x1');
  const l = base.lkws[0].id;
  const mk = n => ({ ...base, unplaced: Array.from({ length: n }, (_, i) => ({ id: `u${i}`, caseId: 'c', lkw: l })) });
  const cases = byId(mkCase('c', 10, 10, 10));
  for (const n of [1, 3]) {
    const lines = distributionNotices(mk(n), cases);
    assert.equal(lines.length, 1);
    englisch(lines[0]);
    assert.match(lines[0], n === 1 ? /^1 item does not fit/ : /^3 items do not fit/);
  }
});

test('Importmeldungen englisch (Grenzwerte, Kürzung, Verweise)', () => {
  const w = limitWarnings([
    { name: 'K', field: 'weight', value: 9, max: 5 }, { name: 'K', field: 'maxTopLoad', value: 9, max: 5 }, { name: 'K', field: 'stock', value: 9, max: 5 },
  ]);
  assert.equal(w.length, 3);
  w.forEach(englisch);
  const list = capList(Array.from({ length: 12 }, (_, i) => `x${i}`));
  assert.equal(list.at(-1), '… and 2 more');
  const iw = importWarnings([{ planId: 'p', plan: 'Tour', cases: ['weg'], truck: 'weg2' }], { cases: [], trucks: [] });
  assert.equal(iw.length, 2);
  iw.forEach(englisch);
});

test('Importwarnung: Plurale als Paare, kein „(s)“', () => {
  const warn = n => importWarnings([{ planId: 'p', plan: 'Tour', cases: Array.from({ length: n }, (_, i) => 'weg' + i), truck: 't' }], { cases: [], trucks: [{ id: 't' }] })[0];
  assert.equal(warn(1), 'Load plan “Tour”: 1 item refers to a case that is neither in the file nor known.');
  assert.equal(warn(2), 'Load plan “Tour”: 2 items refer to a case that is neither in the file nor known.');
});

test('Plan-, Druck-, Fehler- und Zoom-Texte englisch', async () => {
  assert.equal(copyName('Tour'), 'Tour (copy)');
  englisch(multiAddedNotice());
  assert.equal(druckTitel('plan', { plan: { name: 'Tour' }, truck: null, alle: true }), 'Tour – all trucks');
  const alerts = [];
  await guarded('Failed', () => Promise.reject(undefined), { showAlert: async m => alerts.push(m) });
  assert.deepEqual(alerts, ['Failed: unknown error']);
  for (const m of ['auto', 'zoom', 'pan']) { englisch(SCROLL_SHORT[m]); englisch(SCROLL_LABELS[m]); }
});
