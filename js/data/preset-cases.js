import { colorFor } from './categories.js';
import { trussDims } from '../model/truss.js';

const NOTE = 'Richtwert – Maße und Gewicht an dein Case anpassen';
const P = (id, name, category, l, w, h, weight, opts = {}) => ({
  id: `preset-${id}`, builtin: true, name, content: '', category, color: colorFor(category),
  l, w, h, weight, tippable: true, stackable: true, maxTopLoad: null, stock: null, wheelH: 12,
  dimsInclWheels: true, note: NOTE, ...opts,
});
// F34 (34er) ≈ 6 kg/m, F44 (40er) ≈ 8 kg/m Traversengewicht; Wagen (Paar) ≈ 2 × 12 kg.
const KG_PER_M = { 29: 6, 40: 8 };
const DOLLY_KG = 2 * 12;
const T = (id, name, length, width, count) => {
  const truss = { length, width, count };
  const { l, w, h } = trussDims(truss);
  const weight = Math.round((length / 100) * count * KG_PER_M[width] + DOLLY_KG);
  return P(id, name, 'Rigging', l, w, h, weight,
    { kind: 'truss', truss, tippable: false, wheelH: 0, layers: [1, 2] });
};

// Truckmaß (EU): Breiten 60/80/120 cm, gehen in 240 cm Innenbreite auf (Megacase, Gäng-Case).
export const PRESET_CASES = [
  P('kabel-120x60x60', 'Kabelcase Truckmaß 120×60×60', 'Strom', 120, 60, 60, 110),
  P('kabel-120x60x80', 'Kabelcase Truckmaß 120×60×80', 'Strom', 120, 60, 80, 140),
  P('pack-80x60x60', 'Packcase Truckmaß 80×60×60', 'Sonstiges', 80, 60, 60, 70),
  P('pack-60x60x60', 'Packcase Truckmaß 60×60×60', 'Sonstiges', 60, 60, 60, 50),
  P('pack-120x80x80', 'Packcase Truckmaß 120×80×80', 'Sonstiges', 120, 80, 80, 150),
  P('rack-12he', '19″-Rack 12 HE auf Rollen', 'Ton', 80, 60, 85, 90, { tippable: false }),
  P('rack-20he', '19″-Rack 20 HE auf Rollen', 'Ton', 80, 60, 120, 140, { tippable: false, maxTopLoad: 80, layers: [1] }),
  P('mh-2er', 'Moving-Head-Case (2 Stück)', 'Licht', 120, 60, 85, 120, { tippable: false }),
  P('led-8er', 'LED-Wall-Case (8 Panels)', 'Video', 120, 60, 110, 220, { tippable: false, layers: [1, 2] }),
  P('distro-63a', 'Stromverteiler 63 A', 'Strom', 80, 60, 90, 110, { tippable: false }),
  P('foh-pult', 'FOH-Pult-Case', 'Ton', 150, 80, 110, 160, { tippable: false, stackable: false, layers: [1] }),
  T('truss-34-3m', 'Traversenwagen 34er 3 m (4 Stück)', 300, 29, 4),
  T('truss-34-2m', 'Traversenwagen 34er 2 m (4 Stück)', 200, 29, 4),
  T('truss-40-3m', 'Traversenwagen 40er 3 m (4 Stück)', 300, 40, 4),
  // Legacy (V0.2) – nicht mehr in der Bibliothek gelistet, bleiben aber für alte Ladepläne bestehen.
  P('truss-29-3m', 'Traverse 29er Dreipunkt 3 m', 'Rigging', 300, 29, 29, 15, { tippable: false, wheelH: 0, legacy: true }),
  P('truss-dolly', 'Traversen-Dolly 29er (8× 2 m)', 'Rigging', 200, 60, 70, 180, { tippable: false, legacy: true }),
];
