import test from 'node:test';
import assert from 'node:assert/strict';
import { symbol, dialogKopf } from '../js/ui/dom.js';
import { SYMBOLS, LUCIDE_VERSION } from '../js/ui/symbols.js';
import { t } from '../js/i18n/i18n.js';

const NAMEN = ['arrow-down', 'arrow-up', 'box', 'circle-x', 'minus', 'pencil-line', 'plus', 'redo-2', 'trash-2', 'triangle-alert', 'undo-2', 'x'];

test('Lucide-Version und Symbolnamen sind fest', () => {
  assert.equal(LUCIDE_VERSION, '1.74.0');
  assert.deepEqual(Object.keys(SYMBOLS).sort(), NAMEN);
});

test('symbol() liefert ein SVG, das der Textfarbe folgt und stumm ist', () => {
  const s = symbol('x');
  assert.ok(s.startsWith('<svg class="symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor"'));
  assert.ok(s.includes('aria-hidden="true"'));
  for (const n of NAMEN) assert.match(symbol(n), /^<svg class="symbol".*<\/svg>$/s);
});

test('symbol() wirft bei unbekanntem Namen', () => {
  assert.throws(() => symbol('nope'), /Unknown symbol: nope/);
});

test('dialogKopf: Standard schließt per Formular', () => {
  const h = dialogKopf('A');
  assert.ok(h.includes('<header class="dialog-head"><h2>A</h2>'));
  assert.ok(h.includes('value="cancel"') && h.includes('formnovalidate') && h.includes('type="submit"'));
  assert.ok(h.includes('class="quiet dialog-x"'));
  assert.ok(h.includes(`aria-label="${t('Schließen')}"`));
});

test('dialogKopf mit act ist ein Knopf mit data-act', () => {
  const h = dialogKopf('A', { act: 'cancel' });
  assert.ok(h.includes('data-act="cancel"') && h.includes('type="button"'));
  assert.ok(!h.includes('formnovalidate'));
  assert.ok(h.includes('class="quiet dialog-x"'));
});
