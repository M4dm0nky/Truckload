import test from 'node:test';
import assert from 'node:assert/strict';
import { importWarnings, limitWarnings, capList, warningsForWinners, wireImportExport, parseDimsInput } from '../js/app/importExport.js';
import { mkCase, mkTruck } from './fixtures.js';
import { createBestandsSync } from '../js/app/core.js';

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

test('importWarnings: Verweise, die die Kopie des Plans auflöst, werden nicht gemeldet', () => {
  const r = [{ planId: 'p1', plan: 'Tour A', cases: ['kopie', 'weg'], truck: 'tk', kopieCases: ['kopie'], kopieTrucks: ['tk'] }];
  assert.deepEqual(importWarnings(r, { cases: [], trucks: [] }), [
    'Ladeplan „Tour A“: 1 Stück verweisen auf ein Case, das weder in der Datei noch bekannt ist.',
  ]);
});

test('Import: wirft autosave.include, läuft bestandsSync.ende trotzdem', async () => {
  const handlers = {};
  const realDoc = globalThis.document, realCreate = URL.createObjectURL;
  globalThis.document = { querySelector: sel => (handlers[sel] ??= {}), createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => 'blob:x';
  try {
    const plan = { id: 'p', name: 'P', truckId: 't', placements: [], unplaced: [], notes: '' };
    let s = { cases: [], trucks: [mkTruck({ id: 't' })], plans: [], plan, ruleSets: [], collections: [] };
    const store = { get: () => s, update(fn) { s = fn(s); }, resetHistory() {} };
    let ende = 0;
    const repo = {
      mergeImportedBundle: cur => ({ ...cur, planChanged: false, winners: { cases: [], trucks: [], plans: [], ruleSets: [], collections: [] } }),
      saveImportWinners: async () => {},
    };
    wireImportExport({ store, autosave: { exclude() {}, include() { throw new Error('include'); } }, repo, showAlert: async m => { if (process.env.DBG) console.log(m); }, showConfirm: async () => false, bestandsSync: { halte() {}, ende() { ende++; } } });
    const bundle = JSON.stringify({ format: 'truckload', version: 1, cases: [{ id: 'zz', name: 'Z', l: 10, w: 10, h: 10, weight: 1 }] });
    await handlers['#import'].onchange({ target: { files: [{ text: async () => bundle }], value: '' } }).catch(e => { if (process.env.DBG) console.log(e); });
    assert.equal(ende, 1);
  } finally {
    globalThis.document = realDoc; URL.createObjectURL = realCreate;
  }
});

// --- Issue #10: fehlende Maße beim Import nachfragen ---

test('parseDimsInput: drei Zahlen mit ×, x, * oder Leerzeichen, Komma erlaubt; sonst null', () => {
  assert.deepEqual(parseDimsInput('120 × 60 × 80'), { l: 120, w: 60, h: 80 });
  assert.deepEqual(parseDimsInput('120,5x60 x80'), { l: 120.5, w: 60, h: 80 });
  assert.deepEqual(parseDimsInput('120 60 80'), { l: 120, w: 60, h: 80 });
  assert.equal(parseDimsInput('120 60'), null);
  assert.equal(parseDimsInput('a b c'), null);
  assert.equal(parseDimsInput(''), null);
});

async function dimsLauf(answers, bundleCases) {
  const handlers = {};
  const realDoc = globalThis.document, realCreate = URL.createObjectURL;
  globalThis.document = { querySelector: sel => (handlers[sel] ??= {}), createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => 'blob:x';
  try {
    let s = { cases: [], trucks: [mkTruck({ id: 't' })], plans: [], plan: null, ruleSets: [], collections: [] };
    const store = { get: () => s, update(fn) { s = fn(s); }, resetHistory() {} };
    let seen = null;
    const repo = {
      mergeImportedBundle: (cur, b) => { seen = b; return { ...cur, planChanged: false, winners: { cases: [], trucks: [], plans: [], ruleSets: [], collections: [] } }; },
      saveImportWinners: async () => {},
    };
    const prompts = [], alerts = [];
    const queue = [...answers];
    wireImportExport({
      store, autosave: { exclude() {}, include() {} }, repo, showConfirm: async () => false,
      showAlert: async m => { alerts.push(m); },
      showPrompt: async m => { prompts.push(m); return queue.shift() ?? null; },
      bestandsSync: { halte() {}, ende() {} },
    });
    const bundle = JSON.stringify({ format: 'truckload', version: 1, cases: bundleCases });
    await handlers['#import'].onchange({ target: { files: [{ text: async () => bundle }], value: '' } });
    return { seen, prompts, alerts };
  } finally {
    globalThis.document = realDoc; URL.createObjectURL = realCreate;
  }
}
const ok = { id: 'ok', name: 'Ganz', l: 10, w: 10, h: 10, weight: 1 };
const kaputt = { id: 'k', name: 'Kaputt', l: 10, w: 10, weight: 1 };

test('Import: Case ohne Maß – Nutzer ergänzt, Case kommt mit den eingegebenen Maßen', async () => {
  const r = await dimsLauf(['100 × 50 × 40'], [ok, kaputt]);
  assert.equal(r.prompts.length, 1);
  assert.match(r.prompts[0], /Kaputt/);
  const k = r.seen.cases.find(c => c.id === 'k');
  assert.deepEqual([k.l, k.w, k.h], [100, 50, 40]);
});
test('Import: ungültige Eingabe wird erneut erfragt', async () => {
  const r = await dimsLauf(['abc', '0 0 0', '100 50 40'], [kaputt]);
  assert.equal(r.prompts.length, 3);
  assert.ok(r.seen.cases.some(c => c.id === 'k'));
});
test('Import: Abbrechen lässt das Case aus und nennt es in der Meldung, der Rest lädt', async () => {
  const r = await dimsLauf([], [ok, kaputt]);
  assert.deepEqual(r.seen.cases.map(c => c.id), ['ok']);
  assert.match(r.alerts.at(-1), /Case „Kaputt“ ohne gültige Maße – nicht importiert/);
});

// --- #35: ein gescheiterter Import setzt auch die Regelsets zurück ---
test('Import: schlägt saveImportWinners fehl, stehen ruleSets und projectRuleSets wieder auf dem Stand vor dem Import', async () => {
  const handlers = {};
  const realDoc = globalThis.document, realCreate = URL.createObjectURL;
  globalThis.document = { querySelector: sel => (handlers[sel] ??= {}), createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => 'blob:x';
  try {
    const rs0 = [{ id: 'rs', name: 'Alt', rules: [] }], prs0 = [{ id: 'pr', name: 'Projekt alt', rules: [] }];
    let s = { cases: [], trucks: [mkTruck({ id: 't' })], plans: [], plan: null, ruleSets: rs0, projectRuleSets: prs0, collections: [] };
    const store = { get: () => s, update(fn) { s = fn(s); }, resetHistory() {} };
    const repo = {
      mergeImportedBundle: cur => ({ ...cur, ruleSets: [{ id: 'rs2', name: 'Neu', rules: [] }], projectRuleSets: [{ id: 'pr2', name: 'Projekt neu', rules: [] }],
        planChanged: false, winners: { cases: [], trucks: [], plans: [], ruleSets: [], collections: [] } }),
      saveImportWinners: async () => { throw new Error('boom'); },
    };
    wireImportExport({ store, autosave: { exclude() {}, include() {} }, repo, showAlert: async () => {}, showConfirm: async () => false, bestandsSync: { halte() {}, ende() {} } });
    const bundle = JSON.stringify({ format: 'truckload', version: 1, cases: [{ id: 'zz', name: 'Z', l: 10, w: 10, h: 10, weight: 1 }] });
    await handlers['#import'].onchange({ target: { files: [{ text: async () => bundle }], value: '' } });
    assert.equal(s.ruleSets, rs0);
    assert.equal(s.projectRuleSets, prs0);
  } finally {
    globalThis.document = realDoc; URL.createObjectURL = realCreate;
  }
});
