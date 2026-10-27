// Englische Texte der Editoren, des Materials und des Inspectors (#42, Task 6).
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLang, builtinNote, trade } from '../js/i18n/i18n.js';
import { looksGerman } from './i18n-scan.js';
import { renderInspector, orientationText } from '../js/ui/inspector.js';
import { categoryOptionsHtml } from '../js/ui/case-editor.js';
import { caseLine, caseDetail, fmtNum } from '../js/ui/caseInfo.js';
import { CASE_TABS } from '../js/ui/caseGroups.js';
import { fmtM, ORIENTATION_LABEL } from '../js/ui/dom.js';
import { sumText, tabsHtml } from '../js/ui/lkw-tabs.js';
import { stockTargetHtml } from '../js/ui/stock-target.js';
import { validatePlan } from '../js/model/validate.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { PRESET_TRUCKS } from '../js/data/preset-trucks.js';
import { mkCase, mkTruck, P, plan, byId } from './fixtures.js';

beforeEach(() => setLang('en'));
afterEach(() => setLang('de'));

const fakeEl = () => ({ html: null, __lastHtml: null, set innerHTML(v) { this.html = v; }, contains: () => false, querySelector: () => null });
// Nur sichtbarer Text: Markup und maskierte Nutzerdaten entfernen.
const sichtbar = html => html.replace(/<[^>]*>/g, ' ').replace(/“?&lt;b&gt;&amp;”?/g, ' ');

test('Inspector: Nutzername maskiert, sonst kein Deutsch (Auswahl, getippt, Summen)', () => {
  globalThis.document ??= { activeElement: null };
  const c = mkCase('c1', 100, 50, 50, { name: '<b>&', builtin: false, weight: 12, maxTopLoad: 80 });
  const truck = mkTruck();
  const p = plan([P('a', 'c1', 0, 0, 0, { orientation: 'tipLong', rot: 180 }), P('b', 'c1', 200, 0, 0)]);
  const result = validatePlan(p, byId(c), truck);
  const selected = result.items.find(it => it.id === 'a');
  const el = fakeEl();
  renderInspector(el, { selected, selectedUnplaced: null, result, truck, lkw: { options: [{ id: 'x', name: 'N' }], current: null, name: 'N' } });
  assert.ok(el.html.includes('&lt;b&gt;&amp;'), 'Name maskiert');
  assert.ok(!el.html.includes('<b>&'));
  const text = sichtbar(el.html);
  assert.ok(!looksGerman(text), `deutscher Rest: ${text.replace(/\s+/g, ' ')}`);
  assert.match(text, /Rotate/);
  assert.match(text, /Castors face/);
  assert.match(text, /Warnings/);
  assert.match(text, /Centre of gravity/);
});

test('Inspector: leere Auswahl und Ablage-Stück englisch', () => {
  globalThis.document ??= { activeElement: null };
  const c = mkCase('c1', 100, 50, 50, { builtin: false, weight: 0 });
  const truck = mkTruck();
  const result = validatePlan(plan([]), byId(c), truck);
  const leer = fakeEl();
  renderInspector(leer, { selected: null, selectedUnplaced: null, result, truck });
  assert.ok(!looksGerman(sichtbar(leer.html)), sichtbar(leer.html));
  const abl = fakeEl();
  renderInspector(abl, { selected: null, result, truck,
    selectedUnplaced: { id: 'u', item: { id: 'u', caseId: 'c1' }, c, label: 'x', color: '#999999' } });
  assert.ok(!looksGerman(sichtbar(abl.html)), sichtbar(abl.html));
});

test('orientationText und fmtM: englisches Format', () => {
  assert.equal(ORIENTATION_LABEL.standing, 'standing');
  assert.equal(orientationText({ orientation: 'tipLong', rot: 90 }), 'tipped (long side), rotated by 90°');
  assert.equal(fmtM(123), '1.23 m');
  assert.equal(fmtNum(12.5), '12.5');
});

test('Case-Editor: Gewerk-Auswahl zeigt die Übersetzung, der Wert bleibt deutsch', () => {
  const html = categoryOptionsHtml();
  assert.ok(html.includes('<option value="Licht">Lighting</option>'), html);
  assert.ok(html.includes('<option value="Bühne">Staging</option>'));
  assert.equal(trade('Licht'), 'Lighting');
  setLang('de');
  assert.ok(categoryOptionsHtml().includes('<option value="Licht">Licht</option>'));
});

test('builtinNote: mitgeliefertes Case mit „Gewicht geschätzt“ englisch, Nutzernotiz unverändert', () => {
  const std = PRESET_CASES.find(c => c.note?.startsWith('Gewicht geschätzt: '));
  assert.ok(std);
  const en = builtinNote(std);
  assert.ok(en.startsWith('Weight estimated: '), en);
  assert.ok(!looksGerman(en), en);
  assert.equal(builtinNote({ builtin: false, note: 'Gewicht geschätzt' }), 'Gewicht geschätzt');
  assert.equal(builtinNote({ builtin: true, note: 'Gewicht geschätzt' }), 'Weight estimated');
  const truck = PRESET_TRUCKS[0];
  assert.ok(!looksGerman(builtinNote(truck)), builtinNote(truck));
});

test('Anzeigetexte: Case-Zeilen, Reiter, Leiste, Ablageziel englisch', () => {
  const truss = mkCase('t1', 100, 50, 50, { kind: 'truss', truss: { length: 300, width: 29, count: 4 }, weight: 40 });
  for (const s of [caseLine(mkCase('c', 100, 50, 50, { weight: 30, stackable: false, layers: [1, 2] })),
    caseDetail(mkCase('c', 100, 50, 50, { weight: 30, stackable: false, layers: [2] })), caseLine(truss)]) {
    assert.ok(!looksGerman(s), s);
  }
  assert.deepEqual(CASE_TABS.map(x => x.label), ['Cases', 'Speakers', 'Truss', 'Scenic']);
  assert.ok(!looksGerman(sumText({ total: 3, weight: 1234, withoutWeight: 1, unassigned: 0, unassignedLines: [] })), 'sumText');
  assert.match(sumText({ total: 3, weight: 1234, withoutWeight: 0, unassigned: 0, unassignedLines: [] }), /Total 3 items · 1,234 kg/);
  const tabs = tabsHtml({ tabs: [{ id: 'a', label: 'A', count: 1, active: true }], canAdd: false, sum: { total: 1, weight: 0, withoutWeight: 0, unassigned: 0, unassignedLines: [] } });
  assert.ok(!looksGerman(sichtbar(tabs)), sichtbar(tabs));
  const stock = stockTargetHtml({ mode: 'choose', companies: ['Acme'], defaultCompany: '', collections: [] });
  assert.ok(!looksGerman(sichtbar(stock).replace('Acme', '')), sichtbar(stock));
  assert.match(stock, /My collection/);
});

test('fmtM/fmt2: Deutsch rundet wie das alte toFixed (Halbschritte), Englisch mit Punkt', () => {
  setLang('de');
  const alt = cm => `${(cm / 100).toFixed(2).replace('.', ',')} m`;
  for (const cm of [1.5, 4.5, 0.5, 2.5, 123, 1362, 100000.5]) assert.equal(fmtM(cm), alt(cm), String(cm));
  assert.equal(fmtM(1.5), '0,01 m');
  assert.equal(fmtM(4.5), '0,04 m');
  const truss = mkCase('t1', 100, 50, 50, { kind: 'truss', truss: { length: 4.5, width: 29, count: 4 }, weight: 40 });
  assert.match(caseLine(truss), /· 0,04 m ·/);
  setLang('en');
  assert.equal(fmtM(1.5), '0.01 m');
  assert.equal(fmtM(150), '1.50 m');
});
