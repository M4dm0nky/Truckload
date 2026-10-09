// Plan-Verwaltung: reine Zustandsübergänge beim Wechseln und Löschen sowie die Verdrahtung der
// Plan-Knöpfe (Auswahl, Neu, Umbenennen, Duplizieren, Löschen) samt Lade-Wizard. Kein Import
// von js/app.js; alles Übrige kommt als Parameter.
import * as A from '../model/actions.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { ruleTargets } from '../model/packRules.js';
import { openLoadWizard } from '../ui/load-wizard.js';
import { guarded } from './guarded.js';
import { piecesOf } from './core.js';

const $ = sel => document.querySelector(sel);

// Neuer aktiver Plan. Der bisherige (falls es einen gibt) wandert in `plans`; ohne aktiven Plan
// (Startbildschirm) kommt kein null dorthin.
export function switchPlanState(s, plan) {
  return {
    ...s,
    plans: [...(s.plan ? [s.plan] : []), ...s.plans.filter(p => p.id !== s.plan?.id && p.id !== plan.id)],
    plan,
    selectedId: null,
  };
}

// Nach dem Löschen des aktiven Plans: ein übriger Plan wird aktiv, der letzte führt zurück zum
// Startbildschirm (plan: null) statt automatisch einen leeren Plan anzulegen.
export function deletePlanState(s) {
  const rest = s.plans.filter(p => p.id !== s.plan.id);
  const next = rest[0] ?? null;
  return { ...s, plans: rest.filter(p => p.id !== next?.id), plan: next, selectedId: null };
}

// deps: store, edit, ctx, autosave, repo, stamp, uid, showAlert/showConfirm/showPrompt,
// warnIfUnplaced, saveCase, newCaseForWizard, openMaterialFromWizard.
// Liefert { switchPlan, runLoadWizard }.
export function wirePlans(deps) {
  const { store, edit, ctx, autosave, repo, stamp, uid, showAlert, showConfirm, showPrompt,
    warnIfUnplaced, saveCase, newCaseForWizard, openMaterialFromWizard } = deps;

  // Ein reiner Wechsel zu einem schon bekannten Plan ist keine Änderung AN ihm: markKnown()
  // läuft deshalb VOR dem store.update(), damit der Autosave den Wechsel nicht als „geändert“
  // wertet. Sonst schriebe er 400 ms später den lokal zwischengespeicherten, womöglich
  // veralteten Plan zurück und überschriebe so die Änderung eines zweiten Tabs.
  // Ein wirklich neuer, nie gespeicherter Plan (Duplikat, Wizard „Neu“) ist dagegen nicht
  // bekannt und bekommt sein erstes Speichern über den normalen Mechanismus.
  function switchPlan(plan) {
    autosave.flush();
    const cur = store.get().plan;
    const known = cur?.id === plan.id || store.get().plans.some(p => p.id === plan.id);
    if (known) autosave.markKnown(plan);
    store.update(s => switchPlanState(s, plan));
    store.resetHistory();
  }

  async function runLoadWizard(mode) {
    const s = store.get();
    // Im Startbildschirm gibt es noch keinen Plan, ctx() würde daran scheitern.
    const res = await openLoadWizard($('#dlg-wizard'), {
      mode,
      cases: s.cases,
      trucks: s.trucks,
      defaultTruckId: s.plan ? ctx().truck.id : DEFAULT_TRUCK_ID,
      defaultName: `Load ${new Date().toLocaleDateString('de-DE')}`,
      onNewCase: newCaseForWizard,
      onOpenMaterial: openMaterialFromWizard,
      trussDlg: $('#dlg-truss'),
      onNewTruss: saveCase,
      dollyDlg: $('#dlg-dolly'),
      onNewDollyStack: saveCase,
      // Ein neuer Load hat noch keinen Plan, dessen Gruppen sich vorschlagen ließen.
      groups: mode === 'add' && s.plan ? ruleTargets(piecesOf(s.plan), ctx().caseById).groups : [],
    });
    if (!res) return;
    if (mode === 'new') switchPlan(A.emptyPlan(uid(), res.name, res.truckId));
    edit((p, c) => {
      let next = res.items.reduce((pl, it) =>
        A.addUnplaced(pl, it.caseId, 1, uid, {
          labels: it.label ? [it.label] : [],
          color: it.color ?? null,
          layers: it.layers,
          tipped: it.tipped,
          group: it.group,
        }), p);
      if (res.autoPack) next = A.packRest(next, c);
      return next;
    });
    if (res.autoPack) await warnIfUnplaced();
  }

  $('#plan-select').onchange = e => {
    const next = store.get().plans.find(p => p.id === e.target.value);
    if (next) switchPlan(next);
  };
  $('#plan-new').onclick = () => runLoadWizard('new');
  $('#plan-rename').onclick = async () => {
    const name = await showPrompt('Neuer Name:', store.get().plan.name);
    if (name?.trim()) edit(p => stamp({ ...p, name: name.trim() }));
  };
  $('#plan-dup').onclick = () => {
    const p = store.get().plan;
    switchPlan(stamp({ ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)` }));
  };
  $('#plan-del').onclick = async () => {
    const s = store.get();
    if (!await showConfirm(`Ladeplan „${s.plan.name}“ löschen?`, { okLabel: 'Löschen', danger: true })) return;
    if (!(await guarded('Löschen fehlgeschlagen', () => repo.deletePlan(s.plan.id), { showAlert })).ok) return;
    // Erst NACH dem erfolgreichen Löschen die ausstehende Speicherung verwerfen: schlüge
    // deletePlan fehl, bliebe der Plan bestehen und sein ausstehender Stand ginge verloren.
    autosave.forget(s.plan.id);
    const after = deletePlanState(s);
    if (after.plan) autosave.markKnown(after.plan);
    store.update(st => ({ ...st, plans: after.plans, plan: after.plan, selectedId: null }));
    store.resetHistory();
  };

  return { switchPlan, runLoadWizard };
}
