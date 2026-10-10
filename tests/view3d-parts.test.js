import test from 'node:test';
import assert from 'node:assert/strict';
import {
  edgeBars, latchBoxes, speakerUnits, speakerDollyFrame, speakerUnitParts, faceZigzag, trussPoint,
} from '../js/ui/view3d-parts.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);
const nearBox = (box, exp) => { for (const k of Object.keys(exp)) near(box[k], exp[k], k); };

test('speakerUnits: teilt den Korpus in gleich hohe Einzelboxen', () => {
  assert.deepEqual(speakerUnits({ z0: 10, z1: 130 }, 40), [{ z0: 10, z1: 50 }, { z0: 50, z1: 90 }, { z0: 90, z1: 130 }]);
  // 120 / 50 = 2,4 → gerundet 2 Boxen à 60
  assert.deepEqual(speakerUnits({ z0: 0, z1: 120 }, 50), [{ z0: 0, z1: 60 }, { z0: 60, z1: 120 }]);
});

test('speakerUnits: ohne unitH eine Einheit über die volle Höhe, nie null Einheiten', () => {
  assert.deepEqual(speakerUnits({ z0: 5, z1: 65 }, undefined), [{ z0: 5, z1: 65 }]);
  assert.deepEqual(speakerUnits({ z0: 5, z1: 65 }, 0), [{ z0: 5, z1: 65 }]);
  assert.equal(speakerUnits({ z0: 0, z1: 10 }, 100).length, 1); // 0,1 würde 0 ergeben
});

test('speakerDollyFrame: vier Rohre à 2,2 cm unter dem Korpus, 1 cm Luft', () => {
  const [a, b, c, d] = speakerDollyFrame({ x0: 0, x1: 100, y0: 0, y1: 60, z0: 0 }, 20);
  nearBox(a, { x0: 0, x1: 100, y0: 0, y1: 2.2, z0: 16.8, z1: 19 });
  nearBox(b, { x0: 0, x1: 100, y0: 57.8, y1: 60, z0: 16.8, z1: 19 });
  nearBox(c, { x0: 0, x1: 2.2, y0: 0, y1: 60, z0: 16.8, z1: 19 });
  nearBox(d, { x0: 97.8, x1: 100, y0: 0, y1: 60, z0: 16.8, z1: 19 });
});

test('speakerDollyFrame: sehr flacher Dolly bleibt über dem Boden', () => {
  const [a] = speakerDollyFrame({ x0: 0, x1: 10, y0: 0, y1: 10, z0: 5 }, 5);
  // z1 = max(5,1; 4) = 5,1; z0 = max(5; 2,9) = 5
  nearBox(a, { z0: 5, z1: 5.1 });
});

test('speakerUnitParts: breite Box (120×80×40) mit Steg, zwei Badges, je Seite Platte und Griff', () => {
  const parts = speakerUnitParts(120, 80, 40);
  assert.deepEqual(parts.map(p => p.matKey), ['grille', 'mullion', 'badge', 'badge', 'rig', 'mullion', 'rig', 'mullion']);
  // mX = min(4; 7,2) = 4, mZ = min(3; 4,8) = 3, Front bei y = −40
  nearBox(parts[0].b, { x0: -56, x1: 56, y0: -40.3, y1: -39.7, z0: -17, z1: 17 });
  // Steg: mw = min(8; 7,2) = 7,2
  nearBox(parts[1].b, { x0: -3.6, x1: 3.6, y0: -40.6, y1: -39.8, z0: -17, z1: 17 });
  // Badge links: bw = 3, bh = min(1,6; 2,1) = 1,6, Mitte z = −20 + 1,5
  nearBox(parts[2].b, { x0: -31.5, x1: -28.5, y0: -40.5, y1: -39.9, z0: -19.3, z1: -17.7 });
  nearBox(parts[3].b, { x0: 28.5, x1: 31.5 });
  // Seite −x (sx = −1 kommt zuerst): Rigging-Platte bei x = −60
  nearBox(parts[4].b, { x0: -60.2, x1: -58.8, y0: -40, y1: 4, z0: -16.8, z1: 16.8 });
  // Griff der Seite +x (letztes Teil): hz = min(1,2; 2,4) = 1,2
  nearBox(parts[7].b, { x0: 60.2, x1: 61.1, y0: -4, y1: 24, z0: -1.2, z1: 1.2 });
});

test('speakerUnitParts: schmale Box (60) hat keinen Steg und nur ein Badge', () => {
  const parts = speakerUnitParts(60, 40, 30);
  assert.deepEqual(parts.map(p => p.matKey), ['grille', 'badge', 'rig', 'mullion', 'rig', 'mullion']);
  // mX = min(4; 3,6) = 3,6; mZ = min(3; 3,6) = 3
  nearBox(parts[0].b, { x0: -26.4, x1: 26.4, z0: -12, z1: 12 });
  // bw = min(3; 2,4) = 2,4 → Badge mittig
  nearBox(parts[1].b, { x0: -1.2, x1: 1.2 });
});

test('edgeBars: zwölf Profilstäbe, 3 cm stark, 0,3 cm über die Flächen hinaus', () => {
  const out = [];
  edgeBars({ x0: 0, x1: 10, y0: 0, y1: 20, z0: 0, z1: 30 }, out);
  assert.equal(out.length, 12);
  // erster Stab: Längskante in x bei y0/z0
  nearBox(out[0], { x0: -0.3, x1: 10.3, y0: -1.5, y1: 1.5, z0: -1.5, z1: 1.5 });
  // fünfter: Kante in y bei x0/z0
  nearBox(out[4], { x0: -1.5, x1: 1.5, y0: -0.3, y1: 20.3, z0: -1.5, z1: 1.5 });
  // letzter: Kante in z bei x1/y1
  nearBox(out[11], { x0: 8.5, x1: 11.5, y0: 18.5, y1: 21.5, z0: -0.3, z1: 30.3 });
});

test('latchBoxes: zwei Verschlüsse je Längsseite bei 25 % und 75 %, einer je Stirnseite', () => {
  const out = [];
  latchBoxes({ x0: 0, x1: 100, y0: 0, y1: 60, z0: 0, z1: 50 }, 12, out);
  assert.equal(out.length, 6);
  nearBox(out[0], { x0: 23, x1: 27, y0: -0.9, y1: 0.3, z0: 10.5, z1: 13.5 });
  nearBox(out[1], { x0: 23, x1: 27, y0: 59.7, y1: 60.9 });
  nearBox(out[2], { x0: 73, x1: 77 });
  nearBox(out[4], { x0: -0.9, x1: 0.3, y0: 28, y1: 32, z0: 10.5, z1: 13.5 });
  nearBox(out[5], { x0: 99.7, x1: 100.9, y0: 28, y1: 32 });
});

test('trussPoint: Längs- und Breitenwert landen auf den gewählten Achsen', () => {
  assert.deepEqual(trussPoint('x', 'y', 5, 7, 9), { x: 5, y: 7, z: 9 });
  assert.deepEqual(trussPoint('y', 'x', 5, 7, 9), { x: 7, y: 5, z: 9 });
});

test('faceZigzag: Diagonalen wechseln die Richtung je Feld', () => {
  const out = [];
  // Länge 60, Profilbreite 29 → round(2,07) = 2 Felder à 30
  faceZigzag('x', 'y', 0, 60, { w: 0, z: 0 }, { w: 0, z: 29 }, 29, 1.5, out);
  assert.deepEqual(out, [
    { p1: { x: 0, y: 0, z: 0 }, p2: { x: 30, y: 0, z: 29 }, r: 1.5 },
    { p1: { x: 30, y: 0, z: 29 }, p2: { x: 60, y: 0, z: 0 }, r: 1.5 },
  ]);
});

test('faceZigzag: mindestens ein Feld, Profilbreite unter 1 wird wie 1 behandelt', () => {
  const out = [];
  faceZigzag('x', 'y', 0, 0.2, { w: 0, z: 0 }, { w: 4, z: 0 }, 29, 1, out);
  assert.equal(out.length, 1);
  const out2 = [];
  faceZigzag('x', 'y', 0, 3, { w: 0, z: 0 }, { w: 4, z: 0 }, 0.5, 1, out2);
  assert.equal(out2.length, 3); // 3 / max(0,5; 1) = 3
});
