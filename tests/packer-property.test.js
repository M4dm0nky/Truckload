// Eigenschaftstest für den Packer (2.4): 50 zufällige Case-Mischungen mit festem Seed. Nach packAll
// darf validatePlan weder eine Kollision noch einen Überstand melden, und keine Stück darf
// verloren gehen. Der Zufallsgenerator ist mulberry32 (hier eingebaut, keine Abhängigkeit).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/model/actions.js';
import { validatePlan } from '../js/model/validate.js';
import { mkCase, mkTruck, SPRINTER, P, plan, byId, counter } from './fixtures.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = Array.from({ length: 50 }, (_, i) => 1000 + i);
const VIOLATIONS = ['collision', 'outOfBounds', 'arch'];
const CATEGORIES = ['Audio', 'Licht', 'Rigging', 'Bühne'];

function scenario(seed) {
  const r = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const truck = r() < 0.3 ? SPRINTER : mkTruck({
    l: int(250, 1000), w: int(160, 248), h: int(150, 270),
    wheelArches: r() < 0.4 ? [{ x: int(40, 150), l: int(60, 120), w: int(15, 30), h: int(20, 35), side: ['left', 'right', 'both'][int(0, 2)] }] : [],
  });
  const cases = Array.from({ length: int(2, 8) }, (_, i) => {
    const truss = r() < 0.15;
    const l = int(30, 220), w = int(25, 110), h = int(15, 130);
    return mkCase(`t${i}`, l, w, h, {
      weight: int(0, 180), stackable: r() < 0.7, tippable: !truss && r() < 0.4,
      category: CATEGORIES[int(0, 3)], maxTopLoad: r() < 0.3 ? int(20, 250) : null,
      layers: r() < 0.2 ? [[1], [1, 2], [2, 3, 4]][int(0, 2)] : undefined,
      ...(truss ? { kind: 'truss', truss: { length: l, width: w, count: 1, standing: true, height: h } } : {}),
    });
  });
  const unplaced = Array.from({ length: int(5, 70) }, (_, i) => {
    const c = cases[int(0, cases.length - 1)];
    return { id: `u${i}`, caseId: c.id, ...(r() < 0.15 ? { group: 'Motoren' } : {}) };
  });
  let pl = plan([], unplaced);
  if (r() < 0.5) pl = { ...pl, mixTop: true };
  if (r() < 0.5) pl = { ...pl, packRules: [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }, { by: 'count' }] };
  return { truck, caseById: byId(...cases), plan: pl, count: unplaced.length };
}

for (const seed of SEEDS) {
  test(`Packer-Eigenschaft (Seed ${seed}): keine Kollision, kein Überstand, nichts geht verloren`, () => {
    const { truck, caseById, plan: input, count } = scenario(seed);
    const packed = A.packAll(input, { truck, caseById, newId: counter('n') });
    const report = validatePlan(packed, caseById, truck);
    const bad = report.issues.filter(i => VIOLATIONS.includes(i.code)).map(i => `${i.code}: ${i.message}`);
    assert.deepEqual(bad, [], `Seed ${seed}`);
    assert.equal(packed.placements.length + packed.unplaced.length, count, `Seed ${seed}`);
    assert.equal(new Set([...packed.placements, ...packed.unplaced].map(x => x.id)).size, count, `Seed ${seed}: IDs doppelt`);
  });
}

test('Packer-Eigenschaft: die 50 Seeds liefern sowohl voll verladene als auch überfüllte Lasten', () => {
  let full = 0, over = 0;
  for (const seed of SEEDS) {
    const { truck, caseById, plan: input } = scenario(seed);
    const packed = A.packAll(input, { truck, caseById, newId: counter('n') });
    if (packed.unplaced.length) over++; else full++;
  }
  assert.ok(full >= 5 && over >= 5, `voll ${full}, überfüllt ${over}`);
});
