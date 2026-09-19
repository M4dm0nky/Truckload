import { colorFor } from './categories.js';

const NOTE = 'Richtwert – Maße und Gewicht an dein Case anpassen';
const P = (id, name, category, l, w, h, weight, opts = {}) => ({
  id: `preset-${id}`, builtin: true, name, content: '', category, color: colorFor(category),
  l, w, h, weight, tippable: true, stackable: true, maxTopLoad: null, stock: null, note: NOTE, ...opts,
});

// Truckmaß (EU): Breiten 60/80/120 cm, gehen in 240 cm Innenbreite auf (Megacase, Gäng-Case).
// Truck Pack (US): 22,5″-Raster, Höhe 30″ inkl. Rollen (OSP, Gator, Brady).
export const PRESET_CASES = [
  P('kabel-120x60x60', 'Kabelcase Truckmaß 120×60×60', 'Strom', 120, 60, 60, 110),
  P('kabel-120x60x80', 'Kabelcase Truckmaß 120×60×80', 'Strom', 120, 60, 80, 140),
  P('pack-80x60x60', 'Packcase Truckmaß 80×60×60', 'Sonstiges', 80, 60, 60, 70),
  P('pack-60x60x60', 'Packcase Truckmaß 60×60×60', 'Sonstiges', 60, 60, 60, 50),
  P('pack-120x80x80', 'Packcase Truckmaß 120×80×80', 'Sonstiges', 120, 80, 80, 150),
  P('us-full', 'Truck Pack 45×22,5×30″ (US)', 'Sonstiges', 114, 57, 76, 120),
  P('us-half', 'Truck Pack ½ 30×22,5×30″ (US)', 'Sonstiges', 76, 57, 76, 80),
  P('us-quarter', 'Truck Pack ¼ 22,5×22,5×30″ (US)', 'Sonstiges', 57, 57, 76, 55),
  P('rack-12he', '19″-Rack 12 HE auf Rollen', 'Ton', 80, 60, 85, 90, { tippable: false }),
  P('rack-20he', '19″-Rack 20 HE auf Rollen', 'Ton', 80, 60, 120, 140, { tippable: false, maxTopLoad: 80 }),
  P('mh-2er', 'Moving-Head-Case (2 Stück)', 'Licht', 120, 60, 85, 120, { tippable: false }),
  P('led-8er', 'LED-Wall-Case (8 Panels)', 'Video', 120, 60, 110, 220, { tippable: false }),
  P('distro-63a', 'Stromverteiler 63 A', 'Strom', 80, 60, 90, 110, { tippable: false }),
  P('foh-pult', 'FOH-Pult-Case', 'Ton', 150, 80, 110, 160, { tippable: false, stackable: false }),
  P('truss-29-3m', 'Traverse 29er Dreipunkt 3 m', 'Rigging', 300, 29, 29, 15, { tippable: false }),
  P('truss-dolly', 'Traversen-Dolly 29er (8× 2 m)', 'Rigging', 200, 60, 70, 180, { tippable: false }),
];
