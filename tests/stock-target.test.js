import test from 'node:test';
import assert from 'node:assert/strict';
import { stockTargetHtml, readStockTarget, resolveStockCompany, newCompanyError } from '../js/ui/stock-target.js';

test('stockTargetHtml (choose): Häkchen an, Meine Sammlung + Sammlungen, Namen escaped', () => {
  const html = stockTargetHtml({ mode: 'choose', companies: ['CAB', '<b>X'], defaultCompany: 'CAB' });
  assert.match(html, /name="inStock" checked/);
  assert.match(html, /<option value="">Meine Sammlung<\/option>/);
  assert.match(html, /<option value="CAB" selected>CAB<\/option>/);
  assert.match(html, /&lt;b&gt;X/);
});
test('stockTargetHtml (fixed): kein Häkchen, Firma als Hinweis', () => {
  const html = stockTargetHtml({ mode: 'fixed', company: 'CAB' });
  assert.doesNotMatch(html, /inStock/);
  assert.match(html, /Sammlung: CAB/);
  assert.match(stockTargetHtml({ mode: 'fixed', company: '' }), /Meine Sammlung/);
});
test('readStockTarget', () => {
  const form = { elements: { inStock: { checked: false }, stockCompany: { value: 'CAB' } } };
  assert.deepEqual(readStockTarget(form, { mode: 'choose' }), { inStock: false, company: 'CAB' });
  assert.deepEqual(readStockTarget({ elements: {} }, { mode: 'fixed', company: 'X' }), { inStock: true, company: 'X' });
});

// Nutzer-Feedback 2026-10-09: beim Ablegen im Wizard direkt eine neue Firma anlegen können.
test('stockTargetHtml (choose): Option „+ Neue Sammlung …“ und verborgenes Namensfeld (max. 80)', () => {
  const html = stockTargetHtml({ mode: 'choose', companies: ['CAB'], defaultCompany: '' });
  assert.match(html, /<option value="__new__">\+ Neue Sammlung …<\/option>/);
  assert.match(html, /<label class="stock-new" hidden>[^<]*<input name="stockNewCompany" maxlength="80"/);
  assert.doesNotMatch(stockTargetHtml({ mode: 'fixed', company: 'CAB' }), /__new__|stockNewCompany/);
});
test('resolveStockCompany: neue Firma getrimmt, sonst die Auswahl', () => {
  assert.equal(resolveStockCompany('__new__', '  Neue GmbH '), 'Neue GmbH');
  assert.equal(resolveStockCompany('CAB', 'egal'), 'CAB');
  assert.equal(resolveStockCompany('', ''), '');
});
test('readStockTarget: neue Firma aus dem Namensfeld', () => {
  const form = { elements: { inStock: { checked: true }, stockCompany: { value: '__new__' }, stockNewCompany: { value: ' X ' } } };
  assert.deepEqual(readStockTarget(form, { mode: 'choose' }), { inStock: true, company: 'X' });
});
test('newCompanyError: nur im Neu-Modus, prüft leer/zu lang/reserviert', () => {
  assert.equal(newCompanyError('CAB', ''), null);
  assert.equal(newCompanyError('__new__', 'Neu', false), null);
  assert.equal(newCompanyError('__new__', 'Neu'), null);
  assert.match(newCompanyError('__new__', '  '), /fehlt/);
  assert.match(newCompanyError('__new__', 'x'.repeat(81)), /höchstens/);
  assert.match(newCompanyError('__new__', '__Standard__'), /reserviert/);
});
test('newCompanyError: Name einer vorhandenen Sammlung ist doppelt', () => {
  const cols = [{ id: 't', name: 'TSE' }];
  assert.match(newCompanyError('__new__', 'tse', true, cols), /gibt es schon/);
  assert.equal(newCompanyError('__new__', 'Robe', true, cols), null);
});
