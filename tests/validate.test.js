import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, archBoxes, buildItems } from '../js/model/validate.js';
import { mkCase, mkTruck, SPRINTER, P, plan, byId } from './fixtures.js';

const K = mkCase('k', 120, 60, 60);
const codes = (r, id) => (r.byPlacement.get(id) ?? []).map(i => i.code).sort();
const planCodes = r => r.issues.filter(i => !i.placementId).map(i => i.code);

test('leerer Plan', () => {
  const r = validatePlan(plan([]), byId(K), mkTruck());
  assert.deepEqual(r.issues, []);
  assert.equal(r.totals.weight, 0);
  assert.equal(r.totals.cog, null);
});
test('buildItems legt label/color mit Fallback auf den Case-Typ frei', () => {
  const { items } = buildItems(plan([P('a','k',0,0,0)]), byId(K));
  assert.equal(items[0].label, K.name);
  assert.equal(items[0].color, K.color);
});
test('buildItems bevorzugt Stück-Label/Farbe vor dem Case-Typ', () => {
  const { items } = buildItems(plan([P('a','k',0,0,0,{ label: 'Custom', color: '#123456' })]), byId(K));
  assert.equal(items[0].label, 'Custom');
  assert.equal(items[0].color, '#123456');
});
test('Kollision auf beiden Cases', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',60,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['collision']);
  assert.deepEqual(codes(r,'b'), ['collision']);
});
test('über den Laderaum hinaus', () => {
  const r = validatePlan(plan([P('a','k',1300,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['outOfBounds']);
});
test('schwebt ohne Auflage', () => {
  const r = validatePlan(plan([P('a','k',0,0,60)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['unsupported']);
});
test('sauber gestapelt: keine Probleme, Last unten', () => {
  // y=94 → mittig (Mitte 124), sonst meldet die Prüfung „einseitig"
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','k',0,94,60)]), byId(K), mkTruck());
  assert.deepEqual(r.issues, []);
  assert.equal(r.load.get('a'), 100);
});
test('halbe Auflage reicht nicht', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',60,0,60)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'b'), ['unsupported']);
});
test('auf nicht stapelbarem Case', () => {
  const N = mkCase('n', 120, 60, 60, { stackable: false });
  const r = validatePlan(plan([P('a','n',0,0,0), P('b','k',0,0,60)]), byId(K, N), mkTruck());
  assert.deepEqual(codes(r,'b'), ['notStackable']);
});
test('Überlast wird durchgereicht', () => {
  const W = mkCase('w', 120, 60, 60, { maxTopLoad: 150 });
  const r = validatePlan(plan([P('a','w',0,0,0), P('b','k',0,0,60), P('c','k',0,0,120)]), byId(K, W), mkTruck());
  assert.equal(r.load.get('a'), 200);
  assert.deepEqual(codes(r,'a'), ['overload']);
});
test('getippt, obwohl nicht tippbar', () => {
  const r = validatePlan(plan([P('a','k',0,0,0,{ orientation: 'tipLong' })]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['notTippable']);
});
test('Radkasten', () => {
  assert.equal(archBoxes(SPRINTER).length, 2);
  const S = mkCase('s', 60, 60, 60);
  const r = validatePlan(plan([P('a','s',220,0,0)]), byId(S), SPRINTER);
  assert.deepEqual(codes(r,'a'), ['arch']);
});
test('zu schwer', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',0,60,0)]), byId(K), mkTruck({ payload: 150 }));
  assert.ok(planCodes(r).includes('tooHeavy'));
});
test('einseitige Ladung', () => {
  const r = validatePlan(plan([P('a','k',0,0,0)]), byId(K), mkTruck());
  assert.ok(planCodes(r).includes('imbalance'));
});
test('fehlender Case-Typ', () => {
  const r = validatePlan(plan([P('a','weg',0,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['missingCase']);
});
test('Kennzahlen und Reihenfolge', () => {
  const r = validatePlan(plan([P('hinten','k',120,0,0), P('vorn','k',0,0,0)]), byId(K), mkTruck());
  assert.equal(r.totals.weight, 200);
  assert.equal(r.totals.cog.x, 120);
  assert.equal(r.totals.loadMeters, 2.4);
  assert.equal(r.sequence.get('vorn'), 1);
  assert.equal(r.sequence.get('hinten'), 2);
});

test('sind alle Cases gewogen, bleibt der Schwerpunkt gewichtsbasiert und als solcher gekennzeichnet', () => {
  const r = validatePlan(plan([P('hinten','k',120,0,0), P('vorn','k',0,0,0)]), byId(K), mkTruck());
  assert.equal(r.totals.withoutWeight, 0);
  assert.equal(r.totals.cog.source, 'weight');
});

test('Cases ohne Gewicht werden gezählt (totals.withoutWeight)', () => {
  const Z = mkCase('z', 60, 60, 60, { weight: 0 });
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','z',60,94,0), P('c','z',120,94,0)]), byId(K, Z), mkTruck());
  assert.equal(r.totals.withoutWeight, 2);
});

test('Schwerpunkt fällt auf Volumen zurück, wenn kein Case ein Gewicht hat', () => {
  const Z = mkCase('z', 60, 60, 60, { weight: 0 });
  // zwei gleich große Cases, Mittelpunkte bei x=30 und x=150 -> Volumen-Schwerpunkt bei 90
  const r = validatePlan(plan([P('a','z',0,94,0), P('b','z',120,94,0)]), byId(Z), mkTruck());
  assert.equal(r.totals.cog.source, 'volume');
  assert.equal(r.totals.cog.x, 90);
});

test('Schwerpunkt fällt auf Volumen zurück, sobald irgendein Stück in einer gemischten Ladung ohne Gewicht ist', () => {
  // Ein Fall mit Gewicht, einer ohne – ein gewichtsbasierter Schwerpunkt würde hier nur aus
  // dem gewogenen Case bestehen und einen falschen Eindruck von Genauigkeit erwecken.
  const Z = mkCase('z', 60, 60, 60, { weight: 0 });
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','z',120,94,0)]), byId(K, Z), mkTruck());
  assert.equal(r.totals.withoutWeight, 1);
  assert.equal(r.totals.cog.source, 'volume');
});

test('Einseitigkeit wird auch ganz ohne Gewichte über das Volumen erkannt', () => {
  const Z = mkCase('z', 60, 60, 60, { weight: 0 });
  const r = validatePlan(plan([P('a','z',0,0,0)]), byId(Z), mkTruck());
  assert.ok(planCodes(r).includes('imbalance'));
});

// Fix-Runde 1 (Koordinator): Die Volumen-Ersatzrechnung darf eine aus den bekannten
// Gewichten bereits nachweisbare Einseitigkeit nicht verschlucken, nur weil irgendwo ein
// zusätzliches Case ohne Gewicht dazukommt. Drei Stufen, wie vom Koordinator vorgerechnet
// (Truck-Standardbreite 248 cm, Mitte bei 124 cm, Schwelle 24,8 cm):
const HW1 = mkCase('hw1', 100, 100, 50, { weight: 500 });
const HW2 = mkCase('hw2', 100, 100, 50, { weight: 500 });
const Z1 = mkCase('z1', 60, 60, 60, { weight: 0 });
const Z2 = mkCase('z2', 200, 248, 200, { weight: 0 });

test('Fall 1: zwei schwere Cases allein – Schwerpunkt (Gewicht) deutlich einseitig', () => {
  const r = validatePlan(plan([P('a','hw1',0,0,0), P('b','hw2',110,0,0)]), byId(HW1, HW2), mkTruck());
  assert.equal(r.totals.withoutWeight, 0);
  assert.equal(r.totals.cog.source, 'weight');
  assert.equal(r.totals.cog.y, 50); // (500*50 + 500*50) / 1000
  assert.ok(planCodes(r).includes('imbalance'));
});

test('Fall 2: erstes Case ohne Gewicht dazu – beide Prüfungen (Gewicht und Volumen) schlagen weiterhin an', () => {
  const r = validatePlan(
    plan([P('a','hw1',0,0,0), P('b','hw2',110,0,0), P('c','z1',250,180,0)]),
    byId(HW1, HW2, Z1), mkTruck());
  assert.equal(r.totals.withoutWeight, 1);
  assert.equal(r.totals.cog.source, 'volume'); // angezeigter Schwerpunkt bleibt Volumen-basiert
  assert.ok(planCodes(r).includes('imbalance'));
  const msg = r.issues.find(i => i.code === 'imbalance').message;
  assert.match(msg, /aus den bekannten Gewichten/);
  assert.match(msg, /Volumen-Schätzung/);
});

test('Fall 3 (der eigentliche Befund): riesiges Case ohne Gewicht zieht die Volumen-Schätzung zur Mitte – die Prüfung aus den bekannten Gewichten warnt trotzdem weiter', () => {
  const r = validatePlan(
    plan([P('a','hw1',0,0,0), P('b','hw2',110,0,0), P('c','z1',250,180,0), P('d','z2',400,0,0)]),
    byId(HW1, HW2, Z1, Z2), mkTruck());
  assert.equal(r.totals.withoutWeight, 2);
  // Die Volumen-Schätzung selbst würde hier NICHT mehr anschlagen (großes Case zieht die
  // Näherung fast in die Mitte) – genau das war die verschwiegene Schieflage aus dem Befund.
  const cogVolumeDeviation = Math.abs(r.totals.cog.y - mkTruck().w / 2);
  assert.ok(cogVolumeDeviation < 24.8, `Volumen-Schwerpunkt sollte nahe der Mitte liegen, war aber ${cogVolumeDeviation}`);
  // Trotzdem muss die Warnung erscheinen, weil 1000 kg nachweislich auf einer Seite stehen.
  assert.ok(planCodes(r).includes('imbalance'));
  const msg = r.issues.find(i => i.code === 'imbalance').message;
  assert.match(msg, /aus den bekannten Gewichten/);
  assert.doesNotMatch(msg, /Volumen-Schätzung/, 'Volumen-Schätzung selbst schlägt hier nicht mehr an');
});

test('Lagen 1/2/3 im Stapel korrekt', () => {
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','k',0,94,60), P('c','k',0,94,120)]), byId(K), mkTruck());
  assert.equal(r.layers.get('a'), 1);
  assert.equal(r.layers.get('b'), 2);
  assert.equal(r.layers.get('c'), 3);
  assert.deepEqual(r.issues, []);
});
test('layer-Issue: nur Lage 1 erlaubt, steht aber in Lage 2', () => {
  const RACK = mkCase('rack', 80, 60, 60, { layers: [1] });
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','rack',0,94,60)]), byId(K, RACK), mkTruck());
  assert.deepEqual(codes(r,'b'), ['layer']);
  assert.match(r.byPlacement.get('b')[0].message, /„rack“ darf nicht in Lage 2 stehen \(erlaubt: 1\)\./);
});
test('layer-Issue: erlaubte Lagen werden im Text numerisch sortiert', () => {
  const LED = mkCase('led', 80, 60, 60, { layers: [2, 1] });
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','k',0,94,60), P('c','led',0,94,120)]), byId(K, LED), mkTruck());
  assert.deepEqual(codes(r,'c'), ['layer']);
  assert.match(r.byPlacement.get('c')[0].message, /„led“ darf nicht in Lage 3 stehen \(erlaubt: 1, 2\)\./);
});
// Meldungstexte müssen die Stück-Beschriftung (it.label) nennen, nicht den Case-Typ-Namen
// (docs/architektur.md sagt das zu; bei mehreren Exemplaren desselben Typs kann der Nutzer
// die Meldung sonst keinem Stück zuordnen — docs/code-review-2026-09-21.md).
test('Meldungstexte nennen die Stück-Beschriftung, nicht den Case-Typ-Namen (outOfBounds)', () => {
  const r = validatePlan(plan([P('a', 'k', 1300, 0, 0, { label: 'Front-Case 3' })]), byId(K), mkTruck());
  const msg = r.byPlacement.get('a')[0].message;
  assert.match(msg, /Front-Case 3/);
  assert.doesNotMatch(msg, /\bk\b/, 'Case-Typ-Name „k“ darf nicht mehr in der Meldung stehen');
});
test('Meldungstexte nennen die Stück-Beschriftung bei Kollision', () => {
  const r = validatePlan(plan([
    P('a', 'k', 0, 0, 0, { label: 'Case A' }), P('b', 'k', 60, 0, 0, { label: 'Case B' }),
  ]), byId(K), mkTruck());
  const msgA = r.byPlacement.get('a')[0].message, msgB = r.byPlacement.get('b')[0].message;
  assert.match(msgA, /Case A.*Case B/);
  assert.match(msgB, /Case B.*Case A/);
});
test('Meldungstexte nennen die Stück-Beschriftung bei unsupported/notStackable/overload', () => {
  const N = mkCase('n', 120, 60, 60, { stackable: false });
  const rUnsupported = validatePlan(plan([P('a', 'k', 0, 0, 60, { label: 'Schwebend' })]), byId(K), mkTruck());
  assert.match(rUnsupported.byPlacement.get('a')[0].message, /Schwebend/);

  const rStack = validatePlan(plan([
    P('a', 'n', 0, 0, 0, { label: 'Unten' }), P('b', 'k', 0, 0, 60, { label: 'Oben' }),
  ]), byId(K, N), mkTruck());
  assert.match(rStack.byPlacement.get('b')[0].message, /Oben.*Unten/);

  const W = mkCase('w', 120, 60, 60, { maxTopLoad: 150 });
  const rOverload = validatePlan(plan([
    P('a', 'w', 0, 0, 0, { label: 'Träger' }), P('b', 'k', 0, 0, 60), P('c', 'k', 0, 0, 120),
  ]), byId(K, W), mkTruck());
  assert.match(rOverload.byPlacement.get('a')[0].message, /Träger/);
});

// Ein getippter Traversenwagen ist geometrisch immer „standing“ (effectiveDims zwingt das),
// die alte notTippable-Prüfung wertete p.orientation trotzdem stumpf aus.
test('getippter Traversenwagen meldet nicht mehr fälschlich notTippable', () => {
  const TR = { ...mkCase('tr', 60, 60, 80, { tippable: false }), kind: 'truss' };
  const r = validatePlan(plan([P('a', 'tr', 0, 94, 0, { orientation: 'tipLong' })]), byId(TR), mkTruck());
  assert.deepEqual(codes(r, 'a'), []);
});
test('ein echtes, nicht tippbares Case meldet weiterhin notTippable', () => {
  const N = mkCase('n', 120, 60, 60, { tippable: false });
  const r = validatePlan(plan([P('a', 'n', 0, 0, 0, { orientation: 'tipLong' })]), byId(N), mkTruck());
  assert.deepEqual(codes(r, 'a'), ['notTippable']);
});

// Division durch null bei einer Grundfläche von 0 (l oder w = 0) darf nicht zu einem
// stillen NaN führen, das die unsupported-Prüfung verschluckt.
test('Grundfläche 0: unsupported-Prüfung liefert kein stilles NaN, sondern meldet unsupported', () => {
  const ZERO = mkCase('zero', 0, 60, 60);
  const r = validatePlan(plan([P('a', 'zero', 0, 0, 100)]), byId(ZERO), mkTruck());
  assert.deepEqual(codes(r, 'a'), ['unsupported']);
});
// Alle drei Fahrzeugmaße einzeln geprüft: ein Rückbau, der nur eines der drei prüft
// (z. B. `truck.l > 0` allein), bliebe sonst grün, wenn zufällig immer nur l getestet wird.
test('Fahrzeugmaß 0 (Länge): volumeRatio liefert 0 statt NaN', () => {
  const r = validatePlan(plan([]), byId(K), mkTruck({ l: 0 }));
  assert.equal(r.totals.volumeRatio, 0);
});
test('Fahrzeugmaß 0 (Breite): volumeRatio liefert 0 statt NaN', () => {
  const r = validatePlan(plan([]), byId(K), mkTruck({ w: 0 }));
  assert.equal(r.totals.volumeRatio, 0);
});
test('Fahrzeugmaß 0 (Höhe): volumeRatio liefert 0 statt NaN', () => {
  const r = validatePlan(plan([]), byId(K), mkTruck({ h: 0 }));
  assert.equal(r.totals.volumeRatio, 0);
});

// Placements mit fehlendem Case-Typ können mangels bekannter Maße geometrisch nicht in die
// Kollisionsprüfung einbezogen werden (das Modell speichert keine Maße pro Placement, nur
// pro Case-Typ) — die Meldung muss das aber offenlegen, statt stillschweigend "geprüft" zu
// wirken (docs/code-review-2026-09-21.md, Vorschlag: "Mindestens muss die Meldung sagen,
// dass die Position ungeprüft bleibt").
test('fehlender Case-Typ: Meldung macht deutlich, dass die Position nicht auf Kollisionen geprüft wird', () => {
  const r = validatePlan(plan([P('a', 'weg', 0, 0, 0, { label: 'Geistercase' })]), byId(K), mkTruck());
  const msg = r.byPlacement.get('a')[0].message;
  assert.match(msg, /Geistercase/);
  assert.match(msg, /nicht.*(auf Kollisionen|geprüft)/i);
});

test('tooManyLayers bei 5er-Stapel flacher Cases', () => {
  const F = mkCase('f', 120, 60, 50);
  const r = validatePlan(plan([
    P('a','f',0,94,0), P('b','f',0,94,50), P('c','f',0,94,100),
    P('d','f',0,94,150), P('e','f',0,94,200),
  ]), byId(F), mkTruck());
  assert.equal(r.layers.get('e'), 5);
  assert.deepEqual(codes(r,'e'), ['tooManyLayers']);
  assert.match(r.byPlacement.get('e')[0].message, /„f“ steht in Lage 5 – mehr als 4 Lagen sind nicht vorgesehen\./);
});
