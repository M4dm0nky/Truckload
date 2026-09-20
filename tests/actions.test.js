import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/model/actions.js';
import { validatePlan } from '../js/model/validate.js';
import { wheelFace, DOOR_FACE } from '../js/model/geometry.js';
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
