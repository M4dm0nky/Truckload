import test from 'node:test';
import assert from 'node:assert/strict';
import { labelPlanes, fitFontSize, estimateTextWidth } from '../js/ui/labelTexture.js';

const BOX = { x0: 0, x1: 100, y0: 0, y1: 50, z0: 16, z1: 120 }; // stehendes Case, Rollen schon aus z0 herausgeschnitten

test('labelPlanes: stehendes Case (face "bottom") liefert 5 Flächen, Boden (z0) fehlt', () => {
  const planes = labelPlanes(BOX, 'bottom');
  assert.equal(planes.length, 5);
  assert.deepEqual(planes.map(p => p.face).sort(), ['x0', 'x1', 'y0', 'y1', 'z1']);
});

test('labelPlanes: keine Fläche schneidet den Korpus (0,5 cm Abstand nach außen, korrekte Achse)', () => {
  for (const plane of labelPlanes(BOX, 'bottom')) {
    const axis = plane.face[0];
    const side = plane.face[1];
    const expected = BOX[`${axis}${side}`] + (side === '1' ? 0.5 : -0.5);
    assert.ok(Math.abs(plane.center[axis] - expected) < 1e-9, `${plane.face}: ${plane.center[axis]} !== ${expected}`);
    // die beiden anderen Achsen liegen in der Korpus-Mitte (innerhalb der Box-Ausdehnung)
    for (const other of ['x', 'y', 'z']) {
      if (other === axis) continue;
      assert.ok(plane.center[other] >= BOX[`${other}0`] && plane.center[other] <= BOX[`${other}1`]);
    }
  }
});

test('labelPlanes: Seitenflächen (x/y-Normale) haben Welt-z als "oben" – Text bleibt waagerecht', () => {
  for (const plane of labelPlanes(BOX, 'bottom')) {
    if (plane.face === 'z1') continue;
    assert.deepEqual(plane.up, { x: 0, y: 0, z: 1 });
    assert.equal(plane.height, BOX.z1 - BOX.z0);
  }
});

test('labelPlanes: Deckel (z1) hat Welt-x als "oben"', () => {
  const lid = labelPlanes(BOX, 'bottom').find(p => p.face === 'z1');
  assert.deepEqual(lid.up, { x: 1, y: 0, z: 0 });
  assert.equal(lid.width, BOX.y1 - BOX.y0);
  assert.equal(lid.height, BOX.x1 - BOX.x0);
});

test('labelPlanes: getipptes Case (face "+x") spart die Rollenseite (x1) statt des Bodens aus', () => {
  const planes = labelPlanes(BOX, '+x');
  assert.deepEqual(planes.map(p => p.face).sort(), ['x0', 'y0', 'y1', 'z0', 'z1']);
});

test('labelPlanes: ohne Rollenangabe (Traversenwagen-Enden, kein "face") wird der Boden ausgespart', () => {
  const planes = labelPlanes(BOX, undefined);
  assert.deepEqual(planes.map(p => p.face).sort(), ['x0', 'x1', 'y0', 'y1', 'z1']);
});

test('fitFontSize: kurzer Text passt einzeilig, möglichst groß', () => {
  const { fontSize, lines } = fitFontSize('Case 1', 30, 10);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'Case 1');
  assert.ok(fontSize > 0.8 && fontSize <= 10);
  assert.ok(estimateTextWidth(lines[0], fontSize) <= 30);
});

test('fitFontSize: langer Text wird umgebrochen und bleibt innerhalb der Fläche', () => {
  const text = 'Kabelcase Strom Verteilung Bühne links';
  const w = 20, h = 8;
  const { fontSize, lines } = fitFontSize(text, w, h);
  assert.ok(lines.length > 1, 'sollte über mehrere Zeilen umbrechen');
  for (const l of lines) assert.ok(estimateTextWidth(l, fontSize) <= w + 1e-9);
  assert.ok(lines.length * fontSize * 1.15 <= h + 1e-9);
});

test('fitFontSize: ein einzelnes, sehr langes Wort wird hart umbrochen statt die Fläche zu sprengen', () => {
  const { fontSize, lines } = fitFontSize('Sonderanfertigungsflightcasebeschriftung', 10, 6);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(estimateTextWidth(l, fontSize) <= 10 + 1e-9);
});

test('fitFontSize: leerer Text liefert eine leere Zeile ohne Fehler', () => {
  const { lines } = fitFontSize('', 10, 5);
  assert.deepEqual(lines, ['']);
});
