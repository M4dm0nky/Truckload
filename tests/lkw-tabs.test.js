import test from 'node:test';
import assert from 'node:assert/strict';
import { lkwTabsModel, sumText, tabsHtml, unassignedLines } from '../js/ui/lkw-tabs.js';
import { deleteQuestion, CATEGORY_HINT, LAST_LKW_MESSAGE } from '../js/ui/lkw-editor.js';
import { NO_LKW } from '../js/app/core.js';
import { MAX_LKW } from '../js/model/limits.js';
import { mkCase, mkTruck, byId } from './fixtures.js';

const cases = byId(mkCase('li', 10, 10, 10, { category: 'Licht', weight: 50 }), mkCase('st', 10, 10, 10, { category: 'Strom', weight: 0 }));
const trucks = [mkTruck({ id: 't1', name: 'Sattel' }), mkTruck({ id: 't2', name: 'Sprinter' })];
const plan = {
  id: 'p', name: 'P', truckId: 't1',
  lkws: [{ id: 'A', name: 'LKW Licht', truckId: 't1', categories: ['Licht'] }, { id: 'B', name: 'Rest', truckId: 't2', categories: [] }],
  placements: [{ id: 'x1', caseId: 'li', lkw: 'A' }],
  unplaced: [{ id: 'x2', caseId: 'li', lkw: 'B' }, { id: 'x3', caseId: 'st' }, { id: 'x4', caseId: 'st', lkw: 'weg' }, { id: 'x5', caseId: 'li', lkw: 'A' }],
};

test('lkwTabsModel: Ein-LKW-Plan -> null', () => {
  assert.equal(lkwTabsModel({ plan: { ...plan, lkws: undefined }, trucks, caseById: cases, active: null }), null);
});
test('lkwTabsModel: Reiter je LKW mit Stückzahl, aktiver markiert, „Ohne LKW“ am Ende', () => {
  const m = lkwTabsModel({ plan, trucks, caseById: cases, active: 'B' });
  assert.deepEqual(m.tabs.map(t => [t.id, t.label, t.count, t.active]), [
    ['A', 'LKW Licht · Sattel', 2, false], ['B', 'Rest · Sprinter', 1, true], [NO_LKW, 'Ohne LKW', 2, false]]);
  assert.equal(m.canAdd, true);
});
test('lkwTabsModel: ohne nicht zugeordnete Stücke kein Reiter „Ohne LKW“; „Ohne LKW“ aktiv markierbar', () => {
  const full = { ...plan, unplaced: plan.unplaced.filter(u => u.lkw === 'A' || u.lkw === 'B') };
  assert.ok(!lkwTabsModel({ plan: full, trucks, caseById: cases, active: 'A' }).tabs.some(t => t.none));
  assert.equal(lkwTabsModel({ plan, trucks, caseById: cases, active: NO_LKW }).tabs.at(-1).active, true);
});
test('lkwTabsModel: Summe – Gesamtzahl, Gewicht (0 = unbekannt, wird genannt), nicht zugeordnet je Gewerk', () => {
  const { sum } = lkwTabsModel({ plan, trucks, caseById: cases, active: 'A' });
  assert.deepEqual([sum.total, sum.weight, sum.withoutWeight, sum.unassigned], [5, 150, 2, 2]);
  assert.deepEqual(sum.unassignedLines, ['2 Stücke ohne LKW (Strom)']);
  assert.equal(sumText(sum), 'Gesamt 5 Stücke · 150 kg (2 ohne Gewicht) · 2 Stücke ohne LKW (Strom)');
});
test('unassignedLines: einzelnes Stück, unbekannter Case', () => {
  const p = { ...plan, unplaced: [{ id: 'a', caseId: 'li' }, { id: 'b', caseId: 'nix' }], placements: [] };
  assert.deepEqual(unassignedLines(p, cases), ['1 Stück ohne LKW (Licht)', '1 Stück mit unbekanntem Case']);
});
test('lkwTabsModel: „+ LKW“ bei MAX_LKW gesperrt', () => {
  const many = { ...plan, lkws: Array.from({ length: MAX_LKW }, (_, i) => ({ id: `l${i}`, name: `L${i}`, truckId: 't1', categories: [] })) };
  const m = lkwTabsModel({ plan: many, trucks, caseById: cases, active: 'l0' });
  assert.equal(m.canAdd, false);
  assert.match(tabsHtml(m), /data-act="add" disabled/);
});
test('tabsHtml: Namen werden maskiert, Reiter tragen data-lkw', () => {
  const evil = { ...plan, lkws: [{ id: 'A', name: '<img src=x onerror=1>', truckId: 't1', categories: [] }] };
  const html = tabsHtml(lkwTabsModel({ plan: evil, trucks, caseById: cases, active: 'A' }));
  assert.ok(!html.includes('<img'));
  assert.match(html, /data-lkw="A"/);
  assert.match(html, /class="lkw-tab on"/);
});
test('lkw-editor: Texte', () => {
  assert.equal(CATEGORY_HINT, 'Kein Haken = Rest-LKW (nimmt alles, was sonst keiner annimmt)');
  assert.match(LAST_LKW_MESSAGE, /letzte LKW lässt sich nicht löschen/);
  assert.equal(deleteQuestion('Ton', 0), 'LKW „Ton“ löschen?');
  assert.match(deleteQuestion('Ton', 3), /Seine 3 Stücke werden keinem LKW mehr zugeordnet/);
});
