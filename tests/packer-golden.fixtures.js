// Feste Packer-Eingaben für tests/packer-golden.test.js. Bewusst von Hand gebaut und unabhängig von
// den Vorlagen unter js/data/ (deren Maße sich ändern dürfen). Keine Zufallswerte.
import { autoPack } from '../js/model/packer.js';
import { dollyStackCase } from '../js/model/audioDolly.js';
import { mkCase, mkTruck, SPRINTER } from './fixtures.js';

const piece = (c, id, extra = {}) => ({ id, caseId: c.id, c, ...extra });
const many = (c, n, pre, extra = {}) => Array.from({ length: n }, (_, i) => piece(c, `${pre}${i + 1}`, extra));
const trussCase = (id, l, w, h, extra = {}) =>
  mkCase(id, l, w, h, { kind: 'truss', truss: { length: l, width: w, count: 1, standing: true, height: h }, ...extra });

export const FIXTURES = {
  light() {
    const a = mkCase('a', 120, 80, 100, { weight: 80 }), b = mkCase('b', 60, 40, 50, { weight: 20 });
    return { items: [...many(a, 3, 'a'), ...many(b, 3, 'b')], truck: mkTruck() };
  },
  mixed() {
    const amp = mkCase('amp', 80, 60, 60, { weight: 70, tippable: true, category: 'Audio', maxTopLoad: 150 });
    const rack = mkCase('rack', 60, 60, 90, { weight: 90, category: 'Audio' });
    const lamp = mkCase('lamp', 100, 50, 40, { weight: 25, category: 'Licht', tippable: true });
    const big = mkCase('big', 200, 100, 120, { weight: 200, category: 'Bühne', stackable: false });
    const fl = mkCase('fl', 120, 60, 30, { weight: 15, category: 'Licht', layers: [2, 3, 4] });
    return {
      items: [...many(amp, 7, 'amp'), ...many(rack, 5, 'rack'), ...many(lamp, 8, 'lamp'), ...many(big, 2, 'big'),
        ...many(fl, 4, 'fl'), ...many(rack, 2, 'grp', { group: 'Motoren' })],
      truck: mkTruck(),
    };
  },
  overfull() {
    const a = mkCase('a', 100, 60, 70, { weight: 60, tippable: true });
    const b = mkCase('b', 120, 80, 100, { weight: 110 });
    const c = mkCase('c', 80, 50, 40, { weight: 30 });
    const d = mkCase('d', 150, 90, 150, { weight: 180, stackable: false });
    return {
      items: [...many(a, 14, 'a'), ...many(b, 10, 'b'), ...many(c, 12, 'c'), ...many(d, 6, 'd')],
      truck: SPRINTER,
    };
  },
  overfullSmall() {
    const a = mkCase('a', 60, 40, 45, { weight: 12 }), b = mkCase('b', 80, 50, 35, { weight: 20, tippable: true });
    const c = mkCase('c', 50, 50, 50, { weight: 18 });
    return { items: [...many(a, 30, 'a'), ...many(b, 25, 'b'), ...many(c, 22, 'c')], truck: mkTruck({ l: 300, w: 178, h: 150 }) };
  },
  // Eine Sorte (ein Case-Typ), aber Stapel mit verschiedenen Grundflächen: das Feld `tipped` je Stück
  // erzwingt stehend bzw. getippt. Überfüllt, mit Hindernis.
  tippedMix() {
    const t = mkCase('t', 90, 55, 40, { weight: 30, tippable: true });
    const items = Array.from({ length: 36 }, (_, i) => piece(t, `t${i + 1}`, i % 3 === 0 ? { tipped: true } : i % 3 === 1 ? { tipped: false } : {}));
    const obstacle = { x0: 0, y0: 30, z0: 0, x1: 70, y1: 100, z1: 60 };
    return { items, truck: mkTruck({ l: 260, w: 150, h: 120 }), opts: { obstacles: [obstacle] } };
  },
  truss() {
    const wagon = trussCase('wagon', 240, 62, 60, { weight: 120, stackable: true, category: 'Rigging' });
    const stand = trussCase('stand', 300, 62, 115, { weight: 150, stackable: false, category: 'Rigging' });
    const box = mkCase('box', 100, 60, 70, { weight: 50, category: 'Licht' });
    return { items: [...many(wagon, 6, 'w'), ...many(stand, 2, 's'), ...many(box, 9, 'b')], truck: mkTruck() };
  },
  dolly() {
    const k2 = mkCase('preset-k2', 135, 53, 53, { weight: 56, category: 'Audio', speakerType: 'line', cabinetColor: '#222222' });
    const d2 = dollyStackCase(k2, 2), d3 = dollyStackCase(k2, 3, { l: 135, w: 80 });
    const sub = mkCase('sub', 100, 70, 80, { weight: 60, category: 'Audio' });
    return { items: [...many(d2, 4, 'd2'), ...many(d3, 3, 'd3'), ...many(sub, 6, 'sub')], truck: mkTruck() };
  },
  mixTop() {
    const big = mkCase('big', 120, 80, 60, { weight: 120, category: 'Audio', maxTopLoad: 200 });
    const mid = mkCase('mid', 100, 60, 50, { weight: 40, category: 'Audio' });
    const sm = mkCase('sm', 60, 40, 40, { weight: 15, category: 'Audio' });
    const li = mkCase('li', 60, 40, 40, { weight: 15, category: 'Licht' });
    return {
      items: [...many(big, 4, 'big'), ...many(mid, 3, 'mid'), ...many(sm, 6, 'sm'), ...many(li, 3, 'li'),
        ...many(sm, 2, 'gs', { group: 'Motoren' })],
      truck: mkTruck({ l: 500 }),
      opts: { mixTop: true, rules: [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }, { by: 'count' }] },
    };
  },
  obstacles() {
    const a = mkCase('a', 100, 60, 80, { weight: 70 }), b = mkCase('b', 60, 60, 60, { weight: 30 });
    const obstacle = { x0: 0, y0: 0, z0: 0, x1: 150, y1: 120, z1: 100 };
    return { items: [...many(a, 6, 'a'), ...many(b, 7, 'b')], truck: mkTruck({ l: 600 }), opts: { obstacles: [obstacle], startX: 100, order: 'count' } };
  },
};

// Kurzform der Ausgabe: Platzierungen als Zeichenketten, Ablage als IDs.
export function snapshot({ items, truck, opts = {} }) {
  const r = autoPack(items, truck, opts);
  return {
    placements: r.placements.map(p => `${p.id}@${p.x},${p.y},${p.z}/${p.rot}/${p.orientation}`),
    unplaced: r.unplaced.map(u => u.id),
  };
}
