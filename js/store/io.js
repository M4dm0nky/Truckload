import { APP_VERSION } from '../version.js';
import { ORIENTATIONS, MAX_LABEL } from '../model/geometry.js';
import { trussDims } from '../model/truss.js';
import { PRESET_TRUCKS } from '../data/preset-trucks.js';
import { CASE_LIBRARY } from '../data/case-library.js';

export { MAX_LABEL };
export const FORMAT = 'truckload';
export const VERSION = 1;
const ROTATIONS = [0, 90, 180, 270];
const ARCH_SIDES = ['left', 'right', 'both'];
const CASE_KINDS = ['case', 'truss'];

// Obergrenzen für Case-Werte aus fremden Dateien. Großzügig, aber so, dass Unsinn
// (ein 100 m langes, 100 t schweres Case) auffällt. Task 5 übernimmt dieselbe Konstante
// für die `max=`-Attribute im Case-Editor, damit Oberfläche und Import nicht auseinanderlaufen.
export const CASE_LIMITS = {
  l: 2000, w: 2000, h: 2000, // cm
  weight: 50000, // kg
  wheelH: 200, // cm
  maxTopLoad: 50000, // kg
  stock: 9999, // Stück
};

const num = v => typeof v === 'number' && Number.isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);
const numOrNullMax = (v, max) => v == null || (num(v) && v >= 0 && v <= max);
const isPreset = x => !!x?.builtin
  || (typeof x?.id === 'string' && (x.id.startsWith('preset-') || x.id.startsWith('lib-')));
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const colorOk = x => x.color === undefined || COLOR_RE.test(x.color);
const updatedAtOk = x => x.updatedAt === undefined || typeof x.updatedAt === 'string';

export function checkCase(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Case ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h']) if (!num(c[k]) || c[k] <= 0 || c[k] > CASE_LIMITS[k]) throw new Error(`Case „${c.name}“ hat ungültige Maße.`);
  if (!num(c.weight) || c.weight < 0 || c.weight > CASE_LIMITS.weight) throw new Error(`Case „${c.name}“ hat ein ungültiges Gewicht.`);
  if (!colorOk(c)) throw new Error(`Case „${c.name}“ hat eine ungültige Farbe.`);
  if (!updatedAtOk(c)) throw new Error(`Case „${c.name}“ hat einen ungültigen Zeitstempel.`);
  const wheelHOk = c.wheelH == null || (num(c.wheelH) && c.wheelH >= 0 && c.wheelH <= CASE_LIMITS.wheelH
    && (c.dimsInclWheels === false || c.wheelH < c.h));
  const layersOk = c.layers == null || (Array.isArray(c.layers) && c.layers.length > 0
    && new Set(c.layers).size === c.layers.length
    && c.layers.every(n => Number.isInteger(n) && n >= 1 && n <= 4));
  const kindOk = c.kind == null || CASE_KINDS.includes(c.kind);
  const propsOk = numOrNullMax(c.maxTopLoad, CASE_LIMITS.maxTopLoad) && numOrNullMax(c.stock, CASE_LIMITS.stock)
    && (c.tippable === undefined || typeof c.tippable === 'boolean')
    && (c.stackable === undefined || typeof c.stackable === 'boolean')
    && (c.wheels === undefined || typeof c.wheels === 'boolean')
    && (c.dimsInclWheels === undefined || typeof c.dimsInclWheels === 'boolean')
    && wheelHOk && layersOk && kindOk;
  if (!propsOk) throw new Error(`Case „${c.name}“ hat ungültige Eigenschaften.`);
  if (c.kind === 'truss') {
    const t = c.truss;
    const trussOk = t
      && num(t.length) && t.length >= 1 && t.length <= 1000
      && num(t.width) && t.width >= 1 && t.width <= 40
      && Number.isInteger(t.count) && t.count >= 1 && t.count <= 12
      && c.tippable !== true;
    if (!trussOk) throw new Error(`Case „${c.name}“ hat ungültige Traversenwagen-Werte.`);
  }
}
export function normalizeCase(c) {
  if (c.kind !== 'truss') return c;
  // trussDims() wirft, wenn c.truss.width die Grenze (MAX_TRUSS_WIDTH) überschreitet.
  // Beim Datei-Import ist das nicht erreichbar: checkCase() lehnt eine solche Breite schon
  // vorher ab, bevor normalizeCase() überhaupt läuft. Aber repo.normalizeOwnCases() ruft
  // normalizeCase() beim Laden für JEDES eigene gespeicherte Case auf, ohne vorherige
  // checkCase()-Prüfung – ein vor Einführung der Grenze gespeichertes Case darf dort nicht
  // werfen (das würde in app.js den kompletten Ladepfad in loadAllFallback() reißen und
  // die gesamte eigene Bibliothek stillschweigend leeren). Die gespeicherten Maße bleiben
  // in diesem Fall unverändert erhalten, statt die Normalisierung zu erzwingen.
  try {
    const { l, w, h } = trussDims(c.truss);
    return { ...c, l, w, h, wheelH: 0, tippable: false };
  } catch {
    return { ...c, wheelH: 0, tippable: false };
  }
}
function checkArch(a) {
  return a && num(a.x) && a.x >= 0 && num(a.l) && a.l > 0 && num(a.w) && a.w > 0 && num(a.h) && a.h > 0
    && ARCH_SIDES.includes(a.side);
}
function checkTruck(t) {
  if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') throw new Error('Fahrzeug ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h', 'payload']) if (!num(t[k]) || t[k] <= 0) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Werte.`);
  if (!updatedAtOk(t)) throw new Error(`Fahrzeug „${t.name}“ hat einen ungültigen Zeitstempel.`);
  if (t.wheelArches != null && !Array.isArray(t.wheelArches)) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Radkästen.`);
  if (!arr(t.wheelArches ?? []).every(checkArch)) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Radkästen.`);
}
const labelOk = x => x.label === undefined || (typeof x.label === 'string' && x.label.length <= MAX_LABEL);
function checkPlan(p) {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.placements) || typeof p.truckId !== 'string')
    throw new Error('Ungültiger Ladeplan in der Datei.');
  if (!updatedAtOk(p)) throw new Error(`Ladeplan „${p.name}“ hat einen ungültigen Zeitstempel.`);
  if (p.notes !== undefined && (typeof p.notes !== 'string' || p.notes.length > 2000))
    throw new Error(`Ladeplan „${p.name}“ hat ungültige Notizen.`);
  const placementOk = pl => pl && typeof pl.id === 'string' && typeof pl.caseId === 'string'
    && ORIENTATIONS.includes(pl.orientation) && ROTATIONS.includes(pl.rot)
    && num(pl.x) && num(pl.y) && num(pl.z) && labelOk(pl) && colorOk(pl);
  const unplacedOk = u => u && typeof u.id === 'string' && typeof u.caseId === 'string' && labelOk(u) && colorOk(u);
  if (!p.placements.every(placementOk) || !arr(p.unplaced).every(unplacedOk))
    throw new Error(`Ladeplan „${p.name}“ enthält ungültige Platzierungen.`);
  const pieceIds = [...p.placements, ...arr(p.unplaced)].map(x => x.id);
  if (new Set(pieceIds).size !== pieceIds.length)
    throw new Error(`Ladeplan „${p.name}“ enthält doppelte Stück-IDs.`);
}

export function exportBundle({ cases, trucks, plans }, now = new Date()) {
  return JSON.stringify({
    format: FORMAT, version: VERSION, appVersion: APP_VERSION, exportedAt: now.toISOString(),
    cases: cases.filter(c => !c.builtin), trucks: trucks.filter(t => !t.builtin), plans,
  }, null, 2);
}

const FIELD_LABELS = { cases: 'Cases', trucks: 'Fahrzeuge', plans: 'Ladepläne' };

export function parseBundle(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (data?.format !== FORMAT) throw new Error('Keine Truckload-Datei.');
  if (!num(data.version)) throw new Error('Die Datei hat keine gültige Versionsangabe.');
  if (data.version > VERSION) throw new Error('Die Datei stammt aus einer neueren Version.');
  for (const field of ['cases', 'trucks', 'plans']) {
    if (data[field] !== undefined && !Array.isArray(data[field]))
      throw new Error(`Das Feld „${FIELD_LABELS[field]}“ in der Datei ist beschädigt.`);
  }
  const cases = arr(data.cases).filter(c => !isPreset(c));
  const trucks = arr(data.trucks).filter(t => !isPreset(t));
  const plans = arr(data.plans).map(p => ({ ...p, unplaced: arr(p?.unplaced), notes: p?.notes ?? '' }));
  if (cases.length === 0 && trucks.length === 0 && plans.length === 0)
    throw new Error('Die Datei enthält keine Daten.');
  cases.forEach(checkCase); trucks.forEach(checkTruck); plans.forEach(checkPlan);

  const knownCaseIds = new Set([...cases.map(c => c.id), ...CASE_LIBRARY.map(c => c.id)]);
  const knownTruckIds = new Set([...trucks.map(t => t.id), ...PRESET_TRUCKS.map(t => t.id)]);
  const warnings = [];
  for (const p of plans) {
    const refs = [...p.placements, ...p.unplaced].map(x => x.caseId);
    const unknown = refs.filter(id => !knownCaseIds.has(id)).length;
    if (unknown > 0)
      warnings.push(`Ladeplan „${p.name}“: ${unknown} Stück verweisen auf ein Case, das weder in der Datei noch bekannt ist.`);
    if (!knownTruckIds.has(p.truckId))
      warnings.push(`Ladeplan „${p.name}“ verweist auf ein unbekanntes Fahrzeug.`);
  }

  return { cases: cases.map(normalizeCase), trucks, plans, warnings };
}

export function mergeById(existing, incoming) {
  const ts = x => (typeof x?.updatedAt === 'string' ? x.updatedAt : null);
  const map = new Map(existing.map(x => [x.id, x]));
  for (const x of incoming) {
    const cur = map.get(x.id);
    const bothStamped = ts(x) !== null && ts(cur) !== null;
    if (!cur || (bothStamped && ts(x) >= ts(cur))) map.set(x.id, x);
  }
  return [...map.values()];
}

export const backupFileName = (now = new Date()) =>
  `truckload-backup-${now.toISOString().slice(0, 10)}.json`;

// Name der stillen Sicherung, die die App vor jedem Import des aktuellen Stands anlegt
// (Befund Daten-10) – derselbe Name wie beim „Sichern“-Knopf, nur kenntlich gemacht, damit
// er nicht mit einer bewusst vom Nutzer erzeugten Sicherung verwechselt wird.
export const preImportBackupFileName = (now = new Date()) =>
  backupFileName(now).replace(/\.json$/, '-vor-import.json');
