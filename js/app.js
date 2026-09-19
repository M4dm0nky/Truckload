import { APP_VERSION } from './version.js';
import * as repo from './store/repo.js';
import { createStore } from './state.js';
import { validatePlan } from './model/validate.js';
import * as A from './model/actions.js';
import { DEFAULT_TRUCK_ID } from './data/preset-trucks.js';
import { renderView, attachTopInteractions, attachSelect } from './ui/view2d.js';
import { mountLibrary } from './ui/library.js';
import { openCaseEditor } from './ui/case-editor.js';
import { stamp } from './store/repo.js';
import { renderInspector } from './ui/inspector.js';
import { openTruckEditor } from './ui/truck-editor.js';
import { esc } from './ui/dom.js';
import { createView3d } from './ui/view3d.js';
import { buildPrint } from './ui/print.js';
import { exportBundle, parseBundle, mergeById, backupFileName } from './store/io.js';

const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

const data = await repo.loadAll();
const latest = [...data.plans].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
const initialPlan = latest ?? A.emptyPlan(uid(), 'Neuer Ladeplan', DEFAULT_TRUCK_ID);

export const store = createStore({
  cases: data.cases, trucks: data.trucks, plans: data.plans,
  plan: initialPlan, selectedId: null, mode: '2d',
});

export function ctx(s = store.get()) {
  return {
    caseById: new Map(s.cases.map(c => [c.id, c])),
    truck: s.trucks.find(t => t.id === s.plan.truckId) ?? s.trucks.find(t => t.id === DEFAULT_TRUCK_ID),
    newId: uid,
  };
}
export function derive(s = store.get()) {
  const c = ctx(s);
  return { ...c, result: validatePlan(s.plan, c.caseById, c.truck) };
}
export function edit(fn, history = true) {
  store.update(s => {
    const next = fn(s.plan, ctx(s));
    return next === s.plan ? s : { ...s, plan: next };
  }, { history });
}
export const select = id => store.update(s => (s.selectedId === id ? s : { ...s, selectedId: id }));

let frame = 0;
export function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; render(); });
}

function render() {
  const s = store.get();
  const d = derive(s);
  const opts = { truck: d.truck, result: d.result, selectedId: s.selectedId };
  if (s.mode === '2d') {
    renderView($('#svg-top'), 'top', opts);
    renderView($('#svg-side'), 'side', opts);
    renderView($('#svg-rear'), 'rear', opts);
  }
  for (const fn of renderHooks) fn(s, d);
}
export const renderHooks = []; // Task 10–13 hängen hier Bibliothek, Inspector, Toolbar, 3D an

let saveTimer;
let lastSaved = store.get().plan;
store.subscribe(s => {
  scheduleRender();
  clearTimeout(saveTimer);
  if (s.plan === lastSaved) return;
  saveTimer = setTimeout(() => { lastSaved = s.plan; repo.savePlan(s.plan); }, 400);
});

const usage = (s, caseId) => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .filter(p => [...p.placements, ...p.unplaced].some(x => x.caseId === caseId)).length;

async function editCase(caseId) {
  const s = store.get();
  const c = caseId ? s.cases.find(x => x.id === caseId) : null;
  const res = await openCaseEditor($('#dlg-case'), c, { usedIn: caseId ? usage(s, caseId) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    await repo.deleteCase(caseId);
    store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== caseId) }));
  } else {
    const value = stamp(res.value);
    await repo.saveCase(value);
    store.update(st => ({ ...st, cases: [...st.cases.filter(x => x.id !== value.id), value] }));
  }
}

const library = mountLibrary($('#library'), {
  onNew: () => editCase(null),
  onEdit: id => editCase(id),
  onAdd: id => {
    const n = Number.parseInt(prompt('Wie viele Stück in die Ablage legen?', '1') ?? '', 10);
    if (n > 0 && n <= 500) edit((p) => A.addUnplaced(p, id, n, uid));
  },
  onTrayRemove: id => edit(p => A.removeUnplaced(p, id)),
});
renderHooks.push(s => library.update(s));

attachTopInteractions($('#svg-top'), {
  getTruck: () => ctx().truck,
  getItem: id => derive().result.items.find(it => it.id === id),
  onSelect: select,
  onDragStart: () => store.checkpoint(),
  onDrag: (id, x, y) => edit((p, c) => A.moveGroup(p, id, x, y, c), false),
  onDropCase: ({ caseId, unplacedId }, x, y) => {
    const c = ctx().caseById.get(caseId);
    if (!c) return;
    edit((p, cx) => A.placeCase(p, caseId, x - c.l / 2, y - c.w / 2, cx, unplacedId));
  },
});
attachSelect($('#svg-side'), select);
attachSelect($('#svg-rear'), select);

// Inspector
renderHooks.push((s, d) => {
  const selected = d.result.items.find(it => it.id === s.selectedId) ?? null;
  renderInspector($('#inspector'), { selected, result: d.result, truck: d.truck });
});
const withSel = fn => { const id = store.get().selectedId; if (id) fn(id); };
const ACTIONS = {
  rotate: id => edit((p, c) => A.rotate(p, id, c)),
  tip: id => edit((p, c) => A.cycleTip(p, id, c)),
  dup: id => edit((p, c) => A.duplicate(p, id, c)),
  tray: id => { edit(p => A.toTray(p, id)); select(null); },
  delete: id => { edit(p => A.removePlacement(p, id)); select(null); },
  'edit-case': id => editCase(store.get().plan.placements.find(p => p.id === id)?.caseId),
};
$('#inspector').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) return withSel(ACTIONS[act]);
  const target = e.target.closest('[data-select]')?.dataset.select;
  if (target) select(target);
});

// Tastatur
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
  if (e.key === 'Escape') return select(null);
  const key = { r: 'rotate', t: 'tip', d: 'dup', Delete: 'delete', Backspace: 'delete' }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (key && !mod) { e.preventDefault(); return withSel(ACTIONS[key]); }
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (arrow) withSel(id => {
    e.preventDefault();
    const step = e.shiftKey ? 1 : 5;
    const p = store.get().plan.placements.find(q => q.id === id);
    edit((pl, c) => A.moveGroup(pl, id, p.x + arrow[0] * step, p.y + arrow[1] * step, c, { grid: step, edges: false }));
  });
});

// Undo/Redo, Modus, Auto-Pack
$('#undo').onclick = () => store.undo();
$('#redo').onclick = () => store.redo();
$('#pack-all').onclick = () => {
  const s = store.get();
  if (s.plan.placements.length && !confirm('Alle Cases neu anordnen? (Rückgängig mit ⌘Z möglich)')) return;
  edit((p, c) => A.packAll(p, c));
};
$('#pack-rest').onclick = () => edit((p, c) => A.packRest(p, c));
function setMode(mode) {
  store.update(s => ({ ...s, mode }));
  $('#views2d').hidden = mode !== '2d';
  $('#view3d').hidden = mode !== '3d';
  $('#mode-2d').classList.toggle('on', mode === '2d');
  $('#mode-3d').classList.toggle('on', mode === '3d');
}
$('#mode-2d').onclick = () => setMode('2d');
$('#mode-3d').onclick = () => setMode('3d');

// Toolbar-Zustand: Planliste, Fahrzeugliste, Undo-Buttons
const allPlans = s => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));
renderHooks.push((s, d) => {
  $('#plan-select').innerHTML = allPlans(s).map(p =>
    `<option value="${esc(p.id)}" ${p.id === s.plan.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  $('#truck-select').innerHTML = s.trucks.map(t =>
    `<option value="${esc(t.id)}" ${t.id === d.truck.id ? 'selected' : ''}>${esc(t.name)}${t.builtin ? '' : ' ★'} – ${t.l}×${t.w}×${t.h}</option>`).join('');
  $('#undo').disabled = !store.canUndo();
  $('#redo').disabled = !store.canRedo();
});

// Ladepläne
function switchPlan(plan) {
  // ausstehende Änderungen des bisherigen Plans sofort sichern
  const current = store.get().plan;
  clearTimeout(saveTimer);
  if (current !== lastSaved) { lastSaved = current; repo.savePlan(current); }
  store.update(s => ({ ...s, plans: [s.plan, ...s.plans.filter(p => p.id !== s.plan.id && p.id !== plan.id)], plan, selectedId: null }));
  store.resetHistory();
}
$('#plan-select').onchange = e => {
  const next = store.get().plans.find(p => p.id === e.target.value);
  if (next) switchPlan(next);
};
$('#plan-new').onclick = () => {
  const name = prompt('Name des Ladeplans (z. B. Show / Datum / Truck 1):', 'Neuer Ladeplan');
  if (name?.trim()) switchPlan(A.emptyPlan(uid(), name.trim(), ctx().truck.id));
};
$('#plan-rename').onclick = () => {
  const name = prompt('Neuer Name:', store.get().plan.name);
  if (name?.trim()) edit(p => ({ ...p, name: name.trim(), updatedAt: new Date().toISOString() }));
};
$('#plan-dup').onclick = () => {
  const p = store.get().plan;
  switchPlan({ ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)`, updatedAt: new Date().toISOString() });
};
$('#plan-del').onclick = async () => {
  const s = store.get();
  if (!confirm(`Ladeplan „${s.plan.name}“ löschen?`)) return;
  clearTimeout(saveTimer); // sonst speichert der Autosave den gelöschten Plan erneut
  await repo.deletePlan(s.plan.id);
  const rest = s.plans.filter(p => p.id !== s.plan.id);
  const next = rest[0] ?? A.emptyPlan(uid(), 'Neuer Ladeplan', DEFAULT_TRUCK_ID);
  store.update(st => ({ ...st, plans: rest.filter(p => p.id !== next.id), plan: next, selectedId: null }));
  store.resetHistory();
};

// Fahrzeuge
$('#truck-select').onchange = e => edit(p => ({ ...p, truckId: e.target.value, updatedAt: new Date().toISOString() }));
const truckUsage = (s, truckId) => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .filter(p => p.truckId === truckId).length;

async function editTruck(truck) {
  const s0 = store.get();
  const res = await openTruckEditor($('#dlg-truck'), truck, { usedIn: truck ? truckUsage(s0, truck.id) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    await repo.deleteTruck(truck.id);
    const usedByCurrent = store.get().plan.truckId === truck.id;
    store.update(s => ({ ...s, trucks: s.trucks.filter(t => t.id !== truck.id) }));
    if (usedByCurrent) edit(p => ({ ...p, truckId: DEFAULT_TRUCK_ID, updatedAt: new Date().toISOString() }));
    return;
  }
  const value = stamp(res.value);
  await repo.saveTruck(value);
  store.update(s => ({ ...s, trucks: [...s.trucks.filter(t => t.id !== value.id), value] }));
  edit(p => ({ ...p, truckId: value.id, updatedAt: new Date().toISOString() }));
}
$('#truck-new').onclick = () => editTruck(null);
$('#truck-edit').onclick = () => editTruck(ctx().truck);

// 3D-Ansicht
let view3d = null, view3dLoading = null;
renderHooks.push(async (s, d) => {
  if (s.mode !== '3d') return;
  try {
    view3d ??= await (view3dLoading ??= createView3d($('#view3d')));
    view3d.update({ truck: d.truck, result: d.result, selectedId: s.selectedId });
  } catch {
    $('#view3d').textContent = '3D-Ansicht konnte nicht geladen werden (vendor/ fehlt?).';
    view3d = null;
    view3dLoading = null;
  }
});

// Drucken, Sichern, Importieren
$('#print').onclick = () => {
  const s = store.get(), d = derive(s);
  buildPrint($('#print-root'), { plan: s.plan, truck: d.truck, result: d.result });
  window.print();
};

$('#export').onclick = () => {
  const s = store.get();
  const plans = [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)];
  const blob = new Blob([exportBundle({ cases: s.cases, trucks: s.trucks, plans })], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: backupFileName() });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('#import').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const b = parseBundle(await file.text());
    const s0 = store.get();
    const mergedCases = mergeById(s0.cases, b.cases);
    const mergedTrucks = mergeById(s0.trucks, b.trucks);
    const mergedPlans = mergeById([s0.plan, ...s0.plans], b.plans);
    const wonCases = b.cases.filter(x => mergedCases.find(m => m.id === x.id) === x);
    const wonTrucks = b.trucks.filter(x => mergedTrucks.find(m => m.id === x.id) === x);
    const wonPlans = b.plans.filter(x => mergedPlans.find(m => m.id === x.id) === x);
    await Promise.all([
      ...wonCases.map(repo.saveCase), ...wonTrucks.map(repo.saveTruck), ...wonPlans.map(repo.savePlan),
    ]);
    const planChanged = mergedPlans.find(p => p.id === s0.plan.id) !== s0.plan;
    store.update(s => ({
      ...s,
      cases: mergedCases,
      trucks: mergedTrucks,
      plans: mergedPlans.filter(p => p.id !== s.plan.id),
      plan: mergedPlans.find(p => p.id === s.plan.id) ?? s.plan,
    }));
    if (planChanged) store.resetHistory();
    alert(`Importiert: ${wonCases.length} Cases, ${wonTrucks.length} Fahrzeuge, ${wonPlans.length} Ladepläne (neuere lokale Stände behalten).`);
  } catch (err) {
    alert(`Import fehlgeschlagen: ${err.message}`);
  }
};

// Version sichtbar machen (einzige Quelle: js/version.js)
$('#app-version').textContent = `V ${APP_VERSION}`;
document.title = `Truckload V ${APP_VERSION}`;

scheduleRender();
