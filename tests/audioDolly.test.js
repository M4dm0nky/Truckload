import test from 'node:test';
import assert from 'node:assert/strict';
import { dollyStackCase, DOLLY_WEIGHT_KG, DOLLY_HEIGHT_CM } from '../js/model/audioDolly.js';
import { checkCase } from '../js/store/io.js';
import { outerDims } from '../js/model/geometry.js';
import { mkCase } from './fixtures.js';

test('dollyStackCase: Konstanten aus der Recherche (Carvin/SYNQ/DAS, docs/casemasse-gewichte.md)', () => {
  assert.equal(DOLLY_HEIGHT_CM, 18);
  assert.equal(DOLLY_WEIGHT_KG, 15);
});

test('dollyStackCase: Fußabdruck bleibt die Basisbox, Höhe/Gewicht nach Formel', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 3);
  assert.equal(c.l, 78);
  assert.equal(c.w, 68);
  assert.equal(c.h, 3 * 51);
  assert.equal(c.weight, 15 + 3 * 56);
});

test('dollyStackCase: Dolly-Höhe steckt in wheelH, nicht in h (outerDims addiert sie)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 2);
  assert.equal(c.wheelH, 18);
  assert.equal(c.dimsInclWheels, false);
  assert.equal(outerDims(c).h, 2 * 51 + 18);
});

test('dollyStackCase: id/name tragen Basis-ID und Stückzahl, ohne company-Feld', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 4);
  assert.equal(c.id, 'preset-ls18-dolly-4');
  assert.equal(c.name, 'Nexo LS18 4er (auf Dolly)');
  assert.equal(c.company, undefined);
  assert.equal(c.category, 'Ton');
});

test('dollyStackCase: nie tippbar, Stack ist der volle Turm (nur Lage 1)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 1);
  assert.equal(c.tippable, false);
  assert.deepEqual(c.layers, [1]);
  assert.ok(c.stackable);
});

test('dollyStackCase: Gegenprobe L-Acoustics K2, Stückzahl 4 (reale Boxmaße)', () => {
  const k2 = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const c = dollyStackCase(k2, 4);
  assert.equal(c.l, 138);
  assert.equal(c.w, 40);
  assert.equal(c.h, 4 * 35);
  assert.equal(c.weight, 15 + 4 * 56);
});

test('dollyStackCase: Ergebnis besteht checkCase() auch bei großer Stückzahl (10 schwere Subs)', () => {
  const sub = mkCase('preset-sub-8006-as', 111, 71, 70, { weight: 96, name: 'RCF SUB 8006-AS', category: 'Ton' });
  const c = dollyStackCase(sub, 10);
  assert.doesNotThrow(() => checkCase(c));
});

test('dollyStackCase: Stückzahl 1 ist gültig (ein Dolly, eine Box)', () => {
  const base = mkCase('preset-geom6b', 37, 26, 19, { weight: 8, name: 'Nexo GEO M6B', category: 'Ton' });
  const c = dollyStackCase(base, 1);
  assert.equal(c.h, 19);
  assert.equal(c.weight, 23);
  assert.doesNotThrow(() => checkCase(c));
});
