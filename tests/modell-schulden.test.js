// #18: Absicherung der technischen Schulden der Modellschicht (Vorgabewert box, orderForStacking, toPiece).
import test from 'node:test';
import assert from 'node:assert/strict';
import { caseShape } from '../js/model/caseShape.js';
import { trussShape } from '../js/model/truss.js';
import { boxOf, ORIENTATIONS, ROTATIONS } from '../js/model/geometry.js';
import { orderForStacking } from '../js/model/packer.js';
import { PIECE_FIELDS, pickPieceFields } from '../js/model/pieceFields.js';
import * as A from '../js/model/actions.js';
import { mkCase, mkTruck, plan, byId, counter } from './fixtures.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { buildWagonCaseType } from '../js/ui/truss-wizard.js';

test('caseShape ohne box = caseShape mit boxOf(c, p), für alle Lagen und Drehungen', () => {
  const c = mkCase('k', 120, 60, 80, { wheelH: 12, wheels: true, tippable: true });
  for (const orientation of ORIENTATIONS) for (const rot of ROTATIONS) {
    const p = { x: 10, y: 20, z: 0, orientation, rot };
    assert.deepEqual(caseShape(c, p), caseShape(c, p, boxOf(c, p)), `${orientation}/${rot}`);
  }
});

test('trussShape ohne box = trussShape mit boxOf(c, p), klassischer Wagen und Pre-Rig', () => {
  const wagen = buildWagonCaseType('w1', 'F34', 300, 29, 8);
  const prerig = PRESET_CASES.find(c => c.kind === 'truss' && c.truss.standing);
  for (const c of [wagen, prerig]) for (const rot of [0, 90]) {
    const p = { x: 5, y: 7, z: 0, orientation: 'standing', rot };
    assert.deepEqual(trussShape(c, p), trussShape(c, p, boxOf(c, p)), `${c.id}/${rot}`);
  }
});

test('orderForStacking: Stücke ohne passende Lage in unplaced, Boden-/Nicht-Boden-Stücke getrennt und sortiert', () => {
  const truck = mkTruck({ l: 400, w: 200, h: 200 });
  const gross = mkCase('gross', 90, 60, 50, { weight: 80 });
  const schwer = mkCase('schwer', 90, 60, 50, { weight: 120 });
  const zuHoch = mkCase('zuhoch', 100, 100, 300);
  const nurOben = mkCase('oben', 50, 50, 50, { weight: 10 });
  const item = (id, c, extra = {}) => ({ id, caseId: c.id, c, ...extra });
  const r = orderForStacking([item('a', gross), item('b', schwer), item('x', zuHoch), item('o', nurOben, { layers: [2, 3] })], truck);
  assert.deepEqual(r.unplaced.map(i => i.id), ['x']);
  assert.deepEqual(r.withFloor.map(e => e.it.id), ['b', 'a'], 'schwerer zuerst bei gleicher höchster Lage');
  assert.deepEqual(r.withoutFloor.map(e => e.it.id), ['o']);
  assert.ok(r.withFloor.every(e => e.o && e.o.d), 'jeder Eintrag trägt die gewählte Orientierung');
});

// Struktursperre: Jedes Stückfeld aus PIECE_FIELDS muss „Alles neu packen“ (toPiece → Packer) überleben,
// platziert wie in der Ablage. Ergänzt jemand ein Feld in PIECE_FIELDS, ohne pickPieceFields/den Packer
// nachzuziehen, schlägt dieser Test an.
const BEISPIEL = { label: 'Beschriftung', color: '#123456', layers: [1, 2], tipped: false, group: 'FOH' };

test('PIECE_FIELDS und pickPieceFields nennen dieselben Felder, jedes hat einen Beispielwert', () => {
  assert.deepEqual(Object.keys(BEISPIEL).sort(), [...PIECE_FIELDS].sort(), 'neues Stückfeld: BEISPIEL ergänzen');
  assert.deepEqual(Object.keys(pickPieceFields(BEISPIEL)).sort(), [...PIECE_FIELDS].sort());
});

test('toPiece/packAll: alle Stückfelder bleiben beim „Alles neu packen“ erhalten (platziert und in der Ablage)', () => {
  const K = mkCase('k', 60, 40, 50, { weight: 20, tippable: true });
  const ctx = { caseById: byId(K), truck: mkTruck(), newId: counter('n') };
  const pl0 = plan(
    [{ id: 'a', caseId: 'k', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0, ...BEISPIEL }],
    [{ id: 'u', caseId: 'k', ...BEISPIEL }],
  );
  const pl = A.packAll(pl0, ctx);
  for (const id of ['a', 'u']) {
    const x = [...pl.placements, ...pl.unplaced].find(s => s.id === id);
    assert.ok(x, `Stück ${id} fehlt`);
    for (const f of PIECE_FIELDS) assert.deepEqual(x[f], BEISPIEL[f], `Feld „${f}“ ging bei „Alles neu packen“ verloren (Stück ${id})`);
  }
});
