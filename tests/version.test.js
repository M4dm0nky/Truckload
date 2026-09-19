import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';

test('Startversion 0.1', () => assert.equal(APP_VERSION, '0.1'));
test('package.json passt zur App-Version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.ok(pkg.version.startsWith(`${APP_VERSION}.`), pkg.version);
});
test('CHANGELOG nennt die aktuelle Version', () => {
  const log = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(log, new RegExp(`## V ${APP_VERSION.replace('.', '\\.')}\\b`));
});
