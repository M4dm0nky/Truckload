import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklist, buildLabels, printHTML } from '../js/ui/print.js';
import { validatePlan } from '../js/model/validate.js';
import { APP_VERSION } from '../js/version.js';
import { mkCase, mkTruck, P, plan, byId } from './fixtures.js';

const FAKE_ROOT = () => ({ innerHTML: '' });

function buildResult({ cases = [], placements = [] } = {}) {
  const truck = mkTruck();
  const p = plan(placements);
  return { truck, plan: p, result: validatePlan(p, byId(...cases), truck) };
}

test('Abhakliste: Ladereihenfolge folgt result.sequence, nicht result.items', () => {
  const c = mkCase('c1', 50, 50, 50);
  const placements = [
    P('p3', 'c1', 300, 0, 0),
    P('p1', 'c1', 0, 0, 0),
    P('p2', 'c1', 150, 0, 0),
  ];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  const nums = [...root.innerHTML.matchAll(/class="num">(\d+)</g)].map(m => Number(m[1]));
  assert.deepEqual(nums, [1, 2, 3]);
});

test('Abhakliste: Beschriftung, Plan- und Fahrzeugname werden maskiert', () => {
  const c = mkCase('c1', 50, 50, 50, { name: '<b>Böse & Co</b>' });
  const placements = [P('p1', 'c1', 0, 0, 0, { label: '<b>Böse & Co</b>' })];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  p.name = '<b>Böse & Co</b>';
  truck.name = '<b>Böse & Co</b>';
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.ok(!root.innerHTML.includes('<b>Böse & Co</b>'));
  assert.ok((root.innerHTML.match(/&lt;b&gt;Böse &amp; Co&lt;\/b&gt;/g) ?? []).length >= 3);
});

test('Abhakliste: eine ungültige Farbe wandert nicht unverändert ins style-Attribut', () => {
  const c = mkCase('c1', 50, 50, 50, { color: 'red;position:fixed' });
  const placements = [P('p1', 'c1', 0, 0, 0)];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.ok(!root.innerHTML.includes('red;position:fixed'));
  assert.ok(root.innerHTML.includes('background:#888'));
});

test('Abhakliste: Vollzähligkeit bei 17 Stücken', () => {
  const c = mkCase('c1', 20, 20, 20);
  const placements = Array.from({ length: 17 }, (_, i) => P(`p${i}`, 'c1', i * 20, 0, 0));
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.equal((root.innerHTML.match(/class="tick"/g) ?? []).length, 17);
  assert.ok(root.innerHTML.includes('17 Cases'));
});

test('Abhakliste: Kopf nennt Plan, Fahrzeug, Gewicht und Version', () => {
  const c = mkCase('c1', 50, 50, 50, { weight: 42 });
  const placements = [P('p1', 'c1', 0, 0, 0)];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.ok(root.innerHTML.includes(`Truckload V ${APP_VERSION}`));
  assert.ok(root.innerHTML.includes('42'));
});

test('Abhakliste: Unterschriftszeile vorhanden, keine Eingabefelder', () => {
  const c = mkCase('c1', 50, 50, 50);
  const placements = [P('p1', 'c1', 0, 0, 0)];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.ok(root.innerHTML.includes('Geladen von'));
  assert.ok(root.innerHTML.includes('Datum'));
  assert.ok(!root.innerHTML.includes('<input'));
  assert.ok(!root.innerHTML.includes('type="checkbox"'));
});

test('Etiketten: Reihenfolge und Vollzähligkeit bei 17 Stücken', () => {
  const c = mkCase('c1', 20, 20, 20);
  const placements = Array.from({ length: 17 }, (_, i) => P(`p${i}`, 'c1', i * 20, 0, 0));
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildLabels(root, { plan: p, truck, result });
  const nums = [...root.innerHTML.matchAll(/class="seq">(\d+)</g)].map(m => Number(m[1]));
  assert.deepEqual(nums, Array.from({ length: 17 }, (_, i) => i + 1));
});

test('Etiketten: „n von m“ folgt der Ladereihenfolge, nicht result.items', () => {
  const c = mkCase('c1', 50, 50, 50);
  const placements = [
    P('p3', 'c1', 300, 0, 0),
    P('p1', 'c1', 0, 0, 0),
    P('p2', 'c1', 150, 0, 0),
  ];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildLabels(root, { plan: p, truck, result });
  assert.ok(root.innerHTML.includes('3 von 3'));
});

test('Etiketten: Beschriftung und Planname werden maskiert', () => {
  const c = mkCase('c1', 50, 50, 50, { name: '<b>Böse & Co</b>' });
  const placements = [P('p1', 'c1', 0, 0, 0, { label: '<b>Böse & Co</b>' })];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  p.name = '<b>Böse & Co</b>';
  const root = FAKE_ROOT();
  buildLabels(root, { plan: p, truck, result });
  assert.ok(!root.innerHTML.includes('<b>Böse & Co</b>'));
  assert.ok((root.innerHTML.match(/&lt;b&gt;Böse &amp; Co&lt;\/b&gt;/g) ?? []).length >= 2);
});

test('Etiketten: eine ungültige Farbe wandert nicht unverändert ins style-Attribut', () => {
  const c = mkCase('c1', 50, 50, 50, { color: 'red;position:fixed' });
  const placements = [P('p1', 'c1', 0, 0, 0)];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildLabels(root, { plan: p, truck, result });
  assert.ok(!root.innerHTML.includes('red;position:fixed'));
  assert.ok(root.innerHTML.includes('background:#888'));
});

test('Etiketten: ein einziges Stück zeigt „1 von 1“', () => {
  const c = mkCase('c1', 50, 50, 50);
  const placements = [P('p1', 'c1', 0, 0, 0)];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const root = FAKE_ROOT();
  buildLabels(root, { plan: p, truck, result });
  assert.ok(root.innerHTML.includes('1 von 1'));
});

// Regression: der gemeinsame Kopf-Baustein darf die bestehende Ausgabe von buildPrint nicht
// verändern (Task-3-Brief, „Was NICHT angefasst wird“).
test('buildPrint-Regression: Kopfzeile und Tabelle bleiben wortgleich', () => {
  const c = mkCase('c1', 50, 50, 50, { name: 'Case A', content: 'Inhalt A', weight: 10 });
  const placements = [P('p1', 'c1', 0, 0, 0, { label: 'Stück 1' })];
  const { truck, plan: p, result } = buildResult({ cases: [c], placements });
  const html = printHTML({ plan: p, truck, result });
  assert.match(html, /<h1>Test<\/h1>/);
  assert.match(html, /Innen 1360×248×270 cm/);
  assert.match(html, /10 \/ 24.000 kg/);
  assert.match(html, new RegExp(`Truckload V ${APP_VERSION.replace('.', '\\.')}`));
  assert.match(html, /<td>1<\/td><td>Stück 1<\/td><td>Case A<\/td><td>Inhalt A<\/td>/);
  assert.match(html, /<figure><figcaption>Draufsicht \(Stirnwand links\)<\/figcaption><svg class="p-top"><\/svg><\/figure>/);
});
