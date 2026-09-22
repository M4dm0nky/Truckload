import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDims, boxOf, wheelFace, overlaps, footprintOverlapArea, gravityZ,
  snap, snapToEdges, stackAbove, faceSlab, DEFAULT_WHEEL_H, wheelHOf,
  DEFAULT_LAYERS, layersOf, NEW_CASE_WHEEL_H, WHEEL_PRESETS, hasWheels, outerDims,
  ORIENTATIONS, WHEEL_FACES, DOOR_FACE, rotForWheelFace } from '../js/model/geometry.js';
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

test('wheelFace: rot außerhalb 0/90/180/270 liefert trotzdem eine gültige Seite statt undefined (negatives rot aus IndexedDB-Daten)', () => {
  // -90 ist rechnerisch dasselbe wie 270 (eine volle Umdrehung zurück).
  assert.equal(wheelFace({ orientation: 'tipShort', rot: -90 }), wheelFace({ orientation: 'tipShort', rot: 270 }));
  assert.notEqual(wheelFace({ orientation: 'tipShort', rot: -90 }), undefined);
});

test('WHEEL_FACES/DOOR_FACE: +x ist die Trucktür', () => {
  assert.deepEqual(WHEEL_FACES, ['+x', '+y', '-x', '-y']);
  assert.equal(DOOR_FACE, '+x');
});

test('rotForWheelFace ist die exakte Umkehrung von wheelFace für alle Ausrichtungen × rot-Werte', () => {
  for (const orientation of ORIENTATIONS) {
    for (const rot of [0, 90, 180, 270]) {
      const face = wheelFace({ orientation, rot });
      if (face === 'bottom') continue; // standing: keine Rollenseite ansteuerbar
      assert.equal(rotForWheelFace(orientation, face), rot,
        `rotForWheelFace(${orientation}, ${face}) sollte ${rot} ergeben`);
    }
  }
});

test('rotForWheelFace: „standing“ liefert für jede Richtung null (Rollen zeigen nach unten)', () => {
  for (const face of WHEEL_FACES) assert.equal(rotForWheelFace('standing', face), null);
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

test('boxOf einer Traverse ignoriert p.orientation: immer wie stehend', () => {
  const truss = { kind: 'truss', l: 300, w: 60, h: 80 };
  const standing = boxOf(truss, { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 });
  const tipped = boxOf(truss, { x: 0, y: 0, z: 0, orientation: 'tipLong', rot: 0 });
  assert.deepEqual(tipped, standing);
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

test('NEW_CASE_WHEEL_H und WHEEL_PRESETS sind definiert', () => {
  assert.equal(NEW_CASE_WHEEL_H, 16);
  assert.deepEqual(WHEEL_PRESETS, [
    { name: 'Blue Wheel Ø 125 mm', h: 16 },
    { name: 'Blue Wheel Ø 100 mm', h: 13 },
  ]);
});

test('hasWheels: false bei wheels:false oder wheelH<=0, sonst true', () => {
  assert.equal(hasWheels({}), true);
  assert.equal(hasWheels({ wheels: false }), false);
  assert.equal(hasWheels({ wheelH: 0 }), false);
  assert.equal(hasWheels({ wheels: true, wheelH: 8 }), true);
});

test('outerDims: Maß inkl. Rollen nur wenn dimsInclWheels === false', () => {
  const c = mkCase('c', 200, 80, 200, { wheels: true, wheelH: 16, dimsInclWheels: false });
  assert.deepEqual(outerDims(c), { l: 200, w: 80, h: 216 });
});

test('outerDims: dimsInclWheels true lässt Maß unverändert', () => {
  const c = mkCase('c', 200, 80, 200, { wheels: true, wheelH: 16, dimsInclWheels: true });
  assert.deepEqual(outerDims(c), { l: 200, w: 80, h: 200 });
});

test('outerDims: wheels:false ergibt unverändertes Maß und wheelHOf 0', () => {
  const c = mkCase('c', 200, 80, 200, { wheels: false, wheelH: 16, dimsInclWheels: false });
  assert.deepEqual(outerDims(c), { l: 200, w: 80, h: 200 });
  assert.equal(wheelHOf(c), 0);
});

test('outerDims: Altdaten ohne neue Felder verhalten sich wie bisher (Regression)', () => {
  const c = mkCase('c', 200, 80, 200);
  assert.deepEqual(outerDims(c), { l: 200, w: 80, h: 200 });
});

test('localDims benutzt outerDims (Rollenhöhe fließt in Gesamtmaß ein)', () => {
  const c = mkCase('c', 200, 80, 200, { wheels: true, wheelH: 16, dimsInclWheels: false });
  assert.deepEqual(effectiveDims(c, { orientation: 'standing', rot: 0 }), { dx: 200, dy: 80, dz: 216 });
});

test('Traversenwagen: outerDims ändert die Maße nicht (wheelH ist 0, l/w/h fix)', () => {
  const truss = { kind: 'truss', l: 300, w: 60, h: 80, wheelH: 0 };
  assert.deepEqual(outerDims(truss), { l: 300, w: 60, h: 80 });
  assert.deepEqual(effectiveDims(truss, { orientation: 'standing', rot: 0 }), { dx: 300, dy: 60, dz: 80 });
  // dimsInclWheels === false darf trotzdem nichts ändern, da wheelHOf 0 ist (kein wheels-Flag gesetzt).
  const trussExplicit = { ...truss, dimsInclWheels: false };
  assert.deepEqual(outerDims(trussExplicit), { l: 300, w: 60, h: 80 });
});
