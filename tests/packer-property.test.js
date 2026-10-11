// Eigenschaftstest für den Packer (2.4): 50 zufällige Case-Mischungen mit festem Seed. Nach packAll
// darf validatePlan weder eine Kollision noch einen Überstand melden, und keine Stück darf
// verloren gehen. Der Zufallsgenerator ist mulberry32 (hier eingebaut, keine Abhängigkeit).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/model/actions.js';
import { validatePlan } from '../js/model/validate.js';
import { boxOf } from '../js/model/geometry.js';
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

// Deckschicht mischen (mixTop): große Hauptstücke plus viele kleine, leichte Cases derselben
// Kategorie, damit Deckstücke nebeneinander entstehen. Geprüft wird in Weltkoordinaten.
const CAP_BAD = [...VIOLATIONS, 'unsupported', 'overload', 'notStackable', 'tooManyLayers', 'layer'];
const CAP_SEEDS = Array.from({ length: 500 }, (_, i) => 5000 + i);
const E = 1e-6;

function capScenario(seed) {
  const r = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const truck = r() < 0.3 ? SPRINTER : mkTruck({
    l: int(250, 900), w: int(160, 248), h: int(150, 270),
    wheelArches: r() < 0.3 ? [{ x: int(40, 150), l: int(60, 120), w: int(15, 30), h: int(20, 35), side: ['left', 'right', 'both'][int(0, 2)] }] : [],
  });
  const cats = CATEGORIES.slice(0, int(1, 2));
  const cases = Array.from({ length: int(2, 6) }, (_, i) => {
    const big = i === 0 || r() < 0.3;
    return mkCase(`c${i}`, big ? int(80, 130) : int(20, 70), big ? int(60, 90) : int(20, 60), int(20, 80), {
      weight: big ? int(80, 250) : int(5, 80), stackable: r() < 0.9, tippable: r() < 0.3,
      category: cats[int(0, cats.length - 1)], maxTopLoad: r() < 0.25 ? int(0, 300) : null,
      layers: r() < 0.1 ? [[1], [1, 2], [2, 3]][int(0, 2)] : undefined,
    });
  });
  const unplaced = Array.from({ length: int(6, 50) }, (_, i) => {
    const c = cases[int(0, cases.length - 1)];
    return { id: `u${i}`, caseId: c.id, ...(r() < 0.12 ? { group: 'Motoren' } : {}) };
  });
  return { truck, caseById: byId(...cases), plan: { ...plan([], unplaced), mixTop: true }, count: unplaced.length };
}

const overlapXY = (a, b) => a.x0 < b.x1 - E && b.x0 < a.x1 - E && a.y0 < b.y1 - E && b.y0 < a.y1 - E;
const containsXY = (u, x) => x.x0 >= u.x0 - E && x.x1 <= u.x1 + E && x.y0 >= u.y0 - E && x.y1 <= u.y1 + E;

test('Packer-Eigenschaft mit Deckschicht mischen: 500 Mischungen, Auflage, Validierung, Höhe', () => {
  let sideBySide = 0;
  for (const seed of CAP_SEEDS) {
    const { truck, caseById, plan: input, count } = capScenario(seed);
    const packed = A.packAll(input, { truck, caseById, newId: counter('n') });
    assert.equal(packed.placements.length + packed.unplaced.length, count, `Seed ${seed}`);
    assert.equal(new Set([...packed.placements, ...packed.unplaced].map(x => x.id)).size, count, `Seed ${seed}: IDs doppelt`);
    const bad = validatePlan(packed, caseById, truck).issues.filter(i => CAP_BAD.includes(i.code)).map(i => `${i.code}: ${i.message}`);
    assert.deepEqual(bad, [], `Seed ${seed}`);
    const boxes = packed.placements.map(p => ({ p, b: boxOf(caseById.get(p.caseId), p) }));
    for (const { p, b } of boxes) {
      assert.ok(b.z1 <= truck.h + E, `Seed ${seed}: ${p.id} ragt über die Fahrzeughöhe`);
      if (b.z0 < E) continue;
      // Jedes Stück über dem Boden liegt mit voller Grundfläche auf einem Stück, dessen Oberkante seine Unterkante ist.
      const under = boxes.filter(o => o.p !== p && Math.abs(o.b.z1 - b.z0) < E && containsXY(o.b, b));
      assert.ok(under.length >= 1, `Seed ${seed}: ${p.id} hängt über oder schwebt`);
      // Lastsumme: alle Stücke auf demselben Träger zusammen sind nicht schwerer als der Träger.
      const carrier = under[0];
      const onCarrier = boxes.filter(o => Math.abs(o.b.z0 - carrier.b.z1) < E && containsXY(carrier.b, o.b));
      const sum = onCarrier.reduce((t, o) => t + caseById.get(o.p.caseId).weight, 0);
      assert.ok(sum <= caseById.get(carrier.p.caseId).weight + E, `Seed ${seed}: Last auf ${carrier.p.id} (${sum} kg) übersteigt sein Gewicht`);
      // Nebeneinander: zwei Stücke auf demselben Träger überlappen sich nicht.
      for (const { p: q, b: bq } of boxes) {
        if (q === p || Math.abs(bq.z0 - b.z0) > E || !under.some(o => containsXY(o.b, bq))) continue;
        assert.ok(!overlapXY(b, bq), `Seed ${seed}: ${p.id} und ${q.id} überlappen`);
        if (p.id < q.id) sideBySide++;
      }
    }
  }
  assert.ok(sideBySide >= 20, `zu wenige Deckschichten nebeneinander: ${sideBySide}`);
});
