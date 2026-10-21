import { MAX_FIRM } from './limits.js';
import { isInStock } from './material.js';

// Sammlungen (docs/superpowers/specs/2026-10-13-sammlungen-design.md). Reine Funktionen ohne DOM
// und ohne Store. Eine Sammlung ist ein Datensatz { id, name, parentId?, updatedAt, cases[] };
// im Speicher der App steht die flache Case-Liste, jedes eigene Case trägt `collectionId`.
export const STANDARD_ID = 'standard';
export const MEINE_ID = 'meine';
export const MEINE_NAME = 'Meine Sammlung';
export const MAX_DEPTH = 4;

const BUILTIN = [
  { id: STANDARD_ID, name: 'Standard', readOnly: true },
  { id: MEINE_ID, name: MEINE_NAME },
];
const isBuiltinId = id => id === STANDARD_ID || id === MEINE_ID;

// Meta-Liste ohne Cases. Die zwei festen Sammlungen stehen immer vorn, Name und readOnly kommen
// von hier (ein Datensatz kann sie nicht umbenennen); eigene alphabetisch.
export function withBuiltins(metas) {
  const own = metas
    .filter(m => !isBuiltinId(m.id))
    .map(({ id, name, parentId, updatedAt }) => ({
      id, name, ...(parentId ? { parentId } : {}), ...(updatedAt ? { updatedAt } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return [...BUILTIN.map(b => ({ ...b })), ...own];
}

// Zu welcher Sammlung ein Case gehört: die gesetzte ID; sonst die Standardvorlagen (preset-,
// mitgeliefert) in „Standard“, alles andere in „Meine Sammlung“.
export const collectionIdOf = c =>
  c.collectionId ?? (c.builtin && typeof c.id === 'string' && c.id.startsWith('preset-') ? STANDARD_ID : MEINE_ID);

export function composeRecords(records) {
  const real = records.filter(r => r && r.id !== STANDARD_ID);
  const collections = withBuiltins(real.map(({ cases: _c, ...meta }) => meta));
  const cases = real.flatMap(r => (Array.isArray(r.cases) ? r.cases : []).map(c => ({ ...c, collectionId: r.id })));
  return { collections, cases };
}

export function collectionRows(collections) {
  const known = new Set(collections.map(c => c.id));
  const kids = new Map();
  for (const c of collections) {
    const p = c.parentId && c.parentId !== c.id && known.has(c.parentId) ? c.parentId : null;
    kids.set(p, [...(kids.get(p) ?? []), c]);
  }
  const rows = [];
  const seen = new Set();
  const walk = (parent, depth) => {
    for (const c of kids.get(parent) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      rows.push({ collection: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  // Eine Schleife aus fremden Daten (A unter B, B unter A) hat keine Wurzel: trotzdem anzeigen.
  for (const c of collections) if (!seen.has(c.id)) { seen.add(c.id); rows.push({ collection: c, depth: 0 }); walk(c.id, 1); }
  return rows;
}

export function descendantIds(collections, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of collections) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; }
    }
  }
  return out;
}

// Oberste Ebene = 1. Eine Schleife bricht ab, statt zu hängen.
export function depthOf(collections, id) {
  let depth = 1;
  let cur = collections.find(c => c.id === id);
  const seen = new Set([id]);
  while (cur?.parentId) {
    const next = collections.find(c => c.id === cur.parentId);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    cur = next;
    depth++;
  }
  return depth;
}

// Höhe des Teilbaums. Ein Zyklus aus fremden Daten bricht ab, statt zu überlaufen.
function subtreeHeight(collections, id, seen = new Set()) {
  if (seen.has(id)) return 0;
  seen.add(id);
  const kids = collections.filter(c => c.parentId === id && c.id !== id);
  return 1 + (kids.length ? Math.max(...kids.map(k => subtreeHeight(collections, k.id, seen))) : 0);
}

export function collectionNameError(name, collections, exceptId = null) {
  const n = String(name ?? '').trim();
  if (!n) return 'Sammlungsname fehlt.';
  if (n.length > MAX_FIRM) return `Sammlungsname: höchstens ${MAX_FIRM} Zeichen.`;
  if (/^__.*__$/.test(n)) return 'Dieser Sammlungsname ist reserviert.';
  if (collections.some(c => c.id !== exceptId && c.name.toLowerCase() === n.toLowerCase()))
    return `Eine Sammlung „${n}“ gibt es schon.`;
  return null;
}

// id = null: neue Sammlung. parentId = null: oberste Ebene.
export function parentError(collections, id, parentId) {
  if (!parentId) return null;
  const parent = collections.find(c => c.id === parentId);
  if (!parent || parent.readOnly) return 'Unter dieser Sammlung ist das nicht möglich.';
  if (id && descendantIds(collections, id).has(parentId)) return 'Eine Sammlung lässt sich nicht in sich selbst verschieben.';
  const below = id ? subtreeHeight(collections, id) : 1;
  if (depthOf(collections, parentId) + below > MAX_DEPTH) return `Höchstens ${MAX_DEPTH} Ebenen.`;
  return null;
}

// Ziel-Sammlung eines zu speichernden Cases, in dieser Reihenfolge: ausdrückliche collectionId;
// die des schon vorhandenen Cases gleicher ID (ein bearbeitetes Listen-Case bleibt in „Meine
// Sammlung“, auch wenn es `company: 'CAB'` trägt); eine Sammlung mit dem Namen aus `company`
// (so entsteht „+ Neue Sammlung …“ im Wizard); sonst „Meine Sammlung“.
export function resolveTarget(c, existing, collections, newId) {
  const writable = id => collections.some(x => x.id === id && !x.readOnly);
  // Eine veraltete (gelöschte, feste) collectionId fällt auf die Sammlung des vorhandenen Cases zurück.
  const own = [c.collectionId, existing && collectionIdOf(existing)].find(id => id && writable(id));
  if (own) return { id: own };
  const company = typeof c.company === 'string' ? c.company.trim() : '';
  if (!company || company.toLowerCase() === MEINE_NAME.toLowerCase()) return { id: MEINE_ID };
  const byName = collections.find(x => !x.readOnly && x.id !== MEINE_ID && x.name.toLowerCase() === company.toLowerCase());
  if (byName) return { id: byName.id };
  // Der Name einer festen Sammlung (Standard) oder ein unzulässiger Name legt keine Sammlung an.
  if (collections.some(x => x.readOnly && x.name.toLowerCase() === company.toLowerCase())) return { id: MEINE_ID };
  if (collectionNameError(company, collections)) return { id: MEINE_ID };
  const id = newId();
  return { id, created: { id, name: company } };
}

// Verschiebt ein Case in eine Sammlung. Eine eigene Sammlung setzt `company` auf ihren Namen (so
// bleiben Dolly-IDs, Traversen-Treffer und die Anzeige „· Name“ wie bisher), „Meine Sammlung“
// entfernt es. Ein mitgeliefertes Listen-Case wird dabei zur eigenen Überlagerung gleicher ID.
// `shipped` (optional): die mitgelieferte Fassung gleicher ID (data/meine.json). Zurück nach „Meine
// Sammlung“ bekommt das Case dann die Marke dieser Fassung statt keiner (kein neues Feld, nichts
// geraten); ohne mitgelieferte Fassung oder ohne deren Marke entfällt `company` wie bisher.
export function moveCase(c, target, shipped) {
  const named = !isBuiltinId(target.id);
  return {
    ...c,
    builtin: false,
    collectionId: target.id,
    company: named ? target.name : (target.id === MEINE_ID ? shipped?.company : undefined),
  };
}

// Aus den gespeicherten Datensätzen und den Änderungen die Datensätze, die geschrieben werden
// müssen (nur geänderte). upserts: Cases mit gesetzter `collectionId`; removeIds: Cases, die
// entfallen; touchIds: Sammlungen, deren Datensatz (Name, Oberebene) ohne Case-Änderung neu
// geschrieben wird. `metas` ist die Wahrheit für Name und parentId. Fehlt ein Datensatz, entsteht er
// aus der Meta; fehlt auch die, ist das ein Fehler.
export function recordsAfterChanges(records, metas, { upserts = [], removeIds = [], touchIds = [] }, stampFn) {
  const byId = new Map(records.map(r => [r.id, r]));
  const touched = new Map();
  const touch = id => {
    if (!touched.has(id)) {
      const cur = byId.get(id);
      const meta = metas.find(m => m.id === id);
      if (!meta) throw new Error(`Sammlung „${id}“ unbekannt`);
      const { parentId: _p, ...rest } = cur ?? {};
      touched.set(id, {
        ...rest, id, name: meta.name, ...(meta.parentId ? { parentId: meta.parentId } : {}),
        cases: [...(cur?.cases ?? [])],
      });
    }
    return touched.get(id);
  };
  const drop = new Set([...removeIds, ...upserts.map(c => c.id)]);
  for (const r of records) {
    if (Array.isArray(r.cases) && r.cases.some(c => drop.has(c.id))) {
      const t = touch(r.id);
      t.cases = t.cases.filter(c => !drop.has(c.id));
    }
  }
  for (const c of upserts) {
    const { collectionId, ...rest } = c;
    touch(collectionId).cases.push(rest);
  }
  for (const id of touchIds) touch(id);
  return [...touched.values()].map(r => stampFn(r));
}

// Was die Sammlungsdatei und die Liste der Materialverwaltung für `id` zeigen: nur Bestand
// (kein onlyInPlan, kein legacy), die in genau dieser Sammlung liegen.
export const exportableCases = (cases, id) => cases.filter(c => isInStock(c) && collectionIdOf(c) === id);

// „In Bestand übernehmen“ / „Kopieren“ in eine Sammlung: holt das Case in den Bestand
// (onlyInPlan weg) und legt es in `meta` ab (collectionId + company = Name, Meine: keins).
export const adoptInto = (c, meta) => moveCase({ ...c, onlyInPlan: undefined }, meta);

export const userCollectionNames = collections =>
  collections.filter(c => !isBuiltinId(c.id)).map(c => c.name);

// Eine eingelesene Sammlungsdatei (parseCollectionFile) in den Bestand einordnen: gleiche ID
// mischt in die vorhandene Sammlung (die Aufrufer lassen den neueren Stand gewinnen), gleicher
// Name unter anderer ID bekommt ein Suffix. Die Sammlung kommt auf die oberste Ebene.
export function planCollectionImport(collections, file, newId) {
  const { id: fileId, name: fileName } = file.collection;
  const existing = collections.find(c => c.id === fileId && !c.readOnly && c.id !== MEINE_ID);
  let meta;
  if (existing) {
    meta = existing;
  } else {
    let name = String(fileName).trim().slice(0, MAX_FIRM);
    const taken = n => collections.some(c => c.name.toLowerCase() === n.toLowerCase());
    for (let i = 2; taken(name); i++) name = `${String(fileName).trim().slice(0, MAX_FIRM - 6)} (${i})`;
    const idClash = collections.some(c => c.id === fileId);
    meta = { id: idClash ? newId() : fileId, name };
  }
  const cases = file.cases.map(c => ({ ...c, builtin: false, collectionId: meta.id, company: meta.name }));
  const merged = withBuiltins(existing ? collections : [...collections, meta]);
  return { meta, cases, merged };
}
