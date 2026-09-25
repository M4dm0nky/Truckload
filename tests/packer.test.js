import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseOrientation, buildStacks, autoPack } from '../js/model/packer.js';
import { validatePlan } from '../js/model/validate.js';
import { wheelFace, DOOR_FACE } from '../js/model/geometry.js';
import { mkCase, mkTruck, SPRINTER, plan, byId } from './fixtures.js';

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
