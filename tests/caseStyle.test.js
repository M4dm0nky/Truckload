import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_BLACK, COLOR_MODES, caseColors, DETAIL_MIN } from '../js/ui/caseStyle.js';
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
test('COLOR_MODES enthält beide Modi', () => {
  assert.deepEqual(COLOR_MODES, ['black', 'trade']);
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

// DETAIL_MIN ist die einzige Quelle für 2D und 3D (Befund I3/I4, js/ui/view2d.js und
// js/ui/view3d.js importieren beide von hier). Ohne diesen Test lässt sich der Wert
// unbemerkt verändern und die beiden Ansichten laufen wieder auseinander.
test('DETAIL_MIN hat den dokumentierten Wert (40 cm)', () => {
  assert.equal(DETAIL_MIN, 40);
});
