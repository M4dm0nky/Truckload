import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store/state.js';
import { createPersistence } from '../js/app/persistence.js';
import { guarded } from '../js/app/guarded.js';
import { DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';

const stamp = o => ({ ...o, updatedAt: 1 });
const NOBUILTIN = 'Standardvorlagen lassen sich nicht löschen – „Kopieren“ legt eine eigene Version in einer Firma an.';

function setup({ fail = {}, confirm = true, state = {} } = {}) {
  const calls = [], alerts = [], confirms = [];
  const stub = name => async (...a) => {
    calls.push([name, ...a]);
    if (fail[name]) throw new Error(fail[name]);
  };
  const repo = Object.fromEntries(['saveCase', 'deleteCase', 'saveCases', 'saveAndDelete', 'saveRuleSet', 'deleteRuleSet', 'saveTruck', 'deleteTruck', 'savePlan'].map(n => [n, stub(n)]));
  const store = createStore({ cases: [], ruleSets: [], trucks: [], plans: [], plan: { id: 'cur', truckId: 't1', placements: [], unplaced: [] }, ...state });
  const p = createPersistence({
    repo, store, stamp, uid: () => 'new-id',
    showAlert: async m => { alerts.push(m); },
    showConfirm: async (m, o) => { confirms.push([m, o]); return confirm; },
  });
  return { p, store, calls, alerts, confirms };
}

test('guarded: Erfolg liefert ok und Wert, keine Meldung', async () => {
  const alerts = [];
  const r = await guarded('X', async () => 42, { showAlert: async m => alerts.push(m) });
  assert.deepEqual(r, { ok: true, value: 42 });
  assert.deepEqual(alerts, []);
});
test('guarded: Fehler meldet genau einmal „<label>: <message>“', async () => {
  const alerts = [];
  const r = await guarded('Nicht gespeichert', async () => { throw new Error('kaputt'); }, { showAlert: async m => alerts.push(m) });
  assert.equal(r.ok, false);
  assert.deepEqual(alerts, ['Nicht gespeichert: kaputt']);
});
test('guarded: Fehler ohne Meldung -> „unbekannter Fehler“', async () => {
  const alerts = [];
  await guarded('L', () => Promise.reject(undefined), { showAlert: async m => alerts.push(m) });
  assert.deepEqual(alerts, ['L: unbekannter Fehler']);
});

test('saveCase: Erfolg schreibt und aktualisiert den Store (ersetzt gleiche id)', async () => {
  const { p, store, calls, alerts } = setup({ state: { cases: [{ id: 'a', name: 'alt' }, { id: 'b' }] } });
  const v = await p.saveCase({ id: 'a', name: 'neu' });
  assert.equal(v.updatedAt, 1);
  assert.deepEqual(store.get().cases.map(c => c.id).sort(), ['a', 'b']);
  assert.equal(store.get().cases.find(c => c.id === 'a').name, 'neu');
  assert.equal(calls[0][0], 'saveCase');
  assert.deepEqual(alerts, []);
});
test('saveCase: Fehler lässt den Store unverändert, genau eine Meldung', async () => {
  const { p, store, alerts } = setup({ fail: { saveCase: 'voll' }, state: { cases: [{ id: 'a', name: 'alt' }] } });
  const before = store.get();
  assert.equal(await p.saveCase({ id: 'a', name: 'neu' }), undefined);
  assert.equal(store.get(), before);
  assert.deepEqual(alerts, ['Case konnte nicht gespeichert werden: voll']);
});

test('removeFromStock: Standardvorlage -> Meldung, kein Schreiben', async () => {
  const { p, calls, alerts } = setup();
  assert.equal(await p.removeFromStock({ id: 'preset-x', name: 'P', builtin: true }), false);
  assert.deepEqual(alerts, [NOBUILTIN]);
  assert.deepEqual(calls, []);
});
test('removeFromStock: ohne Case false, still', async () => {
  const { p, alerts } = setup();
  assert.equal(await p.removeFromStock(undefined), false);
  assert.deepEqual(alerts, []);
});
test('removeFromStock: Rückfrage abgelehnt -> nichts passiert', async () => {
  const c = { id: 'a', name: 'Kiste' };
  const { p, store, calls } = setup({ confirm: false, state: { cases: [c] } });
  assert.equal(await p.removeFromStock(c), false);
  assert.equal(store.get().cases.length, 1);
  assert.deepEqual(calls, []);
});
test('removeFromStock: Erfolg entfernt aus Store; confirmed überspringt die Rückfrage', async () => {
  const c = { id: 'a', name: 'Kiste' };
  const { p, store, confirms } = setup({ state: { cases: [c, { id: 'b' }] } });
  assert.equal(await p.removeFromStock(c, { confirmed: true }), true);
  assert.deepEqual(store.get().cases.map(x => x.id), ['b']);
  assert.deepEqual(confirms, []);
});
test('removeFromStock: Fehler -> Store unverändert, genau eine Meldung', async () => {
  const c = { id: 'a', name: 'Kiste' };
  const { p, store, alerts } = setup({ fail: { deleteCase: 'weg' }, state: { cases: [c] } });
  const before = store.get();
  assert.equal(await p.removeFromStock(c, { confirmed: true }), false);
  assert.equal(store.get(), before);
  assert.deepEqual(alerts, ['Case konnte nicht gelöscht werden: weg']);
});
test('removeFromStock: lib-Vorlage wird ausgeblendet (gespeichert, nicht gelöscht)', async () => {
  const c = { id: 'lib-1', name: 'L' };
  const { p, store, calls } = setup({ state: { cases: [c] } });
  assert.equal(await p.removeFromStock(c, { confirmed: true }), true);
  assert.deepEqual(calls.map(x => x[0]), ['saveCase']);
  assert.equal(store.get().cases[0].legacy, true);
});

test('renameCompany: Erfolg schreibt gesammelt und zieht den Store nach', async () => {
  const cases = [{ id: 'a', company: 'Alt' }, { id: 'b', company: 'Alt' }, { id: 'c', company: 'Andere' }];
  const { p, store, calls } = setup({ state: { cases } });
  assert.equal(await p.renameCompany('Alt', 'Neu'), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'saveCases');
  assert.equal(calls[0][1].length, 2);
  assert.deepEqual(store.get().cases.map(c => c.company).sort(), ['Andere', 'Neu', 'Neu']);
});
test('renameCompany: atomar – bei Fehler bleibt der Store unverändert, eine Meldung', async () => {
  const cases = [{ id: 'a', company: 'Alt' }, { id: 'b', company: 'Alt' }];
  const { p, store, alerts } = setup({ fail: { saveCases: 'abgebrochen' }, state: { cases } });
  const before = store.get();
  assert.equal(await p.renameCompany('Alt', 'Neu'), false);
  assert.equal(store.get(), before);
  assert.deepEqual(alerts, ['Firma konnte nicht umbenannt werden: abgebrochen']);
});

test('deleteCompany: Standard-Case in der Firma -> Abbruch mit einer Meldung, nichts geschrieben', async () => {
  const cases = [{ id: 'a', company: 'F', name: 'x' }, { id: 'preset-1', company: 'F', name: 'P', builtin: true }];
  const { p, store, calls, alerts } = setup({ state: { cases } });
  const before = store.get();
  assert.equal(await p.deleteCompany('F'), false);
  assert.deepEqual(alerts, [NOBUILTIN]);
  assert.deepEqual(calls, []);
  assert.equal(store.get(), before);
});
test('deleteCompany: Erfolg entfernt Einträge, blendet lib- aus', async () => {
  const cases = [{ id: 'a', company: 'F', name: 'x' }, { id: 'lib-1', company: 'F', name: 'L' }, { id: 'z', company: 'G' }];
  const { p, store, calls, confirms } = setup({ state: { cases } });
  assert.equal(await p.deleteCompany('F'), true);
  assert.match(confirms[0][0], /^Firma „F“ mit 2 Einträgen löschen\?$/);
  assert.deepEqual(calls.map(c => c[0]), ['saveAndDelete'], 'eine einzige Transaktion für Überlagerungen und Entfernungen');
  assert.deepEqual(calls[0][1].removeIds, ['a']);
  assert.deepEqual(calls[0][1].saves.map(c => c.id), ['lib-1']);
  const ids = store.get().cases.map(c => c.id).sort();
  assert.deepEqual(ids, ['lib-1', 'z']);
  assert.equal(store.get().cases.find(c => c.id === 'lib-1').legacy, true);
});
test('deleteCompany: Rückfrage abgelehnt -> nichts', async () => {
  const { p, calls } = setup({ confirm: false, state: { cases: [{ id: 'a', company: 'F' }] } });
  assert.equal(await p.deleteCompany('F'), false);
  assert.deepEqual(calls, []);
});
test('deleteCompany: Fehler -> Store unverändert, genau eine Meldung', async () => {
  const { p, store, alerts } = setup({ fail: { saveAndDelete: 'x' }, state: { cases: [{ id: 'a', company: 'F' }, { id: 'lib-1', company: 'F' }] } });
  const before = store.get();
  assert.equal(await p.deleteCompany('F'), false);
  assert.equal(store.get(), before);
  assert.deepEqual(alerts, ['Firma konnte nicht gelöscht werden: x']);
});

test('saveRuleSet: neues Set bekommt uid, gleicher Name (case-insensitiv) behält die id', async () => {
  const { p, store } = setup({ state: { ruleSets: [{ id: 'r1', name: 'Standard', rules: [] }] } });
  const a = await p.saveRuleSet('neu', ['x'], true);
  assert.equal(a.id, 'new-id');
  assert.equal(a.mixTop, true);
  const b = await p.saveRuleSet('STANDARD', ['y'], false); // Rückfrage (Standard im Fake: bestätigt)
  assert.equal(b.id, 'r1');
  assert.equal('mixTop' in b, false);
  assert.deepEqual(store.get().ruleSets.map(r => r.id).sort(), ['new-id', 'r1']);
});
test('saveRuleSet/deleteRuleSet: Fehler -> Store unverändert, je eine Meldung', async () => {
  const s1 = setup({ fail: { saveRuleSet: 'a' }, state: { ruleSets: [{ id: 'r1', name: 'S' }] } });
  const before = s1.store.get();
  assert.equal(await s1.p.saveRuleSet('T', [], false), undefined);
  assert.equal(s1.store.get(), before);
  assert.deepEqual(s1.alerts, ['Regelset konnte nicht gespeichert werden: a']);
  const s2 = setup({ fail: { deleteRuleSet: 'b' }, state: { ruleSets: [{ id: 'r1', name: 'S' }] } });
  assert.equal(await s2.p.deleteRuleSet('r1'), false);
  assert.equal(s2.store.get().ruleSets.length, 1);
  assert.deepEqual(s2.alerts, ['Regelset konnte nicht gelöscht werden: b']);
});
test('deleteRuleSet: Erfolg entfernt aus Store', async () => {
  const { p, store } = setup({ state: { ruleSets: [{ id: 'r1', name: 'S' }, { id: 'r2', name: 'T' }] } });
  assert.equal(await p.deleteRuleSet('r1'), true);
  assert.deepEqual(store.get().ruleSets.map(r => r.id), ['r2']);
});

test('saveTruck: Erfolg / Fehler', async () => {
  const ok = setup({ state: { trucks: [{ id: 't1', name: 'alt' }] } });
  const v = await ok.p.saveTruck({ id: 't1', name: 'neu' });
  assert.equal(v.name, 'neu');
  assert.equal(ok.store.get().trucks.length, 1);
  const bad = setup({ fail: { saveTruck: 'e' }, state: { trucks: [{ id: 't1' }] } });
  const before = bad.store.get();
  assert.equal(await bad.p.saveTruck({ id: 't1' }), undefined);
  assert.equal(bad.store.get(), before);
  assert.deepEqual(bad.alerts, ['Fahrzeug konnte nicht gespeichert werden: e']);
});
test('deleteTruck: biegt andere Pläne auf den Standardtruck um und speichert sie', async () => {
  const plans = [{ id: 'p1', truckId: 't1' }, { id: 'p2', truckId: 'other' }];
  const { p, store, calls, alerts } = setup({ state: { trucks: [{ id: 't1' }, { id: 'other' }], plans } });
  assert.equal(await p.deleteTruck('t1'), true);
  assert.deepEqual(store.get().trucks.map(t => t.id), ['other']);
  assert.equal(store.get().plans[0].truckId, DEFAULT_TRUCK_ID);
  assert.equal(store.get().plans[1], plans[1]);
  assert.deepEqual(calls.map(c => c[0]), ['deleteTruck', 'savePlan']);
  assert.deepEqual(alerts, []);
});
test('deleteTruck: biegt auch die LKW anderer Mehr-LKW-Pläne um und speichert sie', async () => {
  const multi = { id: 'm', truckId: 't1', placements: [], unplaced: [], lkws: [
    { id: 'a', name: 'A', truckId: 't1', categories: [] }, { id: 'b', name: 'B', truckId: 'other', categories: ['Ton'] },
    { id: 'c', name: 'C', truckId: 't1', categories: ['Licht'] }] };
  const keep = { id: 'k', truckId: 'other', placements: [], unplaced: [], lkws: [{ id: 'x', name: 'X', truckId: 'other', categories: [] }] };
  const { p, store, calls } = setup({ state: { trucks: [{ id: 't1' }, { id: 'other' }], plans: [multi, keep] } });
  assert.equal(await p.deleteTruck('t1'), true);
  const m = store.get().plans[0];
  assert.deepEqual(m.lkws.map(l => l.truckId), [DEFAULT_TRUCK_ID, 'other', DEFAULT_TRUCK_ID]);
  assert.equal(m.truckId, DEFAULT_TRUCK_ID);
  assert.equal(store.get().plans[1], keep);
  assert.deepEqual(calls.map(c => c[0]), ['deleteTruck', 'savePlan']);
  assert.equal(calls[1][1], m);
});
test('deleteTruck: Fehler beim Löschen -> Store unverändert, eine Meldung', async () => {
  const { p, store, alerts } = setup({ fail: { deleteTruck: 'f' }, state: { trucks: [{ id: 't1' }], plans: [{ id: 'p1', truckId: 't1' }] } });
  const before = store.get();
  assert.equal(await p.deleteTruck('t1'), false);
  assert.equal(store.get(), before);
  assert.deepEqual(alerts, ['Fahrzeug konnte nicht gelöscht werden: f']);
});
test('deleteTruck: Plan-Aktualisierung scheitert -> Truck weg, eine Sondermeldung', async () => {
  const { p, store, alerts } = setup({ fail: { savePlan: 'g' }, state: { trucks: [{ id: 't1' }], plans: [{ id: 'p1', truckId: 't1' }] } });
  assert.equal(await p.deleteTruck('t1'), true);
  assert.equal(store.get().trucks.length, 0);
  assert.deepEqual(alerts, ['Fahrzeug gelöscht, aber 1 Plan(e) konnten nicht aktualisiert werden: g. Bitte prüfen und ggf. erneut speichern.']);
});

test('deleteCompany: nur Entfernungen (keine Überlagerung) laufen ebenfalls über saveAndDelete', async () => {
  const { p, store, calls } = setup({ state: { cases: [{ id: 'a', company: 'F' }, { id: 'b', company: 'F' }, { id: 'z', company: 'G' }] } });
  assert.equal(await p.deleteCompany('F'), true);
  assert.deepEqual(calls.map(c => c[0]), ['saveAndDelete']);
  assert.deepEqual(calls[0][1], { saves: [], removeIds: ['a', 'b'] });
  assert.deepEqual(store.get().cases.map(c => c.id), ['z']);
});

// Task 3.2: Rückfrage vor Überschreiben und Löschen eines Regelsets.
test('saveRuleSet unter vorhandenem Namen: Rückfrage „überschreiben?“, Bestätigen speichert', async () => {
  const { p, store, confirms, calls } = setup({ state: { ruleSets: [{ id: 'r1', name: 'Standard', rules: ['a'] }] } });
  const v = await p.saveRuleSet('standard', ['b'], false);
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0][0], 'Regelset „Standard“ überschreiben?');
  assert.equal(confirms[0][1].danger, true);
  assert.equal(v.id, 'r1');
  assert.deepEqual(store.get().ruleSets[0].rules, ['b']);
  assert.equal(calls.filter(c => c[0] === 'saveRuleSet').length, 1);
});
test('saveRuleSet unter vorhandenem Namen: Abbrechen ändert nichts', async () => {
  const { p, store, confirms, calls } = setup({ confirm: false, state: { ruleSets: [{ id: 'r1', name: 'Standard', rules: ['a'] }] } });
  const before = store.get();
  assert.equal(await p.saveRuleSet('Standard', ['b'], false), undefined);
  assert.equal(confirms.length, 1);
  assert.equal(store.get(), before);
  assert.deepEqual(calls, []);
});
test('saveRuleSet mit neuem Namen: keine Rückfrage', async () => {
  const { p, confirms } = setup({ state: { ruleSets: [{ id: 'r1', name: 'Standard', rules: [] }] } });
  await p.saveRuleSet('Neu', [], false);
  assert.deepEqual(confirms, []);
});
test('deleteRuleSet: Rückfrage mit danger, Abbrechen ändert nichts, Bestätigen löscht', async () => {
  const state = { ruleSets: [{ id: 'r1', name: 'S' }, { id: 'r2', name: 'T' }] };
  const no = setup({ confirm: false, state });
  assert.equal(await no.p.deleteRuleSet('r1'), false);
  assert.equal(no.store.get().ruleSets.length, 2);
  assert.deepEqual(no.calls, []);
  assert.equal(no.confirms[0][0], 'Regelset „S“ löschen?');
  assert.equal(no.confirms[0][1].danger, true);
  const yes = setup({ state });
  assert.equal(await yes.p.deleteRuleSet('r1'), true);
  assert.deepEqual(yes.store.get().ruleSets.map(r => r.id), ['r2']);
});
