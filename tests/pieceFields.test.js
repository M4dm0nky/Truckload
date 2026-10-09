import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_FIELDS, pickPieceFields } from '../js/model/pieceFields.js';
import * as A from '../js/model/actions.js';
import { MAX_LABEL } from '../js/model/limits.js';
import { mkCase, mkTruck, plan, byId, counter } from './fixtures.js';

test('PIECE_FIELDS nennt die fünf Stückfelder', () => {
  assert.deepEqual(PIECE_FIELDS, ['label', 'color', 'layers', 'tipped', 'group']);
});

test('pickPieceFields: alter Datensatz ohne Felder bleibt schlüsselgleich leer', () => {
  assert.deepEqual(pickPieceFields({ id: 'a', caseId: 'k', x: 1, y: 2 }), {});
  assert.deepEqual(Object.keys(pickPieceFields({ id: 'a', label: undefined, layers: undefined })), []);
  assert.deepEqual(pickPieceFields(null), {});
  assert.deepEqual(pickPieceFields(undefined), {});
});

test('pickPieceFields übernimmt nur die Stückfelder, nie Position oder Id', () => {
  const src = { id: 'a', caseId: 'k', x: 5, y: 6, z: 7, rot: 90, orientation: 'tipLong',
    label: 'L', color: '#123456', layers: [1, 2], tipped: false, group: 'G' };
  assert.deepEqual(pickPieceFields(src), { label: 'L', color: '#123456', layers: [1, 2], tipped: false, group: 'G' });
});

test('pickPieceFields: leere Strings entfallen, tipped:false bleibt, group wird getrimmt und gekürzt', () => {
  assert.deepEqual(pickPieceFields({ label: '', color: '', tipped: false, group: '   ' }), { tipped: false });
  assert.deepEqual(pickPieceFields({ group: `  ${'x'.repeat(MAX_LABEL + 5)} ` }), { group: 'x'.repeat(MAX_LABEL) });
});

test('Stück mit allen Feldern übersteht den ganzen Kreislauf ohne Feldverlust', () => {
  const K = mkCase('k', 120, 60, 60, { tippable: true });
  const ctx = { caseById: byId(K), truck: mkTruck(), newId: counter('n') };
  const fields = { label: 'Kiste 1', color: '#123456', layers: [1, 2], tipped: true, group: 'FOH' };
  const only = p => pickPieceFields(p);
  let pl = A.addUnplaced(plan([]), 'k', 1, counter('u'), { labels: ['Kiste 1'], color: '#123456', layers: [1, 2], tipped: true, group: 'FOH' });
  assert.deepEqual(only(pl.unplaced[0]), fields);
  const id = pl.unplaced[0].id;
  pl = A.placeCase(pl, 'k', { x: 0, y: 0 }, ctx, { fromUnplacedId: id });
  assert.deepEqual(only(pl.placements[0]), fields);
  pl = A.toTray(pl, id);
  assert.deepEqual(only(pl.unplaced[0]), fields);
  pl = A.packAll(pl, ctx);
  assert.deepEqual(only(pl.placements[0]), fields);
  pl = A.duplicate(pl, id, ctx);
  assert.equal(pl.placements.length, 2);
  assert.deepEqual(only(pl.placements[1]), { ...fields, label: 'Kiste 2' });
  pl = A.unloadAll(pl);
  assert.equal(pl.unplaced.length, 2);
  assert.deepEqual(only(pl.unplaced[0]), fields);
  assert.deepEqual(only(pl.unplaced[1]), { ...fields, label: 'Kiste 2' });
});
