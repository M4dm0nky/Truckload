export const FORMAT = 'truckload';
export const VERSION = 1;

const num = v => typeof v === 'number' && Number.isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);

function checkCase(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Case ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h']) if (!num(c[k]) || c[k] <= 0) throw new Error(`Case „${c.name}" hat ungültige Maße.`);
  if (!num(c.weight) || c.weight < 0) throw new Error(`Case „${c.name}" hat ein ungültiges Gewicht.`);
}
function checkTruck(t) {
  if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') throw new Error('Fahrzeug ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h', 'payload']) if (!num(t[k]) || t[k] <= 0) throw new Error(`Fahrzeug „${t.name}" hat ungültige Werte.`);
}
function checkPlan(p) {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.placements))
    throw new Error('Ungültiger Ladeplan in der Datei.');
}

export function exportBundle({ cases, trucks, plans }, now = new Date()) {
  return JSON.stringify({
    format: FORMAT, version: VERSION, exportedAt: now.toISOString(),
    cases: cases.filter(c => !c.builtin), trucks: trucks.filter(t => !t.builtin), plans,
  }, null, 2);
}

export function parseBundle(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (data?.format !== FORMAT) throw new Error('Keine Truckload-Datei.');
  if (!num(data.version) || data.version > VERSION) throw new Error('Die Datei stammt aus einer neueren Version.');
  const cases = arr(data.cases), trucks = arr(data.trucks);
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
