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
    ...filesIn('css'), ...filesIn('icons'), ...filesIn('js'), ...filesIn('vendor')];
  for (const f of needed) assert.ok(assets.includes(f), `nicht im Offline-Cache: ${f}`);
});

test('Cache-Name enthält die App-Version', () => {
  assert.match(read('sw.js'), new RegExp(`truckload-v${APP_VERSION.replace('.', '\\.')}`));
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
