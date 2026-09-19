const NOTE = 'Richtwert – mit dem echten Fahrzeug abgleichen';
const T = (id, name, l, w, h, payload, wheelArches = []) =>
  ({ id: `preset-${id}`, builtin: true, name, l, w, h, payload, wheelArches, note: NOTE });

export const PRESET_TRUCKS = [
  T('sprinter', 'Transporter (Sprinter L3H2)', 430, 178, 194, 1000,
    [{ x: 215, l: 100, w: 22, h: 30, side: 'both' }]),
  T('koffer35', '3,5-t-Koffer', 420, 210, 220, 900),
  T('lkw75', 'LKW 7,5 t', 620, 245, 240, 2800),
  T('lkw12', 'LKW 12 t', 720, 245, 250, 5000),
  T('sattel', 'Sattelauflieger Standard', 1360, 248, 270, 24000),
  T('mega', 'Megatrailer', 1360, 248, 300, 24000),
];
export const DEFAULT_TRUCK_ID = 'preset-sattel';
