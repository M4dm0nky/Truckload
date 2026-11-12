import test from 'node:test';
import assert from 'node:assert/strict';
import { uebernimmTabelle } from '../js/model/tabellen-uebernahme.js';
import { mitfuehren, bestandFuer, MITGEFUEHRT_VERSION } from '../js/model/mitgefuehrt.js';
import { MAX_MITGEFUEHRT_CASES } from '../js/model/limits.js';
import { SPALTEN, erkenneReiter, werteZeilen, entwurfAus } from '../js/model/ladeliste.js';
import { mkCase, counter } from './fixtures.js';

const kopf = reiter => SPALTEN[reiter].map(s => s.de);
const zeile = (reiter, obj) => SPALTEN[reiter].map(s => obj[s.key] ?? '');
const entwuerfe = (reiter, objs) => {
  const rows = [kopf(reiter), ...objs.map(o => zeile(reiter, o))];
  return werteZeilen(reiter, rows, erkenneReiter(rows)).map(entwurfAus);
};
const leer = (extra = {}) => ({ id: 'p', name: 'P', truckId: 't', placements: [], unplaced: [], notes: '', ...extra });
const BASIS = { breite: '60', tiefe: '80', hoehe: '100', gewicht: '40' };

test('uebernimmTabelle: leerer Plan, Menge 3 und 1, getippte Stücke', () => {
  const e = entwuerfe('cases', [
    { name: 'A', menge: '3', ...BASIS, rollen: 'ja', tippen: 'ja' },
    { name: 'B', menge: '1', ...BASIS, rollen: 'nein', tippen: 'nein' },
  ]);
  const p = uebernimmTabelle(leer(), e, counter('n'));
  assert.equal(p.mitgefuehrt.version, MITGEFUEHRT_VERSION);
  assert.equal(p.mitgefuehrt.cases.length, 2);
  assert.ok(p.mitgefuehrt.cases.every(c => c.id && c.herkunft === 'import'));
  assert.equal(p.unplaced.length, 4);
  const a = p.mitgefuehrt.cases.find(c => c.name === 'A');
  const b = p.mitgefuehrt.cases.find(c => c.name === 'B');
  assert.deepEqual(p.unplaced.filter(u => u.caseId === a.id).map(u => u.tipped), [true, true, true]);
  assert.deepEqual(p.unplaced.filter(u => u.caseId === b.id).map(u => u.tipped), [false]);
  assert.ok(p.unplaced.every(u => !('lkw' in u)));
});

test('uebernimmTabelle: vorhandene Stücke und Kopien bleiben', () => {
  const kopie = mkCase('k1', 10, 10, 10);
  const vorher = leer({ unplaced: [{ id: 'u0', caseId: 'k1' }], mitgefuehrt: { version: 1, cases: [kopie], trucks: [] } });
  const p = uebernimmTabelle(vorher, entwuerfe('cases', [{ name: 'A', menge: '1', ...BASIS }]), counter('n'));
  assert.equal(p.unplaced.length, 2);
  assert.equal(p.unplaced[0].id, 'u0');
  assert.equal(p.mitgefuehrt.cases.length, 2);
  assert.ok(p.mitgefuehrt.cases.some(c => c.id === 'k1' && !c.herkunft));
});

test('uebernimmTabelle: Mehr-LKW-Plan, Stücke ohne lkw-Feld (Ohne LKW)', () => {
  const lkws = [{ id: 'l1', name: 'A', truckId: 't', categories: [] }, { id: 'l2', name: 'B', truckId: 't', categories: [] }];
  const p = uebernimmTabelle(leer({ lkws }), entwuerfe('cases', [{ name: 'A', menge: '2', ...BASIS }]), counter('n'));
  assert.equal(p.unplaced.length, 2);
  assert.ok(p.unplaced.every(u => !('lkw' in u)));
  assert.deepEqual(p.lkws, lkws);
});

test('uebernimmTabelle: Set-Entwurf bleibt Set-Case, Menge wird zu Stücken', () => {
  const p = uebernimmTabelle(leer(), entwuerfe('set', [{ name: 'S', menge: '2', ...BASIS }]), counter('n'));
  assert.equal(p.mitgefuehrt.cases[0].kind, 'set');
  assert.equal(p.unplaced.length, 2);
});

test('mitfuehren nach uebernimmTabelle behält die Import-Cases (Autosave-Regression)', () => {
  const p = uebernimmTabelle(leer(), entwuerfe('cases', [{ name: 'A', menge: '2', ...BASIS }]), counter('n'));
  const q = mitfuehren(p, [], []);
  assert.equal(q.mitgefuehrt.cases.length, 1);
  assert.equal(q.mitgefuehrt.cases[0].herkunft, 'import');
  assert.equal(bestandFuer([], [], q).cases.length, 1);
});

test('uebernimmTabelle: mehr als MAX_MITGEFUEHRT_CASES Typen gesamt wirft, Plan unverändert', () => {
  const e = entwuerfe('cases', [{ name: 'A', menge: '1', ...BASIS }]);
  const viele = Array.from({ length: MAX_MITGEFUEHRT_CASES }, () => e[0]);
  const vorher = leer();
  const snap = JSON.stringify(vorher);
  assert.equal(uebernimmTabelle(vorher, viele, counter('n')).mitgefuehrt.cases.length, MAX_MITGEFUEHRT_CASES);
  assert.throws(() => uebernimmTabelle(vorher, [...viele, e[0]], counter('n')));
  assert.equal(JSON.stringify(vorher), snap);
  const mit = leer({ mitgefuehrt: { version: 1, cases: [mkCase('k', 1, 1, 1)], trucks: [] } });
  assert.throws(() => uebernimmTabelle(mit, viele, counter('n')));
});

test('Ende zu Ende: gestapelte Import-Cases (Höchste Lage 2) landen beim Packen auch über dem Boden', async () => {
  const A = await import('../js/model/actions.js');
  const { bestandFuer } = await import('../js/model/mitgefuehrt.js');
  const e = entwuerfe('cases', [{ name: 'S', menge: '3', breite: '60', tiefe: '80', hoehe: '50', gewicht: '10', rollen: 'nein', lage: '2' }]);
  const p = uebernimmTabelle(leer({ truckId: 't' }), e, counter('n'));
  const truck = { id: 't', name: 'T', l: 80, w: 60, h: 120, payload: 5000, wheelArches: [] };
  const b = bestandFuer([], [truck], p);
  const ctx = { caseById: new Map(b.cases.map(c => [c.id, c])), truck, newId: counter('x') };
  const out = A.packAll(p, ctx);
  assert.ok(out.placements.length >= 2);
  assert.ok(out.placements.some(q => q.z > 0), JSON.stringify(out.placements));
});
