import test from 'node:test';
import assert from 'node:assert/strict';
import { stockTargetHtml, readStockTarget } from '../js/ui/stock-target.js';

test('stockTargetHtml (choose): Häkchen an, Standardliste + Firmen, Firmennamen escaped', () => {
  const html = stockTargetHtml({ mode: 'choose', companies: ['CAB', '<b>X'], defaultCompany: 'CAB' });
  assert.match(html, /name="inStock" checked/);
  assert.match(html, /<option value="">Standardliste<\/option>/);
  assert.match(html, /<option value="CAB" selected>CAB<\/option>/);
  assert.match(html, /&lt;b&gt;X/);
});
test('stockTargetHtml (fixed): kein Häkchen, Firma als Hinweis', () => {
  const html = stockTargetHtml({ mode: 'fixed', company: 'CAB' });
  assert.doesNotMatch(html, /inStock/);
  assert.match(html, /Firma: CAB/);
  assert.match(stockTargetHtml({ mode: 'fixed', company: '' }), /Standardliste/);
});
test('readStockTarget', () => {
  const form = { elements: { inStock: { checked: false }, stockCompany: { value: 'CAB' } } };
  assert.deepEqual(readStockTarget(form, { mode: 'choose' }), { inStock: false, company: 'CAB' });
  assert.deepEqual(readStockTarget({ elements: {} }, { mode: 'fixed', company: 'X' }), { inStock: true, company: 'X' });
});
