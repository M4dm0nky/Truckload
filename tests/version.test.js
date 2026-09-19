import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';

// Eine Versionsnummer überall: App, package.json, CHANGELOG, README, index.html, Offline-Cache.
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const esc = v => v.replaceAll('.', '\\.');

test('Version hat das Format Major.Minor.Patch', () => assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/));
test('package.json hat exakt dieselbe Version', () => {
  assert.equal(JSON.parse(read('package.json')).version, APP_VERSION);
});
test('CHANGELOG beginnt mit der aktuellen Version', () => {
  const first = read('CHANGELOG.md').match(/^## V (\S+)/m);
  assert.equal(first?.[1], APP_VERSION);
});
test('README nennt die aktuelle Version', () => {
  assert.match(read('README.md'), new RegExp(`Version: \\*\\*V ${esc(APP_VERSION)}\\*\\*`));
});
test('index.html zeigt die aktuelle Version schon vor dem Laden des Skripts', () => {
  assert.match(read('index.html'), new RegExp(`class="version">V ${esc(APP_VERSION)}<`));
});
test('Offline-Cache heißt nach der aktuellen Version', () => {
  assert.match(read('sw.js'), new RegExp(`const CACHE = 'truckload-v${esc(APP_VERSION)}';`));
});
