const NOTE = 'Richtwert – mit dem echten Fahrzeug abgleichen';
const T = (id, name, l, w, h, payload, wheelArches = []) =>
  ({ id: `preset-${id}`, builtin: true, name, l, w, h, payload, wheelArches, note: NOTE });

// Innenmaße aus Verleiherangeboten und Branchenseiten (Quellen: docs/fahrzeugmasse.md) – Richtwerte,
// keine Herstellerdatenblätter. Alte IDs bleiben, damit gespeicherte Pläne weiter laden.
export const PRESET_TRUCKS = [
  // Sprinter: Radkästen zwischen ca. 130 cm Breite; Nutzlast kurz = Richtwert wie lang (keine eigene Quelle).
  T('sprinter-kurz', 'Sprinter kurz', 337, 178, 205, 1000,
    [{ x: 170, l: 100, w: 22, h: 30, side: 'both' }]),
  T('sprinter', 'Sprinter lang', 430, 178, 194, 1000,
    [{ x: 215, l: 100, w: 22, h: 30, side: 'both' }]),
  T('koffer35', '3,5-t-Koffer', 420, 210, 220, 900),
  T('lkw75', '7,5-t-Koffer', 610, 250, 240, 2500),
  T('lkw12', '12-t-Koffer', 720, 248, 230, 5100),
  T('lkw18', '18-t-Koffer', 730, 248, 260, 9000),
  T('sattel', 'Trailer 40 t Koffer', 1362, 248, 270, 24000),
  T('mega', 'Trailer 40 t Koffer extra hoch', 1362, 248, 300, 24000),
  T('gardine', 'Trailer 40 t Gardine', 1362, 248, 270, 24000),
];
export const DEFAULT_TRUCK_ID = 'preset-sattel';
