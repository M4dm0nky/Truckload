// Speicherpfade des Materialbestands, der Regelsets und der Fahrzeuge: erst in die Datenbank
// schreiben, danach den Store nachziehen. Schlägt das Schreiben fehl, bleibt der Store
// unverändert und es erscheint genau eine Meldung. Kein Import von js/app.js.
import { guarded } from './guarded.js';
import { usage } from './core.js';
import { casesOf, deletionFor, renameCompany } from '../model/material.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';

const NO_BUILTIN_DELETE = 'Standardvorlagen lassen sich nicht löschen – „Kopieren“ legt eine eigene Version in einer Firma an.';

// `repo`: saveCase/deleteCase/saveCases/saveAndDelete/saveRuleSet/deleteRuleSet/saveTruck/deleteTruck/savePlan.
// `stamp`: setzt den Änderungszeitpunkt. `uid`: neue IDs (nur für Regelsets).
export function createPersistence({ repo, store, showAlert, showConfirm, stamp, uid = () => crypto.randomUUID() }) {
  const run = (label, fn) => guarded(label, fn, { showAlert });

  async function saveCase(rawValue) {
    const value = stamp(rawValue);
    const r = await run('Case konnte nicht gespeichert werden', () => repo.saveCase(value));
    if (!r.ok) return undefined;
    store.update(st => ({ ...st, cases: [...st.cases.filter(x => x.id !== value.id), value] }));
    return value;
  }

  // `confirmed`: die Rückfrage kam schon (Editor bzw. Firma-löschen-Dialog).
  async function removeFromStock(c, { confirmed = false } = {}) {
    if (!c) return false;
    const d = deletionFor(c);
    if (!d) { await showAlert(NO_BUILTIN_DELETE); return false; }
    if (!confirmed) {
      const used = usage(store.get(), c.id);
      const msg = used ? `„${c.name}“ wird in ${used} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${c.name}“ löschen?`;
      if (!await showConfirm(msg, { okLabel: 'Löschen', danger: true })) return false;
    }
    if (d.save) return !!await saveCase(d.save);
    const r = await run('Case konnte nicht gelöscht werden', () => repo.deleteCase(d.remove));
    if (!r.ok) return false;
    store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== d.remove) }));
    return true;
  }

  async function renameCompanyTo(from, to) {
    const renamed = renameCompany(store.get().cases, from, to).map(stamp);
    const r = await run('Firma konnte nicht umbenannt werden', () => repo.saveCases(renamed));
    if (!r.ok) return false;
    const ids = new Set(renamed.map(c => c.id));
    store.update(st => ({ ...st, cases: [...st.cases.filter(x => !ids.has(x.id)), ...renamed] }));
    return true;
  }

  async function deleteCompany(name) {
    const list = casesOf(store.get().cases, name);
    if (list.length && !await showConfirm(`Firma „${name}“ mit ${list.length} Einträgen löschen?`, { okLabel: 'Löschen', danger: true })) return false;
    const ds = list.map(deletionFor);
    if (ds.includes(null)) { await showAlert(NO_BUILTIN_DELETE); return false; }
    const saves = ds.filter(d => d.save).map(d => stamp(d.save));
    const removes = ds.filter(d => d.remove).map(d => d.remove);
    // Überlagerungen und Entfernungen in EINER Transaktion: bei einem Fehler bleibt die Datenbank
    // (und damit der Store) unverändert, statt halb gelöscht zu sein.
    const r = await run('Firma konnte nicht gelöscht werden', () => repo.saveAndDelete({ saves, removeIds: removes }));
    if (!r.ok) return false;
    const savedIds = new Set(saves.map(c => c.id)), gone = new Set(removes);
    store.update(st => ({ ...st, cases: [...st.cases.filter(x => !savedIds.has(x.id) && !gone.has(x.id)), ...saves] }));
    return true;
  }

  async function saveRuleSet(name, rules, mixTop) {
    const existing = store.get().ruleSets.find(r => r.name.toLowerCase() === name.toLowerCase());
    const value = stamp({ id: existing?.id ?? uid(), name, rules, ...(mixTop ? { mixTop: true } : {}) });
    const r = await run('Regelset konnte nicht gespeichert werden', () => repo.saveRuleSet(value));
    if (!r.ok) return undefined;
    store.update(s => ({ ...s, ruleSets: [...s.ruleSets.filter(x => x.id !== value.id), value] }));
    return value;
  }

  async function deleteRuleSet(id) {
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
  // Aufrufer über edit()) auf den Standardtruck um, sonst schöbe ctx() ihnen
  // still den Sattelauflieger unter. Liefert false, wenn das Löschen selbst scheiterte.
  async function deleteTruck(truckId) {
    const r = await run('Fahrzeug konnte nicht gelöscht werden', () => repo.deleteTruck(truckId));
    if (!r.ok) return false;
    const s1 = store.get();
    const fixPlan = p => (p.truckId === truckId ? stamp({ ...p, truckId: DEFAULT_TRUCK_ID }) : p);
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

  return { saveCase, removeFromStock, renameCompany: renameCompanyTo, deleteCompany, saveRuleSet, deleteRuleSet, saveTruck, deleteTruck };
}
