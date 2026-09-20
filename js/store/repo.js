import * as db from './db.js';
import { PRESET_CASES } from '../data/preset-cases.js';
import { CASE_LIBRARY } from '../data/case-library.js';
import { PRESET_TRUCKS } from '../data/preset-trucks.js';

export const stamp = obj => ({ ...obj, updatedAt: new Date().toISOString() });

// Reihenfolge: eigene Cases, dann Vorlagen, dann Bibliothek. Bei einer ID-Kollision
// gewinnt weiterhin das eigene Case – Presets/Bibliothekseinträge mit dieser ID
// entfallen, statt Duplikate zu erzeugen oder das eigene Case zu verdecken (Verbraucher
// wie js/ui/library.js bauen aus dem Ergebnis eine Map nach id, wo der letzte Eintrag
// gewinnt – ohne diesen Filter würde ein Preset/Bibliothekseintrag mit derselben ID
// das eigene Case dort stillschweigend überschreiben).
export function mergeOwnWithBuiltins(ownCases, builtinCases) {
  const ownIds = new Set(ownCases.map(c => c.id));
  return [...ownCases, ...builtinCases.filter(b => !ownIds.has(b.id))];
}

export async function loadAll() {
  await db.persist();
  const [cases, trucks, plans] = await Promise.all([db.getAll('cases'), db.getAll('trucks'), db.getAll('plans')]);
  const mergedCases = mergeOwnWithBuiltins(cases, [...PRESET_CASES, ...CASE_LIBRARY]);
  return { cases: mergedCases, trucks: [...PRESET_TRUCKS, ...trucks], plans };
}
export const saveCase = c => db.put('cases', c);
export const deleteCase = id => db.del('cases', id);
export const saveTruck = t => db.put('trucks', t);
export const deleteTruck = id => db.del('trucks', id);
export const savePlan = p => db.put('plans', p);
export const deletePlan = id => db.del('plans', id);
