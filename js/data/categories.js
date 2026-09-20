export const CATEGORIES = [
  { name: 'Licht', color: '#e8b10c' },
  { name: 'Ton', color: '#3b7dd8' },
  { name: 'Video', color: '#8a5cd6' },
  { name: 'Rigging', color: '#6b7a8f' },
  { name: 'Strom', color: '#e8741c' },
  { name: 'Bühne', color: '#a07845' },
  { name: 'Backline', color: '#1fa67a' },
  { name: 'Sonderbau', color: '#c1443f' },
  { name: 'Sonstiges', color: '#9aa3ad' },
];
export const colorFor = name =>
  (CATEGORIES.find(c => c.name === name) ?? CATEGORIES.at(-1)).color;
