import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklist, buildLabels, printHTML, pageRuleFor } from '../js/ui/print.js';
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
  assert.match(html, new RegExp(`Truckload V ${APP_VERSION.replaceAll('.', '\\.')}`));
  for (const cell of ['1', 'Stück 1', 'Case A', 'Inhalt A']) assert.ok(html.includes(`<td>${cell}</td>`), `Tabellenzelle ${cell}`);
  assert.match(html, /<figcaption>Draufsicht \(Stirnwand links\)<\/figcaption>/);
  assert.match(html, /<svg class="p-top"><\/svg>/);
});

// Schlussprüfung des Branches, Befund 3: Die Abhakliste speiste sich nur aus result.items,
// also aus plan.placements. Stücke in „Noch nicht geladen“ fehlten vollständig, und der Kopf
// zählte sie nicht mit. Ein Lader hakt dann die Liste vollständig ab, während Cases in der
// Halle stehen bleiben — genau das Missgeschick, das die Abhakliste verhindern soll.
test('Abhakliste nennt Stücke, die nicht geladen wurden', () => {
  const c = mkCase('c1', 50, 50, 50);
  const p = plan([P('p1', 'c1', 0, 0, 0)], [{ id: 'u1', caseId: 'c1' }, { id: 'u2', caseId: 'c1' }]);
  const truck = mkTruck();
  const result = validatePlan(p, byId(c), truck);
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.match(root.innerHTML, /2 Stück nicht geladen/);
});

test('Abhakliste ohne unplaced erwähnt nichts von „nicht geladen“', () => {
  const c = mkCase('c1', 50, 50, 50);
  const p = plan([P('p1', 'c1', 0, 0, 0)]);
  const truck = mkTruck();
  const result = validatePlan(p, byId(c), truck);
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.doesNotMatch(root.innerHTML, /nicht geladen/);
});

// Schlussprüfung, Befund 3 (zweiter Teil): buildPrint druckt result.issues als „Achtung“-Block,
// buildChecklist ließ sie weg. Eine Überlast- oder Lagen-Warnung darf auf dem Blatt für die
// Rampe nicht fehlen.
test('Abhakliste druckt Warnungen aus result.issues', () => {
  const c = mkCase('c1', 50, 50, 50);
  // Zwei Cases auf demselben Platz → Kollision, also ein Issue.
  const p = plan([P('p1', 'c1', 0, 0, 0), P('p2', 'c1', 10, 0, 0)]);
  const truck = mkTruck();
  const result = validatePlan(p, byId(c), truck);
  assert.ok(result.issues.length > 0, 'Vorbedingung: der Testaufbau muss eine Warnung erzeugen');
  const root = FAKE_ROOT();
  buildChecklist(root, { plan: p, truck, result });
  assert.match(root.innerHTML, /Achtung/);
});

// Schlussprüfung, Befund 4: „n von m“ stand mit dem Plannamen in EINEM Element mit
// text-overflow: ellipsis. Ein langer Planname schnitt damit genau die Angabe weg, die das
// Etikett laut README zeigt. Beide stehen jetzt in eigenen Elementen; gekürzt wird nur der Name.
test('Etikett: „n von m“ steht in einem eigenen Element, nicht hinter dem Plannamen', () => {
  const c = mkCase('c1', 50, 50, 50);
  const p = plan([P('p1', 'c1', 0, 0, 0), P('p2', 'c1', 150, 0, 0)]);
  p.name = 'Rock am Ring 2026 – Hauptbühne – Rückbau LKW 2';
  const truck = mkTruck();
  const result = validatePlan(p, byId(c), truck);
  const root = FAKE_ROOT();
  buildLabels(root, { plan: p, truck, result });
  assert.match(root.innerHTML, /class="count">1 von 2</);
  assert.match(root.innerHTML, /class="count">2 von 2</);
});

// Etiketten müssen auf A4 HOCH und randlos, damit sie auf Avery-Bögen passen; Ladeplan und
// Abhakliste bleiben A4 quer. Benannte Seiten (@page x { … } + page:) werden von Browsern
// uneinheitlich unterstützt, deshalb hängt js/app.js die Regel vor dem Druck ein und nimmt sie
// danach wieder weg. Bleibt sie stehen, druckt der nächste Ladeplan im Hochformat.
test('pageRuleFor: nur Etiketten brauchen eine eigene Seitenvorschrift', () => {
  assert.equal(pageRuleFor('plan'), null);
  assert.equal(pageRuleFor('checklist'), null);
  assert.match(pageRuleFor('labels'), /@page\s*\{[^}]*A4 portrait/);
  assert.match(pageRuleFor('labels'), /margin:\s*0/);
});
