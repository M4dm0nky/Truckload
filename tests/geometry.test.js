import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDims, boxOf, wheelFace, overlaps, footprintOverlapArea, gravityZ,
  snap, snapToEdges, stackAbove, faceSlab, DEFAULT_WHEEL_H, wheelHOf,
  DEFAULT_LAYERS, layersOf } from '../js/model/geometry.js';
import { mkCase } from './fixtures.js';

const C = mkCase('k', 120, 60, 80);
const B = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });

test('stehend 0°', () => assert.deepEqual(effectiveDims(C, { orientation: 'standing', rot: 0 }), { dx: 120, dy: 60, dz: 80 }));
test('stehend 90°', () => assert.deepEqual(effectiveDims(C, { orientation: 'standing', rot: 90 }), { dx: 60, dy: 120, dz: 80 }));
test('180° = 0°', () => assert.deepEqual(effectiveDims(C, { orientation: 'standing', rot: 180 }), { dx: 120, dy: 60, dz: 80 }));
test('getippt Längsseite: Höhe wird Tiefe', () => assert.deepEqual(effectiveDims(C, { orientation: 'tipLong', rot: 0 }), { dx: 120, dy: 80, dz: 60 }));
test('getippt Stirnseite: Länge wird Höhe', () => assert.deepEqual(effectiveDims(C, { orientation: 'tipShort', rot: 0 }), { dx: 80, dy: 60, dz: 120 }));
test('unbekannte Lage wirft', () => assert.throws(() => effectiveDims(C, { orientation: 'x', rot: 0 })));

test('boxOf', () => assert.deepEqual(boxOf(C, { x: 10, y: 20, z: 30, orientation: 'standing', rot: 0 }), B(10, 20, 30, 130, 80, 110)));

test('Rollenseite', () => {
  assert.equal(wheelFace({ orientation: 'standing', rot: 90 }), 'bottom');
  assert.equal(wheelFace({ orientation: 'tipLong', rot: 0 }), '+y');
  assert.equal(wheelFace({ orientation: 'tipLong', rot: 90 }), '-x');
  assert.equal(wheelFace({ orientation: 'tipShort', rot: 0 }), '+x');
  assert.equal(wheelFace({ orientation: 'tipShort', rot: 180 }), '-x');
});

test('berührende Boxen überlappen nicht', () => assert.equal(overlaps(B(0,0,0,10,10,10), B(10,0,0,20,10,10)), false));
test('überlappende Boxen', () => assert.equal(overlaps(B(0,0,0,10,10,10), B(5,5,5,20,20,20)), true));
test('Grundflächen-Überlappung', () => {
  assert.equal(footprintOverlapArea(B(0,0,0,10,10,10), B(5,0,50,15,10,60)), 50);
  assert.equal(footprintOverlapArea(B(0,0,0,10,10,10), B(10,0,0,20,10,10)), 0);
});
test('gravityZ = höchste Oberkante darunter', () => {
  assert.equal(gravityZ(B(0,0,0,10,10,0), []), 0);
  assert.equal(gravityZ(B(5,0,0,15,10,0), [B(0,0,0,10,10,60), B(0,0,60,10,10,90), B(50,0,0,60,10,200)]), 90);
});
test('snap', () => { assert.equal(snap(62), 60); assert.equal(snap(63), 65); assert.equal(snap(7, 1), 7); });
test('snapToEdges', () => {
  assert.equal(snapToEdges(115, 60, [120]), 120); // Anfang rastet
  assert.equal(snapToEdges(62, 60, [120]), 60);   // Ende rastet
  assert.equal(snapToEdges(200, 60, [120]), 200); // zu weit weg
});
test('stackAbove: nur was allein auf dem Stapel steht', () => {
  const items = [
    { id: 'A', box: B(0,0,0,100,60,60) },
    { id: 'Bx', box: B(0,0,60,100,60,120) },
    { id: 'C', box: B(0,0,120,100,60,180) },
    { id: 'D', box: B(100,0,0,200,60,60) },
    { id: 'E', box: B(50,0,60,150,60,100) }, // überbrückt A und D
  ];
  assert.deepEqual(stackAbove('A', items).sort(), ['A', 'Bx', 'C']);
});
test('faceSlab', () => {
  assert.deepEqual(faceSlab(B(0,0,0,100,60,50), '+x', 3), B(97,0,0,100,60,50));
  assert.deepEqual(faceSlab(B(0,0,0,100,60,50), 'bottom', 3), B(0,0,0,100,60,3));
  assert.deepEqual(faceSlab(B(0,0,0,100,60,50), '-y', 3), B(0,0,0,100,3,50));
});

test('wheelHOf: Fallback DEFAULT_WHEEL_H wenn fehlend, sonst der Wert', () => {
  assert.equal(wheelHOf({}), DEFAULT_WHEEL_H);
  assert.equal(wheelHOf({ wheelH: 0 }), 0);
  assert.equal(wheelHOf({ wheelH: 8 }), 8);
});

test('layersOf: Fallback DEFAULT_LAYERS wenn fehlend, sonst der Wert', () => {
  assert.deepEqual(layersOf({}), DEFAULT_LAYERS);
  assert.deepEqual(layersOf({ layers: [1] }), [1]);
  assert.deepEqual(layersOf({ layers: [] }), DEFAULT_LAYERS);
});
