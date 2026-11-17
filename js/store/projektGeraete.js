// Projektgeräte aus NYX (docs/nyx-projektgeraete.md, „Abgestimmte Schnittstelle“): NYX liefert
// über `truckloadHost.projektGeraete()` die Geräte des Projekts. Ungültige Einträge werden
// verworfen, nicht fatal; eine Ablehnung des Hosts geht als Error unverändert weiter.

import { t } from '../i18n/i18n.js';

const MAX = 200;
const text = v => typeof v === 'string' && v.length > 0 && v.length <= MAX;

export const hatProjektGeraete = () => typeof globalThis.truckloadHost?.projektGeraete === 'function';

function pruefe(e) {
  if (!e || typeof e !== 'object') return null;
  if (!text(e.key) || !(e.key.startsWith('gdtf:') || e.key.startsWith('vw:'))) return null;
  if (!text(e.name)) return null;
  if (!Number.isInteger(e.anzahl) || e.anzahl < 0) return null;
  const g = { key: e.key, name: e.name, anzahl: e.anzahl };
  if (text(e.hersteller)) g.hersteller = e.hersteller;
  if (text(e.gewerk)) g.gewerk = e.gewerk;
  g.vwNamen = Array.isArray(e.vwNamen) ? e.vwNamen.filter(n => typeof n === 'string') : [];
  if (typeof e.gewichtKg === 'number' && Number.isFinite(e.gewichtKg) && e.gewichtKg > 0) g.gewichtKg = e.gewichtKg;
  return g;
}

function zusammen(a, b) {
  a.anzahl += b.anzahl;
  for (const n of b.vwNamen) if (!a.vwNamen.includes(n)) a.vwNamen.push(n);
  if (a.gewichtKg !== b.gewichtKg) delete a.gewichtKg;
}

export async function ladeProjektGeraete() {
  const host = globalThis.truckloadHost;
  let liste;
  try {
    liste = await host.projektGeraete();
  } catch (err) {
    throw err instanceof Error ? err : new Error(typeof err === 'string' ? err : err?.message ?? t('NYX lieferte keine Geräteliste'));
  }
  if (!Array.isArray(liste)) throw new Error(t('NYX lieferte keine Geräteliste'));
  const nachKey = new Map();
  for (const e of liste) {
    const g = pruefe(e);
    if (!g) continue;
    const vorhanden = nachKey.get(g.key);
    if (vorhanden) zusammen(vorhanden, g); else nachKey.set(g.key, g);
  }
  return [...nachKey.values()];
}
