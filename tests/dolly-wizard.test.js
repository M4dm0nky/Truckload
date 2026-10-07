import test from 'node:test';
import assert from 'node:assert/strict';
import { dollyStackCase } from '../js/model/audioDolly.js';
import { mkCase } from './fixtures.js';

// openDollyDialog() selbst ist ein DOM-Dialog (wie openTrussDialog()) und wird per Browser-
// Probe (tools/cdp.mjs) geprüft, nicht hier. Dieser Test sichert nur den reinen Baustein ab,
// den der Dialog beim Bestätigen aufruft.
test('dollyStackCase liefert ein für den Dialog passendes Case (Smoke-Test der Schnittstelle)', () => {
  const base = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const c = dollyStackCase(base, 2);
  assert.equal(c.id, 'dolly-k2-2');
  assert.equal(c.name, 'L-Acoustics K2 2er (auf Dolly)');
});
