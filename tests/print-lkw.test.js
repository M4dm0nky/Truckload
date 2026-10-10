import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildChecklist, buildUnloadList, buildLabels, printHTML,
  buildPrintAll, buildChecklistAll, buildUnloadListAll, buildLabelsAll,
} from '../js/ui/print.js';
import { validatePlan } from '../js/model/validate.js';
import { APP_VERSION } from '../js/version.js';
import { mkCase, mkTruck, P, plan, byId } from './fixtures.js';
import { singleFixture } from './print-fixture.js';

const BASE = JSON.parse(readFileSync(new URL('./baselines/print-single.json', import.meta.url), 'utf8'));
const norm = html => html.split(new Date().toLocaleDateString('de-DE')).join('{{DATE}}')
  .split(`Truckload V ${APP_VERSION}`).join('Truckload V {{VER}}');
const run = (fn, f) => { const root = { innerHTML: '' }; fn(root, f); return norm(root.innerHTML); };

// Baseline: Markup VOR der Mehr-LKW-Änderung (tests/baselines/print-single.json).
test('Ein-LKW-Pläne: Druckmarkup ist byte-identisch zum Stand vor Mehr-LKW', () => {
  const f = singleFixture();
  assert.equal(norm(printHTML(f)), BASE.plan);
  assert.equal(run(buildChecklist, f), BASE.checklist);
  assert.equal(run(buildUnloadList, f), BASE.unload);
  assert.equal(run(buildLabels, f), BASE.labels);
});

// Zwei LKW: je ein Abschnitt, Namen mit Sonderzeichen.
function twoLkw() {
  const c = mkCase('c1', 50, 50, 50, { name: 'Case <X>' });
  const caseById = byId(c);
  const mk = (name, truckName, ids) => {
    const truck = mkTruck({ name: truckName });
    const p = { ...plan(ids.map((id, i) => P(id, 'c1', i * 60, 0, 0, { label: `L-${id}` }))), name: 'Tour & Co' };
    return { lkw: { name }, plan: p, truck, result: validatePlan(p, caseById, truck) };
  };
  const sections = [mk('Ton <A>', 'Sattel "1"', ['a1', 'a2']), mk('Licht', 'Sprinter', ['b1'])];
  const fp = { ...plan([], [{ id: 'f1', caseId: 'c1', label: 'Frei <1>', color: '#123456' }]), name: 'Tour & Co' };
  return { sections, free: { plan: fp, caseById } };
}
const root = () => ({ innerHTML: '' });
const idx = (s, x) => { const i = s.indexOf(x); assert.ok(i >= 0, x); return i; };

test('alle LKW: Abhakliste hat je LKW einen Abschnitt in Reihenfolge, Umbruch ab dem zweiten', () => {
  const { sections, free } = twoLkw();
  const r = root(); buildChecklistAll(r, sections, { free });
  const h = r.innerHTML;
  assert.equal([...h.matchAll(/<section class="p-lkw/g)].length, 3);
  assert.equal([...h.matchAll(/p-lkw p-break/g)].length, 2);
  assert.ok(h.startsWith('<section class="p-lkw">'));
  assert.ok(idx(h, 'Ton &lt;A&gt;') < idx(h, 'Licht') && idx(h, 'Licht') < idx(h, 'Ohne LKW'));
  assert.match(h, /Sattel &quot;1&quot;/);
  assert.doesNotMatch(h, /<A>|Frei <1>/);
  assert.match(h, /Frei &lt;1&gt;/);
});

test('alle LKW: Ausladeliste kehrt je LKW um und trägt den Titel', () => {
  const { sections, free } = twoLkw();
  const r = root(); buildUnloadListAll(r, sections, { free });
  assert.ok(idx(r.innerHTML, 'L-a2') < idx(r.innerHTML, 'L-a1'));
  assert.equal([...r.innerHTML.matchAll(/Ausladeliste – /g)].length, 3);
});

test('alle LKW: ohne nicht zugeordnete Stücke gibt es keinen Abschnitt „Ohne LKW“', () => {
  const { sections } = twoLkw();
  const r = root(); buildChecklistAll(r, sections, { free: null });
  assert.doesNotMatch(r.innerHTML, /Ohne LKW/);
  assert.equal([...r.innerHTML.matchAll(/<section class="p-lkw/g)].length, 2);
  const r2 = root(); buildLabelsAll(r2, sections, { free: { plan: plan([], []), caseById: new Map() } });
  assert.doesNotMatch(r2.innerHTML, /Ohne LKW/);
});

test('alle LKW: Etiketten in einer Folge, Nummern je LKW, LKW-Name maskiert, Ohne LKW zuletzt', () => {
  const { sections, free } = twoLkw();
  const r = root(); buildLabelsAll(r, sections, { free });
  const h = r.innerHTML;
  assert.equal([...h.matchAll(/<div class="labels">/g)].length, 1);
  assert.doesNotMatch(h, /p-break/);
  assert.deepEqual([...h.matchAll(/class="seq">([^<]+)</g)].map(m => m[1]), ['1', '2', '1', '–']);
  assert.match(h, /<span class="lkw">Ton &lt;A&gt;<\/span> <span class="load">Tour &amp; Co<\/span>/);
  assert.match(h, /<span class="lkw">Licht<\/span>/);
  assert.ok(idx(h, 'L-b1') < idx(h, 'Frei &lt;1&gt;'));
  assert.match(h, /Ohne LKW/);
});

test('alle LKW: Ladeplan – Kopf nennt LKW und Fahrzeug, Ohne LKW ohne Zeichnung', () => {
  const { sections, free } = twoLkw();
  const head = printHTML(sections[0]);
  assert.match(head, /<h1>Tour &amp; Co – Ton &lt;A&gt;<\/h1>/);
  assert.match(head, /Sattel &quot;1&quot; · Innen/);
  // buildPrintAll zeichnet über `draw` (sonst renderView, braucht DOM): hier ein Zähler. Je Abschnitt
  // müssen beide Ansichten angefordert werden; renderView selbst läuft im Browser-Rundgang.
  const asked = [];
  const mkScope = i => ({ querySelector: sel => ({ sel, i }) });
  const draw = (svg, mode) => asked.push(`${svg.i}:${svg.sel}:${mode}`);
  const r = { innerHTML: '', querySelectorAll: () => [mkScope(0), mkScope(1), mkScope(2)] };
  buildPrintAll(r, sections, { free, draw });
  assert.deepEqual(asked, ['0:.p-top:top', '0:.p-side:side', '1:.p-top:top', '1:.p-side:side']);
  assert.equal([...r.innerHTML.matchAll(/<section class="p-lkw/g)].length, 3);
  assert.equal([...r.innerHTML.matchAll(/<svg class="p-top">/g)].length, 2);
  assert.match(r.innerHTML, /Ohne LKW/);
});

test('Ohne LKW: Stück ohne Beschriftung und Farbe fällt auf Case-Name und Case-Farbe zurück', () => {
  const c = mkCase('c1', 50, 50, 50, { name: 'Rack <Z>', color: '#aa0000' });
  const fp = { ...plan([], [{ id: 'f1', caseId: 'c1' }]), name: 'T' };
  const free = { plan: fp, caseById: byId(c) };
  const r = root(); buildChecklistAll(r, [], { free });
  assert.match(r.innerHTML, /<span class="label">Rack &lt;Z&gt; <small>\(Rack &lt;Z&gt;\)<\/small>/);
  assert.match(r.innerHTML, /background:#aa0000/);
  assert.doesNotMatch(r.innerHTML, /undefined/);
  const r2 = root(); buildLabelsAll(r2, [], { free });
  assert.match(r2.innerHTML, /<span class="name">Rack &lt;Z&gt;<\/span>/);
  assert.match(r2.innerHTML, /background:#aa0000/);
  assert.doesNotMatch(r2.innerHTML, /undefined/);
});
