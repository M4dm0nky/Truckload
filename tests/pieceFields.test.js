import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_FIELDS, pickPieceFields } from '../js/model/pieceFields.js';
import * as A from '../js/model/actions.js';
import { MAX_LABEL } from '../js/model/limits.js';
import { mkCase, mkTruck, plan, byId, counter } from './fixtures.js';

test('PIECE_FIELDS nennt die sieben Stückfelder', () => {
  assert.deepEqual(PIECE_FIELDS, ['label', 'color', 'layers', 'tipped', 'group', 'nyxGeraet', 'nyxStueck']);
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

test('pickPieceFields: ein volles Stück liefert genau PIECE_FIELDS, in dieser Reihenfolge', () => {
  const full = { label: 'L', color: '#123456', layers: [1, 2], tipped: true, group: 'G', nyxGeraet: 'k1', nyxStueck: 2 };
  assert.deepEqual(Object.keys(pickPieceFields(full)), PIECE_FIELDS);
});

test('duplicate: Kopie, die in die Ablage geht (kein Platz), behält alle Stückfelder außer NYX', () => {
  const K = mkCase('k', 120, 60, 60, { tippable: true });
  const truck = mkTruck({ l: 120, w: 60, h: 60 });
  const ctx = { caseById: byId(K), truck, newId: counter('n') };
  const fields = { label: 'Kiste 1', color: '#123456', layers: [1, 2], tipped: false, group: 'FOH', nyxGeraet: 'key-1', nyxStueck: 2 };
  const pl = A.duplicate(plan([{ id: 'a', caseId: 'k', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0, ...fields }]), 'a', ctx);
  assert.equal(pl.placements.length, 1);
  assert.equal(pl.unplaced.length, 1);
  const { nyxGeraet, nyxStueck, ...handFields } = fields;
  // Ein Duplikat ist ein Hand-Stück: alle Felder außer den NYX-Feldern, das Original behält sie.
  assert.deepEqual(pickPieceFields(pl.unplaced[0]), { ...handFields, label: 'Kiste 2' });
  assert.equal(pl.placements[0].nyxGeraet, 'key-1');
  assert.equal(pl.placements[0].nyxStueck, 2);
});

test('pickPieceFields: leere Strings entfallen, tipped:false bleibt, group wird getrimmt und gekürzt', () => {
  assert.deepEqual(pickPieceFields({ label: '', color: '', tipped: false, group: '   ' }), { tipped: false });
  assert.deepEqual(pickPieceFields({ group: `  ${'x'.repeat(MAX_LABEL + 5)} ` }), { group: 'x'.repeat(MAX_LABEL) });
});

test('Stück mit allen Feldern übersteht den ganzen Kreislauf ohne Feldverlust', () => {
  const K = mkCase('k', 120, 60, 60, { tippable: true });
  const ctx = { caseById: byId(K), truck: mkTruck(), newId: counter('n') };
  const fields = { label: 'Kiste 1', color: '#123456', layers: [1, 2], tipped: true, group: 'FOH', nyxGeraet: 'key-1', nyxStueck: 2 };
  const only = p => pickPieceFields(p);
  let pl = A.addUnplaced(plan([]), 'k', 1, counter('u'), { labels: ['Kiste 1'], color: '#123456', layers: [1, 2], tipped: true, group: 'FOH', nyxGeraet: 'key-1', nyxStueck: 2 });
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
  const { nyxGeraet, nyxStueck, ...hand } = fields;
  assert.deepEqual(only(pl.placements[1]), { ...hand, label: 'Kiste 2' });
  assert.deepEqual(only(pl.placements[0]), fields);
  pl = A.unloadAll(pl);
  assert.equal(pl.unplaced.length, 2);
  assert.deepEqual(only(pl.unplaced[0]), fields);
  assert.deepEqual(only(pl.unplaced[1]), { ...hand, label: 'Kiste 2' });
});

test('pickPieceFields übernimmt nyxGeraet/nyxStueck, nur wenn gültig', () => {
  assert.deepEqual(pickPieceFields({ nyxGeraet: 'k1', nyxStueck: 3 }), { nyxGeraet: 'k1', nyxStueck: 3 });
  assert.deepEqual(pickPieceFields({ nyxGeraet: '', nyxStueck: 0 }), {});
  assert.deepEqual(pickPieceFields({ nyxGeraet: 5, nyxStueck: 2.5 }), {});
  assert.deepEqual(pickPieceFields({ nyxStueck: 100 }), {});
  assert.deepEqual(pickPieceFields({ nyxGeraet: 'x'.repeat(201) }), {});
});

test('addUnplaced reicht nyxGeraet/nyxStueck an die Stücke durch', () => {
  const pl = A.addUnplaced(plan([]), 'k', 2, counter('u'), { nyxGeraet: 'key-1', nyxStueck: 4 });
  assert.equal(pl.unplaced.length, 2);
  for (const u of pl.unplaced) assert.deepEqual(pickPieceFields(u), { nyxGeraet: 'key-1', nyxStueck: 4 });
  const ohne = A.addUnplaced(plan([]), 'k', 1, counter('v'));
  assert.deepEqual(Object.keys(ohne.unplaced[0]).sort(), ['caseId', 'id']);
});

test('autoPack-Placements (packAll) behalten nyxGeraet/nyxStueck, auch in der Ablage', () => {
  const K = mkCase('k', 100, 60, 60);
  const truck = mkTruck({ l: 400, w: 200, h: 200 });
  const ctx = { caseById: byId(K), truck, newId: counter('n') };
  const pl = A.packAll(A.addUnplaced(plan([]), 'k', 1, counter('u'), { nyxGeraet: 'key-1', nyxStueck: 2 }), ctx);
  assert.equal(pl.placements.length, 1);
  assert.equal(pl.placements[0].nyxGeraet, 'key-1');
  assert.equal(pl.placements[0].nyxStueck, 2);
  const tray = A.toTray(pl, pl.placements[0].id);
  assert.deepEqual(pickPieceFields(tray.unplaced[0]), { nyxGeraet: 'key-1', nyxStueck: 2 });
});

test('duplicate (platziert): Kopie ist ein Hand-Stück ohne NYX-Felder, Original behält sie', () => {
  const K = mkCase('k', 100, 60, 60);
  const ctx = { caseById: byId(K), truck: mkTruck({ l: 400, w: 200, h: 200 }), newId: counter('n') };
  const pl = A.duplicate(plan([{ id: 'a', caseId: 'k', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0,
    label: 'Kiste 1', group: 'FOH', nyxGeraet: 'key-1', nyxStueck: 2 }]), 'a', ctx);
  assert.equal(pl.placements.length, 2);
  assert.equal(pl.unplaced.length, 0);
  const [orig, copy] = pl.placements;
  assert.equal(orig.nyxGeraet, 'key-1');
  assert.equal(orig.nyxStueck, 2);
  assert.equal('nyxGeraet' in copy, false);
  assert.equal('nyxStueck' in copy, false);
  assert.equal(copy.label, 'Kiste 2');
  assert.equal(copy.group, 'FOH');
});
