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
