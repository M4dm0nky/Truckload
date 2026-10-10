import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseOrientation, buildStacks, placeStacks, autoPack, orderSorts } from '../js/model/packer.js';
import { PACK_ORDERS, legacyRules } from '../js/model/packRules.js';
import { validatePlan } from '../js/model/validate.js';
import { wheelFace, DOOR_FACE, isTruss, pieceOrientations, canTip, boxOf, overlaps } from '../js/model/geometry.js';
import { mkCase, mkTruck, SPRINTER, plan, byId } from './fixtures.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { PRESET_TRUCKS } from '../js/data/preset-trucks.js';

const mkItem = (c, id, extra = {}) => ({ id, caseId: c.id, c, ...extra });
const items = (c, n, pre = 'i') => Array.from({ length: n }, (_, i) => mkItem(c, `${pre}${i + 1}`));
const placementIssues = r => r.issues.filter(i => i.placementId);

test('nicht tippbar → stehend', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: false });
  assert.equal(chooseOrientation(c, mkTruck()).orientation, 'standing');
});
test('tippbar → getippt, wenn es besser füllt', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  assert.notEqual(chooseOrientation(c, mkTruck()).orientation, 'standing');
});
test('zu groß → null', () => {
  assert.equal(chooseOrientation(mkCase('a', 2000, 60, 60), mkTruck()), null);
});
test('flaches, stapelbares Case: Score deckelt die Lagenzahl auf die 4er-Grenze von buildStacks (docs/code-review-2026-09-21.md)', () => {
  // 120×60×30, tippbar, Standard-Truck: stehend passen rechnerisch 9 Lagen (270/30) in
  // die Fahrzeughöhe, buildStacks stapelt aber nie höher als 4 → der Score darf nicht mit
  // 9 Lagen rechnen, sonst gewinnt „standing“ fälschlich gegen das getippte tipLong.
  const c = mkCase('a', 120, 60, 30, { tippable: true });
  const truck = mkTruck();
  const o = chooseOrientation(c, truck);
  assert.equal(o.orientation, 'tipLong', 'getippt soll gewinnen, nicht stehend mit erfundenen 9 Lagen');
});
test('24 flache Cases (120×60×30): getippt statt gestellt braucht deutlich weniger Lademeter als die 2,40 m im "standing"-Fehlverhalten', () => {
  const c = mkCase('a', 120, 60, 30, { tippable: true });
  const truck = mkTruck();
  const { placements, unplaced } = autoPack(items(c, 24), truck);
  assert.equal(unplaced.length, 0);
  assert.ok(placements.every(p => p.orientation !== 'standing'), 'kein Stück bleibt stehen');
  const r = validatePlan(plan(placements), byId(c), truck);
  assert.deepEqual(placementIssues(r), []);
  // Mit dem alten, ungedeckelten Score gewann „standing“ und brauchte 2,40 Lademeter
  // (docs/code-review-2026-09-21.md). Getippt braucht deutlich weniger.
  assert.ok(r.totals.loadMeters < 1.5, `Lademeter ${r.totals.loadMeters} sollten deutlich unter 2,40 liegen`);
});
test('layers:[1] begrenzt den Score-Lagenwert zusätzlich auf 1 (buildStacks stellt solche Cases immer allein auf den Boden)', () => {
  // Nicht tippbar, damit nur „standing“-Kandidaten existieren und der gewählte Score
  // direkt nachrechenbar ist: layersOf(c) = [1] muss den Score auf 1 Lage deckeln,
  // nicht auf floor(270/30) = 9.
  const c = mkCase('a', 120, 60, 30, { tippable: false, layers: [1] });
  const truck = mkTruck();
  const o = chooseOrientation(c, truck);
  assert.equal(o.orientation, 'standing');
  const cols = Math.floor(truck.w / 60);
  const cappedScore = (cols * 60 / truck.w) * (1 * 30 / truck.h);
  assert.ok(Math.abs(o.score - cappedScore) < 1e-9,
    `Score ${o.score} sollte mit 1 Lage gerechnet sein (${cappedScore}), nicht mit 9`);
});
test('Auto-Beladung tippt mit Rollen zur Trucktür', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const o = chooseOrientation(c, mkTruck());
  assert.notEqual(o.orientation, 'standing');
  assert.equal(wheelFace({ orientation: o.orientation, rot: o.rot }), DOOR_FACE);
});
test('Stapel respektieren maxTopLoad', () => {
  const c = mkCase('a', 120, 60, 60, { maxTopLoad: 150 });
  const { stacks } = buildStacks(items(c, 4), mkTruck());
  assert.deepEqual(stacks.map(s => s.items.length), [2, 2]);
});
test('nicht stapelbar → Einzelstapel', () => {
  const c = mkCase('a', 120, 60, 60, { stackable: false });
  assert.equal(buildStacks(items(c, 3), mkTruck()).stacks.length, 3);
});
test('10 Kabelcases: 3 Stapel an der Stirnwand, fehlerfrei', () => {
  const K = mkCase('k', 120, 60, 60);
  const truck = mkTruck();
  const { placements, unplaced } = autoPack(items(K, 10), truck);
  assert.equal(placements.length, 10);
  assert.deepEqual(unplaced, []);
  assert.ok(placements.every(p => p.x === 0));
  assert.equal(Math.max(...placements.map(p => p.z)), 180);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(K), truck)), []);
});
test('Sprinter mit Radkästen: fehlerfrei, nichts geht verloren', () => {
  const S = mkCase('s', 60, 60, 60);
  const { placements, unplaced } = autoPack(items(S, 40), SPRINTER);
  assert.equal(placements.length + unplaced.length, 40);
  assert.ok(placements.length > 20);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(S), SPRINTER)), []);
});
test('Stapel wird nie höher als 4 Lagen', () => {
  const c = mkCase('a', 120, 60, 60);
  const { stacks } = buildStacks(items(c, 5), mkTruck());
  assert.deepEqual(stacks.map(s => s.items.length), [4, 1]);
});
// Der Test oben scheitert in Wahrheit an der Truckhöhe (4 × 60 = 240, + 60 = 300 > 270) und
// auch an DEFAULT_LAYERS ([1,2,3,4]), nicht an der 4-Lagen-Grenze, die buildStacks selbst hart
// verdrahtet (`s.items.length < 4`, packer.js). Entfernt man diese Zeile ersatzlos, bleibt der
// Test oben unverändert grün (docs/code-review-2026-09-21.md, „packer.test.js:‚Stapel wird nie
// höher als 4 Lagen' prüft nicht, was der Name sagt"). Um die Grenze unabhängig von Truckhöhe
// UND layersOf zu treffen, braucht es ein flaches Case mit einer eigenen `layers`-Liste, die
// über 4 hinausgeht, und genug Fahrzeughöhe für mehr als 4 Lagen.
test('Stapel wird nie höher als 4 Lagen, auch wenn Truckhöhe und layersOf mehr erlauben würden', () => {
  const c = mkCase('a', 120, 60, 20, { layers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  const truck = mkTruck(); // Höhe 270 cm: 5 × 20 = 100 cm passt locker, layersOf erlaubt bis 10.
  const { stacks } = buildStacks(items(c, 5), truck);
  assert.deepEqual(stacks.map(s => s.items.length), [4, 1],
    'der fünfte Case darf nicht auf den bestehenden Stapel, egal was layersOf und Truckhöhe erlauben');
});
test('Case mit nur Lage 1 kommt immer auf den Boden, nie auf ein anderes Case', () => {
  const base = mkCase('base', 120, 60, 60, { layers: [1] });
  const filler = mkCase('filler', 120, 60, 60);
  const { stacks } = buildStacks([mkItem(filler, 'f1'), mkItem(filler, 'f2'), mkItem(base, 'b1')], mkTruck());
  const baseStack = stacks.find(s => s.items.some(it => it.c.id === 'base'));
  assert.equal(baseStack.items[0].c.id, 'base');
});
test('Case, das Lage 1 nicht erlaubt, kommt nur auf bestehende Stapel oder wird unplaced', () => {
  const onlyTop = mkCase('top', 120, 60, 60, { layers: [2] });
  const { stacks: withoutBase, unplaced: withoutBaseUnplaced } = buildStacks([mkItem(onlyTop, 'o1')], mkTruck());
  assert.equal(withoutBase.length, 0);
  assert.deepEqual(withoutBaseUnplaced.map(it => it.caseId), ['top']);

  const base = mkCase('base', 120, 60, 60, { layers: [1] });
  const { stacks: withBase, unplaced: withBaseUnplaced } =
    buildStacks([mkItem(base, 'b1'), mkItem(onlyTop, 'o1')], mkTruck());
  assert.deepEqual(withBaseUnplaced, []);
  assert.equal(withBase.length, 1);
  assert.deepEqual(withBase[0].items.map(it => it.c.id), ['base', 'top']);
});
test('Case ohne Lage 1 findet einen später aufgebauten Basis-Stapel (unabhängig von der Eingabereihenfolge)', () => {
  const def = mkCase('def', 120, 60, 60);
  const top2 = mkCase('top2', 120, 60, 60, { layers: [2] });
  const { stacks, unplaced } = buildStacks([mkItem(def, 'd1'), mkItem(top2, 't1')], mkTruck());
  assert.deepEqual(unplaced, []);
  assert.equal(stacks.length, 1);
  assert.deepEqual(stacks[0].items.map(it => it.c.id), ['def', 'top2']);
});
test('Case mit nur Lage 3 landet auf einem 2-hohen Stapel', () => {
  const def = mkCase('def', 120, 60, 60);
  const only3 = mkCase('only3', 120, 60, 60, { layers: [3] });
  const { stacks, unplaced } = buildStacks([mkItem(def, 'd1'), mkItem(def, 'd2'), mkItem(only3, 'o1')], mkTruck());
  assert.deepEqual(unplaced, []);
  assert.equal(stacks.length, 1);
  assert.deepEqual(stacks[0].items.map(it => it.c.id), ['def', 'def', 'only3']);
});
test('Schwer auf leicht: ein 300 kg Case landet nie oben auf einem 30 kg Case gleicher Grundfläche', () => {
  const light = mkCase('light', 120, 60, 60, { weight: 30, layers: [1, 2] });
  const heavy = mkCase('heavy', 120, 60, 60, { weight: 300 });
  const { stacks } = buildStacks([mkItem(light, 'l1'), mkItem(heavy, 'h1')], mkTruck());
  for (const s of stacks) {
    const idx = s.items.findIndex(it => it.c.id === 'heavy');
    if (idx === -1) continue;
    assert.equal(idx, 0, 'heavy muss unten (Lage 1) stehen, nie über light');
  }
  const lightStack = stacks.find(s => s.items.some(it => it.c.id === 'light'));
  const heavyAboveLight = lightStack && lightStack.items.some((it, i) =>
    it.c.id === 'heavy' && lightStack.items.slice(0, i).some(below => below.c.id === 'light'));
  assert.ok(!heavyAboveLight, 'heavy darf nie über light im selben Stapel liegen');
});

test('Hindernisse werden umgangen', () => {
  const K = mkCase('k', 120, 60, 60);
  const obstacles = [{ x0: 0, y0: 0, z0: 0, x1: 120, y1: 248, z1: 60 }];
  const { placements } = autoPack([mkItem(K, 'k1')], mkTruck(), { obstacles });
  assert.equal(placements[0].x, 120);
});

test('autoPack übernimmt id, label und Farbe des Stücks statt neuer ID', () => {
  const K = mkCase('k', 120, 60, 60);
  const { placements } = autoPack([mkItem(K, 'stück-1', { label: 'Case A', color: '#ff0000' })], mkTruck());
  assert.equal(placements[0].id, 'stück-1');
  assert.equal(placements[0].label, 'Case A');
  assert.equal(placements[0].color, '#ff0000');
});

test('autoPack: getippte Placements haben die Rollen zur Trucktür (breite Stichprobe)', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const { placements } = autoPack(items(c, 3), mkTruck());
  assert.ok(placements.length > 0);
  for (const p of placements) {
    if (p.orientation === 'standing') continue;
    assert.equal(wheelFace(p), DOOR_FACE,
      `getipptes Placement ${p.id} (rot ${p.rot}) sollte Rollen zur Tür haben`);
  }
});

// Für 120×60×100 im Standard-Truck gewinnt score-bestens bereits rot 270 mit
// Rollen zur Tür (kein Swap nötig) — der obige Test greift also nicht bei einem
// Rückbau von `% 360` auf `% 180` oder beim Rückbau des Score-Vorrangs in
// chooseOrientation. Die folgenden zwei Tests zielen gezielt auf genau diese
// beiden Fixes.

test('autoPack: Rotation bleibt nach einem Grundriss-Swap korrekt (Regression für % 360 statt % 180)', () => {
  // Standing-only (nicht tippbar), damit die Türausrichtungs-Logik aus
  // chooseOrientation hier keine Rolle spielt — reiner Test der rot-Arithmetik
  // beim Swap in placeStacks/autoPack.
  const c = mkCase('a', 30, 50, 30, { tippable: false });
  const truck = mkTruck();
  // chooseOrientation wählt für dieses Case/Truck standing/rot 90 (dx 50, dy 30).
  // Das Hindernis überdeckt x 35–45 bei y 0–10: die ungeswappte Box (x 0–50,
  // y 0–30) kollidiert damit, die geswappte Box (x 0–30, y 0–50) nicht mehr —
  // placeStacks muss also tatsächlich swap: true wählen, um das Stück
  // unterzubringen.
  const obstacle = { x0: 35, y0: 0, x1: 45, y1: 10, z0: 0, z1: 1000 };
  const { placements } = autoPack([mkItem(c, 'i1')], truck, { obstacles: [obstacle] });
  assert.equal(placements.length, 1);
  assert.equal(placements[0].x, 0);
  assert.equal(placements[0].y, 0);
  // (90 + 90) % 360 = 180 — mit dem alten Fehler % 180 würde hier 0 herauskommen.
  assert.equal(placements[0].rot, 180);
});

test('autoPack: Türausrichtung gewinnt gegen den score-besten getippten Kandidaten (Regression für Score-Vorrang)', () => {
  // Für 50×50×40 im Standard-Truck ist tipLong/rot 0 (Rollen zur linken Wand,
  // wheelFace '+y') score-bester getippter Kandidat; tipLong/rot 270 (Rollen
  // zur Tür) liegt score-mäßig klar dahinter, aber immer noch vor „standing“.
  // Ohne den Score-Vorrang aus chooseOrientation würde rot 0 gewinnen und die
  // Rollen zeigten nicht zur Tür.
  const c = mkCase('a', 50, 50, 40, { tippable: true });
  const { placements } = autoPack([mkItem(c, 'i1')], mkTruck());
  assert.equal(placements.length, 1);
  assert.notEqual(placements[0].orientation, 'standing');
  assert.equal(wheelFace(placements[0]), DOOR_FACE);
});

test('autoPack: unplaced behält seine Einträge (id/label/color) statt sie zu verwerfen', () => {
  const big = mkCase('big', 2000, 60, 60);
  const { unplaced } = autoPack([mkItem(big, 'stück-2', { label: 'Zu groß', color: '#00ff00' })], mkTruck());
  assert.deepEqual(unplaced, [{ id: 'stück-2', caseId: 'big', label: 'Zu groß', color: '#00ff00' }]);
});

// Lage/Tippen je Stück (Task 1): ein Stück mit eigenem tipped/layers schränkt chooseOrientation
// und buildStacks stärker ein als der Case-Typ allein — ohne diese Felder (Altdaten) bleibt
// alles wie vorher.

test('chooseOrientation: piece.tipped:true wählt nur tipLong/tipShort, nie standing', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const truck = mkTruck();
  for (let i = 0; i < 10; i++) {
    const o = chooseOrientation(c, truck, { tipped: true });
    assert.ok(o, 'ein Kandidat muss gefunden werden');
    assert.notEqual(o.orientation, 'standing');
  }
});
test('chooseOrientation: piece.tipped:false wählt nur standing, auch bei tippbarem Case-Typ', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const o = chooseOrientation(c, mkTruck(), { tipped: false });
  assert.equal(o.orientation, 'standing');
});
test('chooseOrientation: ohne piece-Feld bleibt das bisherige Verhalten (Regression)', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const truck = mkTruck();
  assert.deepEqual(chooseOrientation(c, truck, {}), chooseOrientation(c, truck));
  assert.deepEqual(chooseOrientation(c, truck), chooseOrientation(c, truck, undefined));
});
test('buildStacks: piece.layers:[1] steht immer auf dem Boden (Lage 1), nie oben auf einem anderen Stück, auch wenn der Case-Typ mehr Lagen erlaubt', () => {
  const c = mkCase('a', 120, 60, 60); // Case-Typ erlaubt per Default alle vier Lagen
  const { stacks } = buildStacks([
    mkItem(c, 'i1'), mkItem(c, 'i2', { layers: [1] }),
  ], mkTruck());
  const stackOfI2 = stacks.find(s => s.items.some(it => it.it.id === 'i2'));
  assert.equal(stackOfI2.items[0].it.id, 'i2', 'i2 (piece.layers:[1]) muss die Grundlage (Lage 1) seines Stapels sein, nicht darüber stehen');
});
test('autoPack: ein Stück ohne layers/tipped-Felder packt exakt wie vorher (Regression)', () => {
  const c = mkCase('a', 120, 60, 30, { tippable: true });
  const truck = mkTruck();
  const withoutFields = autoPack(items(c, 24), truck);
  const withEmptyFields = autoPack(items(c, 24, 'j').map(it => ({ ...it })), truck);
  assert.deepEqual(withoutFields.placements.map(p => ({ ...p, id: null })), withEmptyFields.placements.map(p => ({ ...p, id: null })));
});
test('autoPack: schreibt layers/tipped des Stücks in das Placement, wenn vorhanden', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const { placements } = autoPack([mkItem(c, 'i1', { layers: [1], tipped: true })], mkTruck());
  assert.equal(placements[0].tipped, true);
  assert.deepEqual(placements[0].layers, [1]);
});
test('autoPack: Placement ohne layers/tipped am Stück bekommt diese Felder nicht (Regression)', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const { placements } = autoPack([mkItem(c, 'i1')], mkTruck());
  assert.ok(!('tipped' in placements[0]));
  assert.ok(!('layers' in placements[0]));
});

// Fix-Runde 2 (Befund „Testlücke: erzwungenes Tippen, das nicht passt“): piece.tipped:true
// erzwingt tipLong/tipShort (geometry.js, pieceOrientations) — passen beide nicht in den
// Truck, gibt es KEINEN Kandidaten mehr (auch nicht „standing“, obwohl das Case stehend
// passen würde), das Stück muss also unplaced landen und dabei layers/tipped behalten.
test('autoPack: piece.tipped:true, dessen getippte Maße nicht passen, landet in unplaced und behält layers/tipped', () => {
  // l=200/w=300/h=50, stehend passend (rot 90: dx=300, dy=200, dz=50), aber beide getippten
  // Lagen brauchen dz=300 bzw. dz=200 — mit der kleinen Truckhöhe 60 passt keine der beiden.
  const c = mkCase('a', 200, 300, 50, { tippable: true });
  const truck = mkTruck({ h: 60 });
  assert.ok(chooseOrientation(c, truck), 'stehend muss ohne piece.tipped passen (Testannahme)');
  const { placements, unplaced } = autoPack(
    [mkItem(c, 'i1', { layers: [1], tipped: true })], truck);
  assert.deepEqual(placements, []);
  assert.deepEqual(unplaced, [{ id: 'i1', caseId: 'a', layers: [1], tipped: true }]);
});

// Sortenrein packen (Spec docs/superpowers/specs/2026-09-28-sortenrein-packen-design.md).
const sortsOf = groups => groups.map(g => g[0].caseId);

test('PACK_ORDERS: genau volume und count', () => {
  assert.deepEqual(PACK_ORDERS, ['volume', 'count']);
});

test('orderSorts volume: größtes Einzelvolumen zuerst, Traversen immer zuletzt', () => {
  const big = mkCase('big', 120, 60, 100);
  const small = mkCase('small', 60, 60, 60);
  const truss = mkCase('truss', 300, 62, 115, { kind: 'truss', truss: { length: 300, width: 62, count: 1, standing: true, height: 115 } });
  const list = [...items(small, 5, 's'), ...items(truss, 2, 't'), ...items(big, 1, 'b')];
  assert.deepEqual(sortsOf(orderSorts(list, legacyRules('volume'))), ['big', 'small', 'truss']);
});

test('orderSorts count: meiste gleiche Stücke zuerst, Gleichstand nach Volumen', () => {
  const a = mkCase('a', 120, 60, 60);
  const b = mkCase('b', 120, 60, 100);
  const c = mkCase('c', 60, 60, 60);
  const list = [...items(a, 2, 'a'), ...items(b, 2, 'b'), ...items(c, 7, 'c')];
  assert.deepEqual(sortsOf(orderSorts(list, legacyRules('count'))), ['c', 'b', 'a']);
});

test('buildStacks: Stapel mischen keine Sorten, außer dem letzten offenen Stapel der vorigen Sorte', () => {
  const heavy = mkCase('heavy', 120, 60, 60, { weight: 300 });
  const light = mkCase('light', 120, 60, 60, { weight: 30 });
  // 3 × heavy → Stapel [h,h,h] (4 Lagen erlaubt, Truck 270 hoch: 3×60 + 60 = 240 passt),
  // danach 3 × light: das erste light füllt den offenen heavy-Stapel auf, der Rest bildet eigene.
  const { stacks } = buildStacks([...items(light, 3, 'l'), ...items(heavy, 3, 'h')], mkTruck(), { rules: legacyRules('count') });
  const ids = stacks.map(s => s.items.map(i => i.c.id));
  assert.deepEqual(ids[0], ['heavy', 'heavy', 'heavy', 'light']);
  assert.deepEqual(ids.slice(1), [['light', 'light']]);
  assert.deepEqual(stacks.map(s => s.sort), [0, 1]);
});

test('buildStacks: nur der LETZTE offene Stapel der vorigen Sorte wird aufgefüllt, nie ein früherer', () => {
  const a = mkCase('a', 120, 60, 60, { weight: 100, layers: [1, 2] });
  const b = mkCase('b', 120, 60, 60, { weight: 10 });
  // a: 3 Stück, höchstens 2 Lagen → Stapel [a,a] und [a]. b füllt nur den letzten ([a]) auf,
  // bis er voll ist (4 Lagen, 240 cm ≤ 270), nie den früheren [a,a] – der hat noch Platz für
  // Lage 3 und 4 und bleibt trotzdem sortenrein.
  const { stacks } = buildStacks([...items(a, 3, 'a'), ...items(b, 3, 'b')], mkTruck(), { rules: legacyRules('count') });
  const ids = stacks.map(s => s.items.map(i => i.c.id));
  assert.deepEqual(ids, [['a', 'a'], ['a', 'b', 'b', 'b']]);
});

test('buildStacks: Stück ohne Lage 1 ohne passenden offenen Stapel der vorigen Sorte → Ablage, nie fremder Stapel', () => {
  const first = mkCase('first', 120, 60, 60, { weight: 50 });
  const mid = mkCase('mid', 80, 60, 60, { weight: 40 });
  const onlyTop = mkCase('onlyTop', 120, 60, 60, { weight: 10, layers: [2] });
  // count: first ×3, mid ×2, onlyTop ×1 → die unmittelbar vorige Sorte von onlyTop ist mid (andere
  // Grundfläche). Die passenden first-Stapel gehören nicht dazu → onlyTop geht in die Ablage.
  const { unplaced, stacks } = buildStacks([...items(first, 3, 'f'), ...items(mid, 2, 'm'), ...items(onlyTop, 1, 'o')], mkTruck(), { rules: legacyRules('count') });
  assert.deepEqual(unplaced.map(u => u.caseId), ['onlyTop']);
  assert.ok(stacks.every(s => !s.items.some(i => i.c.id === 'onlyTop')));
});

test('buildStacks: gleiche Sorte mit unterschiedlichem tipped bleibt eine Sorte (gleiches sort)', () => {
  const t = mkCase('t', 120, 60, 100, { tippable: true });
  const list = [mkItem(t, 'a', { tipped: true }), mkItem(t, 'b', { tipped: false })];
  const { stacks } = buildStacks(list, mkTruck());
  assert.ok(stacks.length >= 1);
  assert.ok(stacks.every(s => s.sort === 0));
});

// Task 2: Sortenrein platzieren (placeStacks, autoPack)
// Beispiel-Load des Nutzers (2026-09-28): 10 × Mac Viper x2, 16 × MLT TWO 2,4 m, 30 × Packcase
// 120×60×60 im Sattelauflieger; Viper und Packcases wie aus dem Wizard (Lage 1+2, getippt).
const ALLC = new Map([...PRESET_CASES, ...CASE_LIBRARY].map(c => [c.id, c]));
const SATTEL = PRESET_TRUCKS.find(t => t.id === 'preset-sattel');
function exampleLoad() {
  const out = [];
  const add = (caseId, n, extra) => { for (let i = 0; i < n; i++) out.push({ id: `${caseId}#${i}`, caseId, c: ALLC.get(caseId), ...extra }); };
  add('lib-mac-viper-x2-cab', 10, { layers: [1, 2], tipped: true });
  add('preset-hof-mlt2-240', 16, {});
  add('preset-packcase-120x60x60', 30, { layers: [1, 2], tipped: true });
  return out;
}
// Je Säule (x,y) die caseIds von unten nach oben.
function columns(placements) {
  const cols = new Map();
  for (const p of [...placements].sort((a, b) => a.z - b.z)) {
    const k = `${p.x}|${p.y}`;
    if (!cols.has(k)) cols.set(k, []);
    cols.get(k).push(p);
  }
  return [...cols.values()];
}
function checkSortenrein(placements, sortOrder) {
  const rank = new Map(sortOrder.map((id, i) => [id, i]));
  const floor = placements.filter(p => p.z === 0);
  // Je Sorte das größte x0 ihrer Bodenstapel (= x0 der letzten Reihe dieser Sorte).
  const lastRowX = new Map();
  for (const id of sortOrder) {
    const xs = floor.filter(p => p.caseId === id).map(p => p.x);
    if (xs.length) lastRowX.set(id, Math.max(...xs));
  }
  // Stapel: unten eine Sorte, oben höchstens die direkt folgende – und eine gemischte Säule
  // (Ruling F1) steht nur in der letzten Reihe der UNTEREN Sorte, nie in einer früheren Reihe.
  for (const col of columns(placements)) {
    const r = col.map(p => rank.get(p.caseId));
    for (let i = 1; i < r.length; i++) assert.ok(r[i] === r[i - 1] || r[i] === r[i - 1] + 1, `Stapel gemischt: ${col.map(p => p.caseId)}`);
    const distinctSorts = new Set(r);
    assert.ok(distinctSorts.size <= 2);
    if (distinctSorts.size === 2) {
      const lowerId = sortOrder[Math.min(...r)];
      assert.equal(col[0].x, lastRowX.get(lowerId),
        `gemischte Säule (${col.map(p => p.caseId)}) steht nicht in der letzten Reihe von ${lowerId}`);
    }
  }
  // Blöcke: die Bodenstapel einer Sorte beginnen nie vor der letzten Reihe der vorigen.
  for (let i = 1; i < sortOrder.length; i++) {
    const prev = floor.filter(p => p.caseId === sortOrder[i - 1]);
    const cur = floor.filter(p => p.caseId === sortOrder[i]);
    if (!prev.length || !cur.length) continue;
    assert.ok(Math.min(...cur.map(p => p.x)) >= Math.max(...prev.map(p => p.x)),
      `${sortOrder[i]} beginnt vor der letzten Reihe von ${sortOrder[i - 1]}`);
  }
}

test('Beispiel-Load, Große zuerst: Viper → Packcase → MLT, sortenrein, alles geladen, fehlerfrei', () => {
  const { placements, unplaced } = autoPack(exampleLoad(), SATTEL, { order: 'volume' });
  assert.deepEqual(unplaced, []);
  assert.equal(placements.length, 56);
  checkSortenrein(placements, ['lib-mac-viper-x2-cab', 'preset-packcase-120x60x60', 'preset-hof-mlt2-240']);
  assert.equal(placements.find(p => p.x === 0 && p.y === 0 && p.z === 0).caseId, 'lib-mac-viper-x2-cab');
  assert.deepEqual(placementIssues(validatePlan(plan(placements), ALLC, SATTEL)), []);
});

test('Beispiel-Load, Stückzahl zuerst: Packcase → MLT → Viper, sortenrein, alles geladen, fehlerfrei', () => {
  const { placements, unplaced } = autoPack(exampleLoad(), SATTEL, { order: 'count' });
  assert.deepEqual(unplaced, []);
  checkSortenrein(placements, ['preset-packcase-120x60x60', 'preset-hof-mlt2-240', 'lib-mac-viper-x2-cab']);
  assert.equal(placements.find(p => p.x === 0 && p.y === 0 && p.z === 0).caseId, 'preset-packcase-120x60x60');
  assert.deepEqual(placementIssues(validatePlan(plan(placements), ALLC, SATTEL)), []);
});

test('Lücke der letzten Reihe: die nächste Sorte füllt freie Spuren, steht aber nie davor', () => {
  // 5 Wagen à 62 cm (4 passen in eine Reihe) → Reihe 2 hat 1 Wagen und 3 freie Spuren.
  const wagon = mkCase('wagon', 240, 62, 115, { stackable: false });
  const box = mkCase('box', 60, 60, 60, { stackable: false });
  const list = [...items(wagon, 5, 'w'), ...items(box, 3, 'b')];
  const { placements } = autoPack(list, mkTruck(), { order: 'volume' });
  const lastRowX = Math.max(...placements.filter(p => p.caseId === 'wagon').map(p => p.x));
  const boxes = placements.filter(p => p.caseId === 'box');
  assert.equal(boxes.length, 3);
  assert.ok(boxes.every(p => p.x >= lastRowX), 'box nie vor der letzten Wagenreihe');
  assert.ok(boxes.some(p => p.x === lastRowX), 'box füllt die freie Spur der letzten Reihe');
});

test('placeStacks: startX schiebt die erste Sorte hinter eine vorhandene Ladung', () => {
  const K = mkCase('k', 120, 60, 60);
  const { placements } = autoPack([mkItem(K, 'k1')], mkTruck(), { startX: 300 });
  assert.equal(placements[0].x, 300);
});

// F1 (Fix-Welle 2026-09-28): der aufgefüllte Mischstapel sprang bisher an die Stirnwand, weil
// placeStacks innerhalb einer Sorte nach dem GESAMTGEWICHT sortierte – das Auffüllen durch die
// nächste Sorte machte den Stapel schwerer als seine unangetasteten Geschwister und schob ihn
// dadurch fälschlich nach vorn. Ruling: nur nach dem Gewicht der EIGENEN Sorte sortieren
// (`ownWeight`) und einen aufgefüllten Stapel innerhalb seiner Sorte immer zuletzt stellen.
test('F1 (Fixtures): aufgefüllter Mischstapel steht in der letzten Reihe der Basissorte, nicht an der Stirnwand', () => {
  const heavy = mkCase('heavy', 120, 60, 60, { weight: 100, layers: [1] });
  const light = mkCase('light', 120, 60, 60, { weight: 90 });
  // Schmaler Truck (eine Spur) zwingt die vier heavy-Stapel hintereinander in x-Richtung, statt
  // nebeneinander in eine Reihe – so ist die „letzte Reihe" eindeutig das größte x0.
  const truck = mkTruck({ w: 70, l: 2000 });
  const { placements } = autoPack([...items(heavy, 4, 'h'), ...items(light, 1, 'l')], truck, { order: 'count' });
  const heavyFloor = placements.filter(p => p.caseId === 'heavy' && p.z === 0);
  const lastRowX = Math.max(...heavyFloor.map(p => p.x));
  const mixedCol = columns(placements).find(col =>
    col.some(p => p.caseId === 'heavy') && col.some(p => p.caseId === 'light'));
  assert.ok(mixedCol, 'es muss eine Mischsäule aus heavy und light geben');
  assert.equal(mixedCol[0].x, lastRowX,
    `Mischstapel steht bei x=${mixedCol[0].x}, sollte bei der letzten Reihe x=${lastRowX} stehen`);
  assert.notEqual(mixedCol[0].x, 0,
    'vor dem Fix landete der (jetzt schwerste) Mischstapel fälschlich an der Stirnwand x=0');
});

// Realer Fall aus der Reproduktion (.superpowers/sdd/2026-09-28-sortenrein-packen/p9.mjs):
// 9× 19″-Rack 20 HE (Lage 1, eigener Stapel je Stück) + 4× Packcase 80×60×60 (Lage 1+2,
// nicht getippt) im Sattelauflieger. Volumen-Reihenfolge: Rack zuerst (größeres Volumen),
// Packcase danach – der erste Packcase füllt den letzten Rack-Stapel auf.
function rackMixLoad() {
  const out = [];
  const add = (caseId, n, extra) => { for (let i = 0; i < n; i++) out.push({ id: `${caseId}#${i}`, caseId, c: ALLC.get(caseId), ...extra }); };
  add('preset-rack-20he', 9, { layers: [1] });
  add('preset-pack-80x60x60', 4, { layers: [1, 2], tipped: false });
  return out;
}
test('F1 (p9-Konstellation): Rack+Packcase-Mischstapel steht in der letzten Rack-Reihe, nicht an der Stirnwand', () => {
  const { placements, unplaced } = autoPack(rackMixLoad(), SATTEL, { order: 'volume' });
  assert.deepEqual(unplaced, []);
  const rackFloor = placements.filter(p => p.caseId === 'preset-rack-20he' && p.z === 0);
  const lastRowX = Math.max(...rackFloor.map(p => p.x));
  const mixedCol = columns(placements).find(col =>
    col.some(p => p.caseId === 'preset-rack-20he') && col.some(p => p.caseId === 'preset-pack-80x60x60'));
  assert.ok(mixedCol, 'es muss eine Mischsäule aus Rack und Packcase geben');
  assert.equal(mixedCol[0].x, lastRowX,
    `Mischsäule steht bei x=${mixedCol[0].x}, sollte in der letzten Rack-Reihe x=${lastRowX} stehen`);
});

// F4: prevLast wörtlich „unmittelbar vorige Sorte" – nur der Stapel, den GENAU diese Sorte
// begonnen (oder zuletzt aufgefüllt) hat, darf von der nächsten Sorte weiter aufgefüllt werden.
test('F4: Sorte komplett in der Ablage lässt prevLast verfallen – eine übernächste Sorte darf sie nicht überspringen', () => {
  const x = mkCase('x', 120, 60, 60, { weight: 50, layers: [1, 2] });
  const tooBig = mkCase('toobig', 2000, 60, 60, { weight: 999 });
  const b = mkCase('b', 120, 60, 60, { weight: 10 });
  // order 'count': x (3 Stück) zuerst, dann toobig (2, passt nirgends -> komplett Ablage),
  // dann b (1 Stück, gleiche Grundfläche und Gewicht wie x, würde ohne den Fix den offenen
  // x-Stapel auffüllen, obwohl toobig dazwischenliegt).
  const { stacks, unplaced } = buildStacks(
    [...items(x, 3, 'x'), ...items(tooBig, 2, 't'), ...items(b, 1, 'b')],
    mkTruck(), { rules: legacyRules('count') },
  );
  assert.deepEqual(unplaced.map(u => u.caseId), ['toobig', 'toobig']);
  const xStacks = stacks.filter(s => s.items.some(i => i.c.id === 'x'));
  assert.ok(xStacks.every(s => s.items.every(i => i.c.id === 'x')),
    'b darf keinen x-Stapel auffüllen – die dazwischenliegende Sorte „toobig" ist komplett in der Ablage');
  const bStack = stacks.find(s => s.items.some(i => i.c.id === 'b'));
  assert.deepEqual(bStack.items.map(i => i.c.id), ['b']);
});

test('F4: Sorte B füllt nur den Stapel von A auf (kein eigener Stapel) – Sorte C darf trotzdem nicht darauf', () => {
  const a = mkCase('a', 120, 60, 60, { weight: 50, layers: [1, 2] });
  const b = mkCase('b', 120, 60, 60, { weight: 10 });
  const c2 = mkCase('c', 120, 60, 60, { weight: 5 });
  // order 'count': a (3 Stück) -> [a,a] und [a]; b (1 Stück, gleiche Zahl wie c, Gleichstand
  // nach Volumen -> nach Namen: 'b' vor 'c') füllt NUR den offenen [a]-Stapel auf und beginnt
  // dabei nie einen eigenen Stapel; c darf deshalb nicht auf [a,b] weiterpacken.
  const { stacks } = buildStacks(
    [...items(a, 3, 'a'), ...items(b, 1, 'b'), ...items(c2, 1, 'c')],
    mkTruck(), { rules: legacyRules('count') },
  );
  const mixedStack = stacks.find(s => s.items.some(i => i.c.id === 'b'));
  assert.deepEqual(mixedStack.items.map(i => i.c.id), ['a', 'b']);
  const cStack = stacks.find(s => s.items.some(i => i.c.id === 'c'));
  assert.deepEqual(cStack.items.map(i => i.c.id), ['c'],
    'c darf den a/b-Stapel nicht weiter auffüllen, weil B nie einen eigenen Stapel begonnen hat');
});

// F5: Kandidatenpunkte mit x < minX werden auf minX geklemmt statt verworfen, damit eine freie
// Spur weiter hinten (bekannt über einen Eckpunkt eines weiter vorn liegenden Hindernisses)
// nicht verlorengeht.
test('F5: placeStacks klemmt Kandidatenpunkte mit x < minX auf minX, statt sie zu verwerfen', () => {
  const truck = mkTruck({ l: 1000, w: 248, h: 270 });
  const obstacle = { x0: 0, y0: 0, x1: 1000, y1: 188, z0: 0, z1: 9999 };
  const stack = { key: '60x60', dx: 60, dy: 60, height: 60, weight: 10, ownWeight: 10, sort: 0, items: [] };
  const { placed, failed } = placeStacks([stack], truck, [obstacle], { startX: 120 });
  // Ohne Klemmung: (minX,0) kollidiert mit dem Hindernis, (1000,0) ragt über die Trucklänge
  // hinaus – der Stapel würde in `failed` landen, obwohl bei (minX, 188) eine freie Spur liegt
  // (Eckpunkt (0,188) des Hindernisses, hier auf minX geklemmt statt verworfen).
  assert.equal(failed.length, 0, 'der Stapel sollte einen Platz finden');
  assert.equal(placed.length, 1);
  assert.equal(placed[0].box.x0, 120);
  assert.equal(placed[0].box.y0, 188);
});

// F9: zusätzliche Regressionstests.
test('F9: mehrere Sorten im SPRINTER – keine placementIssues, nichts geht verloren', () => {
  const K = mkCase('k', 60, 60, 60);
  const W = mkCase('w', 100, 60, 60, { weight: 50 });
  const list = [...items(K, 8, 'k'), ...items(W, 6, 'w')];
  const { placements, unplaced } = autoPack(list, SPRINTER, { order: 'volume' });
  assert.equal(placements.length + unplaced.length, list.length);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(K, W), SPRINTER)), []);
});

test('F9: eine Sorte mit gemischt getippt/stehend wird vollständig und fehlerfrei platziert', () => {
  const t = mkCase('t', 120, 60, 100, { tippable: true });
  const list = [
    ...Array.from({ length: 3 }, (_, i) => mkItem(t, `tip${i}`, { tipped: true })),
    ...Array.from({ length: 3 }, (_, i) => mkItem(t, `std${i}`, { tipped: false })),
  ];
  const truck = mkTruck();
  const { placements, unplaced } = autoPack(list, truck, { order: 'volume' });
  assert.equal(unplaced.length, 0);
  assert.equal(placements.length, 6);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(t), truck)), []);
});

// Spurraster je Sorte (Nutzer 2026-09-28: „Du stellst immer noch nicht 4× MLT nebeneinander“):
// Bottom-Left setzte den ersten MLT in die Ecke neben der letzten Packcase-Reihe (y = 60) – danach
// lagen die Wagen bei 60/122/184, an der Wand blieben 60 cm für 62 cm Wagen, also nur 3 je Reihe.
// Jede Sorte steht jetzt in ihrem eigenen Raster ab der Wand (y = k · Stapelbreite).
const floorLanes = (placements, caseId) =>
  [...new Set(placements.filter(p => p.caseId === caseId && p.z === 0).map(p => p.y))].sort((a, b) => a - b);

for (const order of ['volume', 'count']) {
  test(`Beispiel-Load (${order}): 4 MLT nebeneinander in den Spuren 0/62/124/186, 8 Bodenstapel`, () => {
    const { placements, unplaced } = autoPack(exampleLoad(), SATTEL, { order });
    assert.deepEqual(unplaced, []);
    assert.deepEqual(floorLanes(placements, 'preset-hof-mlt2-240'), [0, 62, 124, 186]);
    assert.equal(placements.filter(p => p.caseId === 'preset-hof-mlt2-240' && p.z === 0).length, 8);
    assert.deepEqual(placementIssues(validatePlan(plan(placements), ALLC, SATTEL)), []);
  });
}

test('Spurraster: 62er-Sorte nach 60er-Sorte steht in den Spuren 0/62/124/186', () => {
  const narrow = mkCase('narrow', 60, 60, 60, { stackable: false });   // 60er-Spuren
  const wagon = mkCase('wagon', 240, 62, 115, { stackable: false });
  // 9 narrow (mehr Stück als wagon → bei „Stückzahl zuerst“ vorn) → 2 volle Reihen à 4, Reihe 3
  // mit 1 bei y = 0 → Lücke y 60–248 in der letzten Reihe, in die der erste Wagen rutschen würde.
  const list = [...items(narrow, 9, 'n'), ...items(wagon, 8, 'w')];
  const { placements, unplaced } = autoPack(list, mkTruck(), { order: 'count' });
  assert.deepEqual(unplaced, []);
  assert.deepEqual(floorLanes(placements, 'wagon'), [0, 62, 124, 186]);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(narrow, wagon), mkTruck())), []);
});

// Pack-Regeln (Spec 2026-09-30): Blöcke = Case-Typ + Gruppe, Reihenfolge per Rangliste.
test('orderSorts: gleicher Case-Typ mit und ohne Gruppe ergibt zwei Blöcke', () => {
  const c = mkCase('mot', 60, 60, 60);
  const list = [...items(c, 3, 'a'), ...items(c, 2, 'g').map(it => ({ ...it, group: 'Motoren' }))];
  const blocks = orderSorts(list, [{ by: 'group', value: 'Motoren', pos: 'last' }]);
  assert.deepEqual(blocks.map(b => [b[0].group ?? '', b.length]), [['', 3], ['Motoren', 2]]);
});

test('orderSorts: legacyRules geben bei Altdaten die frühere Reihenfolge', () => {
  const big = mkCase('big', 120, 80, 80), small = mkCase('small', 60, 60, 60);
  const tr = mkCase('tr', 300, 62, 115, { kind: 'truss', truss: { length: 300, width: 62, count: 1, standing: true, height: 115 } });
  const list = [...items(small, 5, 's'), ...items(tr, 2, 't'), ...items(big, 1, 'b')];
  const ids = bl => bl.map(b => b[0].caseId);
  assert.deepEqual(ids(orderSorts(list, legacyRules('volume'))), ['big', 'small', 'tr']);
  assert.deepEqual(ids(orderSorts(list, [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }])), ['big', 'small', 'tr']);
  assert.deepEqual(ids(orderSorts(list, legacyRules('count'))), ['small', 'tr', 'big']);
});

test('autoPack: Gruppe „Motoren“ zuletzt steht an der Tür, Traversen zuerst an der Stirnwand', () => {
  const mot = mkCase('mot', 80, 60, 60, { weight: 45 });
  const pack = mkCase('pack', 120, 60, 60, { weight: 50 });
  const tr = mkCase('tr', 240, 62, 115, { kind: 'truss', stackable: false, weight: 120, truss: { length: 240, width: 62, count: 1, standing: true, height: 115 } });
  const list = [
    ...items(mot, 8, 'm').map(it => ({ ...it, group: 'Motoren' })),
    ...items(pack, 8, 'p'), ...items(tr, 4, 't'),
  ];
  const rules = [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'truss', pos: 'first' }, { by: 'volume' }];
  const { placements, unplaced } = autoPack(list, mkTruck(), { rules });
  assert.equal(unplaced.length, 0);
  const maxX = id => Math.max(...placements.filter(p => p.caseId === id).map(p => p.x));
  const minX = id => Math.min(...placements.filter(p => p.caseId === id).map(p => p.x));
  assert.equal(minX('tr'), 0, 'Traversen beginnen an der Stirnwand');
  assert.ok(minX('mot') >= maxX('pack'), 'Motoren stehen hinter den Packcases');
  assert.ok(placements.filter(p => p.caseId === 'mot').every(p => p.group === 'Motoren'), 'Gruppe wandert ins Placement');
  assert.ok(placements.filter(p => p.caseId === 'pack').every(p => !('group' in p)), 'ohne Gruppe kein Feld');
});

test('autoPack: order-String bleibt gültig und entspricht legacyRules (Altdaten)', () => {
  const a = mkCase('a', 120, 60, 60), b = mkCase('b', 60, 60, 60);
  const list = [...items(a, 3, 'a'), ...items(b, 6, 'b')];
  for (const order of ['volume', 'count']) {
    const viaOrder = autoPack(list, mkTruck(), { order });
    const viaRules = autoPack(list, mkTruck(), { rules: order === 'count'
      ? [{ by: 'count' }, { by: 'volume' }]
      : [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }] });
    assert.deepEqual(viaRules, viaOrder, order);
  }
});

// Deckschicht (Spec 2026-09-30-deckschicht-design.md)
const bigC = mkCase('bigC', 120, 60, 80, { weight: 75, layers: [1] });
const smallC = mkCase('smallC', 60, 60, 60, { weight: 28 });
const withLayers = (list, layers) => list.map(it => ({ ...it, layers }));
const withGroup = (list, group) => list.map(it => ({ ...it, ...(group ? { group } : {}) }));
// Anzahl Stücke `capId`, die in einer Säule über einem Stück `baseId` stehen (gleiches x/y, Deckschicht bündig an x0/y0).
const onBase = (r, capId, baseId) => r.placements.filter(p => p.caseId === capId
  && r.placements.some(b => b.caseId === baseId && b.x === p.x && b.y === p.y && b.z < p.z)).length;

test('Deckschicht: kleine, leichte Cases gleichen Gewerks liegen auf den großen, Lademeter sinken', () => {
  const list = [...items(bigC, 12, 'b'), ...withLayers(items(smallC, 12, 's'), [1, 2])];
  const off = autoPack(list, mkTruck());
  const on = autoPack(list, mkTruck(), { mixTop: true });
  assert.equal(on.unplaced.length, 0);
  assert.equal(onBase(off, 'smallC', 'bigC'), 0, 'ohne Deckschicht: eigener Block');
  assert.equal(onBase(on, 'smallC', 'bigC'), 12, 'mit Deckschicht: alle 12 in Lage 2 auf den großen');
  const meters = r => validatePlan(plan(r.placements), byId(bigC, smallC), mkTruck()).totals.loadMeters;
  assert.ok(meters(on) < meters(off), `${meters(on)} < ${meters(off)}`);
  assert.deepEqual(placementIssues(validatePlan(plan(on.placements), byId(bigC, smallC), mkTruck())), []);
});

test('Deckschicht: ohne mixTop exakt wie bisher (Altdaten)', () => {
  const list = [...items(bigC, 5, 'b'), ...items(smallC, 7, 's')];
  assert.deepEqual(autoPack(list, mkTruck()), autoPack(list, mkTruck(), { mixTop: false }));
});

test('Deckschicht: nur gleiches Gewerk bzw. gleiche Gruppe', () => {
  const tonSmall = mkCase('tonSmall', 60, 60, 60, { weight: 28, category: 'Ton' });
  const r1 = autoPack([...items(bigC, 2, 'b'), ...items(tonSmall, 2, 't')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r1, 'tonSmall', 'bigC'), 0, 'anderes Gewerk');
  const r2 = autoPack([...withGroup(items(bigC, 2, 'b'), 'A'), ...withGroup(items(smallC, 2, 's'), 'B')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r2, 'smallC', 'bigC'), 0, 'andere Gruppe');
  const r3 = autoPack([...withGroup(items(bigC, 2, 'b'), 'A'), ...items(smallC, 2, 's')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r3, 'smallC', 'bigC'), 0, 'eins mit, eins ohne Gruppe');
  const r4 = autoPack([...withGroup(items(bigC, 2, 'b'), 'A'), ...withGroup(items(smallC, 2, 's'), 'A')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r4, 'smallC', 'bigC'), 2, 'gleiche Gruppe');
});

test('Deckschicht: 0 kg mischt weder oben noch unten', () => {
  const zeroSmall = mkCase('zeroSmall', 60, 60, 60, { weight: 0 });
  const zeroBig = mkCase('zeroBig', 120, 60, 80, { weight: 0, layers: [1] });
  const r1 = autoPack([...items(bigC, 2, 'b'), ...items(zeroSmall, 2, 'z')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r1, 'zeroSmall', 'bigC'), 0, '0-kg-Stück nicht als Deckschicht');
  const r2 = autoPack([...items(zeroBig, 2, 'b'), ...items(smallC, 2, 's')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r2, 'smallC', 'zeroBig'), 0, 'nicht auf 0-kg-Unterlage');
});

test('Deckschicht: nichts Schwereres, nichts Größeres obendrauf; 90° gedreht passt', () => {
  const heavySmall = mkCase('heavySmall', 60, 60, 60, { weight: 90 });
  const r1 = autoPack([...items(bigC, 2, 'b'), ...items(heavySmall, 2, 'h')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r1, 'heavySmall', 'bigC'), 0, 'schwerer');
  const wide = mkCase('wide', 80, 80, 40, { weight: 10 });
  const r2 = autoPack([...items(bigC, 2, 'b'), ...items(wide, 2, 'w')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r2, 'wide', 'bigC'), 0, '80 breit passt nicht auf 60');
  const long = mkCase('long', 60, 110, 30, { weight: 10 }); // passt nur so gedreht, dass 110 längs auf 120 liegt
  const r3 = autoPack([...items(bigC, 1, 'b'), ...items(long, 1, 'l')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r3, 'long', 'bigC'), 1, 'gedreht als Deckschicht');
  assert.deepEqual(placementIssues(validatePlan(plan(r3.placements), byId(bigC, long), mkTruck())), []);
});

test('Deckschicht: Lagen je Stück gelten (Lage 3 nur, wenn das Stück sie erlaubt)', () => {
  const two = mkCase('two', 120, 60, 60, { weight: 56 });
  const list = [...withLayers(items(two, 2, 't'), [1, 2]), ...withLayers(items(smallC, 1, 's'), [1, 2])];
  const r = autoPack(list, mkTruck(), { mixTop: true });
  assert.equal(onBase(r, 'smallC', 'two'), 0, 'Stapel two ist mit 2 Lagen voll, smallC darf nicht in Lage 3');
  const list3 = [...withLayers(items(two, 2, 't'), [1, 2]), ...withLayers(items(smallC, 1, 's'), [1, 2, 3])];
  const r3 = autoPack(list3, mkTruck(), { mixTop: true });
  assert.equal(r3.placements.find(p => p.caseId === 'smallC').z, 120, 'mit Lage 3 erlaubt');
});

test('Deckschicht: Pack-Regel „Gruppe zuletzt“ wird nicht unterlaufen', () => {
  const rules = [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }];
  const fohBig = mkCase('fohBig', 120, 60, 80, { weight: 75, layers: [1] });
  const list = [...withGroup(items(bigC, 2, 'b'), 'Motoren'), ...withGroup(items(fohBig, 2, 'f'), 'FOH'),
    ...withGroup(items(smallC, 2, 's'), 'Motoren')];
  const r = autoPack(list, mkTruck(), { rules, mixTop: true });
  assert.equal(onBase(r, 'smallC', 'fohBig'), 0, 'Motoren-Deckschicht nie auf FOH');
  assert.equal(onBase(r, 'smallC', 'bigC'), 2, 'aber auf Motoren');
});

test('Deckschicht: Traversen tragen nichts und liegen nie obendrauf', () => {
  const tr = mkCase('tr', 240, 62, 115, { kind: 'truss', category: 'Rigging', weight: 120, stackable: true, truss: { length: 240, width: 62, count: 1, standing: true, height: 115 } });
  const rigSmall = mkCase('rigSmall', 60, 60, 40, { weight: 20, category: 'Rigging' });
  const r = autoPack([...items(tr, 1, 't'), ...items(rigSmall, 1, 'r')], mkTruck(), { mixTop: true });
  assert.equal(r.placements.find(p => p.caseId === 'rigSmall').z, 0);
});

// F1 (Review 2026-09-30): capFits prüfte bisher nur isTruss(base.c) – ein Stück, das per prevLast-
// Auffüllen MITTIG in einen Stapel auf einem nicht-Traversen-Fundament gerät (Traversenwagen,
// stapelbar, gleiche Grundfläche), wurde dabei übersehen: Ein Stück landete oben auf der Traverse.
// Repro wie im Review-Finding: Fundament (Rigging, 200 kg) trägt einen Traversenwagen (Rigging,
// 120 kg, gleiche Grundfläche, stapelbar); ein kleines Rigging-Case (20 kg) darf NICHT als
// Deckschicht auf den Traversenwagen.
test('F1: kein Stück landet auf einem Traversenwagen, der einen fremden Stapel mittig auffüllt', () => {
  const base = mkCase('base', 240, 62, 61, { weight: 200, category: 'Rigging', layers: [1, 2] });
  const trussWagon = mkCase('trussWagon', 240, 62, 60, {
    kind: 'truss', category: 'Rigging', weight: 120, stackable: true, layers: [1, 2],
    truss: { length: 240, width: 62, count: 1, standing: true, height: 60 },
  });
  const small = mkCase('small', 60, 60, 40, { weight: 20, category: 'Rigging' });
  const list = [...items(base, 1, 'b'), ...items(trussWagon, 1, 'w'), ...items(small, 1, 's')];
  const { stacks, unplaced } = buildStacks(list, mkTruck(), { rules: [{ by: 'volume' }], mixTop: true });
  const capStack = stacks.find(s => s.items.length > 1);
  assert.ok(capStack, 'Vorbedingung des Repro: der Traversenwagen füllt den Fundament-Stapel auf');
  assert.equal(capStack.items.length, 2, 'Vorbedingung des Repro: nur Fundament + Traversenwagen im Stapel');
  assert.equal(capStack.items.at(-1).c.id, 'trussWagon', 'Vorbedingung des Repro: der Traversenwagen liegt oben');
  assert.equal(unplaced.length, 0, 'das kleine Case bleibt nicht in der Ablage …');
  assert.ok(!capStack.items.some(x => x.c.id === 'small'), '… sondern darf nicht auf den Traversenwagen');
  assert.ok(stacks.some(s => s !== capStack && s.items.some(x => x.c.id === 'small')),
    'small bekommt stattdessen einen eigenen Bodenstapel');
});

// F1 (b): der umgekehrte Fall – eine Traverse selbst als Deckschicht-Kandidat auf ein fremdes Case –
// war schon vorher durch isTruss(c) abgedeckt. Test bleibt als Regression stehen.
test('F1: eine Traverse wird selbst nie als Deckschicht auf ein fremdes Case gesetzt', () => {
  const bigRig = mkCase('bigRig', 120, 60, 80, { weight: 75, category: 'Rigging', layers: [1] });
  const trussSmall = mkCase('trussSmall', 60, 60, 40, {
    kind: 'truss', category: 'Rigging', weight: 20, stackable: true, layers: [1],
    truss: { length: 60, width: 60, count: 1, standing: true, height: 40 },
  });
  const list = [...items(bigRig, 2, 'b'), ...items(trussSmall, 2, 't')];
  const { stacks } = buildStacks(list, mkTruck(), { mixTop: true });
  for (const s of stacks) {
    const trussFlags = new Set(s.items.map(x => isTruss(x.c)));
    assert.equal(trussFlags.size, 1, 'ein Stapel enthält entweder nur Traversen oder gar keine, nie beides');
  }
});

test('Deckschicht auf Deckschicht: kleinere Stücke dürfen weiter oben aufeinander, solange alle Grenzen halten', () => {
  const r = autoPack([...items(bigC, 1, 'b'), ...items(smallC, 2, 's')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r, 'smallC', 'bigC'), 2, 'zweites smallC auf dem ersten (Lage 3, alle Lagen erlaubt)');
  assert.deepEqual(placementIssues(validatePlan(plan(r.placements), byId(bigC, smallC), mkTruck())), []);
});

test('Deckschicht, Eigenschaft: keine neuen Placement-Fehler, nichts geht verloren, nichts Schweres auf Leichtem', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pool = [...PRESET_CASES, ...CASE_LIBRARY].filter(c => !c.legacy && c.weight > 0);
  const byAll = new Map([...PRESET_CASES, ...CASE_LIBRARY].map(c => [c.id, c]));
  for (let run = 0; run < 40; run++) {
    const truck = PRESET_TRUCKS[run % PRESET_TRUCKS.length];
    const list = [];
    const kinds = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < kinds; k++) {
      const c = pool[Math.floor(rnd() * pool.length)];
      const n = 1 + Math.floor(rnd() * 8);
      for (let i = 0; i < n; i++) list.push(mkItem(c, `r${run}k${k}i${i}`));
    }
    const off = autoPack(list, truck);
    const on = autoPack(list, truck, { mixTop: true });
    assert.equal(on.placements.length + on.unplaced.length, list.length, `run ${run}: Stückzahl`);
    const codes = r => new Set(placementIssues(validatePlan(plan(r.placements, r.unplaced), byAll, truck)).map(i => i.code));
    const before = codes(off);
    for (const code of codes(on)) assert.ok(before.has(code), `run ${run}: neuer Fehler ${code}`);
    for (const p of on.placements) {
      if (p.z === 0) continue;
      const below = on.placements.filter(q => q.x === p.x && q.y === p.y && q.z < p.z).sort((a, b) => b.z - a.z)[0];
      if (below) assert.ok(byAll.get(below.caseId).weight >= byAll.get(p.caseId).weight, `run ${run}: schwer auf leicht`);
    }
  }
});

// Eine Tipp-Regel (canTip): importierte Altdaten können an einem Traversenwagen `tippable: true`
// tragen; er wird trotzdem nie getippt.
test('Traversenwagen mit tippable:true (Altdaten): nur standing, Packer tippt nicht, keine Tipp-Warnung', () => {
  const tw = mkCase('tw', 120, 62, 115, { kind: 'truss', tippable: true, truss: { length: 120, width: 62, count: 1, standing: true, height: 115 } });
  assert.equal(canTip(tw), false);
  assert.deepEqual(pieceOrientations({}, tw), ['standing']);
  assert.deepEqual(pieceOrientations({ tipped: true }, tw), ['standing']);
  const o = chooseOrientation(tw, mkTruck(), { tipped: true });
  assert.equal(o.orientation, 'standing');
  const { placements, unplaced } = autoPack(items(tw, 3, 'w'), mkTruck());
  assert.deepEqual(unplaced, []);
  assert.ok(placements.every(p => p.orientation === 'standing'));
  const r = validatePlan(plan([...placements, { ...placements[0], id: 'x', x: 900, orientation: 'tipLong' }]), byId(tw), mkTruck());
  assert.ok(!r.issues.some(i => i.code === 'notTippable'), 'keine Warnung zum Tippen');
});

// --- Deckschicht nebeneinander (Teilprojekt „Deckschicht nebeneinander“) ---------------------------
// Die oberste Lage eines Stapels trägt mehrere Stücke im Regalverfahren auf der Fläche des obersten
// Hauptstücks; jedes Deckstück hat einen Versatz (ox, oy) in der Stapelfläche.
const topBig = (extra = {}) => mkCase('tb', 120, 80, 60, { weight: 120, category: 'Audio', ...extra });
const topSm = (id = 'ts', extra = {}) => mkCase(id, 60, 40, 40, { weight: 15, category: 'Audio', ...extra });
const at = (r, id) => r.placements.find(p => p.id === id);
const rel = (r, id, baseId) => { const p = at(r, id), b = at(r, baseId); return [p.x - b.x, p.y - b.y, p.z - b.z]; };
const capOf = list => buildStacks(list, mkTruck(), { mixTop: true }).stacks.find(s => s.capped);

test('Deckschicht nebeneinander: vier kleine Cases liegen in zwei Reihen auf einem großen, das fünfte nicht mehr', () => {
  const r = autoPack([...items(topBig(), 1, 'b'), ...items(topSm(), 5, 's')], mkTruck(), { mixTop: true });
  assert.deepEqual(r.unplaced, []);
  assert.deepEqual(rel(r, 's1', 'b1'), [0, 0, 60]);
  assert.deepEqual(rel(r, 's2', 'b1'), [60, 0, 60]);
  assert.deepEqual(rel(r, 's3', 'b1'), [0, 40, 60], 'zweite Reihe: um die Tiefe 40 versetzt');
  assert.deepEqual(rel(r, 's4', 'b1'), [60, 40, 60]);
  assert.equal(at(r, 's5').z, 0, 'das fünfte steht auf dem Boden (nächster Stapel)');
  assert.notDeepEqual([at(r, 's5').x, at(r, 's5').y], [at(r, 'b1').x, at(r, 'b1').y]);
  const { stacks } = buildStacks([...items(topBig(), 1, 'b'), ...items(topSm(), 5, 's')], mkTruck(), { mixTop: true });
  const s = stacks.find(x => x.capped);
  assert.equal(s.height, 100, 'Stapelhöhe = Hauptstapel 60 + Deckstück 40');
  assert.equal(s.weight, 120 + 4 * 15);
  assert.equal(s.mixed, true);
});

test('Deckschicht nebeneinander: drei Stücke, ein Stapel mit zwei Reihen (Reihe 1: zwei, Reihe 2: eins)', () => {
  const s = capOf([...items(topBig(), 1, 'b'), ...items(topSm(), 3, 's')]);
  assert.deepEqual(s.items.map(x => [x.ox ?? 0, x.oy ?? 0, x.z]), [[0, 0, 0], [0, 0, 60], [60, 0, 60], [0, 40, 60]]);
});

test('Deckschicht nebeneinander: ein Stück wird in der Reihe um 90° gedreht, wenn es sonst nicht mehr passt', () => {
  const a = mkCase('a', 60, 30, 20, { weight: 20, category: 'Audio' });
  const b = mkCase('b', 55, 30, 20, { weight: 15, category: 'Audio' });
  const top = mkCase('top', 100, 60, 60, { weight: 150, category: 'Audio' });
  const r = autoPack([...items(top, 1, 't'), ...items(a, 1, 'a'), ...items(b, 1, 'b')], mkTruck(), { mixTop: true });
  assert.deepEqual(rel(r, 'a1', 't1'), [0, 0, 60]);
  assert.deepEqual(rel(r, 'b1', 't1'), [60, 0, 60], '55 breit passt rechts nicht (115 > 100), gedreht 30 × 55 schon');
  const bb = boxOf(b, at(r, 'b1'));
  assert.deepEqual([bb.x1 - bb.x0, bb.y1 - bb.y0], [30, 55]);
});

test('Deckschicht nebeneinander: die Summe der Deckgewichte darf die Auflast des obersten Stücks nicht überschreiten', () => {
  const r = autoPack([...items(topBig({ maxTopLoad: 40 }), 1, 'b'), ...items(topSm(), 3, 's')], mkTruck(), { mixTop: true });
  assert.equal(at(r, 's1').z, 60); assert.equal(at(r, 's2').z, 60);
  assert.equal(at(r, 's3').z, 0, '3 × 15 = 45 > 40 kg: das dritte wird abgelehnt');
  const ok = autoPack([...items(topBig({ maxTopLoad: 45 }), 1, 'b'), ...items(topSm(), 3, 's')], mkTruck(), { mixTop: true });
  assert.equal(at(ok, 's3').z, 60, 'genau 45 kg gehen noch');
});

test('Deckschicht nebeneinander: die Auflast-Kette zählt auch die Stücke unter dem obersten', () => {
  // Unteres Stück trägt höchstens 160 kg: oberes Stück 120 + Deckschicht ≤ 40 kg → zwei Stücke (30 kg), das dritte (45) nicht.
  const lower = topBig({ maxTopLoad: 160 });
  const r = autoPack([...items(lower, 2, 'b'), ...items(topSm(), 3, 's')], mkTruck(), { mixTop: true });
  assert.equal(at(r, 's1').z, 120); assert.equal(at(r, 's2').z, 120);
  assert.equal(at(r, 's3').z, 0);
});

test('Deckschicht nebeneinander: die Summe der Deckgewichte darf das Gewicht des obersten Stücks nicht überschreiten', () => {
  const r = autoPack([...items(topBig({ weight: 50 }), 1, 'b'), ...items(topSm('ts', { weight: 20 }), 3, 's')], mkTruck(), { mixTop: true });
  assert.equal(at(r, 's1').z, 60); assert.equal(at(r, 's2').z, 60);
  assert.equal(at(r, 's3').z, 0, '3 × 20 = 60 > 50 kg');
});

test('Deckschicht nebeneinander: Fahrzeughöhe begrenzt das höchste Deckstück', () => {
  const tall = mkCase('tall', 60, 40, 80, { weight: 10, category: 'Audio' });
  const truck = mkTruck({ h: 130 });
  const r = autoPack([...items(topBig(), 1, 'b'), ...items(topSm('ts', { weight: 15 }), 1, 's'), ...items(tall, 1, 't')], truck, { mixTop: true });
  assert.equal(at(r, 's1').z, 60);
  assert.equal(at(r, 't1').z, 0, '60 + 80 = 140 > 130');
  const small = autoPack([...items(topBig(), 1, 'b'), ...items(topSm(), 1, 's'), ...items(mkCase('mid', 60, 40, 70, { weight: 10, category: 'Audio' }), 1, 'm')], truck, { mixTop: true });
  assert.equal(at(small, 'm1').z, 60, '60 + 70 = 130 passt gerade');
});

test('Deckschicht nebeneinander: Stapelhöhe ist Hauptstapel plus das höchste Deckstück', () => {
  const tall = mkCase('tall', 60, 40, 55, { weight: 10, category: 'Audio' });
  const s = capOf([...items(topBig(), 1, 'b'), ...items(topSm(), 1, 's'), ...items(tall, 1, 't')]);
  assert.equal(s.height, 60 + 55);
  assert.equal(s.items.length, 3);
});

test('Deckschicht nebeneinander: Gruppe und Gewerk gelten für jedes Deckstück', () => {
  const lamp = mkCase('lamp', 60, 40, 40, { weight: 15, category: 'Licht' });
  const r = autoPack([...items(topBig(), 1, 'b'), ...items(topSm(), 1, 's'), ...items(lamp, 1, 'l')], mkTruck(), { mixTop: true });
  assert.equal(at(r, 's1').z, 60);
  assert.equal(at(r, 'l1').z, 0, 'anderes Gewerk');
  const g = (list, grp) => list.map(it => ({ ...it, group: grp }));
  const r2 = autoPack([...g(items(topBig(), 1, 'b'), 'A'), ...g(items(topSm(), 1, 's'), 'A'), ...g(items(lamp, 1, 'l'), 'B')], mkTruck(), { mixTop: true });
  assert.equal(at(r2, 's1').z, 60);
  assert.equal(at(r2, 'l1').z, 0, 'andere Gruppe');
});

test('Deckschicht nebeneinander: 0 kg, Traversen, nicht stapelbares oberstes Stück und volle 4 Lagen nehmen keine Deckstücke', () => {
  const zero = autoPack([...items(topBig(), 1, 'b'), ...items(topSm('z', { weight: 0 }), 2, 'z')], mkTruck(), { mixTop: true });
  assert.ok(zero.placements.filter(p => p.caseId === 'z').every(p => p.z === 0));
  const ns = autoPack([...items(topBig({ stackable: false }), 1, 'b'), ...items(topSm(), 2, 's')], mkTruck(), { mixTop: true });
  assert.ok(ns.placements.filter(p => p.caseId === 'ts').every(p => p.z === 0), 'nicht stapelbar: nichts obendrauf');
  const four = autoPack([...items(topBig(), 4, 'b'), ...items(topSm(), 2, 's')], mkTruck(), { mixTop: true });
  assert.ok(four.placements.filter(p => p.caseId === 'ts').every(p => p.z === 0), 'vier Lagen sind voll');
  const trussSm = mkCase('trs', 60, 40, 40, { kind: 'truss', category: 'Audio', weight: 10, stackable: true, truss: { length: 60, width: 40, count: 1, standing: true, height: 40 } });
  const tr = autoPack([...items(topBig(), 1, 'b'), ...items(topSm(), 1, 's'), ...items(trussSm, 1, 't')], mkTruck(), { mixTop: true });
  assert.equal(at(tr, 't1').z, 0, 'Traverse nie als Deckstück');
});

test('Deckschicht nebeneinander: Lagen je Stück gelten (Deckschicht liegt in Lage n+1)', () => {
  const only1 = items(topSm(), 2, 's').map(it => ({ ...it, layers: [1] }));
  const r = autoPack([...items(topBig(), 1, 'b'), ...only1], mkTruck(), { mixTop: true });
  assert.ok(r.placements.filter(p => p.caseId === 'ts').every(p => p.z === 0), 'nur Lage 1 erlaubt');
});

test('Deckschicht nebeneinander: ein Stapel mit Deckschicht trägt nichts mehr obendrauf und nimmt keine eigene Sorte an', () => {
  // 12 kleine, 2 große: die Deckschicht trägt höchstens vier, der Rest steht auf dem Boden/anderen Stapeln – nie in Lage 3 über einem Deckstück.
  const r = autoPack([...items(topBig(), 1, 'b'), ...items(topSm(), 12, 's')], mkTruck(), { mixTop: true });
  assert.deepEqual(r.unplaced, []);
  assert.equal(r.placements.filter(p => p.z === 60).length, 4);
  assert.ok(!r.placements.some(p => p.z === 100 && p.caseId === 'ts' && at(r, 'b1').x === p.x && at(r, 'b1').y === p.y), 'keine Deckstücke übereinander');
});

test('Deckschicht nebeneinander: ohne mixTop unverändert, auch mit vielen kleinen Stücken', () => {
  const list = [...items(topBig(), 2, 'b'), ...items(topSm(), 10, 's')];
  assert.deepEqual(autoPack(list, mkTruck(), { mixTop: false }), autoPack(list, mkTruck()));
  const off = autoPack(list, mkTruck());
  assert.ok(off.placements.filter(p => p.caseId === 'ts').every(p => p.z < 120), 'nur reguläres Stapeln');
});

// Geometrie in Weltkoordinaten: jedes Deckstück liegt vollständig auf dem obersten Hauptstück, auch bei
// einem im Grundriss um 90° gedrehten Stapel (swap in placeStacks: Versatz (ox, oy) wird zu (oy, ox)).
const insideXY = (inner, outer) => inner.x0 >= outer.x0 - 1e-6 && inner.x1 <= outer.x1 + 1e-6
  && inner.y0 >= outer.y0 - 1e-6 && inner.y1 <= outer.y1 + 1e-6;
const assertCapsOnTop = (r, cases, topId, capIds, label) => {
  const top = boxOf(cases.get(at(r, topId).caseId), at(r, topId));
  for (const id of capIds) {
    const p = at(r, id), b = boxOf(cases.get(p.caseId), p);
    assert.equal(b.z0, top.z1, `${label}: ${id} steht auf der Oberkante von ${topId}`);
    assert.ok(insideXY(b, top), `${label}: ${id} liegt vollständig auf ${topId}`);
  }
  const caps = capIds.map(id => boxOf(cases.get(at(r, id).caseId), at(r, id)));
  caps.forEach((a, i) => caps.slice(i + 1).forEach(b => assert.ok(!overlaps(a, b), `${label}: Deckstücke überschneiden sich nicht`)));
};

test('Deckschicht nebeneinander: Stapel im Grundriss gedreht (swap) trägt die Deckstücke vollständig auf dem obersten Stück', () => {
  const big = topBig();
  const sm = topSm();
  // Nur ein 85 cm breiter Gang: der Stapel (Grundfläche 80 × 120) passt nur um 90° gedreht hinein.
  const truck = mkTruck({ l: 300, w: 130 });
  const obstacles = [{ x0: 0, y0: 85, z0: 0, x1: 300, y1: 130, z1: 270 }];
  const list = [...items(big, 2, 'b'), ...items(sm, 3, 's')];
  const { stacks } = buildStacks(list, truck, { mixTop: true });
  const { placed } = placeStacks(stacks, truck, obstacles);
  assert.equal(placed.find(p => p.stack.capped).swap, true, 'Vorbedingung: der Stapel wird gedreht');
  const r = autoPack(list, truck, { mixTop: true, obstacles });
  assert.deepEqual(r.unplaced, []);
  assertCapsOnTop(r, byId(big, sm), 'b2', ['s1', 's2', 's3'], 'swap');
  const issues = placementIssues(validatePlan(plan(r.placements), byId(big, sm), truck));
  assert.deepEqual(issues.filter(i => /overlap|collision|support|overhang/i.test(i.code)), []);
});

test('Deckschicht nebeneinander: ungedreht und gedreht, auch mit gedrehten Deckstücken, bleiben alle Deckstücke auf dem obersten Stück', () => {
  const cases = byId(topBig(), topSm(), mkCase('wide', 30, 70, 30, { weight: 10, category: 'Audio' }));
  for (const [truck, obstacles] of [[mkTruck(), []], [mkTruck({ l: 300, w: 130 }), [{ x0: 0, y0: 85, z0: 0, x1: 300, y1: 130, z1: 270 }]]]) {
    const list = [...items(topBig(), 2, 'b'), ...items(topSm(), 2, 's'), ...items(cases.get('wide'), 2, 'w')];
    const r = autoPack(list, truck, { mixTop: true, obstacles });
    const caps = r.placements.filter(p => p.z === 120).map(p => p.id);
    assert.ok(caps.length >= 2, 'mindestens zwei Deckstücke');
    assertCapsOnTop(r, cases, 'b2', caps, truck.w === 130 ? 'gedreht' : 'ungedreht');
  }
});
