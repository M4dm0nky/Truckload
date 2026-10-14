import test from 'node:test';
import assert from 'node:assert/strict';
import { setOptions, parseSetValue } from '../js/ui/pack-rules.js';

test('setOptions: zwei Gruppen, Projekt zuerst, Werte mit Ort, Namen escaped', () => {
  const html = setOptions([{ id: 'p1', name: 'Tour <A>' }], [{ id: 'b1', name: 'Standard' }]);
  assert.ok(html.indexOf('label="Projekt"') < html.indexOf('label="Bibliothek"'));
  assert.ok(html.includes('value="projekt:p1"') && html.includes('value="bibliothek:b1"'));
  assert.ok(html.includes('Tour &lt;A&gt;'));
});

test('setOptions: leere Gruppe erscheint nicht', () => {
  const html = setOptions([], [{ id: 'b1', name: 'Standard' }]);
  assert.ok(!html.includes('label="Projekt"'));
});

test('parseSetValue: zerlegt Ort und ID, Unsinn → null', () => {
  assert.deepEqual(parseSetValue('projekt:p1'), { ort: 'projekt', id: 'p1' });
  assert.deepEqual(parseSetValue('bibliothek:a:b'), { ort: 'bibliothek', id: 'a:b' });
  assert.equal(parseSetValue('x:1'), null);
  assert.equal(parseSetValue(''), null);
});
