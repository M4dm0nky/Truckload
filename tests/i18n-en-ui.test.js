// Englische Texte der Editoren, des Materials und des Inspectors (#42, Task 6).
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLang, builtinNote, trade } from '../js/i18n/i18n.js';
import EN from '../js/i18n/en.js';
import { looksGerman } from './i18n-scan.js';
import { renderInspector, orientationText } from '../js/ui/inspector.js';
import { categoryOptionsHtml } from '../js/ui/case-editor.js';
import { caseLine, caseDetail, fmtNum } from '../js/ui/caseInfo.js';
import { CASE_TABS } from '../js/ui/caseGroups.js';
import { fmtM, ORIENTATION_LABEL } from '../js/ui/dom.js';
import { sumText, tabsHtml } from '../js/ui/lkw-tabs.js';
import { stockTargetHtml } from '../js/ui/stock-target.js';
import { validatePlan } from '../js/model/validate.js';
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

test('builtinNote: mitgeliefertes Case englisch (eigener Eintrag), Nutzernotiz unverändert', () => {
  EN['Gewicht geschätzt: Testwert'] = 'Weight estimated: test value';
  try {
    assert.equal(builtinNote({ builtin: true, note: 'Gewicht geschätzt: Testwert' }), 'Weight estimated: test value');
    assert.equal(builtinNote({ builtin: false, note: 'Gewicht geschätzt: Testwert' }), 'Gewicht geschätzt: Testwert');
    setLang('de');
    assert.equal(builtinNote({ builtin: true, note: 'Gewicht geschätzt: Testwert' }), 'Gewicht geschätzt: Testwert');
  } finally { delete EN['Gewicht geschätzt: Testwert']; }
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

// ---- Task 7: Druck, Pack-Regeln, Assistenten ----------------------------------------------
import { printHTML, buildChecklist, buildUnloadList, buildLabels, buildPrintAll, buildChecklistAll, buildLabelsAll } from '../js/ui/print.js';
import { setOptions } from '../js/ui/pack-rules.js';
import { searchInOptionsHtml, companyFilterAfterChange } from '../js/ui/wizard-items.js';
import { originText, lengthButtons, profileHitsHtml, punkteLabel, profileOriginLine } from '../js/ui/truss-wizard.js';
import { singleFixture } from './print-fixture.js';

// Nutzerdaten (Plan-, Case-, Fahrzeugnamen, Beschriftungen) entfernen; übrig bleibt der eigene Text.
const ohneDaten = html => sichtbar(html)
  .replace(/Rack &lt;A&gt;|Rack &lt;1&gt;|Show &lt;b&gt;&amp;&lt;\/b&gt; Tour|Sprinter &quot;XL&quot;|Kabel &amp; Co|Zwei|Drei|Offen|Case c2|Case c1|c1|c2/g, ' ');
const wurzel = () => ({ innerHTML: '', querySelectorAll: () => [{ querySelector: () => null }], querySelector: () => null });
const heute = new Date().toLocaleDateString('en-GB');

test('Druck englisch: Ladeplan ohne deutschen Rest, Datum und Zahlen im britischen Format', () => {
  const { plan: p, truck, result } = singleFixture();
  const html = printHTML({ plan: p, truck, result });
  const text = ohneDaten(html);
  assert.ok(!looksGerman(text), text.replace(/\s+/g, ' '));
  assert.ok(html.includes(heute), `Datum ${heute}`);
  assert.match(html, /Inside \d+×\d+×\d+ cm/);
  assert.match(html, /loading metres/);
  assert.match(html, /Top view \(front wall on the left\)/);
  assert.match(html, /<th>Layer<\/th>/);
  assert.match(html, /without a weight/);
});

test('Druck englisch: Abhak-, Ausladeliste und Etiketten ohne deutschen Rest', () => {
  const { plan: p, truck, result } = singleFixture();
  for (const build of [buildChecklist, buildUnloadList]) {
    const root = wurzel();
    build(root, { plan: p, truck, result });
    const text = ohneDaten(root.innerHTML);
    assert.ok(!looksGerman(text), text.replace(/\s+/g, ' '));
    assert.ok(root.innerHTML.includes(heute));
    assert.match(root.innerHTML, /1 item not loaded/);
  }
  const root = wurzel();
  buildUnloadList(root, { plan: p, truck, result });
  assert.match(root.innerHTML, /Unloading list – /);
  assert.match(root.innerHTML, /Unloaded by/);
  const lab = wurzel();
  buildLabels(lab, { plan: p, result });
  assert.match(lab.innerHTML, /1 of 3/);
});

test('Druck englisch: alle LKW inkl. „Ohne LKW“-Abschnitt', () => {
  const { plan: p, truck, result } = singleFixture();
  const free = { plan: { name: 'Plan', unplaced: [{ caseId: 'zzz' }, { caseId: 'c1', label: 'Offen' }] }, caseById: new Map([['c1', { name: 'c1', color: '#fff' }]]) };
  const sections = [{ lkw: { name: 'LKW 1' }, plan: p, truck, result }];
  const root = wurzel();
  buildChecklistAll(root, sections, { free });
  assert.ok(!looksGerman(ohneDaten(root.innerHTML).replace(/LKW 1|Plan/g, ' ')), ohneDaten(root.innerHTML));
  assert.match(root.innerHTML, /2 items without a truck/);
  assert.match(root.innerHTML, /unknown case/);
  assert.match(root.innerHTML, /not loaded/);
  const lab = wurzel();
  buildLabelsAll(lab, sections, { free });
  assert.match(lab.innerHTML, /No truck/);
  const all = wurzel();
  buildPrintAll(all, sections, { free, draw: () => {} });
  assert.ok(!looksGerman(ohneDaten(all.innerHTML).replace(/LKW 1|Plan/g, ' ')));
});

test('Pack-Regeln, Suchen-in, Traversen-Dialog: englische Bausteine', () => {
  const opts = setOptions([{ id: 'a', name: 'Set A' }], [{ id: 'b', name: 'Set B' }]);
  assert.match(opts, /label="Project"/);
  assert.match(opts, /label="Library"/);
  const so = searchInOptionsHtml([], '');
  assert.ok(so.includes('Whole stock') && so.includes('Default catalogue'));
  assert.equal(companyFilterAfterChange('weg', []).hinweis, 'Collection no longer exists – filter reset.');
  assert.equal(originText('berechnet'), 'calculated from weight per metre');
  assert.equal(originText('hersteller'), 'Manufacturer’s figure');
  assert.equal(punkteLabel(3), '3-point');
  assert.match(profileHitsHtml([]), /No profile found/);
  const [b1, b2] = lengthButtons({ lengths: [{ cm: 350, kg: 23.5, art: 'hersteller' }, { cm: 100, kg: 0, art: 'berechnet' }] });
  assert.equal(b1.label, '3.5 m · 23.5 kg');
  assert.equal(b2.label, '1 m · Weight unknown');
  assert.equal(profileOriginLine({ lengths: [{ cm: 350, kg: 1, art: 'hersteller' }] }, 350), 'Weight: Manufacturer’s figure');
  setLang('de');
  assert.equal(lengthButtons({ lengths: [{ cm: 350, kg: 23.5, art: 'hersteller' }] })[0].label, '3,5 m · 23,5 kg');
});
