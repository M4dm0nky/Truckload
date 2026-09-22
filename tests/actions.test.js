import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/model/actions.js';
import { validatePlan } from '../js/model/validate.js';
import { wheelFace, DOOR_FACE, MAX_LABEL } from '../js/model/geometry.js';
import { mkCase, mkTruck, P, plan, byId, counter } from './fixtures.js';

const K = mkCase('k', 120, 60, 60);
const T = mkCase('t', 120, 60, 100, { tippable: true });
const ctx = () => ({ caseById: byId(K, T), truck: mkTruck(), newId: counter('n') });
const find = (pl, id) => pl.placements.find(p => p.id === id);

test('placeCase stapelt per Schwerkraft', () => {
  const pl = A.placeCase(plan([P('a','k',0,0,0)]), 'k', 12, 0, ctx());
  const p = pl.placements.at(-1);
  assert.equal(p.x, 10);
  assert.equal(p.z, 60);
});
test('placeCase aus der Ablage entfernt das Stück dort', () => {
  const pl = A.placeCase(plan([], [{ id: 'u1', caseId: 'k' }]), 'k', 0, 0, ctx(), 'u1');
  assert.equal(pl.unplaced.length, 0);
  assert.equal(pl.placements[0].id, 'u1');
});
test('moveGroup nimmt den Stapel mit', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0), P('b','k',0,0,60)]), 'a', 300, 100, ctx());
  assert.deepEqual([find(pl,'b').x, find(pl,'b').y, find(pl,'b').z], [300, 100, 60]);
});
// Der Test oben bewegt einen Stapel innerhalb derselben z-Ebene (Wurzel und Ziel beide bei z 0)
// — ddz ist dort immer 0, ein fest verdrahtetes nz = 0 bliebe unbemerkt
// (docs/code-review-2026-09-21.md, „moveGroup nimmt den Stapel mit deckt den Schwerkraftanteil
// nicht ab"). Dieser Test schiebt den Stapel auf einen bereits 2-hohen Stapel und prüft, dass
// er per Schwerkraft obendrauf landet.
test('moveGroup zieht den Schwerkraftanteil: Stapel landet auf einem anderen Stapel', () => {
  const pl = plan([
    P('a','k',0,0,0),
    P('base1','k',300,0,0), P('base2','k',300,0,60),
  ]);
  const moved = A.moveGroup(pl, 'a', 300, 0, ctx(), { grid: 1, edges: false });
  assert.equal(find(moved,'a').z, 120);
});
test('moveGroup rastet an Kanten', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0), P('b','k',500,0,0)]), 'b', 123, 0, ctx());
  assert.equal(find(pl,'b').x, 120);
});
test('moveGroup ohne Raster (Pfeiltasten mit Shift)', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0)]), 'a', 1, 0, ctx(), { grid: 1, edges: false });
  assert.equal(find(pl,'a').x, 1);
});
test('rotate dreht um 90°', () => {
  const pl = A.rotate(plan([P('a','k',0,0,0)]), 'a', ctx());
  assert.equal(find(pl,'a').rot, 90);
});
test('cycleTip nur bei tippbaren Cases', () => {
  assert.equal(find(A.cycleTip(plan([P('a','k',0,0,0)]), 'a', ctx()), 'a').orientation, 'standing');
  assert.equal(find(A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx()), 'a').orientation, 'tipLong');
});
test('cycleTip lässt Traversenwagen unverändert (auch bei fälschlich tippable:true)', () => {
  const truss = mkCase('trs', 300, 60, 80, { kind: 'truss', tippable: true });
  const trussCtx = { caseById: byId(K, T, truss), truck: mkTruck(), newId: counter('n') };
  assert.equal(find(A.cycleTip(plan([P('a','trs',0,0,0)]), 'a', trussCtx), 'a').orientation, 'standing');
});
test('cycleTip auf ein tippbares Case: Rollen zeigen zur Trucktür', () => {
  const pl = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
  const p = find(pl, 'a');
  assert.notEqual(p.orientation, 'standing');
  assert.equal(wheelFace(p), DOOR_FACE);
});
test('cycleTip: auch der zweite Tipp (tipLong → tipShort) zeigt wieder zur Trucktür', () => {
  const once = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
  assert.equal(find(once, 'a').orientation, 'tipLong');
  const twice = A.cycleTip(once, 'a', ctx());
  assert.equal(find(twice, 'a').orientation, 'tipShort');
  assert.equal(wheelFace(find(twice, 'a')), DOOR_FACE);
});
test('setWheelFace dreht die Rollen eines getippten Cases in die gewünschte Richtung', () => {
  const tipped = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
  const pl = A.setWheelFace(tipped, 'a', '-y', ctx());
  assert.equal(wheelFace(find(pl, 'a')), '-y');
});
test('setWheelFace: unerreichbare Richtung (stehend, Rollen unten) ändert nichts', () => {
  const pl = A.setWheelFace(plan([P('a','k',0,0,0)]), 'a', '+y', ctx());
  assert.deepEqual(find(pl, 'a'), P('a','k',0,0,0));
});
test('toTray und addUnplaced', () => {
  let pl = A.toTray(plan([P('a','k',0,0,0)]), 'a');
  assert.deepEqual(pl.unplaced, [{ id: 'a', caseId: 'k' }]);
  pl = A.addUnplaced(pl, 'k', 3, counter('u'));
  assert.equal(pl.unplaced.length, 4);
  pl = A.removeUnplaced(pl, 'k');
  assert.equal(pl.unplaced.length, 3);
});
test('addUnplaced übernimmt Labels und Farbe', () => {
  const pl = A.addUnplaced(plan([]), 'k', 3, counter('u'), { labels: ['A', 'B', 'C'], color: '#ff0000' });
  assert.deepEqual(pl.unplaced.map(u => u.label), ['A', 'B', 'C']);
  assert.deepEqual(pl.unplaced.map(u => u.color), ['#ff0000', '#ff0000', '#ff0000']);
});
test('addUnplaced ohne Optionen bleibt abwärtskompatibel', () => {
  const pl = A.addUnplaced(plan([]), 'k', 2, counter('u'));
  assert.deepEqual(pl.unplaced, [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 'k' }]);
});
test('addUnplaced kürzt ein zu langes Label auf MAX_LABEL (Befund B4)', () => {
  const long = 'X'.repeat(MAX_LABEL + 20);
  const pl = A.addUnplaced(plan([]), 'k', 1, counter('u'), { labels: [long] });
  assert.equal(pl.unplaced[0].label.length, MAX_LABEL);
  assert.equal(pl.unplaced[0].label, long.slice(0, MAX_LABEL));
});
test('duplicate setzt daneben', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0)]), 'a', ctx());
  assert.equal(pl.placements[1].x, 120);
});
test('duplicate kopiert Label/Farbe und zählt hoch', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label: 'Kabelcase 3', color: '#00ff00' })]), 'a', ctx());
  assert.equal(pl.placements[1].label, 'Kabelcase 4');
  assert.equal(pl.placements[1].color, '#00ff00');
});
test('duplicate ohne Zahl am Ende hängt keine Nummer an', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label: 'Kabelcase' })]), 'a', ctx());
  assert.equal(pl.placements[1].label, 'Kabelcase');
});
test('duplicate kürzt eine über MAX_LABEL hinaus hochgezählte Nummer (Befund B4, Fix-Runde 1)', () => {
  // 40 Zeichen, endet auf "9" -> hochgezählt "10" wäre 41 Zeichen ohne Kürzung.
  const label = `${'X'.repeat(MAX_LABEL - 1)}9`;
  assert.equal(label.length, MAX_LABEL);
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label })]), 'a', ctx());
  assert.ok(pl.placements[1].label.length <= MAX_LABEL, `Label ist ${pl.placements[1].label.length} Zeichen lang`);
  // "X"*39 + "9" -> hochgezählt "X"*39 + "10" (41 Zeichen) -> gekürzt auf 40: die "0" fällt weg.
  assert.equal(pl.placements[1].label, `${'X'.repeat(MAX_LABEL - 1)}1`);
});
test('duplicate kürzt auch ein zu langes Label ohne Zahl am Ende', () => {
  const label = 'Y'.repeat(MAX_LABEL + 10);
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label })]), 'a', ctx());
  assert.equal(pl.placements[1].label.length, MAX_LABEL);
});
test('setItemLabel ändert eine Platzierung', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0)]), 'a', { label: 'Neu', color: '#123456' });
  assert.equal(pl.placements[0].label, 'Neu');
  assert.equal(pl.placements[0].color, '#123456');
});
test('setItemLabel trifft auch Ablage-Einträge', () => {
  const pl = A.setItemLabel(plan([], [{ id: 'u1', caseId: 'k' }]), 'u1', { label: 'Ablage', color: '#abcdef' });
  assert.equal(pl.unplaced[0].label, 'Ablage');
  assert.equal(pl.unplaced[0].color, '#abcdef');
});
test('setItemLabel: nur Label ändern lässt die Farbe stehen', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { label: 'Neu' });
  assert.equal(pl.placements[0].label, 'Neu');
  assert.equal(pl.placements[0].color, '#123456');
});
test('setItemLabel: nur Farbe ändern lässt das Label stehen', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { color: '#abcdef' });
  assert.equal(pl.placements[0].label, 'Alt');
  assert.equal(pl.placements[0].color, '#abcdef');
});
test('setItemLabel: color null entfernt die Farbe', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { color: null });
  assert.equal(pl.placements[0].label, 'Alt');
  assert.equal(pl.placements[0].color, undefined);
  assert.ok(!('color' in pl.placements[0]));
});
test('setItemLabel: label "" entfernt die Beschriftung', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { label: '' });
  assert.equal(pl.placements[0].label, undefined);
  assert.ok(!('label' in pl.placements[0]));
  assert.equal(pl.placements[0].color, '#123456');
});
test('setItemLabel kürzt ein zu langes Label auf MAX_LABEL (Befund B4)', () => {
  const long = 'Z'.repeat(MAX_LABEL + 15);
  const pl = A.setItemLabel(plan([P('a','k',0,0,0)]), 'a', { label: long });
  assert.equal(pl.placements[0].label.length, MAX_LABEL);
  assert.equal(pl.placements[0].label, long.slice(0, MAX_LABEL));
});
test('setItemLabel kürzt auch bei einem Ablage-Eintrag', () => {
  const long = 'Z'.repeat(MAX_LABEL + 5);
  const pl = A.setItemLabel(plan([], [{ id: 'u1', caseId: 'k' }]), 'u1', { label: long });
  assert.equal(pl.unplaced[0].label.length, MAX_LABEL);
});
test('packAll verlädt alles', () => {
  const pl = A.packAll(plan([P('a','k',700,0,0)], [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 't' }]), ctx());
  assert.equal(pl.placements.length, 3);
  assert.equal(pl.unplaced.length, 0);
});
test('packRest lässt Bestehendes stehen und kollidiert nicht', () => {
  const c = ctx();
  const pl = A.packRest(plan([P('a','k',0,0,0)], [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 'k' }]), c);
  assert.deepEqual(find(pl,'a'), P('a','k',0,0,0));
  assert.equal(pl.placements.length, 3);
  const r = validatePlan(pl, c.caseById, c.truck);
  assert.ok(!r.issues.some(i => i.code === 'collision'));
});
test('Regression: Labels und Farben überleben packAll', () => {
  const pl0 = plan(
    [P('a', 'k', 700, 0, 0, { label: 'A', color: '#111111' })],
    [{ id: 'u1', caseId: 'k', label: 'B', color: '#222222' }],
  );
  const pl = A.packAll(pl0, ctx());
  assert.equal(find(pl, 'a').label, 'A');
  assert.equal(find(pl, 'a').color, '#111111');
  assert.equal(find(pl, 'u1').label, 'B');
  assert.equal(find(pl, 'u1').color, '#222222');
});
test('Regression: Labels und Farben überleben packRest, Bestehendes bleibt unverändert', () => {
  const pl0 = plan(
    [P('a', 'k', 0, 0, 0, { label: 'A', color: '#111111' })],
    [{ id: 'u1', caseId: 'k', label: 'B', color: '#222222' }],
  );
  const pl = A.packRest(pl0, ctx());
  assert.deepEqual(find(pl, 'a'), P('a', 'k', 0, 0, 0, { label: 'A', color: '#111111' }));
  assert.equal(find(pl, 'u1').label, 'B');
  assert.equal(find(pl, 'u1').color, '#222222');
});
test('Regression: „Alles neu packen“ vergibt keine neuen Stück-IDs mehr', () => {
  const pl0 = plan([P('a', 'k', 700, 0, 0)], [{ id: 'u1', caseId: 'k' }]);
  const pl = A.packAll(pl0, ctx());
  assert.ok(find(pl, 'a'));
  assert.ok(find(pl, 'u1'));
});

// Fix-Runde 1, [important]: ein Placement mit gelöschtem Case-Typ hat keine bekannten Maße
// (Placements speichern nur x/y/z, keine l/w/h) und kann deshalb nicht als Box-Hindernis in
// autoPack einfließen. Damit ein frisch gepacktes Case nicht unsichtbar in die alte Position
// des Waisen-Placements hineingepackt wird, nimmt packAll es sichtbar aus den Placements
// heraus und legt es in die Ablage (unplaced) – der Nutzer sieht es dort und kann reagieren,
// statt dass zwei Cases im selben Raum stehen, ohne dass irgendetwas das meldet.
// `touch()` ist die einzige Stelle, an der ein Plan seinen `updatedAt`-Zeitstempel bekommt;
// `io.mergeById` entscheidet damit beim Import, welcher Stand der neuere ist. Ein `touch`, das
// `updatedAt` vergisst, führt zu stillem Datenverlust beim Zusammenführen — kein bestehender
// Test hätte das je bemerkt (docs/code-review-2026-09-21.md, „actions.test.js prüft updatedAt
// nirgends"). Ausgangspunkt ist immer ein fest in der Vergangenheit liegendes `updatedAt`, damit
// der Vergleich nicht von der Auflösung von `Date.now()` abhängt (kein Race bei sehr schneller
// Ausführung im selben Millisekunden-Fenster).
const OLD = '2000-01-01T00:00:00.000Z';
const withOld = pl => ({ ...pl, updatedAt: OLD });
const newerThanOld = result =>
  assert.ok(new Date(result.updatedAt).getTime() > new Date(OLD).getTime(),
    `updatedAt (${result.updatedAt}) sollte neuer sein als ${OLD}`);

const touchCases = [
  ['emptyPlan', () => A.emptyPlan('p', 'P', 't')],
  ['placeCase', () => A.placeCase(withOld(plan([P('a','k',0,0,0)])), 'k', 400, 0, ctx())],
  ['moveGroup', () => A.moveGroup(withOld(plan([P('a','k',0,0,0)])), 'a', 300, 100, ctx())],
  ['rotate', () => A.rotate(withOld(plan([P('a','k',0,0,0)])), 'a', ctx())],
  ['cycleTip', () => A.cycleTip(withOld(plan([P('a','t',0,0,0)])), 'a', ctx())],
  ['setWheelFace', () => {
    const tipped = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
    return A.setWheelFace(withOld(tipped), 'a', '-y', ctx());
  }],
  ['addUnplaced', () => A.addUnplaced(withOld(plan([])), 'k', 1, counter('u'))],
  ['removeUnplaced', () => A.removeUnplaced(withOld(plan([], [{ id: 'u1', caseId: 'k' }])), 'k')],
  ['duplicate', () => A.duplicate(withOld(plan([P('a','k',0,0,0)])), 'a', ctx())],
  ['setItemLabel', () => A.setItemLabel(withOld(plan([P('a','k',0,0,0)])), 'a', { label: 'Neu' })],
  ['removePlacement', () => A.removePlacement(withOld(plan([P('a','k',0,0,0)])), 'a')],
  ['toTray', () => A.toTray(withOld(plan([P('a','k',0,0,0)])), 'a')],
  ['packAll', () => A.packAll(withOld(plan([P('a','k',700,0,0)])), ctx())],
  ['packRest', () => A.packRest(withOld(plan([P('a','k',0,0,0)], [{ id: 'u1', caseId: 'k' }])), ctx())],
];
for (const [name, run] of touchCases) {
  test(`${name} setzt updatedAt neuer als die Eingabe (touch()-Regression)`, () => newerThanOld(run()));
}

test('packAll nimmt ein Placement mit gelöschtem Case-Typ aus den Placements heraus und legt es in die Ablage', () => {
  const pl0 = plan([
    P('ghost', 'weg', 0, 0, 0, { label: 'Geistercase' }),
    P('a', 'k', 700, 0, 0),
  ]);
  const pl = A.packAll(pl0, ctx());
  assert.ok(!find(pl, 'ghost'), 'die Waise steht nicht mehr in den Placements');
  const inTray = pl.unplaced.find(u => u.id === 'ghost');
  assert.ok(inTray, 'die Waise landet in der Ablage statt an ihrer alten Position stehen zu bleiben');
  assert.equal(inTray.caseId, 'weg');
  assert.equal(inTray.label, 'Geistercase');
  // Das frisch gepackte Case darf jetzt am Platz der ehemaligen Waise landen, ohne dass
  // irgendwo eine Kollision übersehen wird (die Waise ist ja aus den Placements raus).
  assert.equal(pl.placements.length, 1);
});
test('packRest nimmt ein bereits platziertes Waisen-Placement ebenfalls aus den Placements heraus', () => {
  const c = ctx();
  const pl0 = plan(
    [P('ghost', 'weg', 0, 0, 0, { label: 'Geistercase' }), P('a', 'k', 0, 94, 0)],
    [{ id: 'u1', caseId: 'k' }],
  );
  const pl = A.packRest(pl0, c);
  assert.ok(!find(pl, 'ghost'));
  assert.ok(pl.unplaced.find(u => u.id === 'ghost'));
  assert.ok(find(pl, 'a'), 'das gesunde Placement bleibt an Ort und Stelle stehen');
  const r = validatePlan(pl, c.caseById, c.truck);
  assert.ok(!r.issues.some(i => i.code === 'collision'));
});
