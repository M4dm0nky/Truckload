import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_BLACK, COLOR_MODES, caseColors, DETAIL_MIN, CORNER_R, cornerCenters3d, weightRange, weightColor, textColorFor } from '../js/ui/caseStyle.js';
import { mkCase } from './fixtures.js';

const C = mkCase('k', 120, 60, 80, { color: '#ff8800' });

test('schwarz: Korpus schwarz, Streifen in Gewerk-Farbe', () => {
  assert.deepEqual(caseColors(C, 'black'), { body: CASE_BLACK, stripe: '#ff8800' });
});
test('trade: Korpus in Gewerk-Farbe, kein Streifen', () => {
  assert.deepEqual(caseColors(C, 'trade'), { body: '#ff8800', stripe: null });
});
test('unbekannter Modus → schwarz', () => {
  assert.deepEqual(caseColors(C, 'was-auch-immer'), { body: CASE_BLACK, stripe: '#ff8800' });
});
test('COLOR_MODES enthält alle drei Modi', () => {
  assert.deepEqual(COLOR_MODES, ['black', 'trade', 'weight']);
});

test('schwarz mit Stück-Farbe: Korpus bleibt schwarz, Streifen in Stück-Farbe (schlägt Gewerkfarbe)', () => {
  assert.deepEqual(caseColors(C, 'black', '#3b7dd8'), { body: CASE_BLACK, stripe: '#3b7dd8' });
});
test('trade mit Stück-Farbe: Korpus in Stück-Farbe (schlägt Gewerkfarbe)', () => {
  assert.deepEqual(caseColors(C, 'trade', '#3b7dd8'), { body: '#3b7dd8', stripe: null });
});
test('ohne itemColor bleibt es beim bisherigen Verhalten (Gewerkfarbe)', () => {
  assert.deepEqual(caseColors(C, 'black', undefined), caseColors(C, 'black'));
  assert.deepEqual(caseColors(C, 'trade', undefined), caseColors(C, 'trade'));
});

// DETAIL_MIN legt fest, ab welcher Größe 3D ein Case mit Flightcase-Details zeichnet
// (js/ui/view3d.js importiert ihn von hier; Befund I3/I4). 2D braucht ihn seit V 0.9.2 nicht
// mehr – dort ist jedes Stück ein schlichtes Rechteck. Ohne diesen Test ließe sich der Wert
// unbemerkt verändern.
test('DETAIL_MIN hat den dokumentierten Wert (40 cm)', () => {
  assert.equal(DETAIL_MIN, 40);
});

// Kugelecken (Nutzer-Feedback 2026-09-28: „viel zu groß, richtige Bälle – in echt stehen die kaum
// raus“): das gemessene Außenmaß enthält die Ecken schon, also darf keine Ecke darüber hinausragen.
// Mittelpunkte liegen um r nach innen versetzt, die Kugel berührt die Außenkante nur.
test('cornerCenters3d: 8 Mittelpunkte je um r innerhalb der Box', () => {
  const b = { x0: 0, y0: 0, z0: 12, x1: 120, y1: 60, z1: 80 };
  const pts = cornerCenters3d(b, CORNER_R);
  assert.equal(pts.length, 8);
  for (const p of pts) for (const a of ['x', 'y', 'z']) {
    assert.ok(p[a] - CORNER_R >= b[`${a}0`] - 1e-9 && p[a] + CORNER_R <= b[`${a}1`] + 1e-9, a);
  }
});

test('Eckenradius ist klein (kaum sichtbar über dem Profil, keine Bälle)', () => {
  assert.ok(CORNER_R > 0 && CORNER_R <= 2.5);
});

test('weightRange: Spanne nur über Stücke mit Gewicht', () => {
  const items = [{ c: { weight: 0 } }, { c: { weight: 20 } }, { c: { weight: 100 } }];
  assert.deepEqual(weightRange(items), { min: 20, max: 100 });
});

test('weightRange: ohne Stück mit Gewicht gibt es keine Spanne', () => {
  assert.equal(weightRange([{ c: { weight: 0 } }]), null);
  assert.equal(weightRange([]), null);
});

test('weightColor: 0 kg ist unbekannt und wird neutral grau, nicht „am leichtesten“', () => {
  const grau = weightColor(0, { min: 20, max: 100 });
  assert.equal(grau, weightColor(0, { min: 1, max: 2 }), 'unabhängig von der Spanne derselbe Grauton');
  assert.notEqual(grau, weightColor(20, { min: 20, max: 100 }));
});

test('weightColor: leicht und schwer sind unterschiedlich, Reihenfolge stimmt', () => {
  const r = { min: 20, max: 100 };
  const leicht = weightColor(20, r), mitte = weightColor(60, r), schwer = weightColor(100, r);
  for (const v of [leicht, mitte, schwer]) assert.match(v, /^#[0-9a-f]{6}$/i);
  assert.notEqual(leicht, schwer);
  assert.notEqual(leicht, mitte);
  assert.notEqual(mitte, schwer);
});

test('weightColor: alle gleich schwer (min = max) liefert eine gültige Farbe, keine Division durch null', () => {
  const v = weightColor(50, { min: 50, max: 50 });
  assert.match(v, /^#[0-9a-f]{6}$/i);
});

test('weightColor: ohne Spanne (null) ist alles neutral', () => {
  assert.equal(weightColor(50, null), weightColor(0, null));
});

test('caseColors: Modus weight färbt den Körper wie trade, ohne Streifen', () => {
  const c = { color: '#123456' };
  assert.deepEqual(caseColors(c, 'weight', '#ff0000'), { body: '#ff0000', stripe: null });
});

test('caseColors: Modi schwarz und Gewerk unverändert (Regression)', () => {
  const c = { color: '#123456' };
  assert.deepEqual(caseColors(c, 'trade', '#abcdef'), { body: '#abcdef', stripe: null });
  assert.equal(caseColors(c, 'black', '#abcdef').stripe, '#abcdef');
});

// Schlussprüfung des Branches, Befund 7: Traversenwagen behalten ihre Markenfarbe (drawTruss/
// addTruss übergehen den Farbmodus bewusst). Sie spannten die Gewichtsskala aber trotzdem auf —
// ein 100-kg-Traversenwagen neben Kabelcases von 10–30 kg drückte alle Cases in das untere
// Drittel der Skala, so dass sie fast gleich blau aussahen, während das Stück, das das Maximum
// setzte, selbst gar nicht eingefärbt wurde. Was nicht mitgefärbt wird, darf die Skala nicht
// bestimmen.
test('weightRange lässt Traversenwagen aus, weil sie ihre Markenfarbe behalten', () => {
  const items = [
    { c: { weight: 10 } },
    { c: { weight: 30 } },
    { c: { weight: 100, kind: 'truss' } },
  ];
  assert.deepEqual(weightRange(items), { min: 10, max: 30 });
});

test('weightRange: ein Load nur aus Traversenwagen hat keine Spanne', () => {
  assert.equal(weightRange([{ c: { weight: 100, kind: 'truss' } }]), null);
});

test('textColorFor: dunkle Schrift auf hellem, helle auf dunklem Grund', () => {
  assert.equal(textColorFor('#ffffff'), '#111214');
  assert.equal(textColorFor('#000000'), '#f5f5f5');
  assert.equal(textColorFor('#fc0'), '#111214'); // ffcc00: 0,299 + 0,587·0,8 ≈ 0,77 > 0,55
  assert.equal(textColorFor('#f00'), '#f5f5f5'); // 0,299 < 0,55
});

test('textColorFor: ohne Farbe gilt Case-Schwarz, kaputte Werte zählen als 0', () => {
  assert.equal(textColorFor(undefined), '#f5f5f5');
  assert.equal(textColorFor(''), '#f5f5f5');
  assert.equal(textColorFor('zzzzzz'), '#f5f5f5');
});

test('textColorFor: Grenzwert der Helligkeit 0,55 (#8c8c8c hell auf dunkel, #8d8d8d dunkel auf hell)', () => {
  assert.equal(textColorFor('#8c8c8c'), '#f5f5f5');
  assert.equal(textColorFor('#8d8d8d'), '#111214');
});
