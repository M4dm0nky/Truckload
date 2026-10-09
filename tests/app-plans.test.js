import test from 'node:test';
import assert from 'node:assert/strict';
import { switchPlanState, deletePlanState, copyName, removePlanPersisted } from '../js/app/plans.js';

const P = (id, name = id) => ({ id, name });

test('switchPlanState: der bisherige Plan wandert in die Liste, der neue wird aktiv', () => {
  const s = { plan: P('a'), plans: [P('b'), P('c')], selectedId: 'x', mode: '2d' };
  const next = switchPlanState(s, P('b'));
  assert.equal(next.plan.id, 'b');
  assert.deepEqual(next.plans.map(p => p.id), ['a', 'c']);
  assert.equal(next.selectedId, null);
  assert.equal(next.mode, '2d');
});
test('switchPlanState: ohne bisherigen Plan (Startbildschirm) steht kein null in der Liste', () => {
  const s = { plan: null, plans: [P('a'), P('b')], selectedId: null };
  const next = switchPlanState(s, P('a'));
  assert.deepEqual(next.plans.map(p => p.id), ['b']);
  assert.equal(next.plan.id, 'a');
});
test('switchPlanState: ein neuer, unbekannter Plan wird nicht doppelt geführt', () => {
  const s = { plan: P('a'), plans: [P('b')], selectedId: null };
  const next = switchPlanState(s, P('n'));
  assert.deepEqual(next.plans.map(p => p.id), ['a', 'b']);
  assert.equal(next.plan.id, 'n');
});
test('switchPlanState: Wechsel auf den schon aktiven Plan lässt ihn auch in der Liste stehen (bekannte Eigenheit, allPlansOf entdoppelt)', () => {
  const s = { plan: P('a'), plans: [P('b')], selectedId: 'x' };
  const next = switchPlanState(s, s.plan);
  assert.deepEqual(next.plans.map(p => p.id), ['a', 'b']);
  assert.equal(next.plan.id, 'a');
  assert.equal(next.selectedId, null);
});

test('deletePlanState: mit Resten wechselt der Zustand auf den ersten übrigen Plan', () => {
  const s = { plan: P('a'), plans: [P('b'), P('c')], selectedId: 'x' };
  const next = deletePlanState(s);
  assert.equal(next.plan.id, 'b');
  assert.deepEqual(next.plans.map(p => p.id), ['c']);
  assert.equal(next.selectedId, null);
});
test('deletePlanState: der letzte Plan führt zurück zum Startbildschirm (plan: null)', () => {
  const s = { plan: P('a'), plans: [], selectedId: 'x' };
  const next = deletePlanState(s);
  assert.equal(next.plan, null);
  assert.deepEqual(next.plans, []);
  assert.equal(next.selectedId, null);
});
test('deletePlanState: ein Duplikat des aktiven Plans in der Liste verschwindet mit', () => {
  const s = { plan: P('a'), plans: [P('a'), P('b')], selectedId: null };
  const next = deletePlanState(s);
  assert.equal(next.plan.id, 'b');
  assert.deepEqual(next.plans, []);
});

test('copyName: hängt „ (Kopie)“ an; ein langer Name wird so gekürzt, dass das Ergebnis in NAME_MAX passt', () => {
  assert.equal(copyName('Tour'), 'Tour (Kopie)');
  assert.equal(copyName('N'.repeat(80)).length, 80);
  assert.ok(copyName('N'.repeat(80)).endsWith(' (Kopie)'));
});

// 1.6: Vor dem Löschen eines Plans wird eine ausstehende Speicherung abgeschlossen, damit sie
// nicht erst NACH dem Löschen den gelöschten Plan wieder in die Datenbank schreibt.
test('removePlanPersisted: flush läuft vor deletePlan, forget erst danach', async () => {
  const log = [];
  const autosave = {
    flush: async () => { log.push('flush-start'); await Promise.resolve(); log.push('flush-ende'); },
    forget: id => log.push(`forget:${id}`),
  };
  const repo = { deletePlan: async id => { log.push(`delete:${id}`); } };
  const r = await removePlanPersisted('p1', { autosave, repo, showAlert: async () => {} });
  assert.equal(r.ok, true);
  assert.deepEqual(log, ['flush-start', 'flush-ende', 'delete:p1', 'forget:p1']);
});

test('removePlanPersisted: scheitert deletePlan, wird nicht vergessen und gemeldet', async () => {
  const log = [], alerts = [];
  const autosave = { flush: async () => log.push('flush'), forget: id => log.push(`forget:${id}`) };
  const repo = { deletePlan: async () => { throw new Error('Quota'); } };
  const r = await removePlanPersisted('p1', { autosave, repo, showAlert: async m => alerts.push(m) });
  assert.equal(r.ok, false);
  assert.deepEqual(log, ['flush']);
  assert.deepEqual(alerts, ['Löschen fehlgeschlagen: Quota']);
});
