// Sperre (#50): Zeichen, die durch Lucide-Symbole ersetzt wurden, und Phosphor-icon() kommen nicht zurück.
// ★ ◇ (in <option>-Texten), ein vorangestelltes "+ " im Knopftext und +N/−N als Text bleiben erlaubt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { symbol } from '../js/ui/dom.js';

const ROOT = new URL('..', import.meta.url).pathname;
function jsDateien(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsDateien(p) : p.endsWith('.js') ? [p] : [];
  });
}
const quellen = [...jsDateien(join(ROOT, 'js')), join(ROOT, 'index.html')].map(p => ({
  name: p.slice(ROOT.length),
  text: readFileSync(p, 'utf8').split('\n').map((z, i) => ({ z, nr: i + 1 })).filter(({ z }) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(z)),
}));
const treffer = re => quellen.flatMap(q => q.text.filter(({ z }) => re.test(z)).map(({ nr }) => `${q.name}:${nr}`));

test('keines der ersetzten Zeichen ⚠ ✖ ↶ ↷ ⬛ steht noch im Code', () => {
  assert.deepEqual(treffer(/[⚠✖↶↷⬛]/), []);
});

test('kein Knopf trägt nur × − oder + als Inhalt', () => {
  assert.deepEqual(treffer(/<button\b(?:[^>]|\$\{[^}]*\})*>\s*[×−+]\s*<\/button>/), []);
});

test('icon( (Phosphor) kommt in js/ nicht mehr vor', () => {
  assert.deepEqual(treffer(/(^|[^\w.])icon\(/), []);
});

test('jeder Knopf, der nur ein Symbol trägt, hat aria-label', () => {
  const schlecht = treffer(/<button\b(?!(?:[^>]|\$\{[^}]*\})*aria-label)(?:[^>]|\$\{[^}]*\})*>\s*(\$\{symbol\('[^']+'\)\}|<svg class="symbol"[\s\S]*?<\/svg>)\s*<\/button>/);
  assert.deepEqual(schlecht, []);
});

test('index.html: eingetragene Symbole sind byte-gleich zu symbol(name)', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const bestimmt = {
    'banner-close': 'x', undo: 'undo-2', redo: 'redo-2',
  };
  for (const [id, name] of Object.entries(bestimmt)) {
    const m = html.match(new RegExp(`<button[^>]*(?:id|class)="[^"]*${id}[^"]*"[^>]*>(<svg[\\s\\S]*?</svg>)</button>`));
    assert.ok(m, id);
    assert.equal(m[1], symbol(name), id);
  }
  for (const [z, name] of [['out', 'minus'], ['in', 'plus']]) {
    const alle = [...html.matchAll(new RegExp(`data-z="${z}"[^>]*>(<svg[\\s\\S]*?</svg>)</button>`, 'g'))];
    assert.equal(alle.length, 3, z);
    for (const m of alle) assert.equal(m[1], symbol(name), z);
  }
});
