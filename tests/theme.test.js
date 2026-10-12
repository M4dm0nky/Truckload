import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_VERSION, THEME_TOKENS } from '../js/ui/themeTokens.js';

const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');

// Liefert die Deklarationen des ERSTEN Blocks, dessen Selektor genau `sel` ist.
function block(sel) {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `Block ${sel} fehlt`);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
function lightMediaRoot() {
  const i = css.indexOf('@media (prefers-color-scheme: light)');
  assert.ok(i >= 0);
  const j = css.indexOf(':root {', i);
  const body = css.slice(css.indexOf('{', j) + 1, css.indexOf('}', j));
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const DUNKEL = {
  '--tl-bg': '#0f172a', '--tl-surface': '#192134', '--tl-raised': '#192134', '--tl-input': '#0f172a',
  '--tl-line': '#2a3444', '--tl-text': '#ffffff', '--tl-text-muted': '#94a3b8', '--tl-accent': '#d97706',
  '--tl-on-accent': '#111', '--tl-selection': '#f0a500', '--tl-danger': '#dc2626', '--tl-ok': '#30a46c',
  '--tl-truck': '#121a2c', '--tl-grid': '#223049',
  '--tl-font': 'system-ui, -apple-system, "Segoe UI", sans-serif',
  '--tl-font-display': 'system-ui, -apple-system, "Segoe UI", sans-serif',
  '--tl-radius': '6px', '--tl-focus': '#d97706',
};
const HELL = {
  '--tl-bg': '#f1f4f9', '--tl-surface': '#fff', '--tl-raised': '#fff', '--tl-input': '#f1f4f9',
  '--tl-line': '#dce3ec', '--tl-text': '#16213a', '--tl-text-muted': '#5b6b85',
  '--tl-truck': '#f7f9fc', '--tl-grid': '#e5eaf1',
};

test('Token-Liste Version 1 ist vollständig und in fester Reihenfolge', () => {
  assert.equal(THEME_VERSION, 1);
  assert.deepEqual(THEME_TOKENS, Object.keys(DUNKEL));
});

test('Standardwerte = alte Palette (dunkel), jeder Token definiert', () => {
  const root = block(':root');
  for (const [k, v] of Object.entries(DUNKEL)) assert.equal(root[k], v, k);
  assert.equal(root['--tl-theme-version'], '1');
});

test('Standardwerte = alte Palette (hell, Systemeinstellung)', () => {
  const hell = lightMediaRoot();
  for (const [k, v] of Object.entries(HELL)) assert.equal(hell[k], v, k);
});

test('alte Variablen sind Aliasse auf die Tokens', () => {
  const root = block(':root');
  const alias = { '--bg': 'tl-bg', '--panel': 'tl-surface', '--line': 'tl-line', '--text': 'tl-text',
    '--muted': 'tl-text-muted', '--accent': 'tl-accent', '--on-accent': 'tl-on-accent',
    '--danger': 'tl-danger', '--ok': 'tl-ok', '--truck': 'tl-truck', '--grid': 'tl-grid' };
  for (const [alt, neu] of Object.entries(alias)) assert.equal(root[alt], `var(--${neu})`, alt);
});

test('data-theme gibt es für hell und dunkel, mit allen Farb-Tokens', () => {
  const dark = block(':root[data-theme="dark"]');
  const light = block(':root[data-theme="light"]');
  for (const k of Object.keys(HELL)) {
    assert.equal(dark[k], DUNKEL[k], `dark ${k}`);
    assert.equal(light[k], HELL[k], `light ${k}`);
  }
});

test('Knöpfe, Felder, Fokus und Schrift lesen die Tokens', () => {
  assert.match(css, /button, \.btn \{[^}]*background: var\(--tl-raised\)[^}]*border-radius: var\(--tl-radius\)/);
  assert.match(css, /select, input, textarea \{[^}]*background: var\(--tl-input\)[^}]*border-radius: var\(--tl-radius\)/);
  assert.match(css, /:focus-visible \{[^}]*outline: 2px solid var\(--tl-focus\)/);
  assert.match(css, /body \{[^}]*font-family: var\(--tl-font\)/);
});
