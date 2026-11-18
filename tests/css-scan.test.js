import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCss, targetCompound, uiClasses, isControlTarget, findControlStyling, findColorLiterals, findFixedFontSizes, findBlockOverrides } from './css-scan.js';

const SNIPPET = `:root { --x: #fff; }
.a button { padding: 2px; flex: 1; }
.b { color: #123; }
svg .c { fill: rgba(0,0,0,.5); }
@media (max-width: 600px) { .d input:hover { font-size: 12px; } }
.e, .f select { margin: 0; border-color: red; }
.lib-item:hover { background: var(--bg); }
.klein { padding: 1px; }
`;
const ui = new Set(['klein']);

test('parseCss: Einzelregeln, Media, Zeilennummer, Kommentare', () => {
  const rules = parseCss('/* x { a: b } */\n.a, .b { color: #000; }\n@media (max-width: 600px) {\n  .c { margin: 0 }\n}\n');
  assert.deepEqual(rules.map(r => [r.selector, r.media, r.line]),
    [['.a', null, 2], ['.b', null, 2], ['.c', '(max-width: 600px)', 4]]);
  assert.deepEqual(rules[0].decls, [{ prop: 'color', value: '#000' }]);
  assert.deepEqual(rules[2].decls, [{ prop: 'margin', value: '0' }]);
});

test('targetCompound', () => {
  assert.equal(targetCompound('.view figcaption .zoom button'), 'button');
  assert.equal(targetCompound('.x > .y.z:hover'), '.y.z:hover');
});

test('isControlTarget', () => {
  assert.equal(isControlTarget('button', ui), true);
  assert.equal(isControlTarget('input:hover', ui), true);
  assert.equal(isControlTarget('.btn', ui), true);
  assert.equal(isControlTarget('.klein', ui), true);
  assert.equal(isControlTarget('.lib-item:hover', ui), false);
  assert.equal(isControlTarget('.x:not(button)', ui), false);
});

test('findControlStyling', () => {
  const found = findControlStyling(parseCss(SNIPPET), ui).map(f => `${f.selector} ${f.prop}`);
  assert.deepEqual(found, ['.a button padding', '.d input:hover font-size', '.f select border-color', '.klein padding']);
});

test('findColorLiterals', () => {
  const found = findColorLiterals(parseCss(SNIPPET)).map(f => `${f.selector} ${f.prop} ${f.value}`);
  assert.deepEqual(found, ['.b color #123', '.e border-color red', '.f select border-color red']);
});

test('findColorLiterals: transparent, currentColor, var, Tokens in @media', () => {
  const css = ':root{--a:red}\n@media (x){:root{--b:blue}}\n.a{color:transparent;border:1px solid currentColor;background:var(--red)}';
  assert.deepEqual(findColorLiterals(parseCss(css)), []);
});

test('uiClasses: alle Klassen unverschachtelter Zielglieder, nie :not, Kontext oder Zustand', () => {
  const css = '.a.on:hover, button.b.c, .x .row, .lkw-tab.none:not(.on), input.error { x: y }';
  assert.deepEqual([...uiClasses(parseCss(css))].sort(), ['a', 'b', 'c', 'lkw-tab']);
});

test('Ansichtsregeln mit Zustands- oder Kontextklasse sind kein Bedienelement-Ziel', () => {
  const ui = uiClasses(parseCss('.editor .row { x: y } input.error { x: y } .chip { x: y }'));
  assert.equal(isControlTarget('.save-status.error', ui), false);
  assert.equal(isControlTarget('.row.wiz-all', ui), false);
  assert.equal(isControlTarget('.chip', ui), true);
});

test('Hakenklasse plus Variante wird gemeldet, Zustand und Kontext nicht', () => {
  const ui = uiClasses(parseCss('.chip { x: y } .small { x: y } .btn { x: y } .primary { x: y } .editor .row { x: y } .on { x: y } input.error { x: y }'));
  for (const sel of ['.x.chip', '.quick-len.chip', '.insp-weight.small', '.x.btn', '.x.primary']) {
    const found = findControlStyling(parseCss(`${sel} { padding: 1px }`), ui);
    assert.deepEqual(found.map(f => f.selector), [sel], sel);
  }
  for (const sel of ['.save-status.error', '.wiz-dot.on', '.row.wiz-all']) {
    assert.deepEqual(findControlStyling(parseCss(`${sel} { padding: 1px }`), ui), [], sel);
  }
});

test('findFixedFontSizes: feste Größen melden, Tokens, :root, svg und --* nicht', () => {
  const css = '.a { font-size: 12px }\n.b { font: 13px/1 x }\n:root { font: 14px/1.4 x }\nsvg .t { font-size: 14px }\n.c { font-size: var(--x) }\n.d { font-size: calc(var(--x) - 1px) }\n.e { --y: 12px }\n.f { font-size: inherit }\n.g { font: inherit }';
  assert.deepEqual(findFixedFontSizes(parseCss(css)).map(f => `${f.selector} ${f.prop}`), ['.a font-size', '.b font']);
});

test('findFixedFontSizes: Großschreibung, max/min/clamp wie calc', () => {
  const css = '.a { font-size: 12PX }\n.b { font-size: 1Rem }\n.c { font-size: max(12px, 1vw) }\n.d { font-size: clamp(var(--a), 2vw, 20px) }\n.e { font-size: max(var(--a), var(--b)) }\n.f { font-size: min(var(--a), 1vw) }';
  assert.deepEqual(findFixedFontSizes(parseCss(css)).map(f => f.selector), ['.a', '.b', '.c']);
});

test('LOOK_PROPS kennt Schrift- und Darstellungsdetails', () => {
  for (const p of ['letter-spacing', 'text-decoration', 'text-transform', 'accent-color', 'appearance', 'filter']) {
    assert.deepEqual(findControlStyling(parseCss(`button { ${p}: x }`), new Set()).map(f => f.prop), [p], p);
  }
});

test('findBlockOverrides: nachgebaute Baustein-Selektoren', () => {
  const uiRules = parseCss('.editor .kind-switch label { padding: 1px }\n.editor h2 { margin: 0 }');
  const appRules = parseCss('.editor .kind-switch label { padding: 0 }\n.x .editor h2 { color: red }\n.editor .kind-switch { display: flex }\n.foo h2 { color: red }\n.editor h2:hover { color: red }');
  assert.deepEqual(findBlockOverrides(appRules, uiRules).map(f => `${f.selector} ${f.prop}`),
    ['.editor .kind-switch label padding', '.x .editor h2 color', '.editor h2:hover color']);
});
