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
// Wie T(), aber mit recherchiertem Stückgewicht statt kg/m-Formel (echte Herstellerwerte je
// Modell/Länge, keine Näherung) – Quellen in docs/mlt-truss-gewichte.md.
const TR = (id, name, length, width, count, pieceWeight) => {
  const truss = { length, width, count };
  const { l, w, h } = trussDims(truss);
  const weight = Math.round(pieceWeight * count + DOLLY_KG);
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
  // MLT-Traversenwagen (Moving-Light-Truss): Stückgewichte recherchiert, siehe
  // docs/mlt-truss-gewichte.md. H.O.F. MLT ONE/TWO/THREE (29 cm) und MLT FOUR (40 cm);
  // Prolyte führt keine MLT-Baureihe, S36PRF/S36PRA (36 cm) ist der Gegenpart.
  TR('hof-mlt1-160', 'Traversenwagen MLT ONE 1,6 m (4 Stück) – H.O.F.', 160, 29, 4, 28.5),
  TR('hof-mlt1-240', 'Traversenwagen MLT ONE 2,4 m (4 Stück) – H.O.F.', 240, 29, 4, 38.8),
  TR('hof-mlt1-320', 'Traversenwagen MLT ONE 3,2 m (4 Stück) – H.O.F.', 320, 29, 4, 46.6),
  TR('hof-mlt2-120', 'Traversenwagen MLT TWO 1,2 m (4 Stück) – H.O.F.', 120, 29, 4, 36.8),
  TR('hof-mlt2-160', 'Traversenwagen MLT TWO 1,6 m (4 Stück) – H.O.F.', 160, 29, 4, 41.8),
  TR('hof-mlt2-200', 'Traversenwagen MLT TWO 2,0 m (4 Stück) – H.O.F.', 200, 29, 4, 46.7),
  TR('hof-mlt2-240', 'Traversenwagen MLT TWO 2,4 m (4 Stück) – H.O.F.', 240, 29, 4, 50.8),
  TR('hof-mlt2-300', 'Traversenwagen MLT TWO 3,0 m (4 Stück) – H.O.F.', 300, 29, 4, 57.7),
  TR('hof-mlt2-320', 'Traversenwagen MLT TWO 3,2 m (4 Stück) – H.O.F.', 320, 29, 4, 60.1),
  TR('hof-mlt3-120', 'Traversenwagen MLT THREE 1,2 m (4 Stück) – H.O.F.', 120, 29, 4, 34.7),
  TR('hof-mlt3-160', 'Traversenwagen MLT THREE 1,6 m (4 Stück) – H.O.F.', 160, 29, 4, 39.4),
  TR('hof-mlt3-200', 'Traversenwagen MLT THREE 2,0 m (4 Stück) – H.O.F.', 200, 29, 4, 44.4),
  TR('hof-mlt3-240', 'Traversenwagen MLT THREE 2,4 m (4 Stück) – H.O.F.', 240, 29, 4, 48.9),
  TR('hof-mlt3-300', 'Traversenwagen MLT THREE 3,0 m (4 Stück) – H.O.F.', 300, 29, 4, 55.6),
  TR('hof-mlt3-320', 'Traversenwagen MLT THREE 3,2 m (4 Stück) – H.O.F.', 320, 29, 4, 58.0),
  TR('hof-mlt4-150', 'Traversenwagen MLT FOUR 1,5 m (4 Stück) – H.O.F.', 150, 40, 4, 60.0),
  TR('hof-mlt4-240', 'Traversenwagen MLT FOUR 2,4 m (4 Stück) – H.O.F.', 240, 40, 4, 71.5),
  TR('hof-mlt4-300', 'Traversenwagen MLT FOUR 3,0 m (4 Stück) – H.O.F.', 300, 40, 4, 83.5),
  TR('prolyte-s36prf-122', 'Traversenwagen S36PRF fest 1,22 m (4 Stück) – Prolyte', 122, 36, 4, 25.27),
  TR('prolyte-s36prf-244', 'Traversenwagen S36PRF fest 2,44 m (4 Stück) – Prolyte', 244, 36, 4, 37.10),
  TR('prolyte-s36prf-305', 'Traversenwagen S36PRF fest 3,05 m (4 Stück) – Prolyte', 305, 36, 4, 43.20),
  TR('prolyte-s36pra-122', 'Traversenwagen S36PRA flexibel 1,22 m (4 Stück) – Prolyte', 122, 36, 4, 27.00),
  TR('prolyte-s36pra-244', 'Traversenwagen S36PRA flexibel 2,44 m (4 Stück) – Prolyte', 244, 36, 4, 38.70),
  TR('prolyte-s36pra-305', 'Traversenwagen S36PRA flexibel 3,05 m (4 Stück) – Prolyte', 305, 36, 4, 45.16),
  // Legacy (V0.2) – nicht mehr in der Bibliothek gelistet, bleiben aber für alte Ladepläne bestehen.
  P('truss-29-3m', 'Traverse 29er Dreipunkt 3 m', 'Rigging', 300, 29, 29, 15, { tippable: false, wheelH: 0, legacy: true }),
  P('truss-dolly', 'Traversen-Dolly 29er (8× 2 m)', 'Rigging', 200, 60, 70, 180, { tippable: false, legacy: true }),
];
