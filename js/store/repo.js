import * as db from './db.js';
import { PRESET_CASES } from '../data/preset-cases.js';
import { CASE_LIBRARY } from '../data/case-library.js';
import { PRESET_TRUCKS } from '../data/preset-trucks.js';

export const stamp = obj => ({ ...obj, updatedAt: new Date().toISOString() });

export async function loadAll() {
  await db.persist();
  const [cases, trucks, plans] = await Promise.all([db.getAll('cases'), db.getAll('trucks'), db.getAll('plans')]);
  // Reihenfolge: eigene Cases, dann Vorlagen, dann Bibliothek. Bei einer ID-Kollision
  // gewinnt weiterhin das eigene Case – Vorlagen/Bibliothek mit dieser ID entfallen.
  const ownIds = new Set(cases.map(c => c.id));
  const builtins = [...PRESET_CASES, ...CASE_LIBRARY].filter(b => !ownIds.has(b.id));
  return { cases: [...cases, ...builtins], trucks: [...PRESET_TRUCKS, ...trucks], plans };
}
export const saveCase = c => db.put('cases', c);
export const deleteCase = id => db.del('cases', id);
export const saveTruck = t => db.put('trucks', t);
export const deleteTruck = id => db.del('trucks', id);
export const savePlan = p => db.put('plans', p);
export const deletePlan = id => db.del('plans', id);
