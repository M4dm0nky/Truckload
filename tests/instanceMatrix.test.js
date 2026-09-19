import test from 'node:test';
import assert from 'node:assert/strict';
import { composeMatrix, IDENTITY_QUAT } from '../js/ui/instanceMatrix.js';

// 90°-Rotation um die y-Achse als Quaternion (x,y,z,w).
const QUAT_Y90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];

test('composeMatrix: Identität ergibt reine Translation/Skalierung ohne Rotation', () => {
  const [qx, qy, qz, qw] = IDENTITY_QUAT;
  const m = composeMatrix(1, 2, 3, qx, qy, qz, qw, 4, 5, 6);
  assert.deepEqual(m, [
    4, 0, 0, 0,
    0, 5, 0, 0,
    0, 0, 6, 0,
    1, 2, 3, 1,
  ]);
});

test('composeMatrix: zwei Aufrufe mit unterschiedlicher Rotation beeinflussen sich nicht (kein geteilter Zustand)', () => {
  // Erst ein rotierter „Zylinder“ (wie eine Traversen-Diagonale) …
  const rotated = composeMatrix(0, 0, 0, ...QUAT_Y90, 1, 10, 1);
  // … danach ein achsenparalleler „Balken“ ohne Rotation (wie ein Flightcase-Profilstab).
  const [qx, qy, qz, qw] = IDENTITY_QUAT;
  const axisAligned = composeMatrix(5, 5, 5, qx, qy, qz, qw, 2, 3, 4);

  // Der zweite Aufruf darf keine Rotation aus dem ersten geerbt haben: die Matrix muss eine reine
  // Diagonal-Skalierung + Translation sein (alle Off-Diagonal-Rotationsanteile = 0).
  assert.deepEqual(axisAligned, [
    2, 0, 0, 0,
    0, 3, 0, 0,
    0, 0, 4, 0,
    5, 5, 5, 1,
  ]);

  // Und der Aufruf davor bleibt unverändert nachvollziehbar rotiert (Kontrollwert, keine Drift).
  assert.ok(Math.abs(rotated[0]) < 1e-9); // x-Achse durch 90°-y-Rotation ~0
  assert.ok(Math.abs(rotated[8] - 1) < 1e-9); // z-Anteil in x-Spalte ~1 (Skalierung 1)

  // Aufruf-Reihenfolge umgekehrt liefert dasselbe Ergebnis für den achsenparallelen Fall –
  // bestätigt, dass kein Zustand zwischen den Aufrufen hängen bleibt.
  const axisAlignedFirst = composeMatrix(5, 5, 5, qx, qy, qz, qw, 2, 3, 4);
  assert.deepEqual(axisAlignedFirst, axisAligned);
});

test('composeMatrix: `out`-Parameter wird vollständig überschrieben (kein Rest aus vorheriger Nutzung)', () => {
  const out = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9];
  const [qx, qy, qz, qw] = IDENTITY_QUAT;
  composeMatrix(0, 0, 0, qx, qy, qz, qw, 1, 1, 1, out);
  assert.deepEqual(out, [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
});
