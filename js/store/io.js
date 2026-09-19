import { APP_VERSION } from '../version.js';
import { ORIENTATIONS } from '../model/geometry.js';

export const FORMAT = 'truckload';
export const VERSION = 1;
const ROTATIONS = [0, 90, 180, 270];
const ARCH_SIDES = ['left', 'right', 'both'];

const num = v => typeof v === 'number' && Number.isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);
const numOrNull = v => v == null || (num(v) && v >= 0);
const isPreset = x => !!x?.builtin || (typeof x?.id === 'string' && x.id.startsWith('preset-'));

function checkCase(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Case ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h']) if (!num(c[k]) || c[k] <= 0) throw new Error(`Case „${c.name}“ hat ungültige Maße.`);
  if (!num(c.weight) || c.weight < 0) throw new Error(`Case „${c.name}“ hat ein ungültiges Gewicht.`);
  const wheelHOk = c.wheelH == null || (num(c.wheelH) && c.wheelH >= 0 && c.wheelH < c.h);
  const layersOk = c.layers == null || (Array.isArray(c.layers) && c.layers.length > 0
    && new Set(c.layers).size === c.layers.length
    && c.layers.every(n => Number.isInteger(n) && n >= 1 && n <= 4));
  const propsOk = numOrNull(c.maxTopLoad) && numOrNull(c.stock)
    && (c.tippable === undefined || typeof c.tippable === 'boolean')
    && (c.stackable === undefined || typeof c.stackable === 'boolean')
    && wheelHOk && layersOk;
  if (!propsOk) throw new Error(`Case „${c.name}“ hat ungültige Eigenschaften.`);
}
function checkArch(a) {
  return a && num(a.x) && a.x >= 0 && num(a.l) && a.l > 0 && num(a.w) && a.w > 0 && num(a.h) && a.h > 0
    && ARCH_SIDES.includes(a.side);
}
function checkTruck(t) {
  if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') throw new Error('Fahrzeug ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h', 'payload']) if (!num(t[k]) || t[k] <= 0) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Werte.`);
  if (!arr(t.wheelArches ?? []).every(checkArch)) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Radkästen.`);
}
function checkPlan(p) {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.placements) || typeof p.truckId !== 'string')
    throw new Error('Ungültiger Ladeplan in der Datei.');
  const placementOk = pl => pl && typeof pl.id === 'string' && typeof pl.caseId === 'string'
    && ORIENTATIONS.includes(pl.orientation) && ROTATIONS.includes(pl.rot)
    && num(pl.x) && num(pl.y) && num(pl.z);
  const unplacedOk = u => u && typeof u.id === 'string' && typeof u.caseId === 'string';
  if (!p.placements.every(placementOk) || !arr(p.unplaced).every(unplacedOk))
    throw new Error(`Ladeplan „${p.name}“ enthält ungültige Platzierungen.`);
}

export function exportBundle({ cases, trucks, plans }, now = new Date()) {
  return JSON.stringify({
    format: FORMAT, version: VERSION, appVersion: APP_VERSION, exportedAt: now.toISOString(),
    cases: cases.filter(c => !c.builtin), trucks: trucks.filter(t => !t.builtin), plans,
  }, null, 2);
}

export function parseBundle(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (data?.format !== FORMAT) throw new Error('Keine Truckload-Datei.');
  if (!num(data.version)) throw new Error('Die Datei hat keine gültige Versionsangabe.');
  if (data.version > VERSION) throw new Error('Die Datei stammt aus einer neueren Version.');
  const cases = arr(data.cases).filter(c => !isPreset(c));
  const trucks = arr(data.trucks).filter(t => !isPreset(t));
  const plans = arr(data.plans).map(p => ({ ...p, unplaced: arr(p?.unplaced), notes: p?.notes ?? '' }));
  cases.forEach(checkCase); trucks.forEach(checkTruck); plans.forEach(checkPlan);
  return { cases, trucks, plans };
}

export function mergeById(existing, incoming) {
  const map = new Map(existing.map(x => [x.id, x]));
  for (const x of incoming) {
    const cur = map.get(x.id);
    if (!cur || (x.updatedAt ?? '') >= (cur.updatedAt ?? '')) map.set(x.id, x);
  }
  return [...map.values()];
}

export const backupFileName = (now = new Date()) =>
  `truckload-backup-${now.toISOString().slice(0, 10)}.json`;
