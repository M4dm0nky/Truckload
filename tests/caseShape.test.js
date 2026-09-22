import test from 'node:test';
import assert from 'node:assert/strict';
import { caseShape, wheelAxes } from '../js/model/caseShape.js';
import { boxOf, overlaps } from '../js/model/geometry.js';
import { mkCase } from './fixtures.js';

const C = mkCase('k', 120, 60, 80, { wheelH: 12 });

function pairwiseNoOverlap(wheels) {
  for (let i = 0; i < wheels.length; i++)
    for (let j = i + 1; j < wheels.length; j++)
      assert.equal(overlaps(wheels[i], wheels[j]), false, `Rollen ${i} und ${j} überlappen`);
}

test('stehend: Korpus beginnt über den Rollen, 4 Rollen unten', () => {
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(C, p);
  const { body, wheels, face } = caseShape(C, p, box);
  assert.equal(face, 'bottom');
  assert.equal(body.z0, 12);
  assert.equal(wheels.length, 4);
  for (const w of wheels) {
    assert.equal(w.z0, 0);
    assert.equal(w.z1, 12);
    assert.ok(w.x0 >= box.x0 && w.x1 <= box.x1);
    assert.ok(w.y0 >= box.y0 && w.y1 <= box.y1);
  }
  pairwiseNoOverlap(wheels);
});

test('tipLong rot 0: Rollen an +y, Korpus rückt von der Rollenseite weg', () => {
  const p = { x: 0, y: 0, z: 0, orientation: 'tipLong', rot: 0 };
  const box = boxOf(C, p);
  const { body, wheels, face } = caseShape(C, p, box);
  assert.equal(face, '+y');
  assert.equal(body.y1, box.y1 - 12);
  assert.equal(wheels.length, 4);
  for (const w of wheels) assert.equal(w.y0, box.y1 - 12);
  pairwiseNoOverlap(wheels);
});

test('wheelAxes: Fläche → [a1, a2, n]', () => {
  assert.deepEqual(wheelAxes('bottom'), ['x', 'y', 'z']);
  assert.deepEqual(wheelAxes('+x'), ['y', 'z', 'x']);
  assert.deepEqual(wheelAxes('-y'), ['x', 'z', 'y']);
});

test('wheelH 0: Korpus = Box, keine Rollen', () => {
  const noWheels = mkCase('n', 120, 60, 80, { wheelH: 0 });
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(noWheels, p);
  const { body, wheels, face } = caseShape(noWheels, p, box);
  assert.deepEqual(body, box);
  assert.deepEqual(wheels, []);
  assert.equal(face, null);
});

// Reale Bibliotheks-Cases, an denen die Rollen ohne Begrenzung ineinanderlaufen
// (docs/code-review-2026-09-21.md, "Rollen überlappen bei schmalen Cases").
test('AF-1 -CAB (44×23, wheelH 12): Rollen überlappen nicht mehr', () => {
  const c = mkCase('af1', 44, 23, 58, { wheelH: 12 });
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const { wheels } = caseShape(c, p, box);
  pairwiseNoOverlap(wheels);
});

test('SF TourHazer II -CAB (53×25, wheelH 12): Rollen überlappen nicht mehr', () => {
  const c = mkCase('tourhazer', 53, 25, 41, { wheelH: 12 });
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const { wheels } = caseShape(c, p, box);
  pairwiseNoOverlap(wheels);
});

// Härtefall aus der Review: noch schmaler als die beiden Bibliotheks-Cases – hier
// müssen die Rollen zusätzlich innerhalb der Box bleiben (nicht nur nicht überlappen).
test('sehr schmales Case (20×40, wheelH 12): Rollen bleiben innerhalb der Box und überlappen nicht', () => {
  const c = mkCase('schmal', 20, 40, 40, { wheelH: 12 });
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const { wheels } = caseShape(c, p, box);
  pairwiseNoOverlap(wheels);
  for (const w of wheels) {
    assert.ok(w.x0 >= box.x0 && w.x1 <= box.x1, 'Rolle bleibt innerhalb x');
    assert.ok(w.y0 >= box.y0 && w.y1 <= box.y1, 'Rolle bleibt innerhalb y');
  }
});
