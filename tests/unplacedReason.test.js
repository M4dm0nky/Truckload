import test from 'node:test';
import assert from 'node:assert/strict';
import { unplacedReason } from '../js/model/unplacedReason.js';
import { mkCase, mkTruck } from './fixtures.js';

const truck = mkTruck({ l: 200, w: 100, h: 90 });

test('zu groß in jeder erlaubten Orientierung', () => {
  const c = mkCase('big', 300, 80, 80, { tippable: true });
  assert.equal(unplacedReason({ id: 'u' }, c, truck), 'zu groß für den Laderaum');
});

test('getippt gesetzt, passt aber nur stehend', () => {
  const c = mkCase('hi', 120, 50, 80, { tippable: true });
  assert.equal(unplacedReason({ id: 'u', tipped: true }, c, mkTruck({ l: 200, w: 70, h: 90 })),
    'auf „getippt“ gesetzt, passt aber nur stehend');
});

test('nicht tippen gesetzt, passt aber nur getippt', () => {
  const c = mkCase('lg', 100, 50, 150, { tippable: true });
  const t = mkTruck({ l: 200, w: 100, h: 90 });
  assert.equal(unplacedReason({ id: 'u' }, c, t), null); // frei gewählt passt es (getippt)
  assert.equal(unplacedReason({ id: 'u', tipped: false }, c, t), 'auf „nicht tippen“ gesetzt, passt aber nur getippt');
});

test('tipped ohne Tippbarkeit ist kein eigener Grund', () => {
  const c = mkCase('nt', 300, 80, 80);
  assert.equal(unplacedReason({ id: 'u', tipped: true }, c, truck), 'zu groß für den Laderaum');
  assert.equal(unplacedReason({ id: 'u', tipped: false }, c, truck), 'zu groß für den Laderaum');
});

test('Passt das Stück, gibt es keinen Grund (null), egal welche Lagen oder welches Gewicht', () => {
  const c = mkCase('ok', 100, 50, 50, { weight: 99999 });
  assert.equal(unplacedReason({ id: 'u' }, c, truck), null);
  assert.equal(unplacedReason({ id: 'u', layers: [2] }, c, truck), null);
});

test('ohne Case oder Fahrzeug: null', () => {
  assert.equal(unplacedReason({ id: 'u' }, undefined, truck), null);
  assert.equal(unplacedReason({ id: 'u' }, mkCase('a', 1, 1, 1), null), null);
});
