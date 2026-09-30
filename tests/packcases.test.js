import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { validatePlan } from '../js/model/validate.js';
import { groupCases } from '../js/ui/caseGroups.js';
import { mkTruck } from './fixtures.js';

// Aufräumen der Case-Datenbank (Nutzerwunsch 2026-09-28): leere Standard-Pack-/Kabelcases mit
// gleichem Maß sind dasselbe Case – je Maß ein neutrales „Packcase L×B×H“ mit 0 kg. Cases mit
// konkreter Inhaltsangabe (Powerlocksatz, Multicore, Laka Loom …) bleiben. Die Traversen aus der
// Liste fallen weg (Traversenwagen baut man über „+ Traverse hinzufügen“). Ersetzte Einträge
// werden nur ausgeblendet (legacy), damit alte Ladepläne weiter laden.
const ALL = [...PRESET_CASES, ...CASE_LIBRARY];
const byId = id => ALL.find(c => c.id === id);
const visible = ALL.filter(c => !c.legacy);

const PACK_DIMS = [[60, 60, 60], [60, 60, 73], [80, 60, 60], [120, 60, 60], [120, 60, 73], [120, 60, 80], [120, 80, 80]];
const REPLACED = [
  'preset-pack-60x60x60', 'preset-pack-80x60x60', 'preset-pack-120x80x80',
  'preset-kabel-120x60x60', 'preset-kabel-120x60x80',
  'lib-packwuerfel-bbm', 'lib-transflex-klein-wuerfel-cab', 'lib-packcase-transflex-bbm', 'lib-transflex-gross-cab',
];
const TRUSS_OUT = ['lib-mlt-120-x2-cab', 'lib-mlt-160-x2-cab', 'lib-mlt-240-x2-cab', 'lib-trussdolly-40er-bbm', 'lib-truss-lose-40er-bbm'];

test('je Standardmaß genau ein sichtbares Packcase, Gewicht nach Volumen, Name nach Maß', () => {
  const packs = visible.filter(c => c.name.startsWith('Packcase '));
  assert.equal(packs.length, PACK_DIMS.length);
  for (const [l, w, h] of PACK_DIMS) {
    const hit = packs.filter(c => c.l === l && c.w === w && c.h === h);
    assert.equal(hit.length, 1, `${l}×${w}×${h}`);
    assert.equal(hit[0].name, `Packcase ${l}×${w}×${h}`);
    // Nutzerangabe 2026-09-30: Standard-Packcase 120×60×80 (120×60×60 plus Rollen) = 100 kg, die übrigen nach Volumen.
    assert.equal(hit[0].weight, Math.round(100 * l * w * h / (120 * 60 * 80)), `${l}×${w}×${h}`);
    assert.equal(hit[0].id, `preset-packcase-${l}x${w}x${h}`);
    assert.equal(hit[0].tippable, true);
    assert.equal(hit[0].stackable, true);
  }
});

test('Packcase-Gewichte: Tabelle der Nutzerangabe', () => {
  const w = dims => visible.find(c => c.name === `Packcase ${dims}`).weight;
  assert.deepEqual(
    ['60×60×60', '60×60×73', '80×60×60', '120×60×60', '120×60×73', '120×60×80', '120×80×80'].map(w),
    [38, 46, 50, 75, 91, 100, 133]);
  assert.equal(byId('preset-pack-120x80x80').weight, 150, 'legacy-Eintrag behält sein altes Gewicht');
});

test('ersetzte Einträge und Listen-Traversen existieren weiter, sind aber ausgeblendet', () => {
  for (const id of [...REPLACED, ...TRUSS_OUT]) {
    const c = byId(id);
    assert.ok(c, `${id} fehlt – alte Ladepläne würden ihn nicht mehr finden`);
    assert.equal(c.legacy, true, id);
  }
  const { presets, list } = groupCases(ALL);
  const shown = new Set([...presets, ...list].map(c => c.id));
  for (const id of [...REPLACED, ...TRUSS_OUT]) assert.ok(!shown.has(id), id);
});

test('Maße der ausgeblendeten Einträge sind unverändert (Altdaten)', () => {
  const expect = {
    'lib-transflex-gross-cab': [120, 60, 73], 'lib-packwuerfel-bbm': [60, 60, 73],
    'preset-kabel-120x60x60': [120, 60, 60], 'lib-mlt-160-x2-cab': [165, 60.5, 210],
  };
  for (const [id, [l, w, h]] of Object.entries(expect)) {
    const c = byId(id);
    assert.deepEqual([c.l, c.w, c.h], [l, w, h], id);
  }
});

test('Regression: Plan im alten Schema mit ausgeblendeten Case-Typen lädt ohne „fehlender Case-Typ“', () => {
  const plan = {
    id: 'alt', name: 'Alt', truckId: 't', notes: '', unplaced: [],
    placements: [
      { id: 'a', caseId: 'lib-transflex-gross-cab', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 },
      { id: 'b', caseId: 'preset-kabel-120x60x60', x: 200, y: 0, z: 0, orientation: 'standing', rot: 0 },
    ],
  };
  const r = validatePlan(plan, new Map(ALL.map(c => [c.id, c])), mkTruck());
  assert.equal(r.items.length, 2);
  assert.ok(!r.issues.some(i => i.code === 'missingCase'), JSON.stringify(r.issues));
  assert.deepEqual(r.items.find(i => i.id === 'a').box, { x0: 0, y0: 0, z0: 0, x1: 120, y1: 60, z1: 73 });
});

test('Cases mit Inhaltsangabe bleiben sichtbar, auch bei gleichem Maß', () => {
  for (const name of ['Laka Loom 45m -CAB', 'Multicore -CAB', 'Multicore LK24 -CAB', 'Powerlocksatz 10m -CAB', 'D8+ 0,25t CAB', 'D8+ 0,5t CAB']) {
    const c = visible.find(x => x.name === name);
    assert.ok(c, name);
  }
});
