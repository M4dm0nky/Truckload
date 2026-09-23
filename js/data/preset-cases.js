import { colorFor } from './categories.js';
import { trussDims, STAND_FOOTPRINT_W, wagonWeight } from '../model/truss.js';

const NOTE = 'Richtwert – Maße und Gewicht an dein Case anpassen';
const P = (id, name, category, l, w, h, weight, opts = {}) => ({
  id: `preset-${id}`, builtin: true, name, content: '', category, color: colorFor(category),
  l, w, h, weight, tippable: true, stackable: true, maxTopLoad: null, stock: null, wheelH: 12,
  dimsInclWheels: true, note: NOTE, ...opts,
});
// F34 (34er) ≈ 6 kg/m, F44 (40er) ≈ 8 kg/m Traversengewicht; Wagen (Paar) ≈ 2 × 12 kg.
// (Gewichtsformel exportiert als wagonWeight() aus model/truss.js, damit Task 3 sie wiedernutzen kann)
const T = (id, name, length, width, count) => {
  const truss = { length, width, count };
  const { l, w, h } = trussDims(truss);
  const weight = wagonWeight(length, width, count);
  return P(id, name, 'Rigging', l, w, h, weight,
    { kind: 'truss', truss, tippable: false, wheelH: 0, layers: [1, 2] });
};
// Pre-Rig-Traversen (H.O.F. MLT/Prolyte S36PR): EIN Stück ist EINE stehende Traverse auf Beinen/
// Rollwagen (standing:true, count immer 1) – anders als T() oben, das mehrere Stücke auf einen
// Standfläche ist STAND_FOOTPRINT_W (62 cm - 4 Stück nebeneinander im 40-Tonner), Höhe je
// Modell (standH). BASE_KG ist ein Richtwert für Grundplatte+Beine+Rollen (kein Herstellerwert,
// s. docs/mlt-truss-gewichte.md) – das Stückgewicht selbst ist recherchiert.
const BASE_KG = 25;
const MLT = (id, name, length, pieceWeight, standH) => {
  const truss = { length, width: STAND_FOOTPRINT_W, count: 1, standing: true, height: standH };
  const { l, w, h } = trussDims(truss);
  const weight = Math.round(pieceWeight + BASE_KG);
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
  // Pre-Rig-Traversen (Moving-Light-Truss): EIN Stück ist EINE stehende Traverse auf Beinen/
  // Rollwagen, keine gestapelten Mehrfachstücke (s. MLT() oben). Stückgewichte und Standhöhe
  // recherchiert, siehe docs/mlt-truss-gewichte.md. MLT ONE steht niedriger (kein eigener
  // Rollwagen-Tisch), TWO/THREE/FOUR und Prolyte S36PR (kein eigenes „MLT“ bei Prolyte, S36PRF/
  // S36PRA ist der Gegenpart) stehen alle auf demselben Rollwagen-Aufbau.
  MLT('hof-mlt1-160', 'Traversenwagen MLT ONE 1,6 m – H.O.F.', 160, 28.5, 75),
  MLT('hof-mlt1-240', 'Traversenwagen MLT ONE 2,4 m – H.O.F.', 240, 38.8, 75),
  MLT('hof-mlt1-320', 'Traversenwagen MLT ONE 3,2 m – H.O.F.', 320, 46.6, 75),
  MLT('hof-mlt2-120', 'Traversenwagen MLT TWO 1,2 m – H.O.F.', 120, 36.8, 103),
  MLT('hof-mlt2-160', 'Traversenwagen MLT TWO 1,6 m – H.O.F.', 160, 41.8, 103),
  MLT('hof-mlt2-200', 'Traversenwagen MLT TWO 2,0 m – H.O.F.', 200, 46.7, 103),
  MLT('hof-mlt2-240', 'Traversenwagen MLT TWO 2,4 m – H.O.F.', 240, 50.8, 103),
  MLT('hof-mlt2-300', 'Traversenwagen MLT TWO 3,0 m – H.O.F.', 300, 57.7, 103),
  MLT('hof-mlt2-320', 'Traversenwagen MLT TWO 3,2 m – H.O.F.', 320, 60.1, 103),
  MLT('hof-mlt3-120', 'Traversenwagen MLT THREE 1,2 m – H.O.F.', 120, 34.7, 103),
  MLT('hof-mlt3-160', 'Traversenwagen MLT THREE 1,6 m – H.O.F.', 160, 39.4, 103),
  MLT('hof-mlt3-200', 'Traversenwagen MLT THREE 2,0 m – H.O.F.', 200, 44.4, 103),
  MLT('hof-mlt3-240', 'Traversenwagen MLT THREE 2,4 m – H.O.F.', 240, 48.9, 103),
  MLT('hof-mlt3-300', 'Traversenwagen MLT THREE 3,0 m – H.O.F.', 300, 55.6, 103),
  MLT('hof-mlt3-320', 'Traversenwagen MLT THREE 3,2 m – H.O.F.', 320, 58.0, 103),
  MLT('hof-mlt4-150', 'Traversenwagen MLT FOUR 1,5 m – H.O.F.', 150, 60.0, 103),
  MLT('hof-mlt4-240', 'Traversenwagen MLT FOUR 2,4 m – H.O.F.', 240, 71.5, 103),
  MLT('hof-mlt4-300', 'Traversenwagen MLT FOUR 3,0 m – H.O.F.', 300, 83.5, 103),
  MLT('prolyte-s36prf-122', 'Traversenwagen S36PRF fest 1,22 m – Prolyte', 122, 25.27, 103),
  MLT('prolyte-s36prf-244', 'Traversenwagen S36PRF fest 2,44 m – Prolyte', 244, 37.10, 103),
  MLT('prolyte-s36prf-305', 'Traversenwagen S36PRF fest 3,05 m – Prolyte', 305, 43.20, 103),
  MLT('prolyte-s36pra-122', 'Traversenwagen S36PRA flexibel 1,22 m – Prolyte', 122, 27.00, 103),
  MLT('prolyte-s36pra-244', 'Traversenwagen S36PRA flexibel 2,44 m – Prolyte', 244, 38.70, 103),
  MLT('prolyte-s36pra-305', 'Traversenwagen S36PRA flexibel 3,05 m – Prolyte', 305, 45.16, 103),
  // Legacy (V0.2) – nicht mehr in der Bibliothek gelistet, bleiben aber für alte Ladepläne bestehen.
  P('truss-29-3m', 'Traverse 29er Dreipunkt 3 m', 'Rigging', 300, 29, 29, 15, { tippable: false, wheelH: 0, legacy: true }),
  P('truss-dolly', 'Traversen-Dolly 29er (8× 2 m)', 'Rigging', 200, 60, 70, 180, { tippable: false, legacy: true }),
];
