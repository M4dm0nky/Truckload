// Speicherpfade des Materialbestands, der Regelsets und der Fahrzeuge: erst in die Datenbank
// schreiben, danach den Store nachziehen. Schlägt das Schreiben fehl, bleibt der Store
// unverändert und es erscheint genau eine Meldung. Kein Import von js/app.js.
import { guarded } from './guarded.js';
import { usage, repointTruck } from './core.js';
import { deletionFor } from '../model/material.js';
import {
  resolveTarget, moveCase, collectionNameError, parentError, descendantIds, planCollectionImport,
  withBuiltins, collectionIdOf, MEINE_ID,
} from '../model/collections.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';

const NO_BUILTIN_MOVE = 'Standardvorlagen lassen sich nicht verschieben – „Kopieren“ legt eine eigene Version in einer Sammlung an.';
const NO_FIXED_COLLECTION = '„Standard“ und „Meine Sammlung“ lassen sich nicht ändern oder löschen.';
const NO_FIXED_DELETE = '„Standard“ und „Meine Sammlung“ lassen sich nicht löschen.';
const NO_BUILTIN_DELETE = 'Standardvorlagen lassen sich nicht löschen – „Kopieren“ legt eine eigene Version in einer Sammlung an.';

// `repo`: writeCases/saveRuleSet/deleteRuleSet/saveTruck/deleteTruck/savePlan.
// `stamp`: setzt den Änderungszeitpunkt. `uid`: neue IDs (Regelsets, Sammlungen).
export function createPersistence({ repo, store, showAlert, showConfirm, stamp, uid = () => crypto.randomUUID() }) {
  const run = (label, fn) => guarded(label, fn, { showAlert });

  // Alle writeCases-Aufrufe laufen nacheinander durch EINE Warteschlange: writeCases liest und
  // schreibt ganze Sammlungs-Datensätze, zwei überlappende Aufrufe verlören sonst eine Änderung.
  // Der Zustand, aus dem ein Schreibvorgang gebaut wird, wird erst im Schritt selbst gelesen
  // (nach den früheren Schreibvorgängen). Eine Ablehnung vergiftet spätere Schritte nicht.
  let chain = Promise.resolve();
  const serial = fn => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };

  // Eine eigene (änderbare) Sammlung; „Standard“, „Meine Sammlung“ und unbekannte IDs sind es nicht.
  const ownMeta = (st, id) => st.collections.find(c => c.id === id && !c.readOnly && c.id !== MEINE_ID);

  const setCollections = (st, collections) => (collections === st.collections ? st : { ...st, collections });

  // Das Ziel steht fest (ausdrückliche collectionId, vorhandenes Case, Name aus `company`, sonst
  // Meine Sammlung, s. resolveTarget); entsteht dabei eine Sammlung, schreibt derselbe Vorgang sie.
  // Nur innerhalb der Warteschlange aufrufen.
  async function saveCaseNow(rawValue) {
    const st = store.get();
    const existing = st.cases.find(x => x.id === rawValue.id);
    const target = resolveTarget(rawValue, existing, st.collections, uid);
    const value = stamp({ ...rawValue, collectionId: target.id });
    const collections = target.created ? withBuiltins([...st.collections, stamp(target.created)]) : st.collections;
    const r = await run('Case konnte nicht gespeichert werden', () => repo.writeCases({
      upserts: [value], touchIds: target.created ? [target.id] : [], collections,
    }));
    if (!r.ok) return undefined;
    store.update(s => ({ ...setCollections(s, collections), cases: [...s.cases.filter(x => x.id !== value.id), value] }));
    return value;
  }
  const saveCase = rawValue => serial(() => saveCaseNow(rawValue));

  // `confirmed`: die Rückfrage kam schon (Editor bzw. Sammlung-löschen-Dialog).
  async function removeFromStock(c, { confirmed = false } = {}) {
    if (!c) return false;
    const d = deletionFor(c);
    if (!d) { await showAlert(NO_BUILTIN_DELETE); return false; }
    if (!confirmed) {
      const used = usage(store.get(), c.id);
      const msg = used ? `„${c.name}“ wird in ${used} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${c.name}“ löschen?`;
      if (!await showConfirm(msg, { okLabel: 'Löschen', danger: true })) return false;
    }
    return serial(async () => {
      // Frisch lesen: ein vorher eingereihtes Umbenennen/Verschieben darf nicht zurückgedreht werden.
      const fresh = store.get().cases.find(x => x.id === c.id);
      if (!fresh) return true;
      const dNow = deletionFor(fresh);
      if (!dNow) { await showAlert(NO_BUILTIN_DELETE); return false; }
      if (dNow.save) return !!await saveCaseNow(dNow.save);
      const r = await run('Case konnte nicht gelöscht werden', () => repo.writeCases({ removeIds: [dNow.remove], collections: store.get().collections }));
      if (!r.ok) return false;
      store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== dNow.remove) }));
      return true;
    });
  }

  const createCollection = (name, parentId = null) => serial(async () => {
    const st = store.get();
    const err = collectionNameError(name, st.collections) ?? parentError(st.collections, null, parentId);
    if (err) { await showAlert(err); return null; }
    const meta = stamp({ id: uid(), name: name.trim(), ...(parentId ? { parentId } : {}) });
    const collections = withBuiltins([...st.collections, meta]);
    const r = await run('Sammlung konnte nicht angelegt werden', () => repo.writeCases({ touchIds: [meta.id], collections }));
    if (!r.ok) return null;
    store.update(s => ({ ...s, collections }));
    return meta.id;
  });

  const renameCollection = (id, name) => serial(async () => {
    const st = store.get();
    if (!ownMeta(st, id)) { await showAlert(NO_FIXED_COLLECTION); return false; }
    const err = collectionNameError(name, st.collections, id);
    if (err) { await showAlert(err); return false; }
    const to = name.trim();
    const collections = withBuiltins(st.collections.map(c => (c.id === id ? stamp({ ...c, name: to }) : c)));
    // `company` einer eigenen Sammlung ist ihr Name; die Cases ziehen mit.
    const renamed = st.cases.filter(c => c.collectionId === id).map(c => stamp({ ...c, company: to }));
    const r = await run('Sammlung konnte nicht umbenannt werden', () => repo.writeCases({ upserts: renamed, touchIds: [id], collections }));
    if (!r.ok) return false;
    const ids = new Set(renamed.map(c => c.id));
    store.update(s => ({ ...s, collections, cases: [...s.cases.filter(x => !ids.has(x.id)), ...renamed] }));
    return true;
  });

  const moveCollection = (id, parentId) => serial(async () => {
    const st = store.get();
    if (!ownMeta(st, id)) { await showAlert(NO_FIXED_COLLECTION); return false; }
    const err = parentError(st.collections, id, parentId);
    if (err) { await showAlert(err); return false; }
    const collections = withBuiltins(st.collections.map(c => {
      if (c.id !== id) return c;
      const { parentId: _p, ...rest } = c;
      return stamp({ ...rest, ...(parentId ? { parentId } : {}) });
    }));
    const r = await run('Sammlung konnte nicht verschoben werden', () => repo.writeCases({ touchIds: [id], collections }));
    if (!r.ok) return false;
    store.update(s => ({ ...s, collections }));
    return true;
  });

  // Löscht die Sammlung samt Untersammlungen. Mitgelieferte Listen-Cases (lib-) in ihr werden
  // ausgeblendet und kommen als Überlagerung nach „Meine Sammlung“, damit alte Ladepläne ihr Stück
  // behalten; alles andere fällt mit dem Datensatz weg.
  async function deleteCollection(id) {
    const insideOf = st => {
      const gone = descendantIds(st.collections, id);
      return { gone, inside: st.cases.filter(c => gone.has(collectionIdOf(c))) };
    };
    // Rückfrage außerhalb der Warteschlange (sie soll Schreibvorgänge nicht aufhalten).
    const pre = store.get();
    const meta0 = ownMeta(pre, id);
    if (!meta0) { await showAlert(NO_FIXED_DELETE); return false; }
    const { gone: gone0, inside: inside0 } = insideOf(pre);
    const used = inside0.reduce((n, c) => n + usage(pre, c.id), 0);
    const usedNote = used ? ` Die Einträge werden in ${used} Ladeplan/-plänen verwendet.` : '';
    if (!await showConfirm(`Sammlung „${meta0.name}“ mit ${inside0.length} Einträgen${gone0.size > 1 ? ` und ${gone0.size - 1} Untersammlungen` : ''} löschen?${usedNote}`, { okLabel: 'Löschen', danger: true })) return false;
    return serial(async () => {
      const st = store.get();
      if (!ownMeta(st, id)) { await showAlert(NO_FIXED_DELETE); return false; }
      const { gone, inside } = insideOf(st);
      const ds = inside.map(deletionFor);
      if (ds.includes(null)) { await showAlert(NO_BUILTIN_DELETE); return false; }
      // Die Überlagerung behält `company` (Name der gelöschten Sammlung): so bleibt die Anzeige
      // „· Name“ und die Dolly-/Traversen-Zuordnung alter Pläne erhalten.
      const hidden = ds.filter(d => d.save).map(d => stamp({ ...d.save, collectionId: MEINE_ID }));
      const collections = withBuiltins(st.collections.filter(c => !gone.has(c.id)));
      const r = await run('Sammlung konnte nicht gelöscht werden', () => repo.writeCases({ upserts: hidden, deleteCollectionIds: [...gone], collections }));
      if (!r.ok) return false;
      const keep = new Set(hidden.map(c => c.id));
      store.update(s => ({
        ...s, collections,
        cases: [...s.cases.filter(x => !gone.has(collectionIdOf(x)) && !keep.has(x.id)), ...hidden],
      }));
      return true;
    });
  }

  const moveCaseTo = (caseId, collectionId) => serial(async () => {
    const st = store.get();
    const c = st.cases.find(x => x.id === caseId);
    const target = st.collections.find(x => x.id === collectionId && !x.readOnly);
    if (!c || !target) return false;
    if (c.builtin && c.id.startsWith('preset-')) { await showAlert(NO_BUILTIN_MOVE); return false; }
    if (collectionIdOf(c) === target.id) return true;
    return !!await saveCaseNow(stamp(moveCase(c, target)));
  });

  // Eine eingelesene Sammlungsdatei (parseCollectionFile). Gleiche ID: Cases werden gemischt, ein
  // lokal neuerer Stand bleibt. Liefert die Meta der betroffenen Sammlung oder null.
  // Erst mischen, dann stempeln: stamp() würde den updatedAt des Imports überschreiben.
  const importCollectionFile = file => serial(async () => {
    const st = store.get();
    const plan = planCollectionImport(st.collections, file, uid);
    const local = new Map(st.cases.map(c => [c.id, c]));
    const upserts = plan.cases.filter(c => {
      const cur = local.get(c.id);
      return !cur || cur.builtin || typeof c.updatedAt !== 'string' || typeof cur.updatedAt !== 'string' || c.updatedAt >= cur.updatedAt;
    }).map(c => stamp(c));
    const r = await run('Sammlung konnte nicht importiert werden', () => repo.writeCases({ upserts, touchIds: [plan.meta.id], collections: plan.merged }));
    if (!r.ok) return null;
    const ids = new Set(upserts.map(c => c.id));
    store.update(s => ({ ...s, collections: plan.merged, cases: [...s.cases.filter(x => !ids.has(x.id)), ...upserts] }));
    return plan.meta;
  });

  async function saveRuleSet(name, rules, mixTop) {
    const existing = store.get().ruleSets.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (existing && !await showConfirm(`Regelset „${existing.name}“ überschreiben?`, { okLabel: 'Überschreiben', danger: true })) return undefined;
    const value = stamp({ id: existing?.id ?? uid(), name, rules, ...(mixTop ? { mixTop: true } : {}) });
    const r = await run('Regelset konnte nicht gespeichert werden', () => repo.saveRuleSet(value));
    if (!r.ok) return undefined;
    store.update(s => ({ ...s, ruleSets: [...s.ruleSets.filter(x => x.id !== value.id), value] }));
    return value;
  }

  async function deleteRuleSet(id) {
    const set = store.get().ruleSets.find(x => x.id === id);
    if (set && !await showConfirm(`Regelset „${set.name}“ löschen?`, { okLabel: 'Löschen', danger: true })) return false;
    const r = await run('Regelset konnte nicht gelöscht werden', () => repo.deleteRuleSet(id));
    if (!r.ok) return false;
    store.update(s => ({ ...s, ruleSets: s.ruleSets.filter(x => x.id !== id) }));
    return true;
  }

  // Speichert das Fahrzeug und liefert den gestempelten Wert (undefined bei Fehler).
  async function saveTruck(rawValue) {
    const value = stamp(rawValue);
    const r = await run('Fahrzeug konnte nicht gespeichert werden', () => repo.saveTruck(value));
    if (!r.ok) return undefined;
    store.update(s => ({ ...s, trucks: [...s.trucks.filter(t => t.id !== value.id), value] }));
    return value;
  }

  // Löscht das Fahrzeug und biegt alle ANDEREN Pläne (nicht den aktuellen – das macht der
  // Aufrufer über edit()) und deren LKW (plan.lkws) auf den Standardtruck um, sonst schöbe ctx() ihnen
  // still den Sattelauflieger unter. Liefert false, wenn das Löschen selbst scheiterte.
  async function deleteTruck(truckId) {
    const r = await run('Fahrzeug konnte nicht gelöscht werden', () => repo.deleteTruck(truckId));
    if (!r.ok) return false;
    const s1 = store.get();
    const fixPlan = p => repointTruck(p, truckId, DEFAULT_TRUCK_ID);
    const fixedOthers = s1.plans.map(fixPlan);
    const changedOthers = fixedOthers.filter((p, i) => p !== s1.plans[i]);
    store.update(s => ({ ...s, trucks: s.trucks.filter(t => t.id !== truckId), plans: fixedOthers }));
    if (changedOthers.length) {
      try {
        await Promise.all(changedOthers.map(repo.savePlan));
      } catch (err) {
        // Unbehandelt hätte das eine tote Rejection UND einen toten truckId-Verweis
        // hinterlassen.
        await showAlert(`Fahrzeug gelöscht, aber ${changedOthers.length} Plan(e) konnten nicht aktualisiert werden: ${err?.message ?? 'unbekannter Fehler'}. Bitte prüfen und ggf. erneut speichern.`);
      }
    }
    return true;
  }

  return {
    enqueue: serial,
    saveCase, removeFromStock, createCollection, renameCollection, moveCollection, deleteCollection,
    moveCaseTo, importCollectionFile, saveRuleSet, deleteRuleSet, saveTruck, deleteTruck,
  };
}
