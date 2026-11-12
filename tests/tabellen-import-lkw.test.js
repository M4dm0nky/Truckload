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

// ---- Befunde der Schlussprüfung ----
import { gruppenAus, planeLkws, gewerkWoerterbuch, gewerkEintrag, gewerkCfg } from '../js/model/lkw-import.js';
import { freieLkwFuer } from '../js/app/tabellenImport.js';
import { lkwSchrittHtml, uebersichtHtml, zusammenfassung, auffaelligkeiten } from '../js/ui/tabellen-import.js';
import { MAX_LKW } from '../js/model/limits.js';

test('Gewerk „__proto__“ aus der Tabelle verschmutzt Object.prototype nicht und bleibt eine eigene Gruppe', () => {
  const zeilen = [
    ['Sub', '2', '120', '60', '100', 'nein', '5', '2', '', '__proto__', ''],
    ['Par', '1', '120', '60', '100', 'nein', '5', '2', '', 'Licht', ''],
  ];
  const cfgs = gewerkWoerterbuch();
  gewerkEintrag(cfgs, '__proto__').modus = 'n'; // wie lkwAenderung
  gewerkEintrag(cfgs, '__proto__').n = 2;
  assert.equal(({}).modus, undefined);
  assert.equal(({}).n, undefined);
  const gruppen = gruppenAus(['__proto__', 'Licht'], { gewerke: cfgs });
  assert.deepEqual(gruppen.map(g => g.gewerke).sort(), [['Licht'], ['__proto__']]);
  assert.equal(gruppen.find(g => g.gewerke[0] === '__proto__').modus, 'n');
  // Ohne eigenen Eintrag liefert ein normales Objekt nicht den Prototyp
  assert.equal(gewerkCfg({}, '__proto__'), undefined);
  assert.equal(gewerkCfg({}, 'constructor'), undefined);
  const p = emptyPlan('p', 'P', TRUCK.id);
  const r = rechneLkwImport(state(p), res(zeilen, einst({ gewerke: cfgs })), counter('x'));
  assert.equal(({}).modus, undefined);
  assert.ok(r.bericht.lkws.some(l => l.gewerke.includes('__proto__')));
  assert.ok(lkwSchrittHtml({ gewerke: ['__proto__', 'Licht'], einst: { gewerke: cfgs }, stueckVon: { constructor: 1 } }).includes('__proto__'));
});

test('freieLkwFuer: Einzel-LKW-Plan mit Ladung zählt den LKW, den convertToMulti anlegt', () => {
  assert.equal(freieLkwFuer(emptyPlan('p', 'P', TRUCK.id)), MAX_LKW);
  assert.equal(freieLkwFuer({ ...emptyPlan('p', 'P', TRUCK.id), placements: [{ id: 'a' }] }), MAX_LKW - 1);
  assert.equal(freieLkwFuer({ lkws: [{ id: 'a' }, { id: 'b' }], placements: [] }), MAX_LKW - 2);
  assert.equal(freieLkwFuer(null), MAX_LKW);
});

test('uebersichtHtml: rote Zeilen nur in Boxen öffnen den Reiter Boxen', () => {
  const rows = [['Hinweis'], SPALTEN.boxen.map(s => s.de), ['x', '1', '', '', '', '', '', '']];
  const eintraege = werteZeilen('boxen', rows, erkenneReiter(rows));
  const z = zusammenfassung(eintraege);
  const html = uebersichtHtml({ ...z, rot: 1, rotBoxen: 1 }, auffaelligkeiten(eintraege));
  assert.match(html, /data-filter="bad" data-tab="boxen"/);
  const html2 = uebersichtHtml({ ...z, rot: 1, rotBoxen: 0 }, []);
  assert.match(html2, /data-filter="bad" data-tab="cases"/);
});

test('Struktursperre: keine Datei unter js/ui/ importiert aus ../app/', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../js/ui/', import.meta.url);
  for (const f of readdirSync(dir).filter(x => x.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /from\s+['"]\.\.\/app\//, f);
  }
});
