import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOLLY_H, DOLLY_WHEEL_H, DOLLY_BOARD_H, DOLLY_RAIL_H, DOLLY_WIDTHS, DOLLY_L, TRUSS_PROFILES,
  TUBE_R_RATIO, trussDims, isTruss, trussShape,
} from '../js/model/truss.js';
import { boxOf } from '../js/model/geometry.js';

const mkTrussCase = (length, width, count) => {
  const { l, w, h } = trussDims({ length, width, count });
  return { kind: 'truss', truss: { length, width, count }, l, w, h };
};

test('trussDims: 34er (29 cm) passt zu zweit nebeneinander -> 60er Wagen', () => {
  const d = trussDims({ length: 300, width: 29, count: 4 });
  assert.equal(d.l, 300);
  assert.equal(d.w, 60);
  assert.equal(d.h, DOLLY_H + 2 * 29);
});
test('trussDims: 40er (40 cm) passt nicht zweit nebeneinander in 60 -> 80er Wagen', () => {
  const d = trussDims({ length: 300, width: 40, count: 4 });
  assert.equal(d.w, 80);
  assert.equal(d.h, DOLLY_H + 2 * 40);
});
test('trussDims: ungerade Stückzahl wird auf volle Lage aufgerundet', () => {
  const d3 = trussDims({ length: 200, width: 29, count: 3 });
  const d4 = trussDims({ length: 200, width: 29, count: 4 });
  assert.equal(d3.h, d4.h);
  assert.equal(d3.h, DOLLY_H + 2 * 29);
});
test('trussDims: 1 Stück -> nur eine Lage', () => {
  const d = trussDims({ length: 200, width: 29, count: 1 });
  assert.equal(d.h, DOLLY_H + 29);
});
test('DOLLY_WIDTHS enthält 60 und 80', () => {
  assert.deepEqual(DOLLY_WIDTHS, [60, 80]);
});
test('TRUSS_PROFILES enthält 34er (29 cm) und 40er (40 cm)', () => {
  assert.ok(TRUSS_PROFILES.some(p => p.width === 29));
  assert.ok(TRUSS_PROFILES.some(p => p.width === 40));
});
test('isTruss erkennt kind truss', () => {
  assert.equal(isTruss({ kind: 'truss' }), true);
  assert.equal(isTruss({ kind: 'case' }), false);
  assert.equal(isTruss({}), false);
});

function checkInsideBox(box, sub) {
  for (const ax of ['x', 'y', 'z']) {
    assert.ok(sub[`${ax}0`] >= box[`${ax}0`] - 1e-9, `${ax}0 innerhalb der Box`);
    assert.ok(sub[`${ax}1`] <= box[`${ax}1`] + 1e-9, `${ax}1 innerhalb der Box`);
  }
}

test('trussShape 0°: 4 Stück -> 2 Lagen × 2 Spalten, alles innerhalb der Box, Wagen an beiden Enden', () => {
  const c = mkTrussCase(300, 29, 4);
  const p = { x: 10, y: 20, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  assert.equal(s.lenAxis, 'x');
  assert.equal(s.widAxis, 'y');
  assert.equal(s.dollies.length, 2);
  assert.equal(s.wheels.length, 8);
  assert.equal(s.pieces.length, 4);

  for (const b of [...s.dollies, ...s.wheels, ...s.pieces]) checkInsideBox(box, b);

  // Wagen an beiden Enden: einer beginnt am unteren Ende der Länge, der andere endet am oberen Ende.
  assert.ok(s.dollies.some(d => Math.abs(d.x0 - box.x0) < 1e-9));
  assert.ok(s.dollies.some(d => Math.abs(d.x1 - box.x1) < 1e-9));
  for (const d of s.dollies) { assert.equal(d.z0, box.z0); assert.equal(d.z1, box.z0 + DOLLY_H); }

  // 2 Lagen × 2 Spalten: 2 unterschiedliche z-Bänder mit je 2 Stücken.
  const rowsZ = [...new Set(s.pieces.map(pc => pc.z0))];
  assert.equal(rowsZ.length, 2);
  for (const z of rowsZ) assert.equal(s.pieces.filter(pc => pc.z0 === z).length, 2);
  // Jedes Stück läuft über die volle Länge (liegt auf beiden Wagen auf).
  for (const pc of s.pieces) { assert.equal(pc.x0, box.x0); assert.equal(pc.x1, box.x1); }
});

test('trussShape 90°: Traversenlänge verläuft entlang y', () => {
  const c = mkTrussCase(300, 29, 4);
  const p = { x: 5, y: 15, z: 0, orientation: 'standing', rot: 90 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  assert.equal(s.lenAxis, 'y');
  assert.equal(s.widAxis, 'x');
  for (const b of [...s.dollies, ...s.wheels, ...s.pieces]) checkInsideBox(box, b);
  assert.ok(s.dollies.some(d => Math.abs(d.y0 - box.y0) < 1e-9));
  assert.ok(s.dollies.some(d => Math.abs(d.y1 - box.y1) < 1e-9));
  for (const pc of s.pieces) { assert.equal(pc.y0, box.y0); assert.equal(pc.y1, box.y1); }
});

test('trussShape: ungerade Stückzahl -> letzte Lage nur 1 Stück, zentriert', () => {
  const c = mkTrussCase(200, 29, 3);
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);
  assert.equal(s.pieces.length, 3);
  const rowsZ = [...new Set(s.pieces.map(pc => pc.z0))].sort((a, b) => a - b);
  assert.equal(rowsZ.length, 2);
  const lastRow = s.pieces.filter(pc => pc.z0 === rowsZ[1]);
  assert.equal(lastRow.length, 1);
  const mid = (box.y0 + box.y1) / 2;
  assert.ok(Math.abs((lastRow[0].y0 + lastRow[0].y1) / 2 - mid) < 1e-9);
});

test('trussShape: sehr kurzer Wagen (40 cm Traverse) – Rollen überlappen nicht und bleiben im Wagen', () => {
  const c = mkTrussCase(40, 29, 2);
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  assert.equal(s.dollies.length, 2);
  assert.equal(s.wheels.length, 8);
  for (const w of s.wheels) checkInsideBox(box, w);

  for (const d of s.dollies) {
    const wheelsOnDolly = s.wheels.filter(w => w.x0 >= d.x0 - 1e-9 && w.x1 <= d.x1 + 1e-9);
    assert.equal(wheelsOnDolly.length, 4);
    for (const w of wheelsOnDolly) checkInsideBox(d, w);
    // Die beiden Rollen entlang der Länge (gleiche y-Lage) dürfen sich nicht überlappen.
    for (const y of [...new Set(wheelsOnDolly.map(w => w.y0))]) {
      const [a, b] = wheelsOnDolly.filter(w => w.y0 === y).sort((p1, p2) => p1.x0 - p2.x0);
      assert.ok(a.x1 <= b.x0 + 1e-9, 'Rollen entlang der Länge überlappen sich nicht');
    }
  }
});

test('DOLLY_H setzt sich aus Rollenbereich, Plattenstärke und Leistenhöhe zusammen', () => {
  assert.equal(DOLLY_H, DOLLY_WHEEL_H + DOLLY_BOARD_H + DOLLY_RAIL_H);
});

test('trussShape: boards – je Wagen eine Platte, volle Breite/Länge, zwischen Rollenbereich und Leisten', () => {
  const c = mkTrussCase(300, 29, 4);
  const p = { x: 10, y: 20, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  assert.equal(s.boards.length, 2);
  for (const b of s.boards) checkInsideBox(box, b);
  s.boards.forEach((b, i) => {
    const d = s.dollies[i];
    // Platte deckt denselben Wagen-Grundriss ab (Länge/Breite wie der Wagen).
    assert.equal(b[`${s.lenAxis}0`], d[`${s.lenAxis}0`]);
    assert.equal(b[`${s.lenAxis}1`], d[`${s.lenAxis}1`]);
    assert.equal(b[`${s.widAxis}0`], d[`${s.widAxis}0`]);
    assert.equal(b[`${s.widAxis}1`], d[`${s.widAxis}1`]);
    // Platte sitzt über dem Rollenbereich (DOLLY_WHEEL_H) und ist exakt DOLLY_BOARD_H dick.
    assert.equal(b.z0 - d.z0, DOLLY_WHEEL_H);
    assert.equal(b.z1 - b.z0, DOLLY_BOARD_H);
    // Über der Platte ist noch Platz für die Leisten (DOLLY_RAIL_H) bis zum Wagenende.
    assert.equal(d.z1 - b.z1, DOLLY_RAIL_H);
  });
});

test('trussShape: rails – 2 Leisten je Traversenspur und Wagen, auf der Platte, unter den Gurtrohr-Linien', () => {
  const c = mkTrussCase(300, 29, 4); // 2 Spuren nebeneinander -> 4 Leisten je Wagen, 8 insgesamt
  const p = { x: 10, y: 20, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  assert.equal(s.rails.length, 8);
  for (const r of s.rails) checkInsideBox(box, r);

  for (const r of s.rails) {
    // Leiste sitzt auf der Platte des jeweiligen Wagens (Unterkante = Plattenoberkante).
    const board = s.boards.find(b => r[`${s.lenAxis}0`] >= b[`${s.lenAxis}0`] - 1e-9 && r[`${s.lenAxis}1`] <= b[`${s.lenAxis}1`] + 1e-9);
    assert.ok(board, 'Leiste gehört zu einer Platte');
    assert.equal(r.z0, board.z1, 'Leiste beginnt an der Plattenoberkante');
    // Oberkante der Leiste ist die Unterkante der untersten Lage (Traverse liegt auf den Leisten auf).
    const dolly = s.dollies.find(d => d[`${s.lenAxis}0`] === board[`${s.lenAxis}0`]);
    assert.equal(r.z1, dolly.z1, 'Leistenoberkante = Wagenoberkante = Unterkante der untersten Lage');
    // Leiste läuft über die volle Wagenlänge.
    assert.equal(r[`${s.lenAxis}0`], board[`${s.lenAxis}0`]);
    assert.equal(r[`${s.lenAxis}1`], board[`${s.lenAxis}1`]);
  }

  // Je Wagen: die 4 Leisten liegen an genau 2 Spuren (4 verschiedene widAxis-Startwerte), jeweils
  // nach innen versetzt von den Spurkanten (nicht bündig auf ihnen).
  for (const d of s.dollies) {
    const railsOnDolly = s.rails.filter(r => r[`${s.lenAxis}0`] === d[`${s.lenAxis}0`]);
    assert.equal(railsOnDolly.length, 4);
    for (const r of railsOnDolly) {
      assert.ok(r[`${s.widAxis}0`] > d[`${s.widAxis}0`] + 1e-9, 'Leiste ist von der Spurkante nach innen versetzt');
    }
  }
});

test('trussShape: keine Leiste überlappt ein Traversenstück – Traverse liegt auf den Leisten auf', () => {
  const c = mkTrussCase(300, 29, 4);
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  const overlaps1D = (a0, a1, b0, b1) => a0 < b1 - 1e-9 && b0 < a1 - 1e-9;
  const overlapsBox = (a, b, ax1, ax2) =>
    overlaps1D(a[`${ax1}0`], a[`${ax1}1`], b[`${ax1}0`], b[`${ax1}1`]) &&
    overlaps1D(a[`${ax2}0`], a[`${ax2}1`], b[`${ax2}0`], b[`${ax2}1`]) &&
    overlaps1D(a.z0, a.z1, b.z0, b.z1);

  for (const r of s.rails) {
    for (const pc of s.pieces) {
      assert.ok(!overlapsBox(r, pc, s.lenAxis, s.widAxis), 'Leiste und Traversenstück überlappen sich nicht');
    }
    // Oberkante der Leiste ist die Unterkante der untersten Lage (z0 der Lage-0-Stücke).
    const row0Z = Math.min(...s.pieces.map(pc => pc.z0));
    assert.equal(r.z1, row0Z);
  }
});

test('trussShape: sehr kurzer/schmaler Wagen – Leisten überlappen sich nicht und ragen nicht aus der Box', () => {
  const c = mkTrussCase(100, 29, 4); // sehr kurze Traverse, testet die Kürzungslogik
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  for (const r of s.rails) checkInsideBox(box, r);

  // Innerhalb einer Spur dürfen sich die beiden Leisten (an den Kanten) nicht überlappen.
  for (const d of s.dollies) {
    const railsOnDolly = s.rails.filter(r => r[`${s.lenAxis}0`] === d[`${s.lenAxis}0`]);
    const byWidStart = [...railsOnDolly].sort((a, b) => a[`${s.widAxis}0`] - b[`${s.widAxis}0`]);
    for (let i = 0; i < byWidStart.length - 1; i++) {
      assert.ok(byWidStart[i][`${s.widAxis}1`] <= byWidStart[i + 1][`${s.widAxis}0`] + 1e-9,
        'Leisten überlappen sich nicht');
    }
  }
});

test('trussShape: schmale Spur begrenzt die Leistenbreite statt zu überlappen', () => {
  // Sehr schmales Traversenprofil (2 cm), nur 1 Stück -> 1 Spur -> Nenn-Leistenbreite (3 cm) muss
  // begrenzt werden, sonst würden sich die beiden Leisten dieser Spur überlappen.
  const c = mkTrussCase(300, 2, 1);
  const p = { x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 };
  const box = boxOf(c, p);
  const s = trussShape(c, p, box);

  assert.equal(s.rails.length, 4); // 1 Spur × 2 Leisten × 2 Wagen
  for (const d of s.dollies) {
    const railsOnDolly = s.rails.filter(r => r[`${s.lenAxis}0`] === d[`${s.lenAxis}0`]);
    const [a, b] = [...railsOnDolly].sort((p1, p2) => p1[`${s.widAxis}0`] - p2[`${s.widAxis}0`]);
    assert.ok(a[`${s.widAxis}1`] <= b[`${s.widAxis}0`] + 1e-9, 'Leisten in schmaler Spur überlappen sich nicht');
    for (const r of railsOnDolly) checkInsideBox(box, r);
  }
});
