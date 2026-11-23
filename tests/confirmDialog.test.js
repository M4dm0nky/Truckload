import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFilter } from '../js/ui/confirmDialog.js';

const opts = ['Robe BMFL x2', 'MAC Viper x2', 'robe spiider x4'].map((label, i) => ({ value: 'v' + i, label }));

test('pickFilter: Wörter, ohne Groß/Klein, Reihenfolge bleibt', () => {
  assert.deepEqual(pickFilter(opts, 'robe').map(o => o.value), ['v0', 'v2']);
  assert.deepEqual(pickFilter(opts, 'ROBE x4').map(o => o.value), ['v2']);
  assert.equal(pickFilter(opts, '').length, 3);
  assert.equal(pickFilter(opts, '  ').length, 3);
  assert.equal(pickFilter(opts, 'zzz').length, 0);
  assert.doesNotThrow(() => pickFilter(opts, '<b>'));
});
