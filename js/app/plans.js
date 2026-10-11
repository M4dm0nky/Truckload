// Plan-Verwaltung: reine Zustandsübergänge beim Wechseln und Löschen sowie die Verdrahtung der
// Plan-Knöpfe (Auswahl, Neu, Umbenennen, Duplizieren, Löschen) samt Lade-Wizard. Kein Import
// von js/app.js; alles Übrige kommt als Parameter.
import * as A from '../model/actions.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { ruleTargets } from '../model/packRules.js';
import { openLoadWizard } from '../ui/load-wizard.js';
import { NAME_MAX } from '../model/limits.js';
import { guarded } from './guarded.js';
import { piecesOf, activeLkwOf } from './core.js';
import { isMultiLkw } from '../model/lkw.js';

export const MULTI_ADDED_NOTICE = 'Das neue Material ist noch keinem LKW zugeordnet. „Alles neu packen“ verteilt es auf die LKW.';

const $ = sel => document.querySelector(sel);

// Neuer aktiver Plan. Der bisherige (falls es einen gibt) wandert in `plans`; ohne aktiven Plan
// (Startbildschirm) kommt kein null dorthin.
export function switchPlanState(s, plan) {
  return {
    ...s,
    plans: [...(s.plan ? [s.plan] : []), ...s.plans.filter(p => p.id !== s.plan?.id && p.id !== plan.id)],
    plan,
    selectedId: null,
    // Reiter: erster LKW des neuen Plans (null bei Ein-LKW-Plänen).
    activeLkw: activeLkwOf(plan, null),
  };
}

// Name der Kopie: „(Kopie)“ anhängen, den Originalnamen aber so weit kürzen, dass das Ergebnis in
// NAME_MAX passt – sonst wäre die eigene Sicherung nicht importierbar.
const COPY_SUFFIX = ' (Kopie)';
export const copyName = name => `${name.slice(0, NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;

// Nach dem Löschen des aktiven Plans: ein übriger Plan wird aktiv, der letzte führt zurück zum
// Startbildschirm (plan: null) statt automatisch einen leeren Plan anzulegen.
export function deletePlanState(s) {
  const rest = s.plans.filter(p => p.id !== s.plan.id);
  const next = rest[0] ?? null;
  return { ...s, plans: rest.filter(p => p.id !== next?.id), plan: next, selectedId: null, activeLkw: activeLkwOf(next, null) };
}

// Löscht den Plan in der Datenbank. Zuerst `autosave.flush()`: eine ausstehende Änderung wird
// fertig geschrieben, bevor gelöscht wird – sonst schriebe der Autosave-Timer sie danach wieder
// hinein. Erst NACH dem erfolgreichen Löschen `forget` (schlüge deletePlan fehl, bliebe der Plan
// bestehen und sein ausstehender Stand ginge verloren).
export async function removePlanPersisted(planId, { autosave, repo, showAlert }) {
  await autosave.flush();
  const r = await guarded('Löschen fehlgeschlagen', () => repo.deletePlan(planId), { showAlert });
  if (r.ok) autosave.forget(planId);
  return r;
}

// deps: store, editWhole, ctx, autosave, repo, stamp, uid, showAlert/showConfirm/showPrompt,
// warnIfUnplaced, saveCase, newCaseForWizard, openMaterialFromWizard.
// Liefert { switchPlan, runLoadWizard }.
export function wirePlans(deps) {
  const { store, edit, editWhole, ctx, autosave, repo, stamp, uid, showAlert, showConfirm, showPrompt,
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
    // Planweit: neues Material ist bei Mehr-LKW-Plänen keinem LKW zugeordnet (Spec), auch nicht dem
    // gewählten Reiter. Ein-LKW-Plan: wie bisher.
    const multi = isMultiLkw(store.get().plan);
    editWhole((p, c) => {
      let next = res.items.reduce((pl, it) =>
        A.addUnplaced(pl, it.caseId, 1, uid, {
          labels: it.label ? [it.label] : [],
          color: it.color ?? null,
          layers: it.layers,
          tipped: it.tipped,
          group: it.group,
        }), p);
      if (res.autoPack && !multi) next = A.packRest(next, c);
      return next;
    });
    // Mehr-LKW: neues Material ist immer unzugeordnet (auch ohne Autopack) – das sagt der Hinweis.
    if (multi && res.items.length) await showAlert(MULTI_ADDED_NOTICE);
    else if (res.autoPack) await warnIfUnplaced();
  }

  $('#plan-select').onchange = e => {
    const next = store.get().plans.find(p => p.id === e.target.value);
    if (next) switchPlan(next);
  };
  $('#plan-new').onclick = () => runLoadWizard('new');
  $('#plan-rename').onclick = async () => {
    const name = await showPrompt('Neuer Name:', store.get().plan.name, { maxlength: NAME_MAX });
    if (name?.trim()) edit(p => stamp({ ...p, name: name.trim() }));
  };
  $('#plan-dup').onclick = () => {
    const p = store.get().plan;
    switchPlan(stamp({ ...structuredClone(p), id: uid(), name: copyName(p.name) }));
  };
  $('#plan-del').onclick = async () => {
    const s = store.get();
    if (!await showConfirm(`Ladeplan „${s.plan.name}“ löschen?`, { okLabel: 'Löschen', danger: true })) return;
    if (!(await removePlanPersisted(s.plan.id, { autosave, repo, showAlert })).ok) return;
    // Nur plans/plan aus dem Schnappschuss vor dem await übernehmen; der übrige aktuelle Zustand bleibt.
    const after = deletePlanState(s);
    if (after.plan) autosave.markKnown(after.plan);
    store.update(st => ({ ...st, plans: after.plans, plan: after.plan, selectedId: null, activeLkw: after.activeLkw }));
    store.resetHistory();
  };

  return { switchPlan, runLoadWizard };
}
