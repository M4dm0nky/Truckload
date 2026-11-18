import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_VERSION, THEME_TOKENS } from '../js/ui/themeTokens.js';

const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const uiCss = readFileSync(new URL('../css/ui.css', import.meta.url), 'utf8');

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

const DUNKEL2 = {
  '--tl-control-height': 'auto', '--tl-control-height-sm': 'auto',
  '--tl-control-font-size': 'inherit', '--tl-control-font-size-sm': '12px',
  '--tl-button-pad': '5px 10px', '--tl-button-pad-sm': '2px 8px',
  '--tl-field-pad': '5px 8px', '--tl-field-pad-sm': '2px 6px',
  '--tl-button-weight': 'inherit', '--tl-button-primary-weight': '600',
  '--tl-button-bg': 'var(--tl-raised)', '--tl-button-hover-bg': 'var(--tl-button-bg)',
  '--tl-button-hover-border': 'var(--tl-text-muted)',
  '--tl-selected-bg': 'var(--tl-accent)', '--tl-selected-text': 'var(--tl-on-accent)',
  '--tl-selected-border': 'var(--tl-accent)', '--tl-marked-border': 'var(--tl-accent)',
  '--tl-dialog-radius': '12px', '--tl-dialog-pad': '18px', '--tl-dialog-title-size': '18px',
  '--tl-dialog-divider': 'transparent', '--tl-backdrop': 'rgba(0,0,0,.5)',
  '--tl-warn': '#f2b705', '--tl-warn-text': '#f2b705',
  '--tl-control-border': 'var(--tl-line)', '--tl-font-size': '14px', '--tl-hint-font-size': '12px',
  '--tl-line-height': '1.4', '--tl-font-size-xs': '11px', '--tl-font-size-sm': '12px', '--tl-font-size-lg': '16px',
};

test('Token-Liste Version 1 ist vollständig und in fester Reihenfolge', () => {
  assert.deepEqual(THEME_TOKENS.slice(0, 18), Object.keys(DUNKEL));
});

test('Token-Liste Version 2 = Version 1 + neue, feste Reihenfolge', () => {
  assert.equal(THEME_VERSION, 3);
  assert.deepEqual(THEME_TOKENS, [...Object.keys(DUNKEL), ...Object.keys(DUNKEL2), '--tl-segment-joined']);
  assert.equal(THEME_TOKENS.at(-1), '--tl-segment-joined');
});

test('Standardwerte Version 2', () => {
  const root = block(':root');
  for (const [k, v] of Object.entries(DUNKEL2)) assert.equal(root[k], v, k);
  assert.equal(root['--tl-theme-version'], '3');
  assert.equal(root['--tl-segment-joined'], '0');
});

test('Warntext je Modus', () => {
  assert.equal(lightMediaRoot()['--tl-warn-text'], '#7a5a00');
  assert.equal(block(':root[data-theme="light"]')['--tl-warn-text'], '#7a5a00');
  assert.equal(block(':root[data-theme="dark"]')['--tl-warn-text'], '#f2b705');
});

test('Warn-Aliasse', () => {
  const root = block(':root');
  assert.equal(root['--warn'], 'var(--tl-warn)');
  assert.equal(root['--warn-text'], 'var(--tl-warn-text)');
});

test('Standardwerte = alte Palette (dunkel), jeder Token definiert', () => {
  const root = block(':root');
  for (const [k, v] of Object.entries(DUNKEL)) assert.equal(root[k], v, k);
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
  assert.match(uiCss, /button, \.btn \{[^}]*background: var\(--tl-button-bg\)[^}]*border-radius: var\(--tl-radius\)/);
  assert.match(uiCss, /select, input, textarea \{[^}]*background: var\(--tl-input\)[^}]*border-radius: var\(--tl-radius\)/);
  assert.match(uiCss, /:focus-visible \{[^}]*outline: 2px solid var\(--tl-focus\)/);
  assert.match(css, /body \{[^}]*font-family: var\(--tl-font\)/);
});

test('Randfarbe, Grund- und Hinweisschrift werden von den Bausteinen gelesen', () => {
  const rule = (sel) => { const i = uiCss.indexOf(`\n${sel} {`); assert.ok(i >= 0, sel); return uiCss.slice(i, uiCss.indexOf('}', i)); };
  assert.match(rule('button, .btn'), /border: 1px solid var\(--tl-control-border\)/);
  assert.match(rule('select, input, textarea'), /border: 1px solid var\(--tl-control-border\)/);
  assert.match(rule('.hint'), /font-size: var\(--tl-hint-font-size\)/);
  assert.match(css, /font: var\(--tl-font-size\)\/var\(--tl-line-height\) /);
  assert.match(rule('.editor .kind-switch label'), /border: 1px solid var\(--tl-control-border\)/);
});

test('ui.css: Größen-Varianten folgen den Höhen-Tokens', () => {
  const rule = sel => uiCss.split('\n').find(l => l.startsWith(sel + ' {') || l.startsWith(sel + ', '));
  assert.match(uiCss, /input\.small, select\.small \{[^}]*min-height: var\(--tl-control-height-sm\)/);
  assert.match(rule('button.mini'), /min-height: var\(--tl-control-height-sm\)/);
  assert.match(rule('button.chip'), /min-height: var\(--tl-control-height-sm\)/);
  assert.match(rule('button.quiet'), /min-height: 0/);
  assert.match(uiCss, /\.editor \.kind-switch label \{[^}]*min-height: var\(--tl-control-height\)/);
  assert.match(uiCss, /input\[type="checkbox"\], input\[type="radio"\] \{[^}]*min-height: 0/);
  assert.match(uiCss, /select, input, textarea \{[^}]*font-size: var\(--tl-control-font-size\)/);
});
