import test from 'node:test';
import assert from 'node:assert/strict';
import { mkCase } from './fixtures.js';
test('fixtures laden', () => assert.equal(mkCase('a', 1, 2, 3).h, 3));
