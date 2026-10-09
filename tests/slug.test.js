import test from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../js/model/slug.js';

test('slug: Umlaute und ß lesbar, Rest zu Bindestrichen, Ränder ohne Bindestrich', () => {
  assert.equal(slug('Größe Ärger'), 'groesse-aerger');
  assert.equal(slug('  Viper X2 (CAB)!  '), 'viper-x2-cab');
  assert.equal(slug('Café'), 'cafe');
});
