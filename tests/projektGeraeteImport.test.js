import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  geraeteAbgleich, uebernimmErgebnis, sollAutomatischOeffnen, kategorieVon, caseEntwurf, suchReihenfolge,
} from '../js/app/projektGeraeteImport.js';
import { applyEditWhole } from '../js/app/core.js';
import { createStore } from '../js/store/state.js';
import { mkCase, mkTruck, P, plan, counter } from './fixtures.js';
import { DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';

const GDTF = 'gdtf:aaaa-1111';
const gerät = (key, anzahl, extra = {}) => ({ key, name: 'Spot 700', anzahl, vwNamen: [], ...extra });
const planMit = (extra = {}) => ({ id: 'pl', name: 'Tour', truckId: DEFAULT_TRUCK_ID, ...plan([], []), ...extra });

// Store und Attrappen wie in app.js, nur ohne DOM. `oeffne` zeichnet die Dialog-Optionen auf.
function harness({ plan: p = null, cases = [], liste = [gerät(GDTF, 4)], ergebnis = null, ladeFehler = null, hat = true } = {}) {
  const store = createStore({ cases, collections: [], trucks: [mkTruck({ id: DEFAULT_TRUCK_ID })], plans: [], plan: p, activeLkw: null });
  const uid = counter('id');
  const log = { oeffne: [], alerts: [], gespeichert: [], markiert: 0, lade: 0, uebernommen: [] };
  const deps = {
    store, hat: () => hat,
    lade: async () => { log.lade++; if (ladeFehler) throw new Error(ladeFehler); return liste; },
    oeffne: async opts => { log.oeffne.push(opts); return ergebnis; },
    leererPlan: () => planMit({ id: 'leer', name: '' }),
    markiereGeoeffnet: () => { log.markiert++; },
    uebernehmen: async (res, k) => { log.uebernommen.push([res, k]); },
    showAlert: async m => { log.alerts.push(m); },
  };
  const editWhole = fn => store.update(s => applyEditWhole(s, fn, uid));
  const switchPlan = pl => store.update(s => ({ ...s, plan: pl }));
  const saveCase = async c => { log.gespeichert.push(c); store.update(s => ({ ...s, cases: [...s.cases.filter(x => x.id !== c.id), c] })); return c; };
  return { store, deps, log, uid, editWhole, switchPlan, saveCase, showAlert: deps.showAlert };
}

test('automatisch öffnen: nur ohne geoeffnet am Plan (oder ohne Plan)', () => {
  const offen = { nyxAbgleich: { geoeffnet: true, nichtLaden: [] } };
  assert.equal(sollAutomatischOeffnen({ plan: null, plans: [] }), true);
  assert.equal(sollAutomatischOeffnen({ plan: planMit(), plans: [] }), true);
  assert.equal(sollAutomatischOeffnen({ plan: planMit({ nyxAbgleich: { nichtLaden: [] } }), plans: [] }), true);
  assert.equal(sollAutomatischOeffnen({ plan: planMit(offen), plans: [] }), false);
  // Startbildschirm in NYX: kein aktueller Plan, aber ein gespeicherter hat den Abgleich schon geöffnet
  assert.equal(sollAutomatischOeffnen({ plan: null, plans: [planMit(), planMit({ id: 'p2', ...offen })] }), false);
  assert.equal(sollAutomatischOeffnen({ plan: null, plans: [planMit()] }), true);
});

test('Start in NYX ohne Plan, Host liefert Geräte: Dialog öffnet sich', async () => {
  const h = harness();
  assert.equal(await geraeteAbgleich(h.deps, { automatisch: true }), 'cancelled');
  assert.equal(h.log.oeffne.length, 1);
});

test('Start: kein Host -> weder Host-Aufruf noch Dialog', async () => {
  const h = harness({ hat: false });
  assert.equal(await geraeteAbgleich(h.deps, { automatisch: true }), 'no-host');
  assert.equal(h.log.lade, 0);
  assert.equal(h.log.oeffne.length, 0);
});

test('Start: ein Plan des Projekts hat geoeffnet (auch nur gespeichert) -> kein Dialog, Host wird nicht gefragt', async () => {
  const h = harness({ plan: planMit({ nyxAbgleich: { geoeffnet: true, nichtLaden: [] } }) });
  assert.equal(await geraeteAbgleich(h.deps, { automatisch: true }), 'already');
  assert.equal(h.log.lade, 0);
  assert.equal(h.log.oeffne.length, 0);
});

test('Start: Host liefert keine Geräte -> nicht automatisch, aber per Knopf (leere Liste sichtbar)', async () => {
  const h = harness({ liste: [] });
  assert.equal(await geraeteAbgleich(h.deps, { automatisch: true }), 'empty');
  assert.equal(h.log.oeffne.length, 0);
  await geraeteAbgleich(h.deps);
  assert.equal(h.log.oeffne.length, 1);
});

test('Hostfehler: Meldung über showAlert, kein Dialog, nichts geschrieben', async () => {
  const h = harness({ plan: planMit(), ladeFehler: 'Kein Projekt offen.' });
  assert.equal(await geraeteAbgleich(h.deps, { automatisch: true }), 'error');
  assert.deepEqual(h.log.alerts, ['Kein Projekt offen.']);
  assert.equal(h.log.oeffne.length, 0);
  assert.equal(h.log.markiert, 0);
});

test('Abbruch ohne Plan: kein Plan, nichts übernommen, nächster Start öffnet wieder', async () => {
  const h = harness();
  await geraeteAbgleich(h.deps, { automatisch: true });
  assert.equal(h.store.get().plan, null);
  assert.equal(h.log.markiert, 0);
  assert.equal(h.log.uebernommen.length, 0);
  await geraeteAbgleich(h.deps, { automatisch: true });
  assert.equal(h.log.oeffne.length, 2);
});

test('Abbruch mit Plan: nur das Öffnen wird gemerkt, nichts übernommen', async () => {
  const h = harness({ plan: planMit() });
  assert.equal(await geraeteAbgleich(h.deps, { automatisch: true }), 'cancelled');
  assert.equal(h.log.markiert, 1);
  assert.equal(h.log.uebernommen.length, 0);
  assert.equal(h.log.gespeichert.length, 0);
});

test('Dialog-Optionen: umhängen einmal gerechnet, dieselbe alias-Map in opts; stand zählt vw-Stücke als gdtf', async () => {
  const c = mkCase('c1', 60, 40, 40, { name: 'Spot x2', fasst: { stueck: 2, geraete: [{ key: 'vw:Spot', name: 'Spot' }] } });
  const p = planMit({ unplaced: [{ id: 'u1', caseId: 'c1', nyxGeraet: 'vw:Spot', nyxStueck: 2 }] });
  const h = harness({ plan: p, cases: [c], liste: [gerät(GDTF, 6, { vwNamen: ['Spot'] })] });
  await geraeteAbgleich(h.deps);
  const o = h.log.oeffne[0];
  assert.equal(o.alias.get('vw:Spot'), GDTF);
  assert.equal(o.cases.find(x => x.id === 'c1').fasst.geraete[0].key, GDTF);
  assert.equal(h.store.get().cases[0].fasst.geraete[0].key, 'vw:Spot'); // Store unberührt (erst Übernahme schreibt)
  assert.deepEqual(o.stand.map(z => [z.key, z.verladen, z.diff]), [[GDTF, 2, 4]]);
  assert.equal(o.plan, p);
});

test('Dialog-Optionen ohne Plan: leerer Plan als Rechenbasis, zielAktuell null', async () => {
  const h = harness();
  await geraeteAbgleich(h.deps);
  const o = h.log.oeffne[0];
  assert.equal(o.zielAktuell, null);
  assert.equal(o.plan.id, 'leer');
  assert.equal(o.stand[0].verladen, 0);
});

test('Ergebnis geht an uebernehmen, mit geaendert/alias', async () => {
  const res = { zuordnungen: [], nichtLaden: [], reduktion: [], laden: false };
  const h = harness({ plan: planMit(), ergebnis: res });
  assert.equal(await geraeteAbgleich(h.deps), 'applied');
  assert.equal(h.log.uebernommen[0][0], res);
  assert.equal(h.log.markiert, 0);
});

// ---- uebernimmErgebnis: schreibt Bibliothek und Plan ----
const tipp = mkCase('t', 60, 40, 40, { name: 'Spot', tippable: true });
const zu = (n, stueck, nyxStueck = stueck) => ({ key: GDTF, name: 'Spot 700', caseId: 't', n, stueck, nyxStueck });

test('Übernahme ohne Plan: legt den Plan an, Stücke getippt mit nyx-Feldern, Case merkt Typ und Geräte pro Case', async () => {
  const h = harness({ cases: [tipp] });
  const res = { zuordnungen: [zu(2, 2), zu(1, 2, 1)], nichtLaden: [], reduktion: [], laden: false };
  const ok = await uebernimmErgebnis(h, res, { geaendert: [], alias: new Map() });
  assert.equal(ok, true);
  const p = h.store.get().plan;
  assert.equal(p.unplaced.length, 3);
  assert.ok(p.unplaced.every(u => u.tipped === true && u.nyxGeraet === GDTF));
  assert.deepEqual(p.unplaced.map(u => u.nyxStueck), [2, 2, 1]);
  assert.equal(p.nyxAbgleich.geoeffnet, true);
  assert.equal(h.log.gespeichert.length, 1);
  assert.deepEqual(h.log.gespeichert[0].fasst, { stueck: 2, geraete: [{ key: GDTF, name: 'Spot 700' }] });
});

test('Übernahme: Speichern schlägt fehl -> Plan bleibt unberührt (kein Plan angelegt)', async () => {
  const h = harness({ cases: [tipp] });
  h.saveCase = async () => undefined;
  const res = { zuordnungen: [zu(1, 1)], nichtLaden: [], reduktion: [], laden: false };
  assert.equal(await uebernimmErgebnis(h, res, { geaendert: [], alias: new Map() }), false);
  assert.equal(h.store.get().plan, null);
});

test('Übernahme im vorhandenen Plan: umgehängte Cases werden gespeichert, vw-Stücke umgeschrieben, bestätigte Reduktion entfernt', async () => {
  const c = mkCase('c1', 60, 40, 40, { name: 'Spot', fasst: { stueck: 1, geraete: [{ key: 'vw:Spot', name: 'Spot' }] } });
  const p = planMit({ unplaced: [
    { id: 'u1', caseId: 'c1', nyxGeraet: 'vw:Spot', nyxStueck: 1 },
    { id: 'u2', caseId: 'c1', nyxGeraet: 'vw:Spot', nyxStueck: 1 },
    { id: 'h', caseId: 'c1' },
  ] });
  const h = harness({ plan: p, cases: [c] });
  const alias = new Map([['vw:Spot', GDTF]]);
  const umg = { ...c, fasst: { stueck: 1, geraete: [{ key: GDTF, name: 'Spot' }] } };
  const res = { zuordnungen: [], nichtLaden: ['gdtf:haus'], reduktion: [{ key: GDTF, entfernen: ['u2', 'h'] }], laden: false };
  await uebernimmErgebnis(h, res, { geaendert: [umg], alias });
  assert.deepEqual(h.log.gespeichert.map(x => x.fasst.geraete[0].key), [GDTF]);
  const u = h.store.get().plan.unplaced;
  assert.deepEqual(u.map(x => [x.id, x.nyxGeraet]), [['u1', GDTF], ['h', undefined]]);
  assert.deepEqual(h.store.get().plan.nyxAbgleich, { geoeffnet: true, nichtLaden: ['gdtf:haus'] });
});

test('Übernahme: Preset-Case wird als eigene Überlagerung gespeichert (builtin false)', async () => {
  const preset = { ...tipp, id: 'preset-x', builtin: true };
  const h = harness({ cases: [preset] });
  const res = { zuordnungen: [{ ...zu(1, 1), caseId: 'preset-x' }], nichtLaden: [], reduktion: [], laden: false };
  await uebernimmErgebnis(h, res, { geaendert: [], alias: new Map() });
  assert.equal(h.log.gespeichert[0].builtin, false);
  assert.equal(h.log.gespeichert[0].id, 'preset-x');
});

// ---- Entwurf „Neues Case“, Suche ----
test('kategorieVon: licht -> Licht, unbekannt -> Sonstiges, fehlt -> Licht', () => {
  assert.equal(kategorieVon('licht'), 'Licht');
  assert.equal(kategorieVon('Video'), 'Video');
  assert.equal(kategorieVon('Zauberei'), 'Sonstiges');
  assert.equal(kategorieVon(undefined), 'Licht');
});

test('caseEntwurf: Name + Case, Gewicht aus gewichtKg, kein Gewicht ohne NYX-Angabe', () => {
  assert.deepEqual(caseEntwurf({ name: 'MAC Viper', gewerk: 'licht', gewichtKg: 32.5 }), { name: 'MAC Viper Case', category: 'Licht', weight: 32.5 });
  assert.equal(caseEntwurf({ name: 'MAC Viper', gewichtKg: 32.5, stueck: 2 }).weight, 65);
  assert.equal('weight' in caseEntwurf({ name: 'X' }), false);
  assert.ok(caseEntwurf({ name: 'N'.repeat(200) }).name.length <= 80);
});

test('suchReihenfolge: Treffer zuerst, dann der Rest, nichts geht verloren', () => {
  const cs = [mkCase('a', 1, 1, 1, { name: 'Kabelcase' }), mkCase('b', 1, 1, 1, { name: 'Viper Doppelcase' }), mkCase('c', 1, 1, 1, { name: 'Spot' })];
  assert.deepEqual(suchReihenfolge(cs, 'viper').map(c => c.id), ['b', 'a', 'c']);
  assert.equal(suchReihenfolge(cs, '').length, 3);
});

test('Übernahme: ein erst im Dialog angelegtes Case (nicht im Snapshot beim Öffnen) wird gemerkt', async () => {
  const h = harness({ ergebnis: { zuordnungen: [zu(1, 3)], nichtLaden: [], reduktion: [], laden: false } });
  h.deps.oeffne = async opts => { // „Neues Case“ speichert mitten im Dialog in die Bibliothek
    h.log.oeffne.push(opts);
    await h.saveCase(tipp);
    return { zuordnungen: [zu(1, 3)], nichtLaden: [], reduktion: [], laden: false };
  };
  h.deps.uebernehmen = (res, k) => uebernimmErgebnis(h, res, k);
  assert.equal(await geraeteAbgleich(h.deps), 'applied');
  const gemerkt = h.log.gespeichert.filter(c => c.fasst);
  assert.equal(gemerkt.length, 1);
  assert.deepEqual(gemerkt[0].fasst, { stueck: 3, geraete: [{ key: GDTF, name: 'Spot 700' }] });
});
