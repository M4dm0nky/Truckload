// Speicherpfade des Materialbestands, der Regelsets und der Fahrzeuge: erst in die Datenbank
// schreiben, danach den Store nachziehen. Schlägt das Schreiben fehl, bleibt der Store
// unverändert und es erscheint genau eine Meldung. Kein Import von js/app.js.
import { guarded } from './guarded.js';
import { usage, repointTruck } from './core.js';
import { deletionFor, originalOf } from '../model/material.js';
import { ohneIds } from '../model/mitgefuehrt.js';
import {
  resolveTarget, moveCase, collectionNameError, parentError, descendantIds, planCollectionImport,
  withBuiltins, collectionIdOf, MEINE_ID,
} from '../model/collections.js';
import { MAX_COLLECTIONS } from '../model/limits.js';
import { CASE_LIBRARY } from '../data/case-library.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { t } from '../i18n/i18n.js';

// Als Funktionen, damit die Sprache beim Anzeigen gilt, nicht beim Laden des Moduls.
const noBuiltinMove = () => t('Standardvorlagen lassen sich nicht verschieben – „Kopieren“ legt eine eigene Version in einer Sammlung an.');
const noFixedCollection = () => t('„Standard“ und „Meine Sammlung“ lassen sich nicht ändern oder löschen.');
const noFixedDelete = () => t('„Standard“ und „Meine Sammlung“ lassen sich nicht löschen.');
const noBuiltinDelete = () => t('Standardvorlagen lassen sich nicht löschen – „Kopieren“ legt eine eigene Version in einer Sammlung an.');

const tooManyCollections = () => t('Höchstens {max} Sammlungen.', { max: MAX_COLLECTIONS });
// Eigene Sammlungen ohne „Standard“ und „Meine Sammlung“ – das zählt auch parseBundle.
const userCollectionCount = collections => collections.filter(c => !c.readOnly && c.id !== MEINE_ID).length;

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
    const r = await run(t('Case konnte nicht gespeichert werden'), () => repo.writeCases({
      upserts: [value], touchIds: target.created ? [target.id] : [], collections,
    }));
    if (!r.ok) return undefined;
    store.update(s => ({ ...setCollections(s, collections), cases: [...s.cases.filter(x => x.id !== value.id), value] }));
    return value;
  }
  const saveCase = rawValue => serial(() => saveCaseNow(rawValue));

  // Gelöschte Cases auch aus der mitgeführten Kopie der Pläne im Store nehmen (ohne Undo-Eintrag,
  // `store.update` ohne history): sonst füllte bestandOf die Lücke aus dem alten Stand, das Case
  // käme mit dem Hinweis „Aus der Projektdatei“ zurück und beim nächsten Speichern in die Datenbank.
  const ohneKopie = (st, caseIds) => {
    const fix = p => ohneIds(p, { cases: caseIds });
    const plans = st.plans.map(fix);
    return { plans: plans.some((p, i) => p !== st.plans[i]) ? plans : st.plans, ...(st.plan ? { plan: fix(st.plan) } : {}) };
  };

  // `confirmed`: die Rückfrage kam schon (Editor bzw. Sammlung-löschen-Dialog).
  async function removeFromStock(c, { confirmed = false } = {}) {
    if (!c) return false;
    const d = deletionFor(c);
    if (!d) { await showAlert(noBuiltinDelete()); return false; }
    if (!confirmed) {
      const used = usage(store.get(), c.id);
      const msg = used ? (used === 1 ? t('„{name}“ wird in 1 Ladeplan verwendet. Trotzdem löschen?', { name: c.name }) : t('„{name}“ wird in {used} Ladeplänen verwendet. Trotzdem löschen?', { name: c.name, used })) : t('„{name}“ löschen?', { name: c.name });
      if (!await showConfirm(msg, { okLabel: t('Löschen'), danger: true })) return false;
    }
    return serial(async () => {
      // Frisch lesen: ein vorher eingereihtes Umbenennen/Verschieben darf nicht zurückgedreht werden.
      const fresh = store.get().cases.find(x => x.id === c.id);
      if (!fresh) return true;
      const dNow = deletionFor(fresh);
      if (!dNow) { await showAlert(noBuiltinDelete()); return false; }
      if (dNow.save) return !!await saveCaseNow(dNow.save);
      const r = await run(t('Case konnte nicht gelöscht werden'), () => repo.writeCases({ removeIds: [dNow.remove], collections: store.get().collections }));
      if (!r.ok) return false;
      store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== dNow.remove), ...ohneKopie(st, [dNow.remove]) }));
      return true;
    });
  }

  // „Original wiederherstellen“: die Überlagerung eines mitgelieferten Listen-Cases (bearbeitet,
  // verschoben oder ausgeblendet) wird entfernt, danach gilt wieder die Fassung aus data/meine.json
  // und bekommt künftige Korrekturen. Rückfrage vorab, außerhalb der Warteschlange.
  async function restoreOriginal(caseId) {
    const pre = store.get().cases.find(x => x.id === caseId);
    if (!originalOf(pre, CASE_LIBRARY)) { await showAlert(t('Zu diesem Case gibt es keine mitgelieferte Fassung.')); return false; }
    const used = usage(store.get(), caseId);
    const usedNote = used ? ` ${used === 1 ? t('Es wird in 1 Ladeplan verwendet; die Stücke bleiben, ihre Maße ändern sich mit.') : t('Es wird in {used} Ladeplänen verwendet; die Stücke bleiben, ihre Maße ändern sich mit.', { used })}` : '';
    if (!await showConfirm(t('„{name}“ auf die mitgelieferte Fassung zurücksetzen? Eigene Änderungen, Verschiebung und Ausblenden gehen verloren.', { name: pre.name }) + usedNote, { okLabel: t('Wiederherstellen'), danger: true })) return false;
    return serial(async () => {
      const st = store.get();
      const fresh = st.cases.find(x => x.id === caseId);
      const original = originalOf(fresh, CASE_LIBRARY);
      if (!original) return true; // inzwischen schon zurückgesetzt
      const r = await run(t('Original konnte nicht wiederhergestellt werden'), () => repo.writeCases({ removeIds: [caseId], collections: st.collections }));
      if (!r.ok) return false;
      store.update(s => ({ ...s, cases: [...s.cases.filter(x => x.id !== caseId), original] }));
      return true;
    });
  }

  const createCollection = (name, parentId = null) => serial(async () => {
    const st = store.get();
    const err = collectionNameError(name, st.collections) ?? parentError(st.collections, null, parentId);
    if (err) { await showAlert(err); return null; }
    if (userCollectionCount(st.collections) >= MAX_COLLECTIONS) { await showAlert(tooManyCollections()); return null; }
    const meta = stamp({ id: uid(), name: name.trim(), ...(parentId ? { parentId } : {}) });
    const collections = withBuiltins([...st.collections, meta]);
    const r = await run(t('Sammlung konnte nicht angelegt werden'), () => repo.writeCases({ touchIds: [meta.id], collections }));
    if (!r.ok) return null;
    store.update(s => ({ ...s, collections }));
    return meta.id;
  });

  const renameCollection = (id, name) => serial(async () => {
    const st = store.get();
    if (!ownMeta(st, id)) { await showAlert(noFixedCollection()); return false; }
    const err = collectionNameError(name, st.collections, id);
    if (err) { await showAlert(err); return false; }
    const to = name.trim();
    const collections = withBuiltins(st.collections.map(c => (c.id === id ? stamp({ ...c, name: to }) : c)));
    // `company` einer eigenen Sammlung ist ihr Name; die Cases ziehen mit.
    const renamed = st.cases.filter(c => c.collectionId === id).map(c => stamp({ ...c, company: to }));
    const r = await run(t('Sammlung konnte nicht umbenannt werden'), () => repo.writeCases({ upserts: renamed, touchIds: [id], collections }));
    if (!r.ok) return false;
    const ids = new Set(renamed.map(c => c.id));
    store.update(s => ({ ...s, collections, cases: [...s.cases.filter(x => !ids.has(x.id)), ...renamed] }));
    return true;
  });

  const moveCollection = (id, parentId) => serial(async () => {
    const st = store.get();
    if (!ownMeta(st, id)) { await showAlert(noFixedCollection()); return false; }
    const err = parentError(st.collections, id, parentId);
    if (err) { await showAlert(err); return false; }
    const collections = withBuiltins(st.collections.map(c => {
      if (c.id !== id) return c;
      const { parentId: _p, ...rest } = c;
      return stamp({ ...rest, ...(parentId ? { parentId } : {}) });
    }));
    const r = await run(t('Sammlung konnte nicht verschoben werden'), () => repo.writeCases({ touchIds: [id], collections }));
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
    if (!meta0) { await showAlert(noFixedDelete()); return false; }
    const { gone: gone0, inside: inside0 } = insideOf(pre);
    const used = inside0.reduce((n, c) => n + usage(pre, c.id), 0);
    const usedNote = used ? ` ${used === 1 ? t('Die Einträge werden in 1 Ladeplan verwendet.') : t('Die Einträge werden in {used} Ladeplänen verwendet.', { used })}` : '';
    const question = gone0.size > 1
      ? t('Sammlung „{name}“ mit {n} Einträgen und {sub} Untersammlungen löschen?', { name: meta0.name, n: inside0.length, sub: gone0.size - 1 })
      : t('Sammlung „{name}“ mit {n} Einträgen löschen?', { name: meta0.name, n: inside0.length });
    if (!await showConfirm(question + usedNote, { okLabel: t('Löschen'), danger: true })) return false;
    return serial(async () => {
      const st = store.get();
      if (!ownMeta(st, id)) { await showAlert(noFixedDelete()); return false; }
      const { gone, inside } = insideOf(st);
      const ds = inside.map(deletionFor);
      if (ds.includes(null)) { await showAlert(noBuiltinDelete()); return false; }
      // Die Überlagerung behält `company` (Name der gelöschten Sammlung): so bleibt die Anzeige
      // „· Name“ und die Dolly-/Traversen-Zuordnung alter Pläne erhalten.
      const hidden = ds.filter(d => d.save).map(d => stamp({ ...d.save, collectionId: MEINE_ID }));
      const collections = withBuiltins(st.collections.filter(c => !gone.has(c.id)));
      const r = await run(t('Sammlung konnte nicht gelöscht werden'), () => repo.writeCases({ upserts: hidden, deleteCollectionIds: [...gone], collections }));
      if (!r.ok) return false;
      const keep = new Set(hidden.map(c => c.id));
      const removedIds = ds.filter(d => d.remove).map(d => d.remove);
      store.update(s => ({
        ...s, collections, ...ohneKopie(s, removedIds),
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
    if (c.builtin && c.id.startsWith('preset-')) { await showAlert(noBuiltinMove()); return false; }
    if (collectionIdOf(c) === target.id) return true;
    return !!await saveCaseNow(stamp(moveCase(c, target, CASE_LIBRARY.find(x => x.id === c.id))));
  });

  // Eine eingelesene Sammlungsdatei (parseCollectionFile). Gleiche ID: Cases werden gemischt, ein
  // lokal neuerer Stand bleibt. Liefert die Meta der betroffenen Sammlung oder null.
  // Erst mischen, dann stempeln: stamp() würde den updatedAt des Imports überschreiben.
  const importCollectionFile = file => serial(async () => {
    const st = store.get();
    const plan = planCollectionImport(st.collections, file, uid);
    // Eine neue Sammlung über der Grenze würde die eigene Sicherung unlesbar machen (parseBundle).
    if (userCollectionCount(plan.merged) > Math.max(MAX_COLLECTIONS, userCollectionCount(st.collections))) {
      await showAlert(tooManyCollections());
      return null;
    }
    const local = new Map(st.cases.map(c => [c.id, c]));
    const upserts = plan.cases.filter(c => {
      const cur = local.get(c.id);
      return !cur || cur.builtin || typeof c.updatedAt !== 'string' || typeof cur.updatedAt !== 'string' || c.updatedAt >= cur.updatedAt;
    }).map(c => stamp(c));
    const r = await run(t('Sammlung konnte nicht importiert werden'), () => repo.writeCases({ upserts, touchIds: [plan.meta.id], collections: plan.merged }));
    if (!r.ok) return null;
    const ids = new Set(upserts.map(c => c.id));
    store.update(s => ({ ...s, collections: plan.merged, cases: [...s.cases.filter(x => !ids.has(x.id)), ...upserts] }));
    return plan.meta;
  });

  const ORT = {
    projekt: { key: 'projectRuleSets', save: rs => repo.saveProjectRuleSet(rs), del: id => repo.deleteProjectRuleSet(id) },
    bibliothek: { key: 'ruleSets', save: rs => repo.saveRuleSet(rs), del: id => repo.deleteRuleSet(id) },
  };

  async function saveRuleSet(name, rules, mixTop, ort = 'bibliothek') {
    const o = ORT[ort] ?? ORT.bibliothek;
    const existing = (store.get()[o.key] ?? []).find(r => r.name.toLowerCase() === name.toLowerCase());
    if (existing && !await showConfirm(t('Regelset „{name}“ überschreiben?', { name: existing.name }), { okLabel: t('Überschreiben'), danger: true })) return undefined;
    const value = stamp({ id: existing?.id ?? uid(), name, rules, ...(mixTop ? { mixTop: true } : {}) });
    const r = await run(t('Regelset konnte nicht gespeichert werden'), () => o.save(value));
    if (!r.ok) return undefined;
    store.update(s => ({ ...s, [o.key]: [...(s[o.key] ?? []).filter(x => x.id !== value.id), value] }));
    return value;
  }

  async function deleteRuleSet(id, ort = 'bibliothek') {
    const o = ORT[ort] ?? ORT.bibliothek;
    const set = (store.get()[o.key] ?? []).find(x => x.id === id);
    if (set && !await showConfirm(t('Regelset „{name}“ löschen?', { name: set.name }), { okLabel: t('Löschen'), danger: true })) return false;
    const r = await run(t('Regelset konnte nicht gelöscht werden'), () => o.del(id));
    if (!r.ok) return false;
    store.update(s => ({ ...s, [o.key]: (s[o.key] ?? []).filter(x => x.id !== id) }));
    return true;
  }

  // Speichert das Fahrzeug und liefert den gestempelten Wert (undefined bei Fehler).
  async function saveTruck(rawValue) {
    const value = stamp(rawValue);
    const r = await run(t('Fahrzeug konnte nicht gespeichert werden'), () => repo.saveTruck(value));
    if (!r.ok) return undefined;
    store.update(s => ({ ...s, trucks: [...s.trucks.filter(tk => tk.id !== value.id), value] }));
    return value;
  }

  // Löscht das Fahrzeug und biegt alle ANDEREN Pläne (nicht den aktuellen – das macht der
  // Aufrufer über edit()) und deren LKW (plan.lkws) auf den Standardtruck um, sonst schöbe ctx() ihnen
  // still den Sattelauflieger unter. Liefert false, wenn das Löschen selbst scheiterte.
  async function deleteTruck(truckId) {
    const r = await run(t('Fahrzeug konnte nicht gelöscht werden'), () => repo.deleteTruck(truckId));
    if (!r.ok) return false;
    const s1 = store.get();
    const fixPlan = p => repointTruck(p, truckId, DEFAULT_TRUCK_ID);
    const fixedOthers = s1.plans.map(fixPlan);
    const changedOthers = fixedOthers.filter((p, i) => p !== s1.plans[i]);
    store.update(s => ({ ...s, trucks: s.trucks.filter(tk => tk.id !== truckId), plans: fixedOthers }));
    if (changedOthers.length) {
      try {
        await Promise.all(changedOthers.map(repo.savePlan));
      } catch (err) {
        // Unbehandelt hätte das eine tote Rejection UND einen toten truckId-Verweis
        // hinterlassen.
        const detail = err?.message ?? t('unbekannter Fehler');
        const n = changedOthers.length;
        await showAlert(n === 1 ? t('Fahrzeug gelöscht, aber 1 Plan konnte nicht aktualisiert werden: {detail}. Bitte prüfen und ggf. erneut speichern.', { detail }) : t('Fahrzeug gelöscht, aber {n} Pläne konnten nicht aktualisiert werden: {detail}. Bitte prüfen und ggf. erneut speichern.', { n, detail }));
      }
    }
    return true;
  }

  return {
    enqueue: serial,
    saveCase, removeFromStock, createCollection, renameCollection, moveCollection, deleteCollection,
    moveCaseTo, restoreOriginal, importCollectionFile, saveRuleSet, deleteRuleSet, saveTruck, deleteTruck,
  };
}
