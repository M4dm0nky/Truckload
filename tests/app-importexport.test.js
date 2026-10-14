import test from 'node:test';
import assert from 'node:assert/strict';
import { importWarnings, limitWarnings, capList, warningsForWinners } from '../js/app/importExport.js';

const refs = [{ planId: 'p1', plan: 'Tour A', cases: ['mein-case', 'weg', 'weg'], truck: 'mein-truck' }];

test('importWarnings: Verweise auf lokal vorhandene Cases/Fahrzeuge erzeugen keine Warnung', () => {
  const warnings = importWarnings(refs, { cases: [{ id: 'mein-case' }, { id: 'weg' }], trucks: [{ id: 'mein-truck' }] });
  assert.deepEqual(warnings, []);
});

test('importWarnings: ein Verweis auf ein eigenes lokales Case (nicht in der Datei) ist keine Warnung', () => {
  const warnings = importWarnings([{ planId: 'p1', plan: 'Tour A', cases: ['mein-case'], truck: null }],
    { cases: [{ id: 'mein-case' }], trucks: [] });
  assert.deepEqual(warnings, []);
});

test('importWarnings: nirgends vorhandenes Case und Fahrzeug werden gemeldet, Wortlaut unverändert', () => {
  const warnings = importWarnings(refs, { cases: [{ id: 'mein-case' }], trucks: [] });
  assert.deepEqual(warnings, [
    'Ladeplan „Tour A“: 2 Stück verweisen auf ein Case, das weder in der Datei noch bekannt ist.',
    'Ladeplan „Tour A“ verweist auf ein unbekanntes Fahrzeug.',
  ]);
});

test('limitWarnings: nennt Case, Feld und Wert, kurz und deutsch', () => {
  const w = limitWarnings([
    { id: 'a', name: 'Schwer', field: 'weight', value: 60000, max: 50000 },
    { id: 'a', name: 'Schwer', field: 'maxTopLoad', value: 70000, max: 50000 },
    { id: 'b', name: 'Viel', field: 'stock', value: 10000, max: 9999 },
  ]);
  assert.deepEqual(w, [
    'Case „Schwer“: Gewicht 60000 kg liegt über der Grenze von 50000 kg – unverändert übernommen.',
    'Case „Schwer“: Auflast 70000 kg liegt über der Grenze von 50000 kg – unverändert übernommen.',
    'Case „Viel“: Bestand 10000 Stück liegt über der Grenze von 9999 Stück – unverändert übernommen.',
  ]);
  assert.deepEqual(limitWarnings([]), []);
});

test('capList: bis 10 Einträge unverändert, darüber „… und N weitere“', () => {
  const ten = Array.from({ length: 10 }, (_, i) => `w${i}`);
  assert.deepEqual(capList(ten), ten);
  const twelve = [...ten, 'w10', 'w11'];
  assert.deepEqual(capList(twelve), [...ten, '… und 2 weitere']);
});

test('warningsForWinners: nur Datensätze, die den Abgleich gewonnen haben', () => {
  const bundle = {
    unknownRefs: [{ planId: 'p1', plan: 'Gewinner', cases: ['weg'], truck: null }, { planId: 'p2', plan: 'Verlierer', cases: ['weg'], truck: null }],
    overLimit: [{ id: 'c1', name: 'Gewinner-Case', field: 'weight', value: 60000, max: 50000 }, { id: 'c2', name: 'Verlierer-Case', field: 'weight', value: 60000, max: 50000 }],
  };
  const winners = { plans: [{ id: 'p1' }], cases: [{ id: 'c1' }] };
  const w = warningsForWinners(bundle, winners, { cases: [], trucks: [] });
  assert.equal(w.length, 2);
  assert.match(w[0], /Gewinner“/);
  assert.match(w[1], /Gewinner-Case/);
});

import { wireImportExport } from '../js/app/importExport.js';
import { mkCase, mkTruck } from './fixtures.js';

test('Sichern: jeder exportierte Plan trägt mitgefuehrt mit den referenzierten Cases', () => {
  const handlers = {};
  const downloads = [];
  const realDoc = globalThis.document;
  const realCreate = URL.createObjectURL;
  globalThis.document = {
    querySelector: sel => (handlers[sel] ??= {}),
    createElement: () => ({ click() { downloads.push(this); } }),
  };
  const blobs = [];
  URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; };
  try {
    const plan = { id: 'p', name: 'P', truckId: 't', placements: [], unplaced: [{ id: 'u', caseId: 'c1' }], notes: '' };
    const s = { cases: [mkCase('c1', 1, 1, 1, {})], trucks: [mkTruck({ id: 't' })], plans: [plan], plan: null, ruleSets: [], collections: [] };
    wireImportExport({ store: { get: () => s }, autosave: {}, repo: {}, showAlert() {}, showConfirm() {} });
    handlers['#export'].onclick();
    return blobs[0].text().then(text => {
      assert.equal(JSON.parse(text).plans[0].mitgefuehrt.cases[0].id, 'c1');
    });
  } finally {
    globalThis.document = realDoc;
    URL.createObjectURL = realCreate;
  }
});

import { createBestandsSync } from '../js/app/core.js';

// Import-Lauf mit echtem Store-Double, echtem BestandsSync und injiziertem Repo.
async function importLauf({ saveImportWinners }) {
  const handlers = {};
  const realDoc = globalThis.document, realCreate = URL.createObjectURL;
  globalThis.document = { querySelector: sel => (handlers[sel] ??= {}), createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => 'blob:x';
  try {
    const pl = id => ({ id, name: id, truckId: 't', placements: [], unplaced: [{ id: `u-${id}`, caseId: 'c1' }], notes: '' });
    const c1 = mkCase('c1', 1, 1, 1, {}), t = [mkTruck({ id: 't' })];
    let s = { cases: [c1], trucks: t, plans: [pl('b'), pl('w')], plan: null, ruleSets: [], collections: [] };
    const subs = [];
    const store = { get: () => s, update(fn) { s = fn(s); subs.forEach(f => f(s)); }, resetHistory() {} };
    const saved = [];
    const sync = createBestandsSync({ initial: s, autosave: { markDirty() {} }, savePlan: p => { saved.push(p.id); return Promise.resolve(); }, onError() {} });
    subs.push(x => sync.change(x));
    const repo = {
      mergeImportedBundle: cur => ({ cases: [{ ...c1, weight: 9 }], trucks: t, plans: cur.plans.map(p => (p.id === 'w' ? { ...p, name: 'neu' } : p)), plan: null, ruleSets: [], collections: [], planChanged: false, winners: { cases: [], trucks: [], plans: [{ id: 'w' }], ruleSets: [], collections: [] } }),
      saveImportWinners,
    };
    wireImportExport({ store, autosave: { exclude() {}, include() {} }, repo, showAlert: async m => { if (process.env.DBG) console.log(m); }, showConfirm: async () => false, bestandsSync: sync });
    const bundle = JSON.stringify({ format: 'truckload', version: 1, cases: [{ id: 'zz', name: 'Z', l: 10, w: 10, h: 10, weight: 1 }] });
    await handlers['#import'].onchange({ target: { files: [{ text: async () => bundle }], value: '' } });
    return { saved };
  } finally {
    globalThis.document = realDoc; URL.createObjectURL = realCreate;
  }
}

test('Import: schlägt saveImportWinners fehl, wird kein Plan einzeln geschrieben', async () => {
  const { saved } = await importLauf({ saveImportWinners: async () => { throw new Error('boom'); } });
  assert.deepEqual(saved, []);
});
test('Import: nach Erfolg werden betroffene Nicht-Gewinner nachgeschrieben, nicht die Gewinner', async () => {
  const { saved } = await importLauf({ saveImportWinners: async () => {} });
  assert.deepEqual(saved, ['b']);
});
