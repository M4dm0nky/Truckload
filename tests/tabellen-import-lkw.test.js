import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPALTEN, erkenneReiter, werteZeilen } from '../js/model/ladeliste.js';
import { rechneLkwImport, neueStueckIds } from '../js/app/tabellenImport.js';
import { DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';
import { emptyPlan } from '../js/model/actions.js';
import { mkTruck, counter } from './fixtures.js';

const lies = (reiter, zeilen) => {
  const rows = [['Hinweis'], SPALTEN[reiter].map(s => s.de), ...zeilen];
  return werteZeilen(reiter, rows, erkenneReiter(rows));
};
const LEER = { cases: [], stuecke: [] };
// 240 x 120 x 200 Laderaum: Cases 120 x 60 x 100 -> höchstens 8 je LKW (stapelbar), 4 ohne Stapeln.
const TRUCK = mkTruck({ id: DEFAULT_TRUCK_ID, l: 240, w: 120, h: 200, payload: 24000 });
const state = plan => ({ cases: [], trucks: [TRUCK], plan, activeLkw: null });
const einst = (extra = {}) => ({ verhalten: 'neu', truckId: TRUCK.id, art: 'je-gewerk', getrennt: false, gewerke: {}, ...extra });
const res = (zeilen, lkw) => ({ eintraege: lies('cases', zeilen), ziel: 'current', laden: true, gebaut: LEER, lkw });

test('rechneLkwImport: Ton und Licht landen auf getrennten LKW, Bericht nennt Name, Gewerk, Stückzahl', () => {
  const p = emptyPlan('p', 'P', TRUCK.id);
  const r = rechneLkwImport(state(p), res([
    ['Sub', '2', '120', '60', '100', 'nein', '5', '2', '', 'Ton', ''],
    ['Par', '1', '120', '60', '100', 'nein', '5', '2', '', 'Licht', ''],
  ], einst()), counter('x'));
  assert.equal(r.plan.lkws.length, 2);
  assert.deepEqual(r.bericht.lkws.map(l => [l.gewerke, l.stueck]).sort(), [[['Licht'], 1], [['Ton'], 2]]);
  assert.deepEqual(r.bericht.nichtGeladen, []);
});

test('rechneLkwImport: was keinen Platz findet, steht als nicht geladen im Bericht', () => {
  const p = emptyPlan('p', 'P', TRUCK.id);
  const r = rechneLkwImport(state(p), res([['Riese', '1', '500', '60', '100', 'nein', '5', '2', '', 'Ton', '']], einst()), counter('x'));
  assert.deepEqual(r.bericht.nichtGeladen, [{ name: 'Riese', gewerk: 'Ton' }]);
});

test('rechneLkwImport: ändert weder Zustand noch Plan (Kopie)', () => {
  const p = emptyPlan('p', 'P', TRUCK.id);
  const s = state(p);
  const vorher = JSON.stringify(s);
  rechneLkwImport(s, res([['Sub', '2', '120', '60', '100', 'nein', '5', '2', '', 'Ton', '']], einst()), counter('x'));
  assert.equal(JSON.stringify(s), vorher);
});

test('neueStueckIds: nur Stücke, die vorher nicht da waren', () => {
  const p = { placements: [{ id: 'a' }], unplaced: [{ id: 'b' }, { id: 'c' }] };
  assert.deepEqual(neueStueckIds(p, new Set(['a', 'b'])), ['c']);
});

test('Struktursperre: Übernahme und Vorschau gehen über dieselben Funktionen, Vorschau schreibt nicht in den Store', () => {
  const src = readFileSync(new URL('../js/app/tabellenImport.js', import.meta.url), 'utf8');
  const vor = src.slice(src.indexOf('vorschau: async'), src.indexOf('vorschau: async') + 400);
  assert.match(vor, /rechneLkwImport\(/);
  assert.doesNotMatch(vor, /editWhole|store\.update|switchPlan/);
  const ueb = src.slice(src.indexOf('async function uebernehmen'));
  assert.match(ueb, /planeLkws\(p, \{ \.\.\.c, truckById: truckByIdOf\(store\.get\(\)\) \}, \{ \.\.\.lkw, neu \}\)/);
  assert.match(ueb, /neueStueckIds\(/);
  assert.doesNotMatch(ueb, /packRest|warnIfUnplaced/);
  assert.doesNotMatch(src, /saveCase/);
});
