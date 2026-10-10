import test from 'node:test';
import assert from 'node:assert/strict';
import { stamp } from '../js/model/stamp.js';

test('stamp: setzt updatedAt (ISO) und lässt das Original unverändert', () => {
  const o = { id: 'a', name: 'X', updatedAt: '2020-01-01T00:00:00.000Z' };
  const s = stamp(o, new Date('2026-10-09T12:00:00Z'));
  assert.equal(s.updatedAt, '2026-10-09T12:00:00.000Z');
  assert.equal(o.updatedAt, '2020-01-01T00:00:00.000Z');
  assert.equal(s.id, 'a');
  assert.notEqual(s, o);
});

test('stamp: ohne now nimmt es die aktuelle Zeit', () => {
  const before = Date.now();
  const t = Date.parse(stamp({ id: 'a' }).updatedAt);
  assert.ok(t >= before && t <= Date.now());
});
