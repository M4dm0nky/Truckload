import test from 'node:test';
import assert from 'node:assert/strict';
import { readThemeColors, FALLBACK } from '../js/ui/themeColors.js';

test('liest bg, selection, danger aus den Tokens, getrimmt', () => {
  const vars = { '--tl-bg': ' #0f1117 ', '--tl-selection': '#f7c948', '--tl-danger': '#fc8181' };
  assert.deepEqual(readThemeColors(n => vars[n]), { bg: '#0f1117', selection: '#f7c948', danger: '#fc8181' });
});

test('leere oder fehlende Werte fallen auf die Standardwerte zurück', () => {
  assert.deepEqual(readThemeColors(() => ''), FALLBACK);
  assert.deepEqual(readThemeColors(() => undefined), FALLBACK);
  assert.deepEqual(FALLBACK, { bg: '#0f172a', selection: '#f0a500', danger: '#dc2626' });
});

test('view3d.js liest Farben nur über readThemeColors und hört auf tl-theme', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/ui/view3d.js', import.meta.url), 'utf8');
  assert.match(src, /readThemeColors\(/);
  assert.match(src, /addEventListener\('tl-theme'/);
  assert.match(src, /removeEventListener\('tl-theme'/);
  assert.doesNotMatch(src, /0xf0a500|0xe5484d/, 'Bedeutungsfarben nicht mehr fest im 3D-Code');
});
