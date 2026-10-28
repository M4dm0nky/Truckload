// Englische Meldungen des Modells (#42, Task 4a): kein deutscher Rest, keine offenen Platzhalter.
// Task 4b ergänzt unten die Store-Meldungen (io.js, db.js, hostDb.js, repo.js).
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLang } from '../js/i18n/i18n.js';
import { looksGerman } from './i18n-scan.js';
import { validatePlan } from '../js/model/validate.js';
import { unplacedReason } from '../js/model/unplacedReason.js';
import { addLkw, convertToMulti } from '../js/model/lkw.js';
import { collectionNameError, parentError, MEINE_NAME, MEINE_NAME_EN, resolveTarget, MEINE_ID } from '../js/model/collections.js';
import { describeRule, POS_LABEL, RULE_KINDS } from '../js/model/packRules.js';
import { trussDims, splitWagons } from '../js/model/truss.js';
import { unassignedLines, stueck } from '../js/model/lkw-distribute.js';
import { truckMarke, truckStiftSperre } from '../js/model/mitgefuehrt.js';
import { checkCase, checkTruck, checkPlan, checkRuleSet, checkCollection, parseBundle, parseCollectionFile } from '../js/store/io.js';
import { dollyName, parseDollyName } from '../js/model/audioDolly.js';
import { repairImportedCollections } from '../js/store/repo.js';
import { mkCase, mkTruck, SPRINTER, P, plan, byId, counter } from './fixtures.js';

beforeEach(() => setLang('en'));
afterEach(() => setLang('de'));

// Der Case-Name „Bühne“ ist Nutzerdaten und bleibt deutsch: vor der Prüfung herausnehmen.
// Die englischen Anführungszeichen “…” zählt looksGerman als deutsch (es kennt „“): ebenfalls entfernen.
const sauber = s => s.replaceAll('Bühne', 'X').replaceAll('bühne', 'x').replace(/[“”]/g, '"');
const englisch = s => { assert.ok(!looksGerman(sauber(s)), `deutscher Rest: ${s}`); assert.ok(!/[{}]/.test(s), `offener Platzhalter: ${s}`); };

test('validatePlan: alle Meldungen englisch', () => {
  const K = mkCase('k', 120, 60, 60, { name: 'Bühne', maxTopLoad: 50, stackable: false });
  const W = mkCase('w', 120, 60, 60, { name: 'Bühne', weight: 100000, layers: [2] });
  const Z = mkCase('z', 60, 60, 60, { name: 'Bühne', weight: 0 });
  const H = mkCase('h', 100, 100, 50, { name: 'Bühne', weight: 500 });
  const pl = plan([
    P('a', 'k', 0, 0, 0), P('b', 'k', 60, 0, 0), P('c', 'k', 2000, 0, 0), P('d', 'k', 0, 100, 0, { orientation: 'tipLong' }),
    P('e', 'k', 0, 150, 0), P('f', 'w', 0, 150, 60), P('g', 'w', 300, 150, 0), P('u', 'k', 700, 0, 60),
    ...[0, 1, 2, 3, 4].map(n => P(`s${n}`, 'z', 900, 0, n * 60)), P('x', 'gibtsnicht', 0, 0, 0, { label: 'Bühne' }),
  ]);
  const seen = new Set();
  for (const [truck, cases, p] of [
    [SPRINTER, byId(K, W, Z), pl],
    [mkTruck(), byId(H, Z), plan([P('a', 'h', 0, 0, 0), P('b', 'h', 110, 0, 0), P('c', 'z', 250, 180, 0)])],
    [mkTruck(), byId(H), plan([P('a', 'h', 0, 0, 0), P('b', 'h', 110, 0, 0)])],
    [mkTruck(), byId(Z), plan([P('a', 'z', 0, 0, 0)])],
  ]) {
    for (const i of validatePlan(p, cases, truck).issues) { englisch(i.message); seen.add(i.code); }
  }
  for (const code of ['missingCase', 'outOfBounds', 'arch', 'notTippable', 'collision', 'notStackable', 'unsupported', 'tooManyLayers', 'tooHeavy', 'imbalance', 'layer'])
    assert.ok(seen.has(code), `Fall ${code} nicht erzeugt (seen: ${[...seen]})`);
});

test('validatePlan: Beispielsatz', () => {
  const K = mkCase('k', 120, 60, 60, { name: 'Bühne' });
  const r = validatePlan(plan([P('a', 'k', 5000, 0, 0)]), byId(K), mkTruck());
  assert.equal(r.issues.find(i => i.code === 'outOfBounds').message, '“Bühne” sticks out of the load space.');
});

test('unplacedReason: jeder Grund englisch', () => {
  const t1 = mkTruck({ l: 200, w: 100, h: 90, payload: 100 });
  const texte = [
    unplacedReason({ id: 'u' }, mkCase('big', 300, 80, 80, { tippable: true }), t1),
    unplacedReason({ id: 'u', tipped: true }, mkCase('hi', 120, 50, 80, { tippable: true }), mkTruck({ l: 200, w: 70, h: 90 })),
    unplacedReason({ id: 'u', tipped: false }, mkCase('lg', 100, 50, 150, { tippable: true }), t1),
    unplacedReason({ id: 'u' }, mkCase('schwer', 100, 50, 50, { weight: 1500 }), t1),
    unplacedReason({ id: 'u', layers: [2, 3] }, mkCase('l', 100, 50, 50), t1),
  ];
  assert.equal(texte.length, 5);
  for (const s of texte) { assert.ok(s); englisch(s); }
  assert.equal(texte[3], 'too heavy for the truck’s payload (1,500 kg, 100 kg allowed)');
});

test('Neuer LKW im Mehr-LKW-Plan heißt „Truck 2“', () => {
  const p = plan([P('p1', 'a', 0, 0, 0)]);
  const m = addLkw(p, { truckId: 't' }, counter('L'));
  assert.deepEqual(m.lkws.map(l => l.name), ['Truck 1', 'Truck 2']);
  assert.equal(convertToMulti(p, counter('L')).lkws[0].name, 'Truck 1');
});

test('Sammlungen: Meldungen englisch, englischer Name der festen Sammlung wird erkannt', () => {
  assert.equal(MEINE_NAME, 'Meine Sammlung');
  assert.equal(MEINE_NAME_EN, 'My collection');
  const cols = [{ id: 'meine', name: MEINE_NAME }, { id: 'x', name: 'Bühne' }];
  for (const s of [collectionNameError('', cols), collectionNameError('__a__', cols), collectionNameError('bühne', cols),
    collectionNameError('x'.repeat(500), cols), parentError(cols, null, 'nix'), parentError([{ id: 'a', name: 'a' }], 'a', 'a')]) englisch(s);
  assert.equal(resolveTarget({ company: 'my COLLECTION' }, null, cols, 'n').id, MEINE_ID);
  assert.equal(resolveTarget({ company: 'meine sammlung' }, null, cols, 'n').id, MEINE_ID);
});

test('Pack-Regeln, Traversen, LKW-Hinweise, Kopien: englisch', () => {
  const cases = new Map([['big', { name: 'Bühne' }]]);
  for (const r of [{ by: 'truss', pos: 'last' }, { by: 'group', value: 'G', pos: 'first' }, { by: 'case', value: 'big', pos: 'first' },
    { by: 'category', value: 'Licht', pos: 'last' }, { by: 'volume' }, { by: 'count' }]) englisch(describeRule(r, cases));
  assert.equal(describeRule({ by: 'category', value: 'Licht', pos: 'last' }, cases), 'Department “Lighting”: last (door)');
  for (const s of [...Object.values(POS_LABEL), ...RULE_KINDS.map(k => k.label)]) englisch(s);
  assert.throws(() => trussDims({ length: 100, width: 500, count: 1 }), e => { englisch(e.message); return true; });
  assert.throws(() => trussDims({ length: 100, width: 40, count: 1, wagonW: 50 }), e => { englisch(e.message); return true; });
  assert.throws(() => splitWagons(0, 1), e => { englisch(e.message); return true; });
  assert.equal(stueck(1), '1 item');
  assert.equal(stueck(3), '3 items');
  const c = new Map([['a', mkCase('a', 10, 10, 10, { category: 'Licht' })]]);
  const mp = { ...plan([P('p1', 'a', 0, 0, 0), P('p2', 'zz', 0, 0, 0)]), lkws: [{ id: 'L', name: 'T', truckId: 't', categories: ['Ton'] }] };
  mp.placements = mp.placements.map(x => ({ ...x, lkw: 'nirgends' }));
  const lines = unassignedLines(mp, c);
  assert.deepEqual(lines, ['1 item without a truck (Lighting)', '1 item with an unknown case']);
  englisch(truckMarke({ id: 'x' }, { trucks: new Set(['x']) }).title);
  englisch(truckStiftSperre({ trucks: new Set(['x']) }, { id: 'x' }).title);
});

// ---- Task 4b: Store ----
const bundle = fields => JSON.stringify({ format: 'truckload', version: 1, ...fields });
const okCase = mkCase('own', 120, 60, 60);
const wirft = (fn, test = englisch) => assert.throws(fn, e => { test(e.message); return true; });

test('checkCase und die anderen Prüfungen werfen englische Meldungen', () => {
  assert.throws(() => checkCase({ id: 'x', name: 'A', l: -1, w: 1, h: 1, weight: 1 }), /^Error: Case “A” has invalid dimensions\.$/);
  wirft(() => checkCase(null));
  wirft(() => checkCase({ ...okCase, weight: -1 }));
  wirft(() => checkCase({ ...okCase, color: 'rot' }));
  wirft(() => checkCase({ ...okCase, updatedAt: 5 }));
  wirft(() => checkCase({ ...okCase, stock: 'x' }));
  wirft(() => checkCase({ ...okCase, kind: 'truss', truss: { length: 1 } }));
  wirft(() => checkCase({ ...okCase, name: 'N'.repeat(200) }));
  const truck = mkTruck();
  wirft(() => checkTruck(null));
  wirft(() => checkTruck({ ...truck, l: 0 }));
  wirft(() => checkTruck({ ...truck, updatedAt: 5 }));
  wirft(() => checkTruck({ ...truck, wheelArches: 'x' }));
  wirft(() => checkTruck({ ...truck, wheelArches: [{}] }));
  wirft(() => checkTruck({ ...truck, name: 'N'.repeat(200) }));
  const pl = extra => ({ id: 'p', name: 'Tour', truckId: 't', placements: [], unplaced: [], notes: '', ...extra });
  wirft(() => checkPlan(null));
  wirft(() => checkPlan(pl({ updatedAt: 5 })));
  wirft(() => checkPlan(pl({ notes: 5 })));
  wirft(() => checkPlan(pl({ packOrder: 'x' })));
  wirft(() => checkPlan(pl({ packRules: 'x' })));
  wirft(() => checkPlan(pl({ mixTop: 'x' })));
  wirft(() => checkPlan(pl({ lkws: 'x' })));
  wirft(() => checkPlan(pl({ lkws: [{ id: 'a', name: 'A', truckId: 't', categories: [] }, { id: 'a', name: 'B', truckId: 't', categories: [] }] })));
  wirft(() => checkPlan(pl({ lkws: [{ id: 'a', name: 'N'.repeat(200), truckId: 't', categories: [] }] })));
  wirft(() => checkPlan(pl({ mitgefuehrt: 'x' })));
  wirft(() => checkPlan(pl({ placements: [{}] })));
  wirft(() => checkPlan(pl({ name: 'N'.repeat(200) })));
  wirft(() => checkRuleSet({ id: 'r', name: '', rules: [] }));
  wirft(() => checkCollection(null));
  wirft(() => checkCollection({ id: 'x'.repeat(100), name: 'A' }));
  wirft(() => checkCollection({ id: 'x', name: 'A'.repeat(200) }));
  wirft(() => checkCollection({ id: 'x', name: '  ' }));
  wirft(() => checkCollection({ id: 'x', name: 'A', parentId: 5 }));
  wirft(() => checkCollection({ id: 'x', name: 'A', updatedAt: 5 }));
});

test('parseBundle: Wrapper-Fehler (innerer Fehler) ist vollständig englisch', () => {
  const kaputt = { id: 'p', name: 'Tour', truckId: 't', placements: [], unplaced: [],
    mitgefuehrt: { version: 1, cases: [{ id: 'c', name: 'A', l: -1, w: 1, h: 1, weight: 1 }], trucks: [] } };
  wirft(() => parseBundle(bundle({ plans: [kaputt] })), m => {
    englisch(m);
    assert.match(m, /^Load plan “Tour” has an invalid copy of its cases or trucks: Case “A” has invalid dimensions\.$/);
  });
});

test('parseBundle und parseCollectionFile: Dateifehler englisch', () => {
  wirft(() => parseBundle('{'));
  wirft(() => parseBundle('{}'));
  wirft(() => parseBundle(JSON.stringify({ format: 'truckload' })));
  wirft(() => parseBundle(JSON.stringify({ format: 'truckload', version: 99 })));
  wirft(() => parseBundle(bundle({ cases: 5 })), m => { englisch(m); assert.match(m, /“Cases”/); });
  wirft(() => parseBundle(bundle({ projectRuleSets: 5 })), m => { englisch(m); assert.match(m, /“Project rule sets”/); });
  wirft(() => parseBundle(bundle({})));
  wirft(() => parseBundle(bundle({ cases: [okCase, okCase] })), m => { englisch(m); assert.match(m, /duplicate IDs in Cases/); });
  wirft(() => parseBundle(bundle({ collections: Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, name: `S${i}` })) })));
  const cf = extra => JSON.stringify({ format: 'truckload-collection', version: 1, collection: { id: 'k', name: 'K' }, cases: [okCase], ...extra });
  wirft(() => parseCollectionFile('{'));
  wirft(() => parseCollectionFile('{}'));
  wirft(() => parseCollectionFile(JSON.stringify({ format: 'truckload-collection' })));
  wirft(() => parseCollectionFile(JSON.stringify({ format: 'truckload-collection', version: 9 })));
  wirft(() => parseCollectionFile(cf({ collection: { id: 'k' } })));
  wirft(() => parseCollectionFile(cf({ collection: { id: 'x'.repeat(100), name: 'K' } })));
  wirft(() => parseCollectionFile(cf({ collection: { id: 'k', name: 'K'.repeat(200) } })));
  wirft(() => parseCollectionFile(cf({ collection: { id: 'k', name: '__x__' } })));
  wirft(() => parseCollectionFile(cf({ cases: 'x' })), m => { englisch(m); assert.match(m, /“Cases”/); });
  wirft(() => parseCollectionFile(cf({ cases: [okCase, okCase] })));
});

test('parseBundle: Reparaturmeldungen englisch, Einzahl und Mehrzahl', () => {
  const far = x => ({ id: x, caseId: 'own', x: 999999, y: 0, z: 0, orientation: 'standing', rot: 0 });
  const wheel = id => ({ ...mkCase(id, 100, 60, 60), wheelH: 80 });
  const long = id => ({ ...mkCase(id, 100, 60, 60), name: 'N'.repeat(200) });
  const pl = { id: 'p', name: 'Tour', truckId: 't', notes: '', placements: [far('a'), far('b')], unplaced: [],
    lkws: [{ id: 'L', name: 'T', truckId: 't', categories: [] }] };
  const res = parseBundle(bundle({
    cases: [wheel('w1'), wheel('w2'), long('l1'), { ...okCase, collectionId: 'weg' }], trucks: [mkTruck()],
    plans: [{ ...pl, placements: [...pl.placements, { id: 'c', caseId: 'own', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0, lkw: 'weg' }], truckId: 't' }],
    collections: [{ id: 'm', name: 'Standard' }, { id: 'n', name: 'X', parentId: 'nirgends' }],
  }));
  assert.ok(res.repairs.length >= 5, res.repairs.join('\n'));
  for (const r of res.repairs) englisch(r);
  assert.ok(res.repairs.some(r => /^2 cases: castor height/.test(r)), res.repairs.join('\n'));
  assert.ok(res.repairs.some(r => /^1 case: name longer than/.test(r)));
  assert.ok(res.repairs.some(r => /^1 case: collection unknown – moved to “My collection”\./.test(r)));
});

test('repairImportedCollections: Reparaturmeldungen englisch, auch „My collection“ ist belegt', () => {
  const local = [{ id: 'l', name: 'Lokal' }];
  const r = repairImportedCollections(local, [{ id: 'a', name: 'Lokal' }, { id: 'b', name: 'My collection' }, { id: 'c', name: 'C', parentId: 'd' }, { id: 'd', name: 'D', parentId: 'c' }]);
  assert.equal(r.repairs.length, 2, r.repairs.join('\n'));
  for (const m of r.repairs) englisch(m);
  assert.match(r.repairs[0], /^2 collections: the name already existed locally – renamed\.$/);
  assert.match(r.repairs[1], /^1 collection: the parent formed a loop/);
  const one = repairImportedCollections(local, [{ id: 'a', name: 'Lokal' }]).repairs;
  assert.deepEqual(one, ['1 collection: the name already existed locally – renamed.']);
});

test('Sammlungsnamen: „My collection“ gilt in der Datei als reserviert und wird umbenannt', () => {
  for (const name of ['My collection', 'Meine Sammlung', 'my COLLECTION']) {
    const res = parseBundle(bundle({ collections: [{ id: 'k', name }] }));
    assert.notEqual(res.collections[0].name.toLowerCase(), name.toLowerCase());
    assert.match(res.collections[0].name, / \(2\)$/);
  }
});

test('dollyName und parseDollyName: erzeugt in der aktiven Sprache, liest beide', () => {
  assert.equal(dollyName('K2', 4), 'K2 ×4 (on dolly)');
  setLang('de');
  assert.equal(dollyName('K2', 4), 'K2 4er (auf Dolly)');
  for (const lang of ['de', 'en']) {
    setLang(lang);
    assert.deepEqual(parseDollyName('K2 4er (auf Dolly)'), { base: 'K2', n: '4' });
    assert.deepEqual(parseDollyName('K2 ×4 (on dolly)'), { base: 'K2', n: '4' });
    assert.equal(parseDollyName('K2'), null);
  }
});

test('Import: zu langer Dolly-Name bleibt in beiden Namensformen lesbar (deutscher Name unter en, englischer unter de)', () => {
  const dolly = name => ({ id: 'd', name, l: 80, w: 60, h: 80, weight: 100, tippable: false, stackable: true, kind: 'speaker' });
  const deName = `${'D'.repeat(91 - ' 4er (auf Dolly)'.length)} 4er (auf Dolly)`;
  const enName = `${'D'.repeat(91 - ' ×4 (on dolly)'.length)} ×4 (on dolly)`;
  setLang('en');
  const a = parseBundle(bundle({ cases: [dolly(deName)] })).cases[0].name;
  assert.equal(a.length, 80);
  assert.ok(a.endsWith(' ×4 (on dolly)'), a);
  const a2 = parseCollectionFile(JSON.stringify({ format: 'truckload-collection', version: 1, collection: { id: 'k', name: 'K' }, cases: [dolly(deName)] })).cases[0].name;
  assert.ok(a2.endsWith(' ×4 (on dolly)') && a2.length === 80, a2);
  setLang('de');
  const b = parseBundle(bundle({ cases: [dolly(enName)] })).cases[0].name;
  assert.equal(b.length, 80);
  assert.ok(b.endsWith(' 4er (auf Dolly)'), b);
  const b2 = parseCollectionFile(JSON.stringify({ format: 'truckload-collection', version: 1, collection: { id: 'k', name: 'K' }, cases: [dolly(enName)] })).cases[0].name;
  assert.ok(b2.endsWith(' 4er (auf Dolly)') && b2.length === 80, b2);
});

test('Speicher: Ladesperre, Transaktionsfehler und NYX-Fehler englisch, Sperre mit Kennung', async () => {
  globalThis.indexedDB = { open() { throw new Error('IndexedDB benutzt'); } };
  const hostDb = await import('../js/store/hostDb.js');
  const db = await import('../js/store/db.js');
  const host = { getAll: async () => 'keine Liste', put: async () => { throw undefined; } };
  await assert.rejects(hostDb.getAll(host, 'plans'), e => { englisch(e.message); assert.match(e.message, /“plans”/); return true; });
  await assert.rejects(hostDb.put(host, 'plans', {}), e => { englisch(e.message); return true; });
  globalThis.truckloadHost = { getAll: async () => { throw new Error('kaputt'); }, put: async () => {}, del: async () => {}, writeMany: async () => {} };
  try {
    await assert.rejects(db.getAll('plans'));
    await assert.rejects(db.put('cases', { id: 'c' }), e => { englisch(e.message); assert.equal(e.code, 'host-load-failed'); return true; });
  } finally { delete globalThis.truckloadHost; delete globalThis.indexedDB; }
});
