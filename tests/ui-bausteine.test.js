// Wächter für die Bausteine (Spec §8): app.css gestaltet keine Bedienelemente, keine
// Farbliterale außerhalb der Token-Blöcke, und ui.css lädt vor app.css.
// Prüfung 3 (Längen in ui.css) fehlt bewusst: siehe PR-Text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCss, uiClasses, findControlStyling, findColorLiterals, findFixedFontSizes, findBlockOverrides } from './css-scan.js';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ui = parseCss(read('css/ui.css'));
const app = parseCss(read('css/app.css'));
const fmt = (file, l) => l.map(x => `${file}:${x.line} ${x.selector} { ${x.prop}${x.value ? ': ' + x.value : ''} }`).join('\n');

test('app.css gestaltet keine Bedienelemente', () => {
  const found = findControlStyling(app, uiClasses(ui));
  assert.deepEqual(found, [], `Gestaltung gehört nach css/ui.css:\n${fmt('css/app.css', found)}`);
});

test('keine Farbliterale außerhalb der Token-Blöcke', () => {
  const found = [...findColorLiterals(app).map(x => ({ ...x, f: 'css/app.css' })), ...findColorLiterals(ui).map(x => ({ ...x, f: 'css/ui.css' }))];
  assert.deepEqual(found, [], `Farben nur über Tokens:\n${found.map(x => fmt(x.f, [x])).join('\n')}`);
});

test('keine festen Schriftgrößen in app.css und ui.css', () => {
  const found = [...findFixedFontSizes(app).map(x => ({ ...x, f: 'css/app.css' })), ...findFixedFontSizes(ui).map(x => ({ ...x, f: 'css/ui.css' }))];
  assert.deepEqual(found, [], `Schriftgrößen nur über Tokens:\n${found.map(x => fmt(x.f, [x])).join('\n')}`);
});

test('ui.css kennt kein generisches button.on', () => {
  const bad = ui.filter(r => /^button\.on(:[\w-]+)*$/.test(r.selector));
  assert.deepEqual(bad.map(r => `css/ui.css:${r.line} ${r.selector}`), []);
});

test('app.css baut keine Baustein-Selektoren aus ui.css nach', () => {
  const found = findBlockOverrides(app, ui);
  assert.deepEqual(found, [], `Gestaltung gehört nach css/ui.css:\n${fmt('css/app.css', found)}`);
});

test('ui.css wird vor app.css geladen (index.html, Musterseite)', () => {
  for (const name of ['index.html', 'tools/muster.html']) {
    const hrefs = [...read(name).matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map(m => m[1]);
    const u = hrefs.findIndex(h => h.endsWith('css/ui.css')), a = hrefs.findIndex(h => h.endsWith('css/app.css'));
    assert.ok(u >= 0 && a >= 0, `${name} nennt beide Dateien`);
    assert.ok(u < a, `${name}: css/ui.css muss vor css/app.css stehen`);
  }
});

test('sw.js führt ui.css und app.css in ASSETS (Reihenfolge dort ohne Wirkung auf die Kaskade)', () => {
  const sw = read('sw.js');
  assert.ok(sw.includes('css/ui.css') && sw.includes('css/app.css'));
});
