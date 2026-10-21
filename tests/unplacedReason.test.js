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

test('Passt das Stück, gibt es keinen Grund (null), solange Gewicht und Lagen unauffällig sind', () => {
  const c = mkCase('ok', 100, 50, 50, { weight: 99 });
  assert.equal(unplacedReason({ id: 'u' }, c, truck), null);
  assert.equal(unplacedReason({ id: 'u', layers: [1, 2] }, c, truck), null);
  assert.equal(unplacedReason({ id: 'u', tipped: false }, c, truck), null);
});

// #31: Nutzlast und Lagen
const mitNutzlast = mkTruck({ l: 200, w: 100, h: 90, payload: 100 });

test('Gewicht des Stücks über der Nutzlast: Grund mit beiden Zahlen, auch wenn es sonst passt', () => {
  const c = mkCase('schwer', 100, 50, 50, { weight: 1500 });
  assert.equal(unplacedReason({ id: 'u' }, c, mitNutzlast), 'zu schwer für die Nutzlast des Fahrzeugs (1.500 kg, erlaubt 100 kg)');
});

test('Gewicht genau an der Nutzlast, 0 kg (unbekannt) und fehlende Nutzlast: kein Grund', () => {
  assert.equal(unplacedReason({ id: 'u' }, mkCase('a', 100, 50, 50, { weight: 100 }), mitNutzlast), null);
  assert.equal(unplacedReason({ id: 'u' }, mkCase('b', 100, 50, 50, { weight: 0 }), mitNutzlast), null);
  assert.equal(unplacedReason({ id: 'u' }, mkCase('c', 100, 50, 50, { weight: 5000 }), mkTruck({ l: 200, w: 100, h: 90, payload: 0 })), null);
});

test('zu groß und zu schwer: beide Gründe, durch „; “ getrennt', () => {
  const c = mkCase('beides', 300, 80, 80, { weight: 500 });
  assert.equal(unplacedReason({ id: 'u' }, c, mitNutzlast),
    'zu groß für den Laderaum; zu schwer für die Nutzlast des Fahrzeugs (500 kg, erlaubt 100 kg)');
});

test('Lagen ohne Lage 1 (am Stück oder am Case-Typ): darf nur auf anderen Stücken stehen', () => {
  const c = mkCase('lg', 100, 50, 50);
  assert.equal(unplacedReason({ id: 'u', layers: [2, 3] }, c, truck), 'erlaubte Lagen 2, 3: darf nur auf anderen Stücken stehen');
  assert.equal(unplacedReason({ id: 'u' }, mkCase('lg2', 100, 50, 50, { layers: [3] }), truck), 'erlaubte Lagen 3: darf nur auf anderen Stücken stehen');
});

test('Lagen mit Lage 1 und leere Schnittmenge (Rückfall auf die Lagen des Case-Typs): kein Lagen-Grund', () => {
  const c = mkCase('lg3', 100, 50, 50, { layers: [1, 2] });
  assert.equal(unplacedReason({ id: 'u', layers: [1] }, c, truck), null);
  assert.equal(unplacedReason({ id: 'u', layers: [4] }, c, truck), null, 'Schnittmenge leer → gilt layersOf(c), also mit Lage 1');
});

test('ohne Case oder Fahrzeug: null', () => {
  assert.equal(unplacedReason({ id: 'u' }, undefined, truck), null);
  assert.equal(unplacedReason({ id: 'u' }, mkCase('a', 1, 1, 1), null), null);
});
