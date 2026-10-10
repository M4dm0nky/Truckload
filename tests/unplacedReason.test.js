import test from 'node:test';
import assert from 'node:assert/strict';
import { unplacedReason, REASON_FALLBACK } from '../js/model/unplacedReason.js';
import { mkCase, mkTruck, plan } from './fixtures.js';

const truck = mkTruck({ l: 200, w: 100, h: 90 });

test('zu groß in jeder erlaubten Orientierung', () => {
  const c = mkCase('big', 300, 80, 80, { tippable: true });
  assert.equal(unplacedReason({ id: 'u' }, c, truck, plan([])), 'zu groß für den Laderaum');
});

test('getippt gesetzt, passt aber nur stehend', () => {
  // stehend 120×50×80 passt in 200×100×90; getippt wäre ein Maß ≥ 100 hoch bzw. breit
  const c = mkCase('hi', 120, 50, 80, { tippable: true });
  assert.ok(unplacedReason({ id: 'u' }, c, truck, plan([])) === REASON_FALLBACK);
  assert.equal(unplacedReason({ id: 'u', tipped: true }, c, mkTruck({ l: 200, w: 70, h: 90 }), plan([])),
    'auf „getippt“ gesetzt, passt aber nur stehend');
});

test('tipped:true ohne Tippbarkeit ist kein eigener Grund', () => {
  const c = mkCase('nt', 300, 80, 80);
  assert.equal(unplacedReason({ id: 'u', tipped: true }, c, truck, plan([])), 'zu groß für den Laderaum');
});

test('Auffangfall: passt, aber kein Platz mehr', () => {
  const c = mkCase('ok', 100, 50, 50);
  assert.equal(unplacedReason({ id: 'u' }, c, truck, plan([])), 'kein Platz mehr im Laderaum');
});

test('Lagen-Einschränkung und Gewicht ändern den Grund nicht (nicht billig entscheidbar bzw. dem Packer unbekannt)', () => {
  const c = mkCase('hv', 100, 50, 50, { weight: 99999 });
  assert.equal(unplacedReason({ id: 'u', layers: [2] }, c, truck, plan([])), REASON_FALLBACK);
});

test('ohne Case oder Fahrzeug: null', () => {
  assert.equal(unplacedReason({ id: 'u' }, undefined, truck, plan([])), null);
  assert.equal(unplacedReason({ id: 'u' }, mkCase('a', 1, 1, 1), null, plan([])), null);
});
