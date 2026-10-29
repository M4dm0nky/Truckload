import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APP_VERSION } from '../js/version.js';

const root = new URL('../', import.meta.url).pathname;
const read = f => readFileSync(join(root, f), 'utf8');

// Liste der Dateien, die der Service-Worker offline vorhält
function precacheList() {
  const m = read('sw.js').match(/const ASSETS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'sw.js muss const ASSETS = [...] enthalten');
  return JSON.parse(m[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
}

function filesIn(dir) {
  return readdirSync(join(root, dir)).flatMap(name => {
    const rel = `${dir}/${name}`;
    return statSync(join(root, rel)).isDirectory() ? filesIn(rel) : [rel];
  });
}

test('Manifest ist gültig und relativ', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Truckload');
  assert.equal(m.start_url, './');
  assert.equal(m.display, 'standalone');
  for (const icon of m.icons) assert.ok(existsSync(join(root, icon.src)), icon.src);
});

test('index.html bindet Manifest und Icons ein', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/icon-180\.png">/);
  assert.match(html, /<link rel="icon" href="icons\/icon\.svg"/);
});

test('Service-Worker hält alle App-Dateien offline vor', () => {
  const assets = precacheList();
  for (const a of assets) assert.ok(a === './' || existsSync(join(root, a)), `fehlt: ${a}`);
  const needed = ['index.html', 'manifest.webmanifest',
    ...filesIn('css'), ...filesIn('data'), ...filesIn('icons'), ...filesIn('js'), ...filesIn('vendor')];
  for (const f of needed) assert.ok(assets.includes(f), `nicht im Offline-Cache: ${f}`);
});

test('Cache-Name enthält die App-Version', () => {
  assert.match(read('sw.js'), new RegExp(`truckload-v${APP_VERSION.replaceAll('.', '\\.')}`));
});

test('index.html lädt jedes js/-Modul aus dem Offline-Cache per modulepreload vor', () => {
  const html = read('index.html');
  const preloaded = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]).sort();
  const expected = precacheList().filter(a => a.startsWith('js/')).sort();
  assert.deepEqual(preloaded, expected);
});

test('Service-Worker lädt beim Install am HTTP-Cache vorbei', () => {
  assert.match(read('sw.js'), /new Request\(u, \{ cache: 'reload' \}\)/);
});

test('index.html zeigt bei Ladefehlern eines Moduls einen Neu-laden-Hinweis', () => {
  const html = read('index.html');
  assert.match(html, /Die App konnte nicht vollständig geladen werden\. Bitte neu laden\./);
  assert.ok(html.indexOf('addEventListener(\'error\'') < html.indexOf('<script type="module" src="js/app.js">'));
});

test('importmap steht vor dem ersten modulepreload (Firefox verwirft ihn sonst)', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('type="importmap"') >= 0);
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('rel="modulepreload"'));
});

test('Fehler-Skript steht vor dem importmap', () => {
  const html = read('index.html');
  assert.ok(html.indexOf("addEventListener('error'") >= 0);
  assert.ok(html.indexOf("addEventListener('error'") < html.indexOf('type="importmap"'));
});

test('Ladefehler-Hinweis erkennt auch Link-Fehler über __tlBooted', () => {
  assert.match(read('js/app.js').trimEnd(), /window\.__tlBooted = true;$/);
  const html = read('index.html');
  assert.match(html, /e\.error instanceof SyntaxError && !window\.__tlBooted/);
});

// #32: Die Textauswahl des Ladefehler-Hinweises steht im ersten Inline-Skript von index.html.
function ladefehlerText() {
  const html = read('index.html');
  const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const win = { addEventListener() {} };
  new Function('window', 'document', src)(win, {});
  return win.tlLadefehlerText;
}

test('Ladefehler: zu alter Browser (SyntaxError der JSON-Modul-Syntax) bekommt den Browser-Hinweis ohne Neu laden', () => {
  const f = ladefehlerText();
  for (const msg of ["Unexpected identifier 'with'", "Unexpected token 'with'", 'unexpected token: identifier']) {
    const r = f(new SyntaxError(msg));
    assert.match(r.text, /Dieser Browser ist zu alt für Truckload\. Gebraucht werden Chrome oder Edge ab 123, Safari ab 17\.2 oder Firefox ab 138\./);
    assert.equal(r.neuLaden, false);
  }
});

test('Ladefehler: Versionsmix (fehlender Export) und andere Fehler behalten „Bitte neu laden“', () => {
  const f = ladefehlerText();
  const mix = f(new SyntaxError("The requested module './a.js' does not provide an export named 'x'"));
  assert.equal(mix.neuLaden, true);
  assert.match(mix.text, /Bitte neu laden/);
  // Firefox und Safari melden den fehlenden Export anders; auch das ist ein Versionsmix, kein alter Browser.
  for (const msg of ['import not found: x', "Importing binding name 'x' is not found.", "The requested module './a.js' doesn't provide an export named: 'x'"]) {
    assert.equal(f(new SyntaxError(msg)).neuLaden, true, msg);
  }
  assert.equal(f(null).neuLaden, true);
  assert.equal(f(new TypeError('x')).neuLaden, true);
});

// Stufe 2 (#42): sprachen.json listet die angebotenen Sprachen für NYX und liegt offline vor.
test('sprachen.json ist gültiges JSON mit de und en und steht im Offline-Cache', () => {
  assert.deepEqual(JSON.parse(read('sprachen.json')), ['de', 'en']);
  assert.ok(precacheList().includes('sprachen.json'), 'sprachen.json fehlt in der sw.js-Asset-Liste');
});
