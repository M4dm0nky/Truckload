// Traversen-Katalog: Profile mit Querschnitt und Stückgewichten je Länge (data/traversen.json).
// Herkunft einer Zahl steht nur als `art` je Länge: hersteller, berechnet (kg/m × Länge) oder
// geschaetzt (Vergleichsprofil). Unbekanntes Gewicht ist 0, nie geraten.
import catalog from '../../data/traversen.json' with { type: 'json' };

export const TRUSS_CATALOG = catalog;

const MAX_HITS = 12;
const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, '');

export function searchProfiles(query) {
  const q = norm(query);
  if (!q) return [];
  return TRUSS_CATALOG.profiles
    .filter(p => norm(p.name).includes(q) || norm(p.hersteller + p.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_HITS);
}

export function profileById(id) {
  return TRUSS_CATALOG.profiles.find(p => p.id === id);
}

// Median der kg/m über alle Längen mit Gewicht; 0 ohne verwertbare Länge.
export function kgPerM(profile) {
  const v = (profile?.lengths ?? []).filter(l => l.kg > 0 && l.cm > 0).map(l => l.kg / (l.cm / 100)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function pieceKg(profile, lengthCm) {
  const hit = (profile?.lengths ?? []).find(l => l.cm === lengthCm);
  if (hit) return { kg: hit.kg, art: hit.art };
  const perM = kgPerM(profile);
  if (perM > 0) return { kg: Math.round(perM * lengthCm / 100 * 10) / 10, art: 'berechnet' };
  return { kg: 0, art: 'geschaetzt' };
}
